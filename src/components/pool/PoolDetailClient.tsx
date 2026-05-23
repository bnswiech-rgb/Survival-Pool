'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CountdownTimer } from './CountdownTimer';
import { PoolChat } from '@/components/chat/PoolChat';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { formatCents, calculatePrizePool, getContestFormatLabel } from '@/lib/utils';
import type { Pool, PoolParticipant, Round, Pick, Profile } from '@/types';
import toast from 'react-hot-toast';
import { Users, Clock, Trophy, Target, Zap } from 'lucide-react';
import GameBoard from '@/app/(app)/pools/[id]/picks/GameBoard';

interface Props {
  pool: Pool;
  initialParticipants: PoolParticipant[];
  initialCurrentRound: Round | null;
  latestRoundNumber: number;
  initialMyPick: Pick | null;
  myParticipation: PoolParticipant | null;
  currentUser: Profile | null;
  initialPicks: Pick[];
  currentRoundGradedPicks?: { user_id: string; status: string }[];
  initialMyTeam?: any;
  initialAllTeams?: any[];
  submittedPickUserIds?: string[];
}

const TABS = ['Overview', 'Picks', 'Survivors', 'History', 'Chat'];
const getTabLabel = (tab: string, isTeamBattle: boolean) =>
  tab === 'Survivors' && isTeamBattle ? 'Teams' : tab;

