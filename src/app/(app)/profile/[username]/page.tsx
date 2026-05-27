import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatDistanceToNow } from 'date-fns';
import { getContestFormatLabel, getStatusBadgeColor, formatPickLabel } from '@/lib/utils';
import Link from 'next/link';
import { FollowButton } from './FollowButton';
import { SelfExclusionCard } from '@/components/account/SelfExclusionCard';

interface Props {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user: currentAuthUser } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  // Compute real stats from pool_participants (profiles.wins/losses are stale denormalized columns)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: allParticipations } = await serviceClient
    .from('pool_participants')
    .select('wins, losses, pushes, status')
    .eq('user_id', profile.id);

  const realWins = (allParticipations ?? []).reduce((s: number, p: any) => s + (p.wins ?? 0), 0);
  const realLosses = (allParticipations ?? []).reduce((s: number, p: any) => s + (p.losses ?? 0), 0);
  const realPushes = (allParticipations ?? []).reduce((s: number, p: any) => s + (p.pushes ?? 0), 0);
  const realPoolsEntered = (allParticipations ?? []).length;
  const realPoolsWon = (allParticipations ?? []).filter((p: any) => p.status === 'winner').length;

  const [{ data: activeContests }, { data: recentPicks }, { data: isFollowing }] = await Promise.all([
    supabase
      .from('pool_participants')
      .select('*, pools(id, name, sport, contest_format, status)')
      .eq('user_id', profile.id)
      .in('status', ['active', 'advanced'])
      .order('joined_at', { ascending: false })
      .limit(5),
    supabase
      .from('picks')
      .select('*, pools(name), rounds(round_number)')
      .eq('user_id', profile.id)
      .neq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(10),
    currentAuthUser
      ? supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentAuthUser.id)
          .eq('following_id', profile.id)
          .maybeSingle()
      : { data: null },
  ]);

  const winRate = realWins + realLosses > 0
    ? Math.round((realWins / (realWins + realLosses)) * 100)
    : 0;

  const isOwnProfile = currentAuthUser?.id === profile.id;

  const achievements = [];
  if (realPoolsWon >= 1) achievements.push({ emoji: '🏆', label: 'Contest Winner' });
  if (realWins >= 50) achievements.push({ emoji: '⚡', label: '50 Win Club' });
  if (realPoolsEntered >= 10) achievements.push({ emoji: '🏈', label: 'Veteran' });
  if (winRate >= 60) achievements.push({ emoji: '🎯', label: 'Sharp' });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-5">
            <Avatar src={profile.avatar_url} username={profile.username} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-white">{profile.username}</h1>
                {profile.role === 'admin' && <Badge variant="purple">Admin</Badge>}
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Member since {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-center">
                  <div className="text-xl font-black text-green-400">{realWins}</div>
                  <div className="text-xs text-gray-500">Wins</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-red-400">{realLosses}</div>
                  <div className="text-xs text-gray-500">Losses</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-blue-400">{realPushes}</div>
                  <div className="text-xs text-gray-500">Pushes</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-white">{winRate}%</div>
                  <div className="text-xs text-gray-500">Win Rate</div>
                </div>
              </div>
            </div>
            {!isOwnProfile && currentAuthUser && (
              <FollowButton
                profileId={profile.id}
                currentUserId={currentAuthUser.id}
                initiallyFollowing={!!isFollowing}
              />
            )}
          </div>
        </CardBody>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-black text-white">{realPoolsEntered}</div>
            <div className="text-gray-400 text-sm mt-1">Contests Entered</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-black text-yellow-400">{realPoolsWon}</div>
            <div className="text-gray-400 text-sm mt-1">Contests Won</div>
          </CardBody>
        </Card>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Achievements</h3></CardHeader>
          <CardBody>
            <div className="flex gap-3 flex-wrap">
              {achievements.map(a => (
                <div key={a.label} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5">
                  <span>{a.emoji}</span>
                  <span className="text-sm text-gray-300">{a.label}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active Contests */}
      <Card>
        <CardHeader><h3 className="font-bold text-white">Active Contests</h3></CardHeader>
        <CardBody>
          {!activeContests || activeContests.length === 0 ? (
            <p className="text-gray-500 text-sm">Not in any active contests.</p>
          ) : (
            <div className="space-y-3">
              {activeContests.map((p: any) => (
                <Link key={p.id} href={`/pools/${p.pools?.id}`} className="flex items-center justify-between hover:bg-gray-800 rounded-lg px-2 py-2 -mx-2 transition-colors">
                  <div>
                    <div className="font-medium text-white text-sm">{p.pools?.name}</div>
                    <div className="text-xs text-gray-400">{p.pools?.sport} · {getContestFormatLabel(p.pools?.contest_format)}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-green-400 font-medium">W{p.wins}-L{p.losses}</div>
                    <div className="text-gray-500">{p.status}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Responsible Gaming — own profile only */}
      {isOwnProfile && <SelfExclusionCard currentLimitCents={profile.daily_deposit_limit_cents ?? null} />}

      {/* Recent Picks */}
      <Card>
        <CardHeader><h3 className="font-bold text-white">Recent Picks</h3></CardHeader>
        <CardBody>
          {!recentPicks || recentPicks.length === 0 ? (
            <p className="text-gray-500 text-sm">No pick history yet.</p>
          ) : (
            <div className="space-y-3">
              {recentPicks.map((pick: any) => (
                <div key={pick.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">{formatPickLabel(pick)}</div>
                    <div className="text-xs text-gray-400">
                      {pick.game} · {pick.pools?.name} Round {pick.rounds?.round_number}
                    </div>
                  </div>
                  <Badge variant={
                    pick.status === 'won' ? 'green' :
                    pick.status === 'lost' ? 'red' :
                    pick.status === 'push' ? 'blue' : 'gray'
                  }>
                    {pick.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
