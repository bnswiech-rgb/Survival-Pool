import { NextRequest, NextResponse } from 'next/server';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

const SPORT_KEYS: Record<string, string[]> = {
  NBA:  ['basketball_nba'],
  WNBA: ['basketball_wnba'],
  MLB:  ['baseball_mlb', 'baseball_mlb_preseason'],
  NHL:  ['icehockey_nhl', 'icehockey_nhl_playoffs'],
  NFL:  ['americanfootball_nfl', 'americanfootball_nfl_preseason', 'americanfootball_nfl_playoffs'],
  CFB:  ['americanfootball_ncaaf', 'americanfootball_ncaaf_championship_winner'],
  NBA2: ['basketball_nba_championship_winner'],
  ATP:  [
    'tennis_atp_french_open',
    'tennis_atp_wimbledon',
    'tennis_atp_us_open',
    'tennis_atp_australian_open',
    'tennis_atp',
  ],
  WTA:  [
    'tennis_wta_french_open',
    'tennis_wta_wimbledon',
    'tennis_wta_us_open',
    'tennis_wta_australian_open',
    'tennis_wta',
  ],
  UFC:  ['mma_mixed_martial_arts'],
  Soccer: [
    'soccer_usa_mls',
    'soccer_epl',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_spain_la_liga',
    'soccer_germany_bundesliga',
    'soccer_italy_serie_a',
    'soccer_france_ligue_one',
  ],
};

// All supported sport keys combined
const ALL_KEYS = Object.values(SPORT_KEYS).flat();