export function PoolDetailClient({
  pool,
  initialParticipants,
  initialCurrentRound,
  latestRoundNumber,
  initialMyPick,
  myParticipation: initMy,
  currentUser,
  initialPicks,
  currentRoundGradedPicks = [],
  initialMyTeam = null,
  initialAllTeams = [],
  submittedPickUserIds = [],
}: Props) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [participants, setParticipants] = useState(initialParticipants);
  const [myParticipation, setMyParticipation] = useState(initMy);
  const [myPick, setMyPick] = useState(initialMyPick);
  const [picks, setPicks] = useState(initialPicks);
  const [joiningLoading, setJoiningLoading] = useState(false);
  const [historyRounds, setHistoryRounds] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [roundOpen, setRoundOpen] = useState(initialCurrentRound?.status === 'open');
  const [myTeam, setMyTeam] = useState<any>(initialMyTeam);
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const supabase = createClient();

  // Auto-fill invite code from URL param (e.g. ?joinTeam=XK9F2A)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('joinTeam');
    if (code) {
      setTeamCode(code.toUpperCase());
      setActiveTab('Overview');
    }
  }, []);

  const { netPrizePool } = calculatePrizePool(
    pool.entry_fee_cents,
    participants.length,
    pool.rake_percentage
  );

  const aliveCount = participants.filter(p => p.status === 'active' || p.status === 'advanced').length;
  const eliminatedCount = participants.filter(p => p.status === 'eliminated').length;
  const isStreakRace = pool.contest_format === 'streak_race';
  // Project live streak/wins/losses from current round's already-graded picks,
  // so standings reflect reality before the round officially closes at 4 AM.
  // Only apply projection while round is still open — once closed, DB values are authoritative.
  const livePickByUser = roundOpen
    ? Object.fromEntries(currentRoundGradedPicks.map(p => [p.user_id, p.status]))
    : {};
  function projectStreak(p: PoolParticipant): number {
    const stored = (p as any).current_streak ?? 0;
    const pickStatus = livePickByUser[p.user_id];
    if (!pickStatus) return stored;
    if (pickStatus === 'won') return stored < 0 ? 1 : stored + 1;
    if (pickStatus === 'lost') return stored > 0 ? -1 : stored - 1;
    return stored; // push
  }
  function projectWins(p: PoolParticipant): number {
    return livePickByUser[p.user_id] === 'won' ? p.wins + 1 : p.wins;
  }
  function projectLosses(p: PoolParticipant): number {
    return livePickByUser[p.user_id] === 'lost' ? p.losses + 1 : p.losses;
  }

  const leaderStreak = isStreakRace ? participants.reduce((max, p) => Math.max(max, projectStreak(p)), 0) : 0;
  const leadersCount = leaderStreak > 0 ? participants.filter(p => projectStreak(p) === leaderStreak).length : 0;

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`pool-${pool.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_participants', filter: `pool_id=eq.${pool.id}` },
        async () => {
          const { data } = await supabase
            .from('pool_participants')
            .select('*, profiles(username, avatar_url, role, wins, losses, pushes, pools_entered, pools_won, created_at)')
            .eq('pool_id', pool.id)
            .order('wins', { ascending: false });
          if (data) {
            setParticipants(data as any);
            const mine = data.find((p: any) => p.user_id === currentUser?.id);
            if (mine) setMyParticipation(mine as any);
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `pool_id=eq.${pool.id}` },
        (payload: any) => {
          if (payload.new?.status === 'completed') setRoundOpen(false);
          if (payload.new?.status === 'open') setRoundOpen(true);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pool.id, currentUser?.id, supabase]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) { toast.error('Enter a team name'); return; }
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/pools/${pool.id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create team');
      setMyTeam({ ...data.team, pool_participants: [{ user_id: currentUser?.id, profiles: { username: currentUser?.username, avatar_url: currentUser?.avatar_url } }] });
      setTeamName('');
      toast.success('Team created!');
    } catch (e: any) {
      toast.error(e.message);
    }
    setTeamLoading(false);
  };

  const handleJoinTeam = async () => {
    if (!teamCode.trim()) { toast.error('Enter an invite code'); return; }
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/pools/${pool.id}/teams/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: teamCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join team');
      // Refresh team data
      const { data: teamData } = await supabase
        .from('teams')
        .select('*, pool_participants(user_id, profiles(username, avatar_url))')
        .eq('id', data.team.id)
        .single();
      setMyTeam(teamData);
      setTeamCode('');
      toast.success(`Joined ${data.team.name}!`);
    } catch (e: any) {
      toast.error(e.message);
    }
    setTeamLoading(false);
  };

  const handleJoin = async () => {
    if (!currentUser) { toast.error('Please log in first'); return; }
    setJoiningLoading(true);
    try {
      const res = await fetch(`/api/pools/${pool.id}/join`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      toast.success('Successfully joined the contest!');
      setMyParticipation(data.participant);
    } catch (e: any) {
      toast.error(e.message);
    }
    setJoiningLoading(false);
  };

  // After pick submitted inline, refresh picks list
  const handlePickSubmitted = async () => {
    if (!initialCurrentRound) return;
    // Refresh my pick
    const { data: pick } = await supabase
      .from('picks')
      .select('*')
      .eq('pool_id', pool.id)
      .eq('round_id', initialCurrentRound.id)
      .eq('user_id', currentUser!.id)
      .maybeSingle();
    if (pick) setMyPick(pick as any);

    // Refresh all picks for this round
    const { data: allPicks } = await supabase
      .from('picks')
      .select('*, profiles(username, avatar_url)')
      .eq('pool_id', pool.id)
      .eq('round_id', initialCurrentRound.id)
      .order('submitted_at', { ascending: false });
    if (allPicks) setPicks(allPicks as any);
  };

  const loadHistory = async () => {
    if (historyLoaded || historyLoading) return;
    setHistoryLoading(true);
    try {
      const [{ data: rounds }, { data: myPicks }, { data: allPicks }] = await Promise.all([
        supabase
          .from('rounds')
          .select('*')
          .eq('pool_id', pool.id)
          .eq('status', 'completed')
          .order('round_number', { ascending: true }),
        currentUser
          ? supabase
              .from('picks')
              .select('*')
              .eq('pool_id', pool.id)
              .eq('user_id', currentUser.id)
              .order('submitted_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase
          .from('picks')
          .select('*, profiles(username, avatar_url)')
          .eq('pool_id', pool.id)
          .neq('status', 'pending')
          .order('submitted_at', { ascending: false }),
      ]);

      const myPicksByRound = Object.fromEntries(
        (myPicks ?? []).map((p: any) => [p.round_id, p])
      );
      const allPicksByRound: Record<string, any[]> = {};
      for (const pick of allPicks ?? []) {
        if (!allPicksByRound[pick.round_id]) allPicksByRound[pick.round_id] = [];
        allPicksByRound[pick.round_id].push(pick);
      }

      setHistoryRounds(
        (rounds ?? []).map((round: any) => ({
          round,
          myPick: myPicksByRound[round.id] ?? null,
          allPicks: allPicksByRound[round.id] ?? [],
        }))
      );
    } finally {
      setHistoryLoading(false);
      setHistoryLoaded(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'History' && !historyLoaded) {
      loadHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const isAdmin = currentUser?.role === 'admin';
  const hasSubmittedPick = !!myPick;
  const picksVisible = hasSubmittedPick || isAdmin;
  const isRoundLocked = !initialCurrentRound || initialCurrentRound.status !== 'open' || new Date(initialCurrentRound.deadline) < new Date();
  const canSubmitPick = myParticipation && (myParticipation.status === 'active' || myParticipation.status === 'advanced') && !isRoundLocked;

  // Build a map of userId -> pick for the survivors tab
  const pickByUser = Object.fromEntries(picks.map((p: any) => [p.user_id, p]));

  function pickLabel(pick: any) {
    if (!pick) return null;
    if (pick.pick_type === 'total') return pick.line_value;
    if (pick.pick_type === 'moneyline') return `${pick.side} ML`;
    return `${pick.side} ${pick.line_value}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-3xl font-black text-white">{pool.name}</h1>
            <Badge variant="purple">{getContestFormatLabel(pool.contest_format)}</Badge>
          </div>
          <div className="text-gray-400">{pool.sport}</div>
        </div>
        {!myParticipation && (pool.status === 'open' || pool.status === 'upcoming' || (pool.contest_format === 'streak_race' && pool.status === 'active')) && currentUser && (
          <Button onClick={handleJoin} loading={joiningLoading} size="lg">
            Join Contest {pool.entry_fee_cents > 0 ? `• ${formatCents(pool.entry_fee_cents)}` : '• Free'}
          </Button>
        )}
        {!myParticipation && pool.contest_format !== 'streak_race' && (pool.status === 'active' || pool.status === 'completed') && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-400">
            🔒 This pool has already started — new entries are closed
          </div>
        )}
      </div>

      {/* My Status Banner */}
      {myParticipation && (
        <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
          myParticipation.status === 'eliminated'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-green-500/10 border-green-500/30'
        }`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-white">
                {myParticipation.status === 'eliminated' ? '💀 Eliminated' : '🟢 Alive'}
              </span>
              {isStreakRace ? (() => {
                const s = (myParticipation as any).current_streak ?? 0;
                const label = s > 0 ? `${s}W streak` : s < 0 ? `${Math.abs(s)}L streak` : '0W streak';
                return (
                  <span className={`font-bold text-sm ${s > 0 ? 'text-green-400' : s < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {label} · target {pool.target_streak}W
                  </span>
                );
              })() : (
                <span className="text-gray-400 text-sm">
                  W{myParticipation.wins}-L{myParticipation.losses}-P{myParticipation.pushes}
                </span>
              )}
            </div>
            {myPick ? (
              <div className="text-sm text-gray-300 mt-0.5 truncate">
                {pickLabel(myPick)} · <span className={
                  myPick.status === 'won' ? 'text-green-400' :
                  myPick.status === 'lost' ? 'text-red-400' :
                  myPick.status === 'push' ? 'text-blue-400' : 'text-yellow-400'
                }>{myPick.status}</span>
              </div>
            ) : canSubmitPick ? (
              <div className="text-sm text-yellow-400 mt-0.5">⚠ No pick yet — go to the Picks tab</div>
            ) : null}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {getTabLabel(tab, pool.contest_format === 'team_battle')}
            {tab === 'Picks' && canSubmitPick && !hasSubmittedPick && (
              <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-yellow-400 align-middle" />
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Team section — only for team_battle pools */}
            {pool.contest_format === 'team_battle' && myParticipation && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-purple-400" />
                    <h3 className="font-bold text-white">Your Team</h3>
                  </div>
                </CardHeader>
                <CardBody>
                  {myTeam ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-lg">{myTeam.name}</span>
                        <span className="text-xs text-gray-500">{(pool as any).team_size ? `${(myTeam.pool_participants ?? []).length}/${(pool as any).team_size} members` : `${(myTeam.pool_participants ?? []).length} members`}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(myTeam.pool_participants ?? []).map((m: any) => (
                          <div key={m.user_id} className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1">
                            <Avatar src={m.profiles?.avatar_url} username={m.profiles?.username ?? '?'} size="xs" />
                            <span className="text-sm text-white">{m.profiles?.username ?? 'Unknown'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-gray-800">
                        <div className="text-xs text-gray-400 mb-1">Team Invite</div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-bold text-green-400 bg-gray-800 px-3 py-1.5 rounded flex-1 tracking-widest">
                            {myTeam.invite_code}
                          </code>
                          <button
                            onClick={() => {
                              const link = `${window.location.origin}/pools/${pool.id}?joinTeam=${myTeam.invite_code}`;
                              if (navigator.share) {
                                navigator.share({ title: `Join my team in ${pool.name}`, url: link });
                              } else {
                                navigator.clipboard.writeText(link);
                                toast.success('Invite link copied!');
                              }
                            }}
                            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 border border-gray-700 rounded whitespace-nowrap"
                          >
                            Share link
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Share this link — teammates land on the pool page with the code pre-filled</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400 font-medium">Create a new team</p>
                        <div className="flex gap-2">
                          <input
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                            placeholder="Team name..."
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                          />
                          <Button onClick={handleCreateTeam} loading={teamLoading} size="sm">Create</Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="flex-1 h-px bg-gray-800" />
                        <span>or</span>
                        <div className="flex-1 h-px bg-gray-800" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400 font-medium">Join with an invite code</p>
                        <div className="flex gap-2">
                          <input
                            value={teamCode}
                            onChange={e => setTeamCode(e.target.value.toUpperCase())}
                            placeholder="Enter code..."
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 tracking-widest uppercase"
                            maxLength={6}
                            onKeyDown={e => e.key === 'Enter' && handleJoinTeam()}
                          />
                          <Button onClick={handleJoinTeam} loading={teamLoading} size="sm" variant="secondary">Join</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400" />
                  <h3 className="font-bold text-white">{pool.entry_fee_cents === 0 ? 'Bragging Rights' : 'Prize Pool'}</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {(pool as any).prize_description ? (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-3xl font-black text-white">Prize</span>
                      <span className="text-3xl font-black text-green-400">{(pool as any).prize_description}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">(winner takes all)</p>
                      <p className="text-xs text-gray-400">
                        <span className="text-green-400 font-bold">{aliveCount}</span> survivor{aliveCount !== 1 ? 's' : ''} remaining
                      </p>
                    </div>
                  </>
                ) : pool.entry_fee_cents > 0 ? (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-3xl font-black text-white">Pot</span>
                      <span className="text-3xl font-black text-green-400">{formatCents(netPrizePool)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">(winner takes all)</p>
                      <p className="text-xs text-gray-400">
                        <span className="text-green-400 font-bold">{aliveCount}</span> survivor{aliveCount !== 1 ? 's' : ''} remaining
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Free contest — last one standing wins</span>
                    <p className="text-xs text-gray-400">
                      <span className="text-green-400 font-bold">{aliveCount}</span> survivor{aliveCount !== 1 ? 's' : ''} remaining
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <Clock size={14} className="text-yellow-400" />
                  {isStreakRace ? (
                    <span className="text-gray-400 text-sm">
                      First to <span className="text-white font-bold">{pool.target_streak} in a row</span> wins
                      {leaderStreak > 0 && (
                        <span className="ml-2 text-gray-600">·</span>
                      )}
                      {leaderStreak > 0 && (
                        <span className="ml-2">
                          <span className="text-white font-bold">{leadersCount}</span>
                          <span> {leadersCount === 1 ? 'person' : 'people'} tied at </span>
                          <span className="text-green-400 font-bold">{leaderStreak}W</span>
                        </span>
                      )}
                    </span>
                  ) : (
                    <>
                      <span className="text-gray-400 text-sm">Currently on</span>
                      <span className="text-white font-bold text-sm">Round {latestRoundNumber}</span>
                    </>
                  )}
                  {initialCurrentRound && !isStreakRace && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-400 text-sm">picks due</span>
                      <CountdownTimer deadline={initialCurrentRound.deadline} />
                    </>
                  )}
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Entries', value: participants.length, icon: Users },
                { label: 'Alive', value: aliveCount, icon: Zap },
                { label: 'Eliminated', value: eliminatedCount, icon: Target },
                isStreakRace
                  ? { label: 'Target', value: `${pool.target_streak}W`, icon: Trophy }
                  : { label: 'Round', value: latestRoundNumber, icon: Trophy },
              ].map(s => (
                <Card key={s.label}>
                  <CardBody className="text-center py-3">
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {pool.contest_format === 'lives' && (
              <Card><CardBody><div className="text-sm text-gray-400"><strong className="text-white">Lives Mode:</strong> Each participant starts with {pool.lives_count} {pool.lives_count === 1 ? 'life' : 'lives'}. Lose a pick, lose a life. Run out of lives and you&apos;re eliminated.</div></CardBody></Card>
            )}
            {pool.contest_format === 'streak_race' && (
              <Card><CardBody><div className="text-sm text-gray-400"><strong className="text-white">Streak Race:</strong> First to reach {pool.target_streak} consecutive wins claims victory. A loss resets your streak to zero.</div></CardBody></Card>
            )}
            {pool.contest_format === 'first_to_x' && (
              <Card><CardBody><div className="text-sm text-gray-400"><strong className="text-white">First To X:</strong> First participant to reach {pool.target_wins} total wins wins the contest.</div></CardBody></Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><h3 className="font-bold text-white">Contest Rules</h3></CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Format</span><span className="text-white">{getContestFormatLabel(pool.contest_format)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Push rule</span><span className="text-white capitalize">{pool.push_rule}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">All-lose rule</span><span className="text-white capitalize">{pool.all_lose_rule}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Frequency</span><span className="text-white capitalize">{pool.round_frequency}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Prize</span><span className="text-white capitalize">{pool.prize_structure.replace(/_/g, ' ')}</span></div>
                {pool.max_entries && <div className="flex justify-between"><span className="text-gray-400">Max entries</span><span className="text-white">{pool.max_entries}</span></div>}
                {currentUser?.id === pool.created_by && pool.visibility === 'private' && (pool as any).invite_code && (
                  <div className="pt-2 border-t border-gray-800">
                    <div className="text-xs text-gray-400 mb-1">Invite Link</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-green-400 bg-gray-800 px-2 py-1 rounded flex-1 truncate">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/invite/{(pool as any).invite_code}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/invite/${(pool as any).invite_code}`);
                          toast.success('Invite link copied!');
                        }}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 border border-gray-700 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader><h3 className="font-bold text-white text-sm">Pick Eligibility</h3></CardHeader>
              <CardBody className="text-xs text-gray-400 space-y-2">
                <p>• Spread/Total: odds must be between -115 and -105</p>
                <p>• Moneyline: must be -150 or better (less negative)</p>
                <p>• Heavily favored picks are not eligible</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Picks Tab */}
      {activeTab === 'Picks' && (
        <div className="space-y-6">
          {/* Game picker — show if user can still pick */}
          {canSubmitPick && initialCurrentRound && myParticipation && currentUser && (
            <div>
              {!hasSubmittedPick && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-yellow-400 font-bold text-sm">
                    {isStreakRace ? '📋 No pick submitted — skipping this round counts as a push' : '⚠ Pick not submitted yet'}
                  </span>
                  {!isStreakRace && <CountdownTimer deadline={initialCurrentRound.deadline} className="text-sm" />}
                </div>
              )}
              {hasSubmittedPick && (
                <div className="mb-4 text-sm text-green-400 font-medium">✓ Pick submitted — you can change it until the deadline</div>
              )}
              <GameBoard
                pool={pool}
                round={initialCurrentRound}
                participant={myParticipation}
                existingPick={myPick}
                isLocked={false}
                userId={currentUser.id}
                onPickSubmitted={handlePickSubmitted}
                inline
              />
            </div>
          )}

          {/* Locked round with no pick */}
          {!canSubmitPick && !hasSubmittedPick && myParticipation && myParticipation.status !== 'eliminated' && (
            <Card>
              <CardBody className="text-center py-8">
                <Clock size={28} className="text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">The pick window is closed for this round.</p>
              </CardBody>
            </Card>
          )}

          {/* Picks list — visible after submitting */}
          {picksVisible && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">{isStreakRace ? 'Picks' : `Round ${latestRoundNumber} Picks`}</h3>
              {picks.length === 0 ? (
                <Card><CardBody className="text-center py-8 text-gray-500">No picks submitted yet.</CardBody></Card>
              ) : (
                <div className="space-y-2">
                  {picks.map((pick: any) => (
                    <Card key={pick.id} className={pick.status === 'won' ? 'border-green-500/30' : pick.status === 'lost' ? 'border-red-500/30' : ''}>
                      <CardBody>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar src={pick.profiles?.avatar_url} username={pick.profiles?.username ?? '?'} size="xs" />
                            <div className="min-w-0">
                              <span className="font-bold text-white text-sm">{pick.profiles?.username ?? 'Unknown'}</span>
                              <div className="text-xs text-gray-400 truncate">{pick.game}</div>
                              <div className="text-xs text-white">{pickLabel(pick)} · <span className="text-gray-500 capitalize">{pick.pick_type}</span></div>
                            </div>
                          </div>
                          <Badge variant={pick.status === 'won' ? 'green' : pick.status === 'lost' ? 'red' : pick.status === 'push' ? 'blue' : 'gray'}>
                            {pick.status.toUpperCase()}
                          </Badge>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Not yet visible */}
          {!picksVisible && !canSubmitPick && (
            <Card>
              <CardBody className="text-center py-10">
                <Clock size={28} className="text-yellow-400 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Submit your pick to see everyone else&apos;s picks.</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Survivors Tab */}
      {activeTab === 'Survivors' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Survivors</h3>
            <div className="text-sm text-gray-400">
              {pool.contest_format === 'team_battle'
                ? `${initialAllTeams.length} team${initialAllTeams.length !== 1 ? 's' : ''}`
                : `${participants.length} entries`}
            </div>
          </div>

          {pool.contest_format === 'team_battle' ? (
            // Team view: group participants by team
            <div className="space-y-3">
              {(() => {
                const teamMap = new Map(initialAllTeams.map((t: any) => [t.id, t]));
                const byTeam = new Map<string, any[]>();
                const noTeam: any[] = [];
                for (const p of participants) {
                  const tid = (p as any).team_id;
                  if (!tid) { noTeam.push(p); continue; }
                  if (!byTeam.has(tid)) byTeam.set(tid, []);
                  byTeam.get(tid)!.push(p);
                }

                const teamEntries = [...byTeam.entries()].map(([tid, members]) => {
                  const team = teamMap.get(tid);
                  // Team status: winner if any member is winner, eliminated if all eliminated, else active
                  const isWinner = members.some((m: any) => m.status === 'winner');
                  const isElim = members.every((m: any) => m.status === 'eliminated');
                  const rep = members[0]; // use first member for record (all same in parlay)
                  return { tid, team, members, isWinner, isElim, wins: rep?.wins ?? 0, losses: rep?.losses ?? 0, pushes: rep?.pushes ?? 0 };
                }).sort((a, b) => {
                  if (a.isWinner && !b.isWinner) return -1;
                  if (b.isWinner && !a.isWinner) return 1;
                  if (a.isElim && !b.isElim) return 1;
                  if (b.isElim && !a.isElim) return -1;
                  return b.wins - a.wins;
                });

                return (
                  <>
                    {teamEntries.map(({ tid, team, members, isWinner, isElim, wins, losses, pushes }, idx) => (
                      <Card key={tid} className={isElim ? 'opacity-50' : isWinner ? 'border-yellow-500/30' : ''}>
                        <CardBody>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-gray-500 font-bold text-sm w-6 text-center flex-shrink-0">
                              {isWinner ? '🏆' : isElim ? '💀' : `#${idx + 1}`}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-bold ${isElim ? 'text-gray-500' : 'text-white'}`}>
                                  {team?.name ?? 'Unnamed Team'}
                                </span>
                                <span className="text-xs text-gray-500">W{wins}-L{losses}-P{pushes}</span>
                              </div>
                            </div>
                            <Badge variant={isWinner ? 'yellow' : isElim ? 'red' : 'green'}>
                              {isWinner ? 'Winner' : isElim ? 'Out' : 'Alive'}
                            </Badge>
                          </div>
                          <div className="ml-9 space-y-1">
                            {members.map((m: any) => {
                              const pick = picksVisible ? pickByUser[m.user_id] : null;
                              const hasLocked = submittedPickUserIds.includes(m.user_id);
                              return (
                                <div key={m.id} className="flex items-center gap-2">
                                  <Avatar src={m.profiles?.avatar_url} username={m.profiles?.username ?? '?'} size="xs" />
                                  <span className={`text-sm ${isElim ? 'text-gray-500' : 'text-gray-300'}`}>
                                    {m.profiles?.username ?? 'Unknown'}
                                  </span>
                                  {pick ? (
                                    <span className="text-xs text-gray-500 truncate">
                                      {pickLabel(pick)}
                                      {pick.status !== 'pending' && (
                                        <span className={`ml-1 font-bold ${pick.status === 'won' ? 'text-green-400' : pick.status === 'lost' ? 'text-red-400' : 'text-blue-400'}`}>
                                          {pick.status.toUpperCase()}
                                        </span>
                                      )}
                                    </span>
                                  ) : hasLocked ? (
                                    <span className="text-xs text-green-400 font-medium">✓ locked in</span>
                                  ) : initialCurrentRound ? (
                                    <span className="text-xs text-gray-600">no pick yet</span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                    {noTeam.length > 0 && (
                      <Card className="opacity-50">
                        <CardBody>
                          <div className="text-xs text-gray-500 mb-2">No team yet</div>
                          <div className="space-y-1">
                            {noTeam.map((p: any) => (
                              <div key={p.id} className="flex items-center gap-2">
                                <Avatar src={p.profiles?.avatar_url} username={p.profiles?.username ?? '?'} size="xs" />
                                <span className="text-sm text-gray-500">{p.profiles?.username ?? 'Unknown'}</span>
                              </div>
                            ))}
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            // Solo view
            <div className="space-y-2">
              {[...participants]
                .sort((a, b) => {
                  if (a.status === 'winner' && b.status !== 'winner') return -1;
                  if (b.status === 'winner' && a.status !== 'winner') return 1;
                  if (a.status === 'eliminated' && b.status !== 'eliminated') return 1;
                  if (b.status === 'eliminated' && a.status !== 'eliminated') return -1;
                  if (isStreakRace) return projectStreak(b) - projectStreak(a);
                  return projectWins(b) - projectWins(a);
                })
                .map((p: any, idx) => {
                  const isElim = p.status === 'eliminated';
                  const pick = picksVisible ? pickByUser[p.user_id] : null;
                  return (
                    <Card key={p.id} className={isElim ? 'opacity-50' : p.status === 'winner' ? 'border-yellow-500/30' : ''}>
                      <CardBody>
                        <div className="flex items-center gap-3">
                          <div className="text-gray-500 font-bold text-sm w-6 text-center flex-shrink-0">
                            {p.status === 'winner' ? '🏆' : isElim ? '💀' : `#${idx + 1}`}
                          </div>
                          <Avatar src={p.profiles?.avatar_url} username={p.profiles?.username ?? '?'} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-sm ${isElim ? 'text-gray-500' : 'text-white'}`}>
                                {p.profiles?.username ?? 'Unknown'}
                              </span>
                              {isStreakRace ? (
                                (() => {
                                  const s = projectStreak(p);
                                  return s > 0
                                    ? <span className="text-xs font-bold text-green-400">{s}W</span>
                                    : s < 0
                                    ? <span className="text-xs font-bold text-red-400">{Math.abs(s)}L</span>
                                    : <span className="text-xs text-gray-500">0W</span>;
                                })()
                              ) : (
                                <span className="text-xs text-gray-500">W{projectWins(p)}-L{projectLosses(p)}-P{p.pushes}</span>
                              )}
                            </div>
                            {pick ? (
                              <div className="text-xs mt-0.5">
                                <span className="text-gray-400">{pick.game} · </span>
                                <span className="text-white font-medium">{pickLabel(pick)}</span>
                                {pick.status !== 'pending' && (
                                  <span className={`ml-1.5 font-bold ${pick.status === 'won' ? 'text-green-400' : pick.status === 'lost' ? 'text-red-400' : 'text-blue-400'}`}>
                                    {pick.status.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : picksVisible ? (
                              <div className="text-xs text-gray-600 mt-0.5">No pick submitted</div>
                            ) : null}
                          </div>
                          <Badge variant={p.status === 'winner' ? 'yellow' : isElim ? 'red' : 'green'}>
                            {p.status === 'winner' ? 'Winner' : isElim ? 'Out' : 'Alive'}
                          </Badge>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
            </div>
          )}

          {!picksVisible && initialCurrentRound && (
            <p className="text-xs text-gray-600 text-center mt-2">Submit your pick to see what everyone else picked</p>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'History' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Round History</h3>

          {!(myParticipation || isAdmin) ? (
            <Card>
              <CardBody className="text-center py-10 text-gray-500">
                Join the contest to view history.
              </CardBody>
            </Card>
          ) : historyLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse">
                  <div className="h-4 bg-gray-800 rounded w-1/4 mb-3" />
                  <div className="h-10 bg-gray-800 rounded" />
                </div>
              ))}
            </div>
          ) : historyRounds.length === 0 ? (
            <Card>
              <CardBody className="text-center py-10 text-gray-500">
                No completed rounds yet.
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {historyRounds.map(({ round, myPick: histMyPick, allPicks: histAllPicks }) => (
                <Card key={round.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white">Round {round.round_number}</h4>
                      <span className="text-xs text-gray-500">
                        {new Date(round.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {/* User's own pick highlighted */}
                    {histMyPick ? (
                      <div className={`rounded-lg px-3 py-2 border ${
                        histMyPick.status === 'won' ? 'bg-green-500/10 border-green-500/30' :
                        histMyPick.status === 'lost' ? 'bg-red-500/10 border-red-500/30' :
                        histMyPick.status === 'push' ? 'bg-blue-500/10 border-blue-500/30' :
                        'bg-gray-800 border-gray-700'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Your Pick</p>
                            <p className="text-white font-bold text-sm">{pickLabel(histMyPick)}</p>
                            <p className="text-xs text-gray-500 truncate">{histMyPick.game}</p>
                          </div>
                          <Badge variant={
                            histMyPick.status === 'won' ? 'green' :
                            histMyPick.status === 'lost' ? 'red' :
                            histMyPick.status === 'push' ? 'blue' : 'gray'
                          }>
                            {histMyPick.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-2 bg-gray-800/50 border border-gray-700">
                        <p className="text-xs text-gray-500">You did not submit a pick this round</p>
                      </div>
                    )}

                    {/* Everyone else's picks (collapsed, show count + expand) */}
                    {histAllPicks.length > 0 && (
                      <details className="group">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-white list-none flex items-center gap-1">
                          <span className="group-open:hidden">▶</span>
                          <span className="hidden group-open:inline">▼</span>
                          Show all {histAllPicks.length} picks this round
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {histAllPicks.map((pick: any) => (
                            <div key={pick.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-gray-800/40">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-medium text-gray-300 truncate">
                                  {pick.profiles?.username ?? 'Unknown'}
                                </span>
                                <span className="text-xs text-gray-500 truncate">
                                  {pickLabel(pick)}
                                </span>
                              </div>
                              <Badge variant={
                                pick.status === 'won' ? 'green' :
                                pick.status === 'lost' ? 'red' :
                                pick.status === 'push' ? 'blue' : 'gray'
                              } className="flex-shrink-0 text-xs">
                                {pick.status.toUpperCase()}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat */}
      {activeTab === 'Chat' && (
        <PoolChat poolId={pool.id} currentUser={currentUser} />
      )}
    </div>
  );
}
