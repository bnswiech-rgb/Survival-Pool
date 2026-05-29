// Auto-grades pending picks using ESPN's free scoreboard API
// Called from the admin run-grader before advancing rounds

const ESPN_LEAGUE_MAP: Record<string, { sport: string; league: string }> = {
  basketball_nba:    { sport: 'basketball', league: 'nba' },
  basketball_wnba:   { sport: 'basketball', league: 'wnba' },
  baseball_mlb:      { sport: 'baseball',   league: 'mlb' },
  icehockey_nhl:     { sport: 'hockey',     league: 'nhl' },
};

const ESPN_TENNIS_MAP: Record<string, string> = {
  tennis_atp: 'atp',
  tennis_atp_french_open: 'atp',
  tennis_atp_wimbledon: 'atp',
  tennis_atp_us_open: 'atp',
  tennis_atp_australian_open: 'atp',
  tennis_wta: 'wta',
  tennis_wta_french_open: 'wta',
  tennis_wta_wimbledon: 'wta',
  tennis_wta_us_open: 'wta',
  tennis_wta_australian_open: 'wta',
};

function toESPNDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function gameContainsTeams(pickGame: string, homeTeam: string, awayTeam: string): boolean {
  const g = normalizeName(pickGame);
  const h = normalizeName(homeTeam);
  const a = normalizeName(awayTeam);
  // Require full team name match — last-word fallback was too loose and caused wrong matches
  return g.includes(h) && g.includes(a);
}

function sideMatchesTeam(side: string, team: string): boolean {
  const s = normalizeName(side);
  const t = normalizeName(team);
  return t.includes(s) || s.includes(t) || t.split(' ').pop() === s.split(' ').pop();
}

function gradeTeamPick(
  pick: any,
  homeTeam: string, awayTeam: string,
  homeScore: number, awayScore: number
): 'won' | 'lost' | 'push' | null {
  if (pick.pick_type === 'moneyline') {
    const pickHome = sideMatchesTeam(pick.side, homeTeam);
    const pickAway = sideMatchesTeam(pick.side, awayTeam);
    if (!pickHome && !pickAway) return null;
    const pickScore = pickHome ? homeScore : awayScore;
    const otherScore = pickHome ? awayScore : homeScore;
    if (pickScore > otherScore) return 'won';
    if (pickScore < otherScore) return 'lost';
    return 'push';
  }

  if (pick.pick_type === 'spread') {
    const line = parseFloat(pick.line_value);
    if (isNaN(line)) return null;
    const pickHome = sideMatchesTeam(pick.side, homeTeam);
    const pickAway = sideMatchesTeam(pick.side, awayTeam);
    if (!pickHome && !pickAway) return null;
    const pickScore = pickHome ? homeScore : awayScore;
    const otherScore = pickHome ? awayScore : homeScore;
    const adjusted = pickScore + line;
    if (adjusted > otherScore) return 'won';
    if (adjusted < otherScore) return 'lost';
    return 'push';
  }

  if (pick.pick_type === 'total') {
    const parts = pick.line_value.split(' ');
    const direction = parts[0]?.toLowerCase();
    const line = parseFloat(parts[1] ?? pick.line_value);
    if (isNaN(line)) return null;
    const total = homeScore + awayScore;
    if (direction === 'over') return total > line ? 'won' : total < line ? 'lost' : 'push';
    if (direction === 'under') return total < line ? 'won' : total > line ? 'lost' : 'push';
    return null;
  }

  return null;
}

