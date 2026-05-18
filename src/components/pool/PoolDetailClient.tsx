'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CountdownTimer } from './CountdownTimer';
import { StandingsTable } from '@/components/leaderboard/StandingsTable';
import { PoolChat } from '@/components/chat/PoolChat';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatCents, calculatePrizePool, getContestFormatLabel } from '@/lib/utils';
import type { Pool, PoolParticipant, Round, Pick, Profile } from '@/types';
import toast from 'react-hot-toast';
import { Users, Clock, Trophy, Target, Zap } from 'lucide-react';

interface Props {
  pool: Pool;
  initialParticipants: PoolParticipant[];
  initialCurrentRound: Round | null;
  latestRoundNumber: number;
  initialMyPick: Pick | null;
  myParticipation: PoolParticipant | null;
  currentUser: Profile | null;
  initialPicks: Pick[];
}

const TABS = ['Overview', 'Picks', 'Survivors', 'Chat'];

export function PoolDetailClient({
  pool,
  initialParticipants,
  initialCurrentRound,
  latestRoundNumber,
  initialMyPick,
  myParticipation: initMy,
  currentUser,
  initialPicks,
}: Props) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [participants, setParticipants] = useState(initialParticipants);
  const [myParticipation, setMyParticipation] = useState(initMy);
  const [myPick] = useState(initialMyPick);
  const [picks] = useState(initialPicks);
  const [joiningLoading, setJoiningLoading] = useState(false);
  const supabase = createClient();

  const { netPrizePool } = calculatePrizePool(
    pool.entry_fee_cents,
    participants.length,
    pool.rake_percentage
  );

  const aliveCount = participants.filter(p => p.status === 'active' || p.status === 'advanced').length;
  const eliminatedCount = participants.filter(p => p.status === 'eliminated').length;

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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pool.id, currentUser?.id, supabase]);

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

  const isAdmin = currentUser?.role === 'admin';
  const hasSubmittedPick = !!myPick;
  const picksVisible = hasSubmittedPick || isAdmin;
  const canSubmitPick = myParticipation && (myParticipation.status === 'active' || myParticipation.status === 'advanced') && initialCurrentRound?.status === 'open';

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
        <div className="flex gap-2 flex-shrink-0">
          {!myParticipation && (pool.status === 'open' || pool.status === 'upcoming') && currentUser && (
            <Button onClick={handleJoin} loading={joiningLoading} size="lg">
              Join Contest {pool.entry_fee_cents > 0 ? `• ${formatCents(pool.entry_fee_cents)}` : '• Free'}
            </Button>
          )}
          {canSubmitPick && (
            <Link href={`/pools/${pool.id}/picks`}>
              <Button variant="secondary" size="lg">Submit Pick</Button>
            </Link>
          )}
        </div>
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
              <span className="text-gray-400 text-sm">
                W{myParticipation.wins}-L{myParticipation.losses}-P{myParticipation.pushes}
              </span>
            </div>
            {myPick && (
              <div className="text-sm text-gray-300 mt-0.5 truncate">
                {myPick.pick_type === 'total' ? myPick.line_value : `${myPick.side} ${myPick.line_value}`} · <span className={
                  myPick.status === 'won' ? 'text-green-400' :
                  myPick.status === 'lost' ? 'text-red-400' :
                  myPick.status === 'push' ? 'text-blue-400' : 'text-yellow-400'
                }>{myPick.status}</span>
              </div>
            )}
          </div>
          {!myPick && canSubmitPick && (
            <Link href={`/pools/${pool.id}/picks`} className="flex-shrink-0">
              <Button size="sm">Submit Pick</Button>
            </Link>
          )}
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
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Prize Pool */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400" />
                  <h3 className="font-bold text-white">Prize Pool</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-black text-white">Pot</span>
                  <span className="text-3xl font-black text-green-400">
                    {pool.entry_fee_cents === 0 ? 'Free' : formatCents(netPrizePool)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">(winner takes all)</p>
                  <p className="text-xs text-gray-400">
                    <span className="text-green-400 font-bold">{aliveCount}</span> survivor{aliveCount !== 1 ? 's' : ''} remaining
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <Clock size={14} className="text-yellow-400" />
                  <span className="text-gray-400 text-sm">Currently on</span>
                  <span className="text-white font-bold text-sm">Round {latestRoundNumber}</span>
                  {initialCurrentRound && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-400 text-sm">picks due</span>
                      <CountdownTimer deadline={initialCurrentRound.deadline} />
                    </>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Entries', value: participants.length, icon: Users },
                { label: 'Alive', value: aliveCount, icon: Zap },
                { label: 'Eliminated', value: eliminatedCount, icon: Target },
                { label: 'Round', value: initialCurrentRound?.round_number ?? '-', icon: Trophy },
              ].map(s => (
                <Card key={s.label}>
                  <CardBody className="text-center py-3">
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Format-specific info */}
            {pool.contest_format === 'lives' && (
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-400">
                    <strong className="text-white">Lives Mode:</strong> Each participant starts with {pool.lives_count} {pool.lives_count === 1 ? 'life' : 'lives'}. Lose a pick, lose a life. Run out of lives and you&apos;re eliminated.
                  </div>
                </CardBody>
              </Card>
            )}
            {pool.contest_format === 'streak_race' && (
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-400">
                    <strong className="text-white">Streak Race:</strong> First to reach {pool.target_streak} consecutive wins claims victory. A loss resets your streak to zero.
                  </div>
                </CardBody>
              </Card>
            )}
            {pool.contest_format === 'first_to_x' && (
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-400">
                    <strong className="text-white">First To X:</strong> First participant to reach {pool.target_wins} total wins wins the contest.
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Rules */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="font-bold text-white">Contest Rules</h3>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Format</span>
                  <span className="text-white">{getContestFormatLabel(pool.contest_format)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Push rule</span>
                  <span className="text-white capitalize">{pool.push_rule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">All-lose rule</span>
                  <span className="text-white capitalize">{pool.all_lose_rule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Frequency</span>
                  <span className="text-white capitalize">{pool.round_frequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Prize</span>
                  <span className="text-white capitalize">{pool.prize_structure.replace(/_/g, ' ')}</span>
                </div>
                {pool.max_entries && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max entries</span>
                    <span className="text-white">{pool.max_entries}</span>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-bold text-white text-sm">Pick Eligibility</h3>
              </CardHeader>
              <CardBody className="text-xs text-gray-400 space-y-2">
                <p>• Spread/Total: odds must be between -115 and -105</p>
                <p>• Moneyline: must be -150 or better (less negative)</p>
                <p>• Heavily favored picks are not eligible</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Survivors */}
      {activeTab === 'Survivors' && (
        <StandingsTable participants={participants} pool={pool} />
      )}

      {/* Chat */}
      {activeTab === 'Chat' && (
        <PoolChat poolId={pool.id} currentUser={currentUser} />
      )}

      {/* Picks */}
      {activeTab === 'Picks' && (
        <div>
          {!picksVisible && (
            <Card>
              <CardBody className="text-center py-12">
                <Clock size={32} className="text-yellow-400 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">Submit your pick to see everyone else&apos;s picks.</p>
                {canSubmitPick && (
                  <Link href={`/pools/${pool.id}/picks`}>
                    <Button size="sm" className="mt-2">Submit Pick</Button>
                  </Link>
                )}
              </CardBody>
            </Card>
          )}
          {picksVisible && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">
                Round {initialCurrentRound?.round_number} Picks
              </h3>
              {picks.length === 0 ? (
                <Card>
                  <CardBody className="text-center py-8 text-gray-500">No picks submitted yet.</CardBody>
                </Card>
              ) : (
                <div className="space-y-3">
                  {picks.map(pick => (
                    <Card key={pick.id} className={pick.status === 'won' ? 'border-green-500/30' : pick.status === 'lost' ? 'border-red-500/30' : ''}>
                      <CardBody>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">{(pick as any).profiles?.username ?? 'Unknown'}</span>
                              <Badge variant={pick.status === 'won' ? 'green' : pick.status === 'lost' ? 'red' : pick.status === 'push' ? 'blue' : 'gray'}>
                                {pick.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-400 mt-1">{pick.game}</div>
                            <div className="text-sm text-white mt-0.5">
                              {pick.pick_type === 'total' ? pick.line_value : `${pick.side} ${pick.line_value}`} · <span className="text-gray-500 capitalize">{pick.pick_type}</span>
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
