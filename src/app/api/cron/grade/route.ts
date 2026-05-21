import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { processRoundResults } from '@/lib/contest-engine';
import type { PickStatus } from '@/types';

// ESPN sport/league mapping for team sports grading
const ESPN_SPORT_MAP: Record<string, { sport: string; league: string }> = {
  'basketball_nba':  { sport: 'basketball', league: 'nba'  },
  'basketball_wnba': { sport: 'basketball', league: 'wnba' },
  'baseball_mlb':    { sport: 'baseball',   league: 'mlb'  },
  'icehockey_nhl':   { sport: 'hockey',     league: 'nhl'  },
};

const DEADLINE_SPORT_KEYS = [
  'basketball_nba', 'basketball_wnba', 'baseball_mlb',
  'tennis_atp_french_open', 'tennis_wta_french_open',
  'tennis_atp_wimbledon', 'tennis_wta_wimbledon',
  'tennis_atp_us_open', 'tennis_wta_us_open',
];

function toESPNDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Match pick.game ("Away @ Home") against API home_team / away_team
// Uses last word of each team name to handle abbreviations
function teamsMatch(gameField: string, homeTeam: string, awayTeam: string): boolean {
  const g = normalize(gameField);
  const homeLast = normalize(homeTeam).split(' ').pop()!;
  const awayLast = normalize(awayTeam).split(' ').pop()!;
  return g.includes(homeLast) && g.includes(awayLast);
}

function sideMatchesTeam(side: string, teamName: string): boolean {
  const s = normalize(side);
  const t = normalize(teamName);
  // Check if the last word of the team name appears in the side string, or vice versa
  const tLast = t.split(' ').pop()!;
  return t.includes(s) || s.includes(t) || s.includes(tLast) || t.includes(s.split(' ').pop()!);
}

function gradePick(
  pickType: string,
  side: string,
  lineValue: string,
  homeTeam: string,
  _awayTeam: string,
  homeScore: number,
  awayScore: number,
): 'won' | 'lost' | 'push' {
  if (pickType === 'moneyline') {
    const pickedIsHome = sideMatchesTeam(side, homeTeam);
    const pickedScore = pickedIsHome ? homeScore : awayScore;
    const oppScore = pickedIsHome ? awayScore : homeScore;
    if (pickedScore > oppScore) return 'won';
    if (pickedScore < oppScore) return 'lost';
    return 'push';
  }

  if (pickType === 'spread') {
    // lineValue like "+4.5" or "-4.5"
    const spread = parseFloat(lineValue);
    if (isNaN(spread)) return 'lost';
    const pickedIsHome = sideMatchesTeam(side, homeTeam);
    const pickedScore = pickedIsHome ? homeScore : awayScore;
    const oppScore = pickedIsHome ? awayScore : homeScore;
    const result = pickedScore + spread - oppScore;
    if (result > 0) return 'won';
    if (result < 0) return 'lost';
    return 'push';
  }

  if (pickType === 'total') {
    // side is "Over" or "Under"; lineValue like "O 215.5" or "Over 215.5"
    const totalLine = parseFloat(lineValue.replace(/[^\d.]/g, ''));
    if (isNaN(totalLine)) return 'lost';
    const actualTotal = homeScore + awayScore;
    const isOver = normalize(side) === 'over';
    if (isOver) {
      if (actualTotal > totalLine) return 'won';
      if (actualTotal < totalLine) return 'lost';
    } else {
      if (actualTotal < totalLine) return 'won';
      if (actualTotal > totalLine) return 'lost';
    }
    return 'push';
  }

  return 'lost';
}

