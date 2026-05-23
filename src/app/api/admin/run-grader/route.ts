import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { processRoundResults } from '@/lib/contest-engine';
import { autoGradePendingPicks } from '@/lib/autoGrade';
import type { PickStatus } from '@/types';

export async function POST(_request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {

  // Auto-grade any pending picks for completed games before advancing rounds
  const picksGraded = await autoGradePendingPicks(supabase);

  // Find all open rounds with no pending picks — these need to be advanced
  const { data: openRounds } = await supabase
    .from('rounds')
    .select('id, pool_id, round_number, deadline, status, pools(*)')
    .eq('status', 'open');

  const roundsToAdvance: string[] = [];
  for (const r of openRounds ?? []) {
    const { count } = await supabase
      .from('picks')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', r.id)
      .eq('status', 'pending');
    if (count === 0) roundsToAdvance.push(r.id);
  }

  // Also add overdue rounds
  const { data: overdueRounds } = await supabase
    .from('rounds')
    .select('id')
    .neq('status', 'completed')
    .lt('deadline', new Date().toISOString());
  for (const r of overdueRounds ?? []) {
    if (!roundsToAdvance.includes(r.id)) roundsToAdvance.push(r.id);
  }

  const advancedRounds: string[] = [];

  for (const roundId of roundsToAdvance) {
    const { data: round } = await supabase
      .from('rounds')
      .select('*, pools(*)')
      .eq('id', roundId)
      .single();

    if (!round || round.status === 'completed') continue;

    const pool = round.pools as any;

    const { data: picks } = await supabase
      .from('picks')
      .select('*')
      .eq('round_id', roundId)
      .neq('status', 'pending');

    const { data: participants } = await supabase
      .from('pool_participants')
      .select('*')
      .eq('pool_id', round.pool_id)
      .in('status', ['active', 'advanced']);

    if (!participants?.length) continue;

    const userToParticipantId = new Map<string, string>();
    for (const p of participants) userToParticipantId.set((p as any).user_id, p.id);
    const picksMap = new Map<string, PickStatus>();
    for (const pick of picks ?? []) {
      const participantId = userToParticipantId.get(pick.user_id);
      if (participantId) picksMap.set(participantId, pick.status as PickStatus);
    }

    const { updates, startTiebreaker } = processRoundResults(
      participants as any,
      picksMap,
      {
        contest_format: pool.contest_format,
        push_rule: pool.push_rule,
        all_lose_rule: pool.all_lose_rule,
        lives_count: pool.lives_count,
        target_wins: pool.target_wins,
        target_streak: pool.target_streak,
        max_losses: pool.max_losses,
        push_resets_streak: pool.push_resets_streak,
        tiebreaker_active: pool.tiebreaker_active ?? false,
      },
      round.round_number,
    );

    if (startTiebreaker) {
      await supabase.from('pools').update({ tiebreaker_active: true }).eq('id', round.pool_id);
    }

    for (const [participantId, update] of updates) {
      const dbUpdate: Record<string, any> = { status: update.status };
      if (update.lives_remaining !== undefined) dbUpdate.lives_remaining = update.lives_remaining;
      if (update.current_streak !== undefined) dbUpdate.current_streak = update.current_streak;
      if (update.wins !== undefined) dbUpdate.wins = update.wins;
      if (update.losses !== undefined) dbUpdate.losses = update.losses;
      if (update.pushes !== undefined) dbUpdate.pushes = update.pushes;
      if (update.rounds_survived !== undefined) dbUpdate.rounds_survived = update.rounds_survived;
      if (update.eliminated_round !== undefined) dbUpdate.eliminated_round = update.eliminated_round;
      await supabase.from('pool_participants').update(dbUpdate).eq('id', participantId);
    }

    await supabase.from('rounds').update({ status: 'completed' }).eq('id', roundId);
    await supabase.from('picks').update({ is_locked: true }).eq('round_id', roundId);

    const { data: remaining } = await supabase
      .from('pool_participants')
      .select('status')
      .eq('pool_id', round.pool_id)
      .in('status', ['active', 'advanced', 'winner']);

    const winners = (remaining ?? []).filter((p: any) => p.status === 'winner');
    const alive = (remaining ?? []).filter((p: any) => ['active', 'advanced'].includes(p.status));

    if (alive.length <= 1 || winners.length > 0) {
      if (pool.tiebreaker_active && alive.length === 1) {
        await supabase.from('pool_participants').update({ status: 'winner' })
          .eq('pool_id', round.pool_id).in('status', ['active', 'advanced']);
      }
      await supabase.from('pools').update({ status: 'completed', tiebreaker_active: false, updated_at: new Date().toISOString() }).eq('id', round.pool_id);
    } else {
      if (pool.status === 'open' && pool.contest_format !== 'streak_race') {
        await supabase.from('pools').update({ status: 'active' }).eq('id', round.pool_id);
      }
      const nextDeadline = new Date();
      nextDeadline.setUTCDate(nextDeadline.getUTCDate() + 1);
      nextDeadline.setUTCHours(1, 30, 0, 0);
      await supabase.from('rounds').insert({
        pool_id: round.pool_id,
        round_number: round.round_number + 1,
        deadline: nextDeadline.toISOString(),
        status: 'open',
      });
    }

    advancedRounds.push(roundId);
  }

  return NextResponse.json({ advancedRounds: advancedRounds.length, roundIds: advancedRounds });
  } catch (e: any) {
    console.error('[run-grader]', e);
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
