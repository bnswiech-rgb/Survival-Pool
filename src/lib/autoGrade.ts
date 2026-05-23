const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

const SPORT_KEYS: Record<string, string[]> = {
  NBA:  ['basketball_nba'],
  WNBA: ['basketball_wnba'],
  MLB:  ['baseball_mlb'],
  NHL:  ['icehockey_nhl'],
  ATP:  ['tennis_atp_french_open', 'tennis_atp_wimbledon', 'tennis_atp_us_open', 'tennis_atp_australian_open', 'tennis_atp'],
  WTA:  ['tennis_wta_french_open', 'tennis_wta_wimbledon', 'tennis_wta_us_open', 'tennis_wta_australian_open', 'tennis_wta'],
};
const ALL_SPORT_KEYS = Object.values(SPORT_KEYS).flat();

interface CompletedGame {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[];
}

async function fetchCompletedGames(sportKey: string): Promise<CompletedGame[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/sports/${sportKey}/scores?apiKey=${ODDS_API_KEY}&daysFrom=3&dateFormat=iso`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data as any[]).filter(g => g.completed && g.scores?.length >= 2);
  } catch {
    return [];
  }
}

function gradePick(pick: any, game: CompletedGame): 'won' | 'lost' | 'push' | null {
  const scoreMap: Record<string, number> = {};
  for (const s of game.scores) scoreMap[s.name] = parseFloat(s.score);

  if (pick.pick_type === 'moneyline') {
    const pickScore = scoreMap[pick.side];
    const otherTeam = game.home_team === pick.side ? game.away_team : game.home_team;
    const otherScore = scoreMap[otherTeam];
    if (pickScore === undefined || otherScore === undefined) return null;
    if (pickScore > otherScore) return 'won';
    if (pickScore < otherScore) return 'lost';
    return 'push';
  }

  if (pick.pick_type === 'spread') {
    const line = parseFloat(pick.line_value);
    if (isNaN(line)) return null;
    const pickScore = scoreMap[pick.side];
    const otherTeam = game.home_team === pick.side ? game.away_team : game.home_team;
    const otherScore = scoreMap[otherTeam];
    if (pickScore === undefined || otherScore === undefined) return null;
    const adjusted = pickScore + line;
    if (adjusted > otherScore) return 'won';
    if (adjusted < otherScore) return 'lost';
    return 'push';
  }

  if (pick.pick_type === 'total') {
    // line_value is like "Over 220.5" or "Under 220.5"
    const parts = pick.line_value.split(' ');
    const direction = parts[0]?.toLowerCase(); // "over" or "under"
    const line = parseFloat(parts[1] ?? pick.line_value);
    if (isNaN(line)) return null;
    const total = Object.values(scoreMap).reduce((a, b) => a + b, 0);
    if (direction === 'over') {
      if (total > line) return 'won';
      if (total < line) return 'lost';
      return 'push';
    }
    if (direction === 'under') {
      if (total < line) return 'won';
      if (total > line) return 'lost';
      return 'push';
    }
    return null;
  }

  return null;
}

function matchGame(pick: any, games: CompletedGame[]): CompletedGame | null {
  // pick.game is stored as "AwayTeam @ HomeTeam"
  return games.find(g =>
    pick.game.includes(g.home_team) && pick.game.includes(g.away_team)
  ) ?? null;
}

export async function autoGradePendingPicks(supabase: any): Promise<number> {
  if (!ODDS_API_KEY) return 0;

  // Fetch all pending picks
  const { data: pendingPicks } = await supabase
    .from('picks')
    .select('id, game, pick_type, side, line_value, league, sport')
    .eq('status', 'pending');

  if (!pendingPicks?.length) return 0;

  // Determine which sport keys to fetch scores for
  const leaguesNeeded = new Set<string>(pendingPicks.map((p: any) => p.league).filter(Boolean));
  const sportKeysToFetch = leaguesNeeded.size > 0
    ? [...leaguesNeeded]
    : ALL_SPORT_KEYS;

  // Fetch completed games for all relevant sport keys
  const allCompleted: CompletedGame[] = [];
  for (const key of sportKeysToFetch) {
    const games = await fetchCompletedGames(key);
    allCompleted.push(...games);
  }

  if (!allCompleted.length) return 0;

  let graded = 0;
  for (const pick of pendingPicks) {
    const game = matchGame(pick, allCompleted);
    if (!game) continue;

    const result = gradePick(pick, game);
    if (!result) continue;

    await supabase
      .from('picks')
      .update({ status: result, graded_at: new Date().toISOString(), is_locked: true })
      .eq('id', pick.id);

    graded++;
  }

  return graded;
}
