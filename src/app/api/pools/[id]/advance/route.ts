import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processRoundResults } from '@/lib/contest-engine';
import type { PickStatus } from '@/types';

const SPORT_KEYS = [
  'basketball_nba', 'basketball_wnba', 'baseball_mlb',
  'tennis_atp_french_open', 'tennis_wta_french_open',
  'tennis_atp_wimbledon', 'tennis_wta_wimbledon',
  'tennis_atp_us_open', 'tennis_wta_us_open',
];

async function getNextRoundDeadline(frequency: string): Promise<Date> {
  // For weekly pools, deadline is 7 days out at 9:30 PM ET
  if (frequency === 'weekly') {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(21, 30, 0, 0);
    return d;
  }

  // For daily: fetch tomorrow's games, use the latest start time
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setUTCDate(tomorrow.getUTCDate() + 1);

    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) throw new Error('No API key');

    let latestStart: Date | null = null;

    for (const sportKey of SPORT_KEYS) {
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&dateFormat=iso`,
          { next: { revalidate: 0 } }
        );
        if (!res.ok) continue;
        const games = await res.json();
        if (!Array.isArray(games)) continue;
        for (const game of games) {
          const t = new Date(game.commence_time);
          if (t >= tomorrow && t < dayAfter) {
            if (!latestStart || t > latestStart) latestStart = t;
          }
        }
      } catch { continue; }
    }

    if (latestStart) return latestStart;
  } catch { /* fall through */ }

  // Fallback: 9:30 PM ET tomorrow
  // ET = UTC-5 (EST) or UTC-4 (EDT); use UTC-4 (EDT) for safety during sports season
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  fallback.setUTCHours(1, 30, 0, 0); // 9:30 PM EDT = 01:30 UTC next day
  return fallback;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const { data: pool } = await supabase.from('pools').select('*').eq('id', id).single();

  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  if (pool.created_by !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get current round
  const { data: currentRound } = await supabase
    .from('rounds')
    .select('*')
    .eq('pool_id', id)
    .in('status', ['open', 'locked', 'grading'])
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!currentRound) return NextResponse.json({ error: 'No active round found' }, { status: 400 });

  // Get all graded picks for this round
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('round_id', currentRound.id)
    .neq('status', 'pending');

  // Get active participants
  const { data: participants } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', id)
    .in('status', ['active', 'advanced']);

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: 'No active participants' }, { status: 400 });
  }

  // Key picksMap by pool_participants.id (not user_id) to match contest-engine lookup
  const userToParticipantId = new Map<string, string>();
  for (const p of participants) userToParticipantId.set((p as any).user_id, p.id);
  const picksMap = new Map<string, PickStatus>();
  for (const pick of picks ?? []) {
    const participantId = userToParticipantId.get(pick.user_id);
    if (participantId) picksMap.set(participantId, pick.status as PickStatus);
  }

  // Process results
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
    },
    currentRound.round_number
  );

  // Apply updates
  for (const [participantId, update] of updates) {
    const participant = participants.find((p: any) => p.id === participantId);
    if (!participant) continue;

    const dbUpdate: any = { status: update.status };
    if (update.lives_remaining !== undefined) dbUpdate.lives_remaining = update.lives_remaining;
    if (update.current_streak !== undefined) dbUpdate.current_streak = update.current_streak;
    if (update.wins !== undefined) dbUpdate.wins = update.wins;
    if (update.losses !== undefined) dbUpdate.losses = update.losses;
    if (update.pushes !== undefined) dbUpdate.pushes = update.pushes;
    if (update.rounds_survived !== undefined) dbUpdate.rounds_survived = update.rounds_survived;
    if (update.eliminated_round !== undefined) dbUpdate.eliminated_round = update.eliminated_round;

    await supabase.from('pool_participants').update(dbUpdate).eq('id', participantId);

    // Activity feed
    if (update.status === 'eliminated') {
      await supabase.from('activity_feed').insert({
        pool_id: id,
        user_id: participant.user_id,
        activity_type: 'eliminated',
        metadata: { round: currentRound.round_number },
      });
    } else if (update.status === 'winner') {
      await supabase.from('activity_feed').insert({
        pool_id: id,
        user_id: participant.user_id,
        activity_type: 'won_contest',
        metadata: { pool_name: pool.name },
      });
      await supabase.from('profiles').update({ pools_won: supabase.rpc('increment', {}) as any }).eq('id', participant.user_id);
    } else {
      await supabase.from('activity_feed').insert({
        pool_id: id,
        user_id: participant.user_id,
        activity_type: 'survived_round',
        metadata: { round: currentRound.round_number },
      });
    }
  }

  // Complete current round
  await supabase.from('rounds').update({ status: 'completed' }).eq('id', currentRound.id);

  // Lock all picks in the round
  await supabase.from('picks').update({ is_locked: true }).eq('round_id', currentRound.id);

  // Check if contest is over
  const { data: remaining } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', id)
    .in('status', ['active', 'advanced']);

  const winners = (remaining ?? []).filter((p: any) => p.status === 'winner');
  const alive = (remaining ?? []).filter((p: any) => p.status === 'active' || p.status === 'advanced');

  if (alive.length <= 1 || winners.length > 0) {
    await supabase.from('pools').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
  } else {
    if (pool.status === 'open' && pool.contest_format !== 'streak_race') {
      await supabase.from('pools').update({ status: 'active' }).eq('id', id);
    }
    // Deadline = latest game start time for the next day, or 9:30 PM ET fallback
    const nextDeadline = await getNextRoundDeadline(pool.round_frequency);

    await supabase.from('rounds').insert({
      pool_id: id,
      round_number: currentRound.round_number + 1,
      deadline: nextDeadline.toISOString(),
      status: 'open',
    });
  }

  // Log admin action
  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'advance_round',
    target_id: id,
    metadata: { round: currentRound.round_number },
  });

  return NextResponse.json({ success: true, round: currentRound.round_number });
}
