import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processRoundResults } from '@/lib/contest-engine';
import type { PickStatus } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { pool_id } = await request.json();
  if (!pool_id) return NextResponse.json({ error: 'Missing pool_id' }, { status: 400 });

  // Load pool
  const { data: pool } = await supabase.from('pools').select('*').eq('id', pool_id).single();
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  // Find all rounds, pick the one with picks
  const { data: allRounds } = await supabase
    .from('rounds').select('id, round_number, deadline').eq('pool_id', pool_id).order('round_number', { ascending: true });
  if (!allRounds?.length) return NextResponse.json({ error: 'No rounds found' }, { status: 400 });

  let targetRound = allRounds[0];
  for (const r of allRounds) {
    const { count } = await supabase.from('picks').select('*', { count: 'exact', head: true }).eq('round_id', r.id);
    if ((count ?? 0) > 0) { targetRound = r; break; }
  }

  // Delete rounds after the target
  for (const r of allRounds) {
    if (r.round_number > targetRound.round_number) {
      await supabase.from('rounds').delete().eq('id', r.id);
    }
  }

  // Reset all participants
  await supabase
    .from('pool_participants')
    .update({ current_streak: 0, wins: 0, losses: 0, pushes: 0, rounds_survived: 0, status: 'active', eliminated_round: null })
    .eq('pool_id', pool_id);

  // Get all graded picks for this round
  const { data: picks } = await supabase
    .from('picks').select('*').eq('round_id', targetRound.id).neq('status', 'pending');

  // Force any remaining pending picks to lost
  await supabase.from('picks').update({ status: 'lost' }).eq('round_id', targetRound.id).eq('status', 'pending');

  // Reload participants (just reset above)
  const { data: participants } = await supabase
    .from('pool_participants').select('*').eq('pool_id', pool_id).in('status', ['active', 'advanced']);

  if (!participants?.length) return NextResponse.json({ error: 'No active participants' }, { status: 400 });

  // Build picksMap keyed by participant.id
  const userToParticipantId = new Map<string, string>();
  for (const p of participants) userToParticipantId.set((p as any).user_id, p.id);
  const picksMap = new Map<string, PickStatus>();
  for (const pick of picks ?? []) {
    const participantId = userToParticipantId.get(pick.user_id);
    if (participantId) picksMap.set(participantId, pick.status as PickStatus);
  }

  // Process results
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
    targetRound.round_number,
  );

  if (startTiebreaker) {
    await supabase.from('pools').update({ tiebreaker_active: true }).eq('id', pool_id);
  }

  // Apply updates
  for (const [participantId, update] of updates) {
    const dbUpdate: Record<string, any> = { status: update.status };
    if (update.wins !== undefined) dbUpdate.wins = update.wins;
    if (update.losses !== undefined) dbUpdate.losses = update.losses;
    if (update.pushes !== undefined) dbUpdate.pushes = update.pushes;
    if (update.current_streak !== undefined) dbUpdate.current_streak = update.current_streak;
    if (update.lives_remaining !== undefined) dbUpdate.lives_remaining = update.lives_remaining;
    if (update.rounds_survived !== undefined) dbUpdate.rounds_survived = update.rounds_survived;
    if (update.eliminated_round !== undefined) dbUpdate.eliminated_round = update.eliminated_round;
    await supabase.from('pool_participants').update(dbUpdate).eq('id', participantId);
  }

  // Mark round completed
  await supabase.from('rounds').update({ status: 'completed' }).eq('id', targetRound.id);

  // Create next round
  const nextDeadline = new Date();
  nextDeadline.setUTCDate(nextDeadline.getUTCDate() + 1);
  nextDeadline.setUTCHours(1, 30, 0, 0);
  await supabase.from('rounds').insert({
    pool_id,
    round_number: targetRound.round_number + 1,
    deadline: nextDeadline.toISOString(),
    status: 'open',
  });

  const eliminated = [...updates.values()].filter(u => u.status === 'eliminated').length;
  const advanced = [...updates.values()].filter(u => u.status === 'advanced' || u.status === 'winner').length;

  return NextResponse.json({ success: true, eliminated, advanced, total: updates.size });
}
