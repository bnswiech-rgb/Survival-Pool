import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processRoundResults } from '@/lib/contest-engine';
import { parseTeamScoring } from '@/lib/utils';
import type { PickStatus } from '@/types';

const SPORT_KEYS = [
  'basketball_nba', 'basketball_wnba', 'baseball_mlb',
  'tennis_atp_french_open', 'tennis_wta_french_open',
  'tennis_atp_wimbledon', 'tennis_wta_wimbledon',
  'tennis_atp_us_open', 'tennis_wta_us_open',
];

// ESPN endpoints for game_day frequency by sport
const ESPN_GAME_DAY_MAP: Record<string, { sport: string; league: string }> = {
  'World Cup': { sport: 'soccer', league: 'fifa.world' },
};
const ESPN_NBA = { sport: 'basketball', league: 'nba' };

// Returns the next game day AND the first kickoff time on that day
async function findNextESPNGameDay(sport: string, startFromOffset = 1, maxDays = 7): Promise<{ dateStr: string; firstKickoff: Date | null } | null> {
  const espnConfig = ESPN_GAME_DAY_MAP[sport] ?? ESPN_NBA;
  const now = new Date();
  for (let offset = startFromOffset; offset <= maxDays; offset++) {
    const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${espnConfig.sport}/${espnConfig.league}/scoreboard?dates=${dateStr}`,
        { cache: 'no-store' },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data?.events) || data.events.length === 0) continue;
      // Find first kickoff time across all events
      let firstKickoff: Date | null = null;
      for (const event of data.events) {
        const t = event.date ? new Date(event.date) : null;
        if (t && (!firstKickoff || t < firstKickoff)) firstKickoff = t;
      }
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      return { dateStr: iso, firstKickoff };
    } catch { continue; }
  }
  return null;
}

async function getNextRoundDeadline(frequency: string, sport?: string): Promise<Date> {
  // For weekly pools, deadline is 7 days out at 9:30 PM ET
  if (frequency === 'weekly') {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(21, 30, 0, 0);
    return d;
  }

  // For game_day: find the next day ESPN has games, deadline = 30 min before first kickoff
  if (frequency === 'game_day') {
    try {
      const result = await findNextESPNGameDay(sport ?? 'NBA');
      if (result) {
        if (result.firstKickoff) {
          // 30 minutes before first game
          return new Date(result.firstKickoff.getTime() - 30 * 60 * 1000);
        }
        // No kickoff time — fallback to midnight ET on that game day
        const p = result.dateStr.split('-').map(Number);
        return new Date(Date.UTC(p[0], p[1] - 1, p[2], 4, 0, 0, 0)); // midnight ET
      }
    } catch { /* fall through */ }
    // Fallback: noon ET tomorrow
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + 1);
    fallback.setUTCHours(16, 0, 0, 0); // noon ET = 16:00 UTC
    return fallback;
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

  // For team_battle random pools: boot incomplete teams before round 1 processes
  const { teamFormation } = parseTeamScoring(pool.team_scoring);
  if (pool.contest_format === 'team_battle' && teamFormation === 'random' && currentRound.round_number === 1) {
    const { data: allActive } = await supabase
      .from('pool_participants')
      .select('id, team_id, user_id')
      .eq('pool_id', id)
      .in('status', ['active', 'advanced']);

    const teamCounts = new Map<string, string[]>();
    for (const p of allActive ?? []) {
      const tid = (p as any).team_id ?? '__solo__';
      if (!teamCounts.has(tid)) teamCounts.set(tid, []);
      teamCounts.get(tid)!.push(p.id);
    }

    const requiredSize = pool.team_size ?? 2;
    for (const [, memberIds] of teamCounts) {
      if (memberIds.length < requiredSize) {
        // Boot incomplete team members
        for (const pid of memberIds) {
          await supabase.from('pool_participants').update({ status: 'eliminated', eliminated_round: 0 }).eq('id', pid);
        }
      }
    }
  }

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

  // Count survivors after this round for activity metadata
  const survivorsCount = [...updates.values()].filter(u => u.status === 'active' || u.status === 'advanced').length;

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
        metadata: { round: currentRound.round_number, remaining: survivorsCount },
      });
    }
  }

  // For team_battle: if any team member was eliminated this round, eliminate the whole team
  if (pool.contest_format === 'team_battle') {
    // Build map of team_id -> all participant updates
    const teamUpdates = new Map<string, { participantId: string; userId: string; status: string }[]>();
    for (const p of participants) {
      const teamId = (p as any).team_id;
      if (!teamId) continue;
      const update = updates.get(p.id);
      if (!teamUpdates.has(teamId)) teamUpdates.set(teamId, []);
      teamUpdates.get(teamId)!.push({ participantId: p.id, userId: (p as any).user_id, status: update?.status ?? p.status });
    }

    for (const [, members] of teamUpdates) {
      const anyEliminated = members.some(m => m.status === 'eliminated');
      if (anyEliminated) {
        // Eliminate everyone on this team
        for (const m of members) {
          if (m.status !== 'eliminated') {
            await supabase.from('pool_participants').update({ status: 'eliminated', eliminated_round: currentRound.round_number }).eq('id', m.participantId);
            await supabase.from('activity_feed').insert({
              pool_id: id,
              user_id: m.userId,
              activity_type: 'eliminated',
              metadata: { round: currentRound.round_number },
            });
          }
        }
      }
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
    .in('status', ['active', 'advanced', 'winner']);

  const winners = (remaining ?? []).filter((p: any) => p.status === 'winner');
  const alive = (remaining ?? []).filter((p: any) => p.status === 'active' || p.status === 'advanced');

  // For team_battle: contest ends when only one team has surviving members
  let teamBattleOver = false;
  if (pool.contest_format === 'team_battle') {
    // Count members per alive team — teams with < team_size members are incomplete and don't count
    const aliveTeamCounts = new Map<string, number>();
    for (const p of alive) {
      const tid = (p as any).team_id;
      if (!tid) continue;
      aliveTeamCounts.set(tid, (aliveTeamCounts.get(tid) ?? 0) + 1);
    }
    const requiredSize = pool.team_size ?? 1;
    const fullyAliveTeamIds = new Set([...aliveTeamCounts.entries()].filter(([, count]) => count >= requiredSize).map(([tid]) => tid));
    teamBattleOver = fullyAliveTeamIds.size <= 1;
    if (teamBattleOver && fullyAliveTeamIds.size === 1) {
      const winningTeamId = [...fullyAliveTeamIds][0];
      // Mark all surviving members of the winning team as winner
      for (const p of alive) {
        if (p.team_id === winningTeamId) {
          await supabase.from('pool_participants').update({ status: 'winner' }).eq('id', p.id);
          await supabase.from('activity_feed').insert({
            pool_id: id,
            user_id: p.user_id,
            activity_type: 'won_contest',
            metadata: { pool_name: pool.name },
          });
        }
      }
    }
  }

  if (alive.length <= 1 || winners.length > 0 || teamBattleOver) {
    await supabase.from('pools').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);

    // Distribute sweeps coin prize pool to winner(s) if coins entry fee was set
    if ((pool.entry_fee_coins ?? 0) > 0) {
      const { count: totalParticipants } = await supabase
        .from('pool_participants')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', id);
      const gross = (totalParticipants ?? 0) * pool.entry_fee_coins;
      const rake = Math.round(gross * ((pool.rake_percentage ?? 10) / 100));
      const prize = gross - rake;
      // Re-fetch winners to include any just-marked team_battle winners
      const { data: freshWinners } = await supabase.from('pool_participants').select('user_id').eq('pool_id', id).eq('status', 'winner');
      const winnerParticipants = freshWinners ?? [];
      const numWinners = Math.max(1, winnerParticipants.length);
      const prizeEach = Math.floor(prize / numWinners);
      if (prizeEach > 0) {
        for (const winner of winnerParticipants) {
          const { data: winnerProfile } = await supabase
            .from('profiles')
            .select('sweeps_coins')
            .eq('id', winner.user_id)
            .single();
          if (winnerProfile) {
            await supabase.from('profiles').update({
              sweeps_coins: (winnerProfile.sweeps_coins ?? 0) + prizeEach,
            }).eq('id', winner.user_id);
            await supabase.from('coin_transactions').insert({
              user_id: winner.user_id,
              gold_delta: 0,
              sweeps_delta: prizeEach,
              transaction_type: 'pool_win',
              pool_id: id,
              note: `Won: ${pool.name}`,
            });
          }
        }
      }
    }
  } else {
    if (pool.status === 'open' && pool.contest_format !== 'streak_race') {
      await supabase.from('pools').update({ status: 'active' }).eq('id', id);
    }
    // Deadline = latest game start time for the next day, or 9:30 PM ET fallback
    const nextDeadline = await getNextRoundDeadline(pool.round_frequency, pool.sport);

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