export async function autoGradePendingPicks(supabase: any): Promise<number> {
  // Only grade picks whose game started more than 2 hours ago
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: pendingPicks } = await supabase
    .from('picks')
    .select('id, game, pick_type, side, line_value, league, game_start_time')
    .eq('status', 'pending')
    .lt('game_start_time', cutoff);

  if (!pendingPicks?.length) return 0;

  // Dates to check: today + up to 7 days ago (covers weekly pools and delayed grading)
  const today = new Date();
  const dates = [0, 1, 2, 3, 4, 5, 6, 7].map(n => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - n);
    return toESPNDate(d);
  });

  const eventCache: Record<string, any[]> = {};

  async function fetchESPN(sportKey: string, dateStr: string): Promise<any[]> {
    const key = `${sportKey}_${dateStr}`;
    if (eventCache[key]) return eventCache[key];
    const mapping = ESPN_LEAGUE_MAP[sportKey];
    if (!mapping) { eventCache[key] = []; return []; }
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${mapping.sport}/${mapping.league}/scoreboard?dates=${dateStr}`,
        { cache: 'no-store' }
      );
      if (!res.ok) { eventCache[key] = []; return []; }
      const json = await res.json();
      eventCache[key] = Array.isArray(json?.events) ? json.events : [];
      return eventCache[key];
    } catch {
      eventCache[key] = [];
      return [];
    }
  }

  async function fetchESPNTennis(tourKey: string, dateStr: string): Promise<any[]> {
    const key = `tennis_${tourKey}_${dateStr}`;
    if (eventCache[key]) return eventCache[key];
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/tennis/${tourKey}/scoreboard?dates=${dateStr}`,
        { cache: 'no-store' }
      );
      if (!res.ok) { eventCache[key] = []; return []; }
      const json = await res.json();
      eventCache[key] = Array.isArray(json?.events) ? json.events : [];
      return eventCache[key];
    } catch {
      eventCache[key] = [];
      return [];
    }
  }

  let graded = 0;

  for (const pick of pendingPicks) {
    const league = pick.league ?? '';
    let result: 'won' | 'lost' | 'push' | null = null;

    if (ESPN_LEAGUE_MAP[league]) {
      // Team sport
      for (const dateStr of dates) {
        const events = await fetchESPN(league, dateStr);
        for (const event of events) {
          const comp = event.competitions?.[0];
          if (!comp?.status?.type?.completed) continue;
          const competitors: any[] = comp.competitors ?? [];
          if (competitors.length < 2) continue;
          const homeComp = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0];
          const awayComp = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1];
          const homeTeam: string = homeComp?.team?.displayName ?? '';
          const awayTeam: string = awayComp?.team?.displayName ?? '';
          if (!gameContainsTeams(pick.game, homeTeam, awayTeam)) continue;
          const homeScore = parseInt(homeComp?.score ?? '0');
          const awayScore = parseInt(awayComp?.score ?? '0');
          if (isNaN(homeScore) || isNaN(awayScore)) continue;
          result = gradeTeamPick(pick, homeTeam, awayTeam, homeScore, awayScore);
          break;
        }
        if (result) break;
      }
    } else if (ESPN_TENNIS_MAP[league]) {
      // Tennis
      const tourKey = ESPN_TENNIS_MAP[league];
      for (const dateStr of dates) {
        const events = await fetchESPNTennis(tourKey, dateStr);
        for (const event of events) {
          const comp = event.competitions?.[0];
          if (!comp?.status?.type?.completed) continue;
          const competitors: any[] = comp.competitors ?? [];
          if (competitors.length < 2) continue;
          const homeComp = competitors.find((c: any) => c.order === 2) ?? competitors[1];
          const awayComp = competitors.find((c: any) => c.order === 1) ?? competitors[0];
          const homeName: string = homeComp?.athlete?.displayName ?? '';
          const awayName: string = awayComp?.athlete?.displayName ?? '';
          if (!gameContainsTeams(pick.game, homeName, awayName)) continue;
          const winner = homeComp.winner ? homeName : awayComp.winner ? awayName : null;
          if (!winner) continue;
          result = sideMatchesTeam(pick.side, winner) ? 'won' : 'lost';
          break;
        }
        if (result) break;
      }
    }

    // If ESPN couldn't find the result but the game started 24+ hours ago, force void
    // so the round isn't stuck forever waiting on a game ESPN no longer tracks
    if (!result) {
      const hoursSinceStart = pick.game_start_time
        ? (Date.now() - new Date(pick.game_start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      if (hoursSinceStart >= 24) {
        await supabase
          .from('picks')
          .update({ status: 'void', graded_at: new Date().toISOString(), is_locked: true })
          .eq('id', pick.id);
        graded++;
      }
      continue;
    }

    // Safety check: never grade a pick whose game hasn't started yet
    if (pick.game_start_time && new Date(pick.game_start_time) > new Date()) continue;

    await supabase
      .from('picks')
      .update({ status: result, graded_at: new Date().toISOString(), is_locked: true })
      .eq('id', pick.id);

    graded++;
  }

  return graded;
}
