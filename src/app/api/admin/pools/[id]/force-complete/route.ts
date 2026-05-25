import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { processRoundResults } from '@/lib/contest-engine';
import type { PickStatus } from '@/types';
import { snapshot } from '@/lib/snapshot';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: poolId } = await params;

  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pool } = await supabase.from('pools').select('*').eq('id', poolId).single();
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  await snapshot(supabase, user.id, 'force-complete', poolId);

  // First: apply any open round's graded picks to participant stats
  const { data: openRounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('pool_id', poolId)
    .eq('status', 'open');

  for (const round of openRounds ?? []) {
    const { data: picks } = await supabase
      .from('picks')
      .select('*')
      .eq('round_id', round.id)
      .neq('status', 'pending');

    const { data: participants } = await supabase
      .from('pool_participants')
      .select('*')
      .eq('pool_id', poolId)
      .in('status', ['active', 'advanced']);

    if (!participants?.length) continue;

    const userToParticipantId = new Map<string, string>();
    for (const p of participants) userToParticipantId.set((p as any).user_id, p.id);
    const picksMap = new Map<string, PickStatus>();
    for (const pick of picks ?? []) {
      const participantId = userToParticipantId.get(pick.user_id);
      if (participantId) picksMap.set(participantId, pick.status as PickStatus);
    }

    const { updates } = processRoundResults(
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

    await supabase.from('rounds').update({ status: 'completed' }).eq('id', round.id);
    await supabase.from('picks').update({ is_locked: true }).eq('round_id', round.id);
  }

  // Now re-fetch updated participants to find the actual winner
  const { data: updatedParticipants } = await supabase
    .from('pool_participants')
    .select('*, profiles(username)')
    .eq('pool_id', poolId)
    .in('status', ['active', 'advanced', 'winner']);

  if (!updatedParticipants?.length) return NextResponse.json({ error: 'No active participants after applying results' }, { status: 400 });

  // Check if there's already a winner from processRoundResults
  const alreadyWinner = updatedParticipants.find((p: any) => p.status === 'winner');
  const alive = updatedParticipants.filter((p: any) => ['active', 'advanced'].includes(p.status));

  let winnerId: string;
  if (alreadyWinner) {
    winnerId = alreadyWinner.id;
  } else if (alive.length === 1) {
    winnerId = alive[0].id;
  } else {
    // Crown whoever has the best streak/wins
    const best = alive.reduce((a: any, b: any) =>
      pool.contest_format === 'streak_race'
        ? (b.current_streak > a.current_streak ? b : a)
        : (b.wins > a.wins ? b : a)
    );
    winnerId = best.id;
  }

  // Crown winner, eliminate everyone else still alive
  for (const p of alive) {
    if (p.id === winnerId) {
      await supabase.from('pool_participants').update({ status: 'winner' }).eq('id', p.id);
    } else {
      await supabase.from('pool_participants').update({ status: 'eliminated' }).eq('id', p.id);
    }
  }

  // Complete the pool
  await supabase.from('pools').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', poolId);

  // Distribute sweeps coins to winner if pool had a coin entry fee
  if ((pool.entry_fee_coins ?? 0) > 0) {
    const { count: totalParticipants } = await supabase
      .from('pool_participants')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);
    const gross = (totalParticipants ?? 0) * pool.entry_fee_coins;
    const rake = Math.round(gross * ((pool.rake_percentage ?? 10) / 100));
    const prize = gross - rake;
    if (prize > 0) {
      const winnerParticipant = updatedParticipants.find((p: any) => p.id === winnerId);
      if (winnerParticipant) {
        const { data: winnerProfile } = await supabase
          .from('profiles')
          .select('sweeps_coins')
          .eq('id', winnerParticipant.user_id)
          .single();
        if (winnerProfile) {
          await supabase.from('profiles').update({
            sweeps_coins: (winnerProfile.sweeps_coins ?? 0) + prize,
          }).eq('id', winnerParticipant.user_id);
          await supabase.from('coin_transactions').insert({
            user_id: winnerParticipant.user_id,
            gold_delta: 0,
            sweeps_delta: prize,
            transaction_type: 'pool_win',
            pool_id: poolId,
            note: `Won: ${pool.name}`,
          });
        }
      }
    }
  }

  const winner = updatedParticipants.find((p: any) => p.id === winnerId);

  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'force_complete_pool',
    target_id: poolId,
    metadata: { pool_name: pool.name, winner: (winner as any)?.profiles?.username },
  });

  return NextResponse.json({ success: true, winner: (winner as any)?.profiles?.username });
}
