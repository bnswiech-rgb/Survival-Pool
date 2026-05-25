import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
import { Trophy, TrendingUp, Target, Award } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, getContestFormatLabel, formatPickLabel } from '@/lib/utils';
import { ActivityFeed } from '@/components/activity/ActivityFeed';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: myParticipations }, { data: activity }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
    supabase
      .from('pool_participants')
      .select('*, pools(*)')
      .eq('user_id', user!.id)
      .order('joined_at', { ascending: false })
      .limit(20),
    supabase
      .from('activity_feed')
      .select('*, profiles(username, avatar_url)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  // For each active pool, get the current open round and the user's pick for it
  const poolIds = (myParticipations ?? []).map((p: any) => p.pool_id);
  const [{ data: openRounds }, { data: myPicks }] = poolIds.length > 0
    ? await Promise.all([
        supabase
          .from('rounds')
          .select('*')
          .in('pool_id', poolIds)
          .eq('status', 'open')
          .order('round_number', { ascending: false }),
        supabase
          .from('picks')
          .select('*')
          .in('pool_id', poolIds)
          .eq('user_id', user!.id)
          .order('submitted_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  // Map pool_id -> current round and pick for quick lookup
  const roundByPool = Object.fromEntries((openRounds ?? []).map((r: any) => [r.pool_id, r]));
  // Keep most recent pick per pool (picks are ordered by submitted_at desc)
  const pickByPool: Record<string, any> = {};
  for (const pk of (myPicks ?? [])) {
    if (!pickByPool[pk.pool_id]) pickByPool[pk.pool_id] = pk;
  }

  const activeParticipations = (myParticipations ?? []).filter((p: any) => ['active', 'advanced'].includes(p.status));
  const finishedParticipations = (myParticipations ?? []).filter((p: any) => ['eliminated', 'winner'].includes(p.status));

  const stats = [
    { label: 'Active Contests', value: activeParticipations.length, icon: Target, color: 'text-blue-400' },
    { label: 'Total Wins', value: profile?.wins ?? 0, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Contests Entered', value: profile?.pools_entered ?? 0, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Contests Won', value: profile?.pools_won ?? 0, icon: Award, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-black text-white">
          Welcome back, <span className="text-green-400">{profile?.username}</span>
        </h1>
        <p className="text-gray-400 mt-1">Here&apos;s your survival contest overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardBody className="flex items-center gap-3">
              <s.icon size={24} className={s.color} />
              <div>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Contests */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">My Active Contests</h2>
            <Link href="/pools" className="text-sm text-green-400 hover:text-green-300 transition-colors">
              Browse all
            </Link>
          </div>

          {activeParticipations.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <Trophy size={40} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">You&apos;re not in any active contests.</p>
                <Link
                  href="/pools"
                  className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-2 rounded-lg text-sm transition-colors inline-block"
                >
                  Browse Contests
                </Link>
              </CardBody>
            </Card>
          ) : (
            activeParticipations.map((p: any) => {
              const pool = p.pools;
              if (!pool) return null;
              const round = roundByPool[pool.id];
              const pick  = pickByPool[pool.id];
              return (
                <Link key={p.id} href={`/pools/${pool.id}`}>
                  <Card className="hover:border-gray-700 transition-colors cursor-pointer">
                    <CardBody>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-white truncate">{pool.name}</span>
                            <Badge variant="purple">{getContestFormatLabel(pool.contest_format)}</Badge>
                          </div>
                          <div className="text-sm text-gray-400">{pool.sport}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {pool.contest_format === 'streak_race' ? (
                            (() => {
                              const stored = p.current_streak ?? 0;
                              const currentPick = pickByPool[pool.id];
                              const pickInCurrentRound = currentPick && round && currentPick.round_id === round.id;
                              let s = stored;
                              if (pickInCurrentRound && currentPick.status !== 'pending') {
                                if (currentPick.status === 'won') s = stored < 0 ? 1 : stored + 1;
                                else if (currentPick.status === 'lost') s = stored > 0 ? -1 : stored - 1;
                              }
                              const label = s > 0 ? `🔥 ${s}W streak` : s < 0 ? `${Math.abs(s)}L streak` : '0W streak';
                              const color = s > 0 ? 'text-orange-400' : s < 0 ? 'text-red-400' : 'text-gray-400';
                              return <div className={`text-sm font-semibold ${color}`}>{label}</div>;
                            })()
                          ) : (
                            <div className={`text-sm font-semibold ${pool.status === 'completed' ? 'text-gray-400' : 'text-green-400'}`}>
                              {pool.status === 'completed' ? '🏁 Concluded' : p.status === 'advanced' ? '✅ Advanced' : '✅ Alive'}
                            </div>
                          )}
                          {pool.contest_format === 'lives' && (
                            <div className="text-xs text-yellow-400">{p.lives_remaining} lives left</div>
                          )}
                        </div>
                      </div>

                      {/* Current pick */}
                      {round && (
                        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wider">Round {round.round_number} Pick</span>
                            {pick && (
                              <span className="text-xs text-gray-400">
                                {new Date(pick.game_start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}
                              </span>
                            )}
                          </div>
                          {pick ? (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{formatPickLabel(pick)}</span>
                              <span className="text-xs text-gray-500 uppercase">{pick.pick_type}</span>
                              <span className="ml-auto text-xs font-bold text-green-400">✓ Locked In</span>
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-sm text-red-400 font-medium">⚠️ No pick submitted yet</span>
                              <span className="text-xs text-gray-500">Submit before deadline</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>W: {p.wins} L: {p.losses}</span>
                        {pool.entry_fee_cents > 0 && <span>{formatCents(pool.entry_fee_cents)} entry</span>}
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              );
            })
          )}

          {/* Past Contests */}
          {finishedParticipations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-bold text-white mb-3">Past Contests</h2>
              <div className="space-y-2">
                {finishedParticipations.map((p: any) => {
                  const pool = p.pools;
                  if (!pool) return null;
                  const isWinner = p.status === 'winner';
                  return (
                    <Link key={p.id} href={`/pools/${pool.id}`}>
                      <Card className="hover:border-gray-700 transition-colors cursor-pointer opacity-70 hover:opacity-100">
                        <CardBody>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="font-bold text-white truncate block">{pool.name}</span>
                              <span className="text-xs text-gray-500">{pool.sport} · {getContestFormatLabel(pool.contest_format)}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`text-sm font-bold ${isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
                                {isWinner ? '🏆 Winner' : '💀 Eliminated'}
                              </div>
                              <div className="text-xs text-gray-500">W{p.wins}-L{p.losses}</div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
          <ActivityFeed items={(activity as any) || []} />
        </div>
      </div>
    </div>
  );
}