async function getNextRoundDeadline(frequency: string): Promise<Date> {
  if (frequency === 'weekly') {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(21, 30, 0, 0);
    return d;
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setUTCDate(tomorrow.getUTCDate() + 1);

    let latestStart: Date | null = null;
    for (const sportKey of DEADLINE_SPORT_KEYS) {
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american&dateFormat=iso`,
          { cache: 'no-store' },
        );
        if (!res.ok) continue;
        const games = await res.json();
        if (!Array.isArray(games)) continue;
        for (const game of games) {
          const t = new Date(game.commence_time);
          if (t >= tomorrow && t < dayAfter && (!latestStart || t > latestStart)) {
            latestStart = t;
          }
        }
      } catch { continue; }
    }
    if (latestStart) return latestStart;
  } catch { /* fall through */ }

  // Fallback: 9:30 PM EDT tomorrow
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  fallback.setUTCHours(1, 30, 0, 0);
  return fallback;
}

export async function GET(_request: NextRequest) {

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find all pending picks where the game started 3+ hours ago
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: pendingPicks, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('status', 'pending')
    .lt('game_start_time', cutoff);

  if (picksError) return NextResponse.json({ error: picksError.message }, { status: 500 });

  let gradedCount = 0;
  const gradedRoundIds = new Set<string>();

  // --- Team sports grading via ESPN (NBA, WNBA, MLB, NHL) ---
  const teamSportPicks = (pendingPicks as any[]).filter((p: any) => p.league in ESPN_SPORT_MAP);

  if (teamSportPicks.length > 0) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    // Check yesterday + today to cover games that ended late
    const datesToCheck = [toESPNDate(yesterday), toESPNDate(today)];

    const espnTeamCache: Record<string, any[]> = {};

    const fetchESPNTeam = async (sportKey: string, dateStr: string): Promise<any[]> => {
      const cacheKey = `${sportKey}_${dateStr}`;
      if (espnTeamCache[cacheKey]) return espnTeamCache[cacheKey];
      const mapping = ESPN_SPORT_MAP[sportKey];
      if (!mapping) { espnTeamCache[cacheKey] = []; return []; }
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${mapping.sport}/${mapping.league}/scoreboard?dates=${dateStr}`,
          { cache: 'no-store' },
        );
        if (!res.ok) { espnTeamCache[cacheKey] = []; return []; }
        const json = await res.json();
        espnTeamCache[cacheKey] = Array.isArray(json?.events) ? json.events : [];
        return espnTeamCache[cacheKey];
      } catch {
        espnTeamCache[cacheKey] = [];
        return [];
      }
    };

    for (const pick of teamSportPicks) {
      let matchedData: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number } | null = null;

      for (const dateStr of datesToCheck) {
        const events = await fetchESPNTeam(pick.league, dateStr);
        for (const event of events) {
          const competition = event.competitions?.[0];
          if (!competition) continue;
          if (!competition.status?.type?.completed) continue;
          const competitors: any[] = competition.competitors ?? [];
          if (competitors.length < 2) continue;

          const homeComp = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0];
          const awayComp = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1];
          const homeTeam: string = homeComp?.team?.displayName ?? homeComp?.team?.name ?? '';
          const awayTeam: string = awayComp?.team?.displayName ?? awayComp?.team?.name ?? '';

          if (!teamsMatch(pick.game, homeTeam, awayTeam)) continue;

          const homeScore = parseInt(homeComp?.score ?? '0');
          const awayScore = parseInt(awayComp?.score ?? '0');
          if (isNaN(homeScore) || isNaN(awayScore)) continue;

          matchedData = { homeTeam, awayTeam, homeScore, awayScore };
          break;
        }
        if (matchedData) break;
      }

      if (!matchedData) continue;

      const result = gradePick(
        pick.pick_type,
        pick.side,
        pick.line_value,
        matchedData.homeTeam,
        matchedData.awayTeam,
        matchedData.homeScore,
        matchedData.awayScore,
      );

      const { error } = await supabase
        .from('picks')
        .update({ status: result, graded_at: new Date().toISOString(), is_locked: true })
        .eq('id', pick.id);

      if (!error) {
        gradedCount++;
        gradedRoundIds.add(pick.round_id);
      }
    }
  }

  // --- Tennis grading via ESPN ---
  const tennisPicks = (pendingPicks as any[]).filter((p: any) =>
    typeof p.league === 'string' && p.league.startsWith('tennis_'),
  );

  if (tennisPicks.length > 0) {
    // Determine ESPN league (atp or wta) for each pending tennis pick
    function espnLeagueForKey(leagueKey: string): 'atp' | 'wta' | null {
      if (leagueKey.includes('_wta')) return 'wta';
      if (leagueKey.includes('_atp')) return 'atp';
      return null;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const datesToFetch = [toESPNDate(yesterday), toESPNDate(today)];

    // Cache ESPN events per league+date
    const espnEventsCache: Record<string, any[]> = {};

    async function fetchESPNEvents(espnLeague: 'atp' | 'wta', dateStr: string): Promise<any[]> {
      const cacheKey = `${espnLeague}_${dateStr}`;
      if (espnEventsCache[cacheKey]) return espnEventsCache[cacheKey];
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/tennis/${espnLeague}/scoreboard?dates=${dateStr}`,
          { cache: 'no-store' },
        );
        if (!res.ok) { espnEventsCache[cacheKey] = []; return []; }
        const json = await res.json();
        const events = Array.isArray(json?.events) ? json.events : [];
        espnEventsCache[cacheKey] = events;
        return events;
      } catch {
        espnEventsCache[cacheKey] = [];
        return [];
      }
    }

    for (const pick of tennisPicks) {
      const espnLeague = espnLeagueForKey(pick.league);
      if (!espnLeague) continue;

      let matchedEvent: any = null;
      for (const dateStr of datesToFetch) {
        const events = await fetchESPNEvents(espnLeague, dateStr);
        for (const event of events) {
          const competition = event.competitions?.[0];
          if (!competition) continue;
          if (!competition.status?.type?.completed) continue;
          const competitors = competition.competitors ?? [];
          if (competitors.length < 2) continue;

          const homeComp = competitors.find((c: any) => c.order === 2) ?? competitors[1];
          const awayComp = competitors.find((c: any) => c.order === 1) ?? competitors[0];
          const homeName = homeComp?.athlete?.displayName ?? '';
          const awayName = awayComp?.athlete?.displayName ?? '';

          if (teamsMatch(pick.game, homeName, awayName)) {
            matchedEvent = { competition, homeName, awayName };
            break;
          }
        }
        if (matchedEvent) break;
      }

      if (!matchedEvent) continue;

      const { competition, homeName, awayName } = matchedEvent;
      const competitors = competition.competitors ?? [];
      const homeComp = competitors.find((c: any) => {
        const n = (c.athlete?.displayName ?? '').toLowerCase();
        return n === homeName.toLowerCase();
      }) ?? competitors.find((c: any) => c.order === 2) ?? competitors[1];
      const awayComp = competitors.find((c: any) => {
        const n = (c.athlete?.displayName ?? '').toLowerCase();
        return n === awayName.toLowerCase();
      }) ?? competitors.find((c: any) => c.order === 1) ?? competitors[0];

      if (!homeComp || !awayComp) continue;

      const winner = homeComp.winner ? homeName : awayComp.winner ? awayName : null;
      if (!winner) continue;

      // Determine result by matching pick.side against the winner's name
      const pickedWinner = sideMatchesTeam(pick.side, winner);
      const result: 'won' | 'lost' = pickedWinner ? 'won' : 'lost';

      const { error } = await supabase
        .from('picks')
        .update({ status: result, graded_at: new Date().toISOString(), is_locked: true })
        .eq('id', pick.id);

      if (!error) {
        gradedCount++;
        gradedRoundIds.add(pick.round_id);
      }
    }
  }

  // Also include any open rounds past their deadline that weren't caught above
  const { data: overdueRounds } = await supabase
    .from('rounds')
    .select('id')
    .neq('status', 'completed')
    .lt('deadline', new Date().toISOString());
  for (const r of overdueRounds ?? []) gradedRoundIds.add(r.id);

  // For each round that had picks graded (or is overdue), check if all picks are done and auto-advance
  const advancedRounds: string[] = [];

  for (const roundId of gradedRoundIds) {
    // Load round + pool first so we can check the deadline
    const { data: round } = await supabase
      .from('rounds')
      .select('*, pools(*)')
      .eq('id', roundId)
      .single();

    if (!round || round.status === 'completed') continue;

    const pool = round.pools as any;
    const roundDeadlinePassed = new Date(round.deadline) < new Date();

    // Skip if any picks are still pending AND the deadline hasn't passed yet
    const { data: stillPending } = await supabase
      .from('picks')
      .select('id')
      .eq('round_id', roundId)
      .eq('status', 'pending');

    if (stillPending && stillPending.length > 0 && !roundDeadlinePassed) continue;

    // After deadline, force any remaining pending picks to 'lost' (missed pick = loss)
    if (stillPending && stillPending.length > 0 && roundDeadlinePassed) {
      await supabase
        .from('picks')
        .update({ status: 'lost' })
        .eq('round_id', roundId)
        .eq('status', 'pending');
    }

    // Get all graded picks for this round
    const { data: picks } = await supabase
      .from('picks')
      .select('*')
      .eq('round_id', roundId)
      .neq('status', 'pending');

    // Get active participants
    const { data: participants } = await supabase
      .from('pool_participants')
      .select('*')
      .eq('pool_id', round.pool_id)
      .in('status', ['active', 'advanced']);

    if (!participants?.length) {
      console.log(`[advance] round ${roundId}: no active participants, skipping`);
      continue;
    }
    console.log(`[advance] round ${roundId}: ${participants.length} participants, ${(picks ?? []).length} graded picks`);

    // Key picksMap by pool_participants.id (not user_id) to match contest-engine lookup
    const userToParticipantId = new Map<string, string>();
    for (const p of participants) userToParticipantId.set((p as any).user_id, p.id);
    const picksMap = new Map<string, PickStatus>();
    for (const pick of picks ?? []) {
      const participantId = userToParticipantId.get(pick.user_id);
      if (participantId) picksMap.set(participantId, pick.status as PickStatus);
    }

    console.log(`[advance] picksMap size: ${picksMap.size}, sample:`, JSON.stringify([...picksMap.entries()].slice(0,3)));
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

    console.log(`[advance] updates size: ${updates.size}, sample:`, JSON.stringify([...updates.entries()].slice(0,3)));
    if (startTiebreaker) {
      await supabase.from('pools').update({ tiebreaker_active: true }).eq('id', round.pool_id);
    }

    // Apply participant updates and activity feed
    for (const [participantId, update] of updates) {
      const participant = participants.find((p: any) => p.id === participantId);
      if (!participant) continue;

      const dbUpdate: Record<string, any> = { status: update.status };
      if (update.lives_remaining !== undefined) dbUpdate.lives_remaining = update.lives_remaining;
      if (update.current_streak !== undefined) dbUpdate.current_streak = update.current_streak;
      if (update.wins !== undefined) dbUpdate.wins = update.wins;
      if (update.losses !== undefined) dbUpdate.losses = update.losses;
      if (update.pushes !== undefined) dbUpdate.pushes = update.pushes;
      if (update.rounds_survived !== undefined) dbUpdate.rounds_survived = update.rounds_survived;
      if (update.eliminated_round !== undefined) dbUpdate.eliminated_round = update.eliminated_round;

      await supabase.from('pool_participants').update(dbUpdate).eq('id', participantId);

      const activityType = update.status === 'eliminated' ? 'eliminated'
        : update.status === 'winner' ? 'won_contest'
        : 'survived_round';
      const activityMeta = activityType === 'won_contest'
        ? { pool_name: pool.name }
        : { round: round.round_number };

      // Only insert if this exact activity doesn't already exist (prevents duplicates on re-runs)
      const { data: existing } = await supabase
        .from('activity_feed')
        .select('id')
        .eq('pool_id', round.pool_id)
        .eq('user_id', participant.user_id)
        .eq('activity_type', activityType)
        .eq('metadata', activityMeta)
        .maybeSingle();

      if (!existing) {
        await supabase.from('activity_feed').insert({
          pool_id: round.pool_id, user_id: participant.user_id,
          activity_type: activityType, metadata: activityMeta,
        });
      }
    }

    // Mark round completed and lock all picks
    await supabase.from('rounds').update({ status: 'completed' }).eq('id', roundId);
    await supabase.from('picks').update({ is_locked: true }).eq('round_id', roundId);

    // Check if contest is over
    const { data: remaining } = await supabase
      .from('pool_participants')
      .select('status')
      .eq('pool_id', round.pool_id)
      .in('status', ['active', 'advanced', 'winner']);

    const winners = (remaining ?? []).filter((p: any) => p.status === 'winner');
    const alive = (remaining ?? []).filter((p: any) => ['active', 'advanced'].includes(p.status));

    if (alive.length <= 1 || winners.length > 0) {
      // In tiebreaker mode, the last surviving player needs to be crowned winner
      if (pool.tiebreaker_active && alive.length === 1) {
        await supabase
          .from('pool_participants')
          .update({ status: 'winner' })
          .eq('pool_id', round.pool_id)
          .in('status', ['active', 'advanced']);
      }
      await supabase.from('pools').update({ status: 'completed', tiebreaker_active: false, updated_at: new Date().toISOString() }).eq('id', round.pool_id);
    } else {
      // Mark pool as active so new entries are blocked for non-streak-race pools
      if (pool.status === 'open' && pool.contest_format !== 'streak_race') {
        await supabase.from('pools').update({ status: 'active' }).eq('id', round.pool_id);
      }
      const nextDeadline = await getNextRoundDeadline(pool.round_frequency);
      await supabase.from('rounds').insert({
        pool_id: round.pool_id,
        round_number: round.round_number + 1,
        deadline: nextDeadline.toISOString(),
        status: 'open',
      });
    }

    advancedRounds.push(roundId);
  }

  return NextResponse.json({
    graded: gradedCount,
    advancedRounds: advancedRounds.length,
    overdueRoundsFound: (overdueRounds ?? []).length,
    timestamp: new Date().toISOString(),
  });
}