function getEligibleRange(startDate?: string, deadline?: string): { start: Date; end: Date } {
  const now = new Date();

  // Start: midnight ET on the pool's start_date, or now if that's already past
  let start = now;
  if (startDate) {
    const dateOnly = startDate.substring(0, 10);
    const parts = dateOnly.split('-').map(Number);
    const poolStart = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 4, 0, 0, 0));
    start = poolStart > now ? poolStart : now;
  }

  // End: use the round deadline so games after the deadline day aren't shown
  let end: Date;
  if (deadline) {
    const dl = new Date(deadline);
    const etOffset = -4 * 60;
    const dlET = new Date(dl.getTime() + etOffset * 60000);
    end = new Date(Date.UTC(dlET.getUTCFullYear(), dlET.getUTCMonth(), dlET.getUTCDate() + 1, 4, 0, 0, 0));
  } else {
    end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'All';

  if (!ODDS_API_KEY) {
    return NextResponse.json({ error: 'Odds API key not configured' }, { status: 500 });
  }

  const keysToFetch = sport === 'All' ? ALL_KEYS : (SPORT_KEYS[sport] ?? ALL_KEYS);
  const startDate = searchParams.get('start') ?? undefined;
  const deadline = searchParams.get('deadline') ?? undefined;
  const todayOnly = searchParams.get('today_only') === 'true';
  const noOddsLimit = searchParams.get('no_odds_limit') === 'true';
  let { start: tomorrowStart, end: tomorrowEnd } = getEligibleRange(startDate, deadline);

  // For team_battle pools: only show games starting today (ET).
  // Override tomorrowEnd to midnight ET tonight regardless of deadline.
  if (todayOnly) {
    const now = new Date();
    // Convert now to ET (EDT = UTC-4)
    const nowET = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    // Midnight at the end of today ET = start of tomorrow ET = UTC date tomorrow at 04:00
    tomorrowEnd = new Date(Date.UTC(
      nowET.getUTCFullYear(), nowET.getUTCMonth(), nowET.getUTCDate() + 1,
      4, 0, 0, 0
    ));
    // Also move tomorrowStart to start of today ET if it's somehow in the future
    const startOfTodayET = new Date(Date.UTC(
      nowET.getUTCFullYear(), nowET.getUTCMonth(), nowET.getUTCDate(),
      4, 0, 0, 0
    ));
    if (tomorrowStart > tomorrowEnd) tomorrowStart = startOfTodayET;
  }

  const allGames: any[] = [];

  for (const sportKey of keysToFetch) {
    try {
      const res = await fetch(
        `${BASE_URL}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals,h2h&oddsFormat=american&dateFormat=iso`,
        { cache: 'no-store' }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) allGames.push(...data);
    } catch {
      continue;
    }
  }

  // Fetch ESPN scoreboard for NBA totals fallback (over/under + actual odds when odds API is missing them)
  // Key: "homeLast_awayLast" (last word of each team name, lowercased) -> { overUnder, overOdds, underOdds }
  const espnTotalsMap = new Map<string, { overUnder: number; overOdds: number; underOdds: number } | undefined>();
  try {
    const now = new Date();
    const datesToCheck = [0, 1, 2, 3].map(offset => {
      const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    });
    for (const dateStr of datesToCheck) {
      try {
        const espnRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`,
          { cache: 'no-store' }
        );
        if (!espnRes.ok) continue;
        const espnData = await espnRes.json();
        for (const event of espnData?.events ?? []) {
          const competition = event.competitions?.[0];
          if (!competition) continue;
          const odds = competition.odds?.[0];
          if (!odds?.overUnder) continue;
          const overUnder = parseFloat(odds.overUnder);
          if (isNaN(overUnder)) continue;
          const overOddsRaw = odds.total?.over?.close?.odds ?? odds.total?.over?.open?.odds ?? '-110';
          const underOddsRaw = odds.total?.under?.close?.odds ?? odds.total?.under?.open?.odds ?? '-110';
          const overOdds = parseInt(String(overOddsRaw)) || -110;
          const underOdds = parseInt(String(underOddsRaw)) || -110;
          const entry = { overUnder, overOdds, underOdds };
          const competitors: any[] = competition.competitors ?? [];
          // Store under every combination of team name last words so lookup always hits
          const lastWords = competitors.map((c: any) =>
            (c.team?.displayName ?? c.team?.name ?? '').split(' ').pop()?.toLowerCase()
          ).filter(Boolean);
          // Store keyed by each individual team last word too (fallback)
          for (const w of lastWords) espnTotalsMap.set(w as string, entry);
          // Store keyed by sorted pair for precise match
          if (lastWords.length >= 2) {
            espnTotalsMap.set(`${lastWords[0]}_${lastWords[1]}`, entry);
            espnTotalsMap.set(`${lastWords[1]}_${lastWords[0]}`, entry);
          }
        }
      } catch { continue; }
    }
  } catch { /* ESPN fallback is best-effort */ }

  const eligibleGames = allGames
    .filter(game => {
      const t = new Date(game.commence_time);
      return t >= tomorrowStart && t < tomorrowEnd;
    })
    .map(game => {
      const bookmakers: any[] = game.bookmakers ?? [];
      if (!bookmakers.length) return null;

      // For each market type, find the first bookmaker that has it posted
      const spreadsMarket = bookmakers.map((b: any) => b.markets?.find((m: any) => m.key === 'spreads')).find(Boolean);
      const totalsMarket  = bookmakers.map((b: any) => b.markets?.find((m: any) => m.key === 'totals')).find(Boolean);
      const h2hMarket     = bookmakers.map((b: any) => b.markets?.find((m: any) => m.key === 'h2h')).find(Boolean);
      const bookmaker = bookmakers[0];

      const picks: any[] = [];

      if (spreadsMarket) {
        for (const outcome of spreadsMarket.outcomes) {
          const odds = Math.round(outcome.price);
          if (odds >= -145 && odds <= -100) {
            picks.push({
              type: 'spread',
              team: outcome.name,
              line: outcome.point >= 0 ? `+${outcome.point}` : `${outcome.point}`,
              odds,
              label: `${outcome.name} ${outcome.point >= 0 ? '+' : ''}${outcome.point}`,
            });
          }
        }
      }

      if (totalsMarket) {
        for (const outcome of totalsMarket.outcomes) {
          const odds = Math.round(outcome.price);
          picks.push({
            type: 'total',
            team: outcome.name,
            line: `${outcome.name} ${outcome.point}`,
            odds,
            label: `${outcome.name} ${outcome.point}`,
          });
        }
      } else {
        // Fallback: use ESPN over/under if odds API didn't return totals
        const homeLast = game.home_team.split(' ').pop()?.toLowerCase();
        const awayLast = game.away_team.split(' ').pop()?.toLowerCase();
        const espnTotal = (homeLast && awayLast)
          ? (espnTotalsMap.get(`${homeLast}_${awayLast}`) ?? espnTotalsMap.get(homeLast) ?? espnTotalsMap.get(awayLast ?? ''))
          : null;
        if (espnTotal) {
          picks.push(
            { type: 'total', team: 'Over', line: `Over ${espnTotal.overUnder}`, odds: espnTotal.overOdds, label: `Over ${espnTotal.overUnder}` },
            { type: 'total', team: 'Under', line: `Under ${espnTotal.overUnder}`, odds: espnTotal.underOdds, label: `Under ${espnTotal.overUnder}` },
          );
        }
      }

      if (h2hMarket) {
        for (const outcome of h2hMarket.outcomes) {
          const odds = Math.round(outcome.price);
          if (noOddsLimit || odds > 0 || odds >= -150) {
            picks.push({
              type: 'moneyline',
              team: outcome.name,
              line: null,
              odds,
              label: outcome.name,
            });
          }
        }
      }

      if (picks.length === 0) return null;

      return {
        id: game.id,
        sport: game.sport_title,
        sportKey: game.sport_key,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        bookmaker: bookmaker.title,
        picks,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ games: eligibleGames });
}
