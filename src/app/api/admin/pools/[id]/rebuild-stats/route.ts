import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { processRoundResults } from '@/lib/contest-engine';
import { parseTeamScoring } from '@/lib/utils';
import type { PickStatus } from '@/types';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: poolId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pool } = await supabase.from('pools').select('*').eq('id', poolId).single();
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  // 1. Reset all participants to clean slate
  const { data: allParticipants } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', poolId);

  if (!allParticipants?.length) return NextResponse.json({ error: 'No participants found' }, { status: 404 });

  await supabase
    .from('pool_participants')
    .update({
      wins: 0, losses: 0, pushes: 0, current_streak: 0,
      rounds_survived: 0, lives_remaining: pool.lives_count ?? 1,
      status: 'active', eliminated_round: null,
    })
    .eq('pool_id', poolId);

  // 2. Replay all completed rounds in order
  const { data: completedRounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('pool_id', poolId)
    .eq('status', 'completed')
    .order('round_number', { ascending: true });

  let roundsProcessed = 0;

  for (const round of completedRounds ?? []) {
    // Re-fetch fresh participant states after each round
    const { data: participants } = await supabase
      .from('pool_participants')
      .select('*')
      .eq('pool_id', poolId)
      .in('status', ['active', 'advanced']);

    if (!participants?.length) break;

    const { data: picks } = await supabase
      .from('picks')
      .select('*')
      .eq('round_id', round.id)
      .neq('status', 'pending');

    // Skip rounds with no picks — data corruption guard
    if (!picks || picks.length === 0) { roundsProcessed++; continue; }

    const userToParticipantId = new Map<string, string>();
    for (const p of participants) userToParticipantId.set(p.user_id, p.id);

    const picksMap = new Map<string, PickStatus>();

    // Team parlay scoring
    if (pool.contest_format === 'team_battle') {
      const teamGroups = new Map<string, any[]>();
      for (const p of participants) {
        const tid = p.team_id ?? 'none';
        if (!teamGroups.has(tid)) teamGroups.set(tid, []);
        teamGroups.get(tid)!.push(p);
      }
      const pickByUser = new Map<string, PickStatus>();
      for (const pick of picks ?? []) pickByUser.set(pick.user_id, pick.status as PickStatus);
      for (const [, members] of teamGroups) {
        const statuses = members.map((m: any) => pickByUser.get(m.user_id) ?? 'lost');
        const teamResult: PickStatus = statuses.some(s => s === 'lost') ? 'lost'
          : statuses.every(s => s === 'won') ? 'won' : 'push';
        for (const m of members) {
          const pid = userToParticipantId.get(m.user_id);
          if (pid) picksMap.set(pid, teamResult);
        }
      }
    } else {
      for (const pick of picks ?? []) {
        const pid = userToParticipantId.get(pick.user_id);
        if (pid) picksMap.set(pid, pick.status as PickStatus);
      }
    }

    // Safety: if picks exist but none mapped, skip this round
    if (picks.length > 0 && picksMap.size === 0) { roundsProcessed++; continue; }

    const effectiveFormat = pool.contest_format === 'team_battle' && pool.team_scoring
      ? parseTeamScoring(pool.team_scoring).effectiveFormat : pool.contest_format;

    const { updates } = processRoundResults(
      participants as any,
      picksMap,
      {
        contest_format: effectiveFormat,
        push_rule: pool.push_rule,
        all_lose_rule: pool.all_lose_rule,
        lives_count: pool.lives_count,
        target_wins: pool.target_wins,
        target_streak: pool.target_streak,
        max_losses: pool.max_losses,
        push_resets_streak: pool.push_resets_streak,
        tiebreaker_active: pool.tiebreaker_active,
      },
      round.round_number
    );

    for (const [participantId, update] of updates) {
      const { isWinner, ...dbUpdate } = update;
      if (isWinner) (dbUpdate as any).status = 'winner';
      await supabase.from('pool_participants').update(dbUpdate).eq('id', participantId);
    }

    roundsProcessed++;
  }

  return NextResponse.json({ success: true, roundsProcessed });
}
