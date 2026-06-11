'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Pool, Round, Pick as SubmittedPick, PoolParticipant } from '@/types';
import { timeUntil } from '@/lib/utils';

interface GamePick {
  type: 'spread' | 'total' | 'moneyline';
  team: string;
  line: string | null;
  odds: number;
  label: string;
}

interface Game {
  id: string;
  sport: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmaker: string;
  picks: GamePick[];
}

interface GameBoardProps {
  pool: Pool;
  round: Round;
  participant: PoolParticipant;
  existingPick: SubmittedPick | null;
  isLocked: boolean;
  userId: string;
  inline?: boolean;
  onPickSubmitted?: () => void;
}

const SPORTS = ['All', 'NBA', 'WNBA', 'MLB', 'NHL', 'ATP', 'WTA', 'World Cup'] as const;

export default function GameBoard({ pool, round, existingPick, isLocked, inline, onPickSubmitted }: GameBoardProps) {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedPick, setSelectedPick] = useState<GamePick | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'spread' | 'total' | 'moneyline'>('all');
  const [usedTeams, setUsedTeams] = useState<string[]>([]);
  const isSurvivorNoRepeat = (pool.contest_format as string) === 'survivor_no_repeat';
  const isWorldCup = pool.sport === 'World Cup';
  // Normalize sport — "All Sports" means no lock, show all with tabs
  const normalizedSport = pool.sport === 'All Sports' ? 'All' : pool.sport;
  const lockedSport = (normalizedSport !== 'All' && SPORTS.includes(normalizedSport as any)) ? normalizedSport : null;
  const [sportFilter, setSportFilter] = useState<string>(lockedSport ?? 'All');

  useEffect(() => {
    fetchGames();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportFilter]);

  useEffect(() => {
    if (!isSurvivorNoRepeat) return;
    fetch(`/api/pools/${pool.id}/picks`)
      .then(r => r.json())
      .then(d => {
        const sides = (d.picks ?? []).map((p: any) => p.side.toLowerCase().trim());
        setUsedTeams(sides);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.id, isSurvivorNoRepeat]);

  async function fetchGames() {
    setLoading(true);
    try {
      const deadlineParam = round.deadline ? `&deadline=${encodeURIComponent(round.deadline)}` : '';
      const startParam = pool.start_date ? `&start=${encodeURIComponent(pool.start_date)}` : '';
      const todayOnly = pool.contest_format === 'team_battle' ? '&today_only=true' : '';
      const noOddsLimit = isSurvivorNoRepeat ? '&no_odds_limit=true' : '';
      const noML = isWorldCup ? '&no_ml=true' : '';
      const res = await fetch(`/api/odds?sport=${encodeURIComponent(sportFilter)}${deadlineParam}${startParam}${todayOnly}${noOddsLimit}${noML}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setGames([]);
      } else {
        setGames(data.games || []);
      }
    } catch (e) {
      toast.error('Failed to load games');
    } finally {
      setLoading(false);
    }
  }

  async function submitPick() {
    if (!selectedGame || !selectedPick) return;
    setSubmitting(true);

    try {
      const body = {
        round_id: round.id,
        sport: selectedGame.sport,
        league: selectedGame.sportKey,
        game: `${selectedGame.awayTeam} @ ${selectedGame.homeTeam}`,
        pick_type: selectedPick.type,
        side: selectedPick.team,
        line_value: selectedPick.line ?? selectedPick.label,
        american_odds: selectedPick.odds,
        game_start_time: selectedGame.commenceTime,
      };

      const method = existingPick ? 'PATCH' : 'POST';
      const url = existingPick
        ? `/api/pools/${pool.id}/picks/${existingPick.id}`
        : `/api/pools/${pool.id}/picks`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit pick');
        return;
      }

      toast.success('Pick locked in! 🎯');
      setSelectedPick(null);
      setSelectedGame(null);
      if (inline && onPickSubmitted) {
        onPickSubmitted();
      } else {
        router.push(`/pools/${pool.id}`);
        router.refresh();
      }
    } catch (e) {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  // Group games by sport
  const gamesBySport = games.reduce((acc, game) => {
    const key = game.sport;
    if (!acc[key]) acc[key] = [];
    acc[key].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  if (isLocked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Round {round.round_number} Locked</h2>
          <p className="text-gray-400">The pick window has closed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? '' : 'min-h-screen bg-gray-950'}>
      {/* Header */}
      <div className={inline ? 'border-b border-gray-800 mb-4' : 'sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800'}>
        <div className={inline ? 'py-2' : 'max-w-4xl mx-auto px-4 py-3'}>
          {!inline && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg font-bold text-white">{pool.name}</h1>
                <p className="text-sm text-gray-400">Round {round.round_number} · Locks in {timeUntil(round.deadline)}</p>
              </div>
              <div className="text-right">
                {existingPick && !selectedPick && (
                  <div className="bg-green-500/20 border border-green-500/40 rounded-lg px-3 py-1">
                    <p className="text-xs text-green-400 font-medium">Pick submitted ✓</p>
                    <p className="text-xs text-green-300">{existingPick.pick_type === 'moneyline' ? `${existingPick.side} ML` : existingPick.pick_type === 'total' ? existingPick.line_value : `${existingPick.side} ${existingPick.line_value}`}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sport tabs — hidden when pool is locked to a specific sport */}
          {!lockedSport && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin mb-2">
            {SPORTS.map(s => (
              <button
                key={s}
                onClick={() => setSportFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  sportFilter === s
                    ? 'bg-white text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          )}

          {/* Pick type filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {(['all', 'spread', 'total', 'moneyline'] as const).filter(f => !isWorldCup || f !== 'moneyline').map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === f
                    ? 'bg-green-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'All Types' : f === 'moneyline' ? 'ML' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected pick bar */}
      {selectedPick && selectedGame && (
        <div className="sticky top-[105px] z-30 bg-gray-900 border-b border-green-500/50 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {selectedPick.label}
                </p>
                <p className="text-gray-400 text-xs truncate">
                  {selectedGame.awayTeam} @ {selectedGame.homeTeam} · {selectedPick.type}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => { setSelectedPick(null); setSelectedGame(null); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg"
              >
                Clear
              </button>
              <button
                onClick={submitPick}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold bg-green-500 hover:bg-green-400 text-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Locking...' : existingPick ? 'Update Pick' : 'Lock In Pick'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Survivor no-repeat: used teams banner */}
      {isSurvivorNoRepeat && usedTeams.length > 0 && (
        <div className={inline ? 'px-2 py-2' : 'max-w-4xl mx-auto px-4 pt-3'}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Teams Already Used</p>
            <div className="flex flex-wrap gap-1.5">
              {usedTeams.map(team => (
                <span key={team} className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg line-through">
                  {team}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game list */}
      <div className={inline ? 'py-2' : 'max-w-4xl mx-auto px-4 py-4 pb-24'}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-1/3 mb-3" />
                <div className="h-6 bg-gray-800 rounded w-2/3 mb-3" />
                <div className="flex gap-2">
                  <div className="h-10 bg-gray-800 rounded flex-1" />
                  <div className="h-10 bg-gray-800 rounded flex-1" />
                  <div className="h-10 bg-gray-800 rounded flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="text-xl font-bold text-white mb-2">No eligible games right now</h3>
            <p className="text-gray-400 text-sm">Check back closer to game time. Only games with eligible lines (-110 spreads/totals, -150 or better moneylines) appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(gamesBySport).map(([sport, sportGames]) => (
              <div key={sport}>
                {/* Sport header */}
                <div className="flex items-center gap-2 py-2 px-1 mb-1">
                  <div className="w-1 h-4 bg-green-500 rounded-full" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{sport}</span>
                  <span className="text-xs text-gray-600">({sportGames.length} games)</span>
                </div>

                {sportGames.map(game => {
                  const isSelected = selectedGame?.id === game.id;
                  const gameTime = new Date(game.commenceTime);
                  const spreads = game.picks.filter(p => p.type === 'spread');
                  const totals = game.picks.filter(p => p.type === 'total');
                  // For World Cup: only show Draw from moneyline picks
                  const mls = isWorldCup
                    ? game.picks.filter(p => p.type === 'moneyline' && p.team.toLowerCase() === 'draw')
                    : game.picks.filter(p => p.type === 'moneyline');

                  const showSpreads = filter === 'all' || filter === 'spread';
                  const showTotals = filter === 'all' || filter === 'total';
                  // For World Cup, always show Draw (it appears in the moneyline slot)
                  const showMLs = isWorldCup ? true : (filter === 'all' || filter === 'moneyline');

                  const isTeamUsed = (team: string) =>
                    isSurvivorNoRepeat && usedTeams.includes(team.toLowerCase().trim());

                  return (
                    <div
                      key={game.id}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? 'border-green-500/60 bg-gray-900/80'
                          : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                      }`}
                    >
                      {/* Game header */}
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold text-sm leading-tight">{game.awayTeam}</p>
                            <p className="text-gray-400 text-xs mt-0.5">@ {game.homeTeam}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {gameTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-yellow-400 font-medium">
                              {gameTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pick buttons grid */}
                      <div className="px-3 pb-3 space-y-2">
                        {/* Spreads */}
                        {showSpreads && spreads.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 px-1">Spread</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {spreads.map((pick, i) => {
                                const isPickSelected = selectedPick === pick && selectedGame?.id === game.id;
                                const burned = isTeamUsed(pick.team);
                                return (
                                  <button
                                    key={i}
                                    disabled={burned}
                                    onClick={() => {
                                      setSelectedGame(game);
                                      setSelectedPick(isPickSelected ? null : pick);
                                    }}
                                    className={`flex items-center justify-center px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                      burned
                                        ? 'bg-gray-800/30 border-gray-800 text-gray-600 cursor-not-allowed line-through'
                                        : isPickSelected
                                          ? 'bg-green-500 border-green-500 text-black'
                                          : 'bg-gray-800/60 border-gray-700 text-white hover:bg-gray-700 hover:border-gray-600'
                                    }`}
                                  >
                                    <span className="truncate">{pick.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Totals */}
                        {showTotals && totals.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 px-1">Total</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {totals.map((pick, i) => {
                                const isPickSelected = selectedPick === pick && selectedGame?.id === game.id;
                                return (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setSelectedGame(game);
                                      setSelectedPick(isPickSelected ? null : pick);
                                    }}
                                    className={`flex items-center justify-center px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                      isPickSelected
                                        ? 'bg-green-500 border-green-500 text-black'
                                        : 'bg-gray-800/60 border-gray-700 text-white hover:bg-gray-700 hover:border-gray-600'
                                    }`}
                                  >
                                    <span className="truncate">{pick.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Moneylines */}
                        {showMLs && mls.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 px-1">Moneyline</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {mls.map((pick, i) => {
                                const isPickSelected = selectedPick === pick && selectedGame?.id === game.id;
                                const burned = isTeamUsed(pick.team);
                                return (
                                  <button
                                    key={i}
                                    disabled={burned}
                                    onClick={() => {
                                      setSelectedGame(game);
                                      setSelectedPick(isPickSelected ? null : pick);
                                    }}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                      burned
                                        ? 'bg-gray-800/30 border-gray-800 text-gray-600 cursor-not-allowed line-through'
                                        : isPickSelected
                                          ? 'bg-green-500 border-green-500 text-black'
                                          : 'bg-gray-800/60 border-gray-700 text-white hover:bg-gray-700 hover:border-gray-600'
                                    }`}
                                  >
                                    <span className="truncate">{pick.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
