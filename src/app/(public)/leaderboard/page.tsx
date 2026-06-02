import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Trophy, Flame, Award, Coins } from 'lucide-react';
import { SharprCashIcon } from '@/components/ui/SharprCashIcon';

export const dynamic = 'force-dynamic';

async function getLeaderboardData() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Coins and cash from profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, gold_coins, sweeps_coins')
    .not('username', 'is', null);

  // Contests won — computed from pool_participants (profiles.pools_won is stale)
  const { data: winners } = await supabase
    .from('pool_participants')
    .select('user_id, profiles(username, avatar_url)')
    .eq('status', 'winner');

  const winsMap = new Map<string, { username: string; avatar_url: string | null; count: number }>();
  for (const w of winners ?? []) {
    const username = (w as any).profiles?.username;
    if (!username) continue;
    const existing = winsMap.get(w.user_id);
    if (existing) existing.count++;
    else winsMap.set(w.user_id, { username, avatar_url: (w as any).profiles?.avatar_url ?? null, count: 1 });
  }
  const topContestsWon = [...winsMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Most consecutive wins — max current_streak per user across active participations
  const { data: streaks } = await supabase
    .from('pool_participants')
    .select('user_id, current_streak, profiles(username, avatar_url)')
    .gt('current_streak', 0)
    .in('status', ['active', 'advanced', 'winner'])
    .order('current_streak', { ascending: false })
    .limit(100);

  // Dedupe streaks — keep best streak per user
  const streakMap = new Map<string, any>();
  for (const s of streaks ?? []) {
    const existing = streakMap.get(s.user_id);
    if (!existing || s.current_streak > existing.current_streak) {
      streakMap.set(s.user_id, s);
    }
  }
  const topStreaks = [...streakMap.values()]
    .sort((a, b) => b.current_streak - a.current_streak)
    .slice(0, 10);

  const topCoins = [...(profiles ?? [])]
    .filter(p => p.gold_coins > 0)
    .sort((a, b) => b.gold_coins - a.gold_coins)
    .slice(0, 10);

  const topCash = [...(profiles ?? [])]
    .filter(p => p.sweeps_coins > 0)
    .sort((a, b) => b.sweeps_coins - a.sweeps_coins)
    .slice(0, 10);

  return { topStreaks, topContestsWon, topCoins, topCash };
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-black text-sm">🥇</span>;
  if (rank === 2) return <span className="text-gray-300 font-black text-sm">🥈</span>;
  if (rank === 3) return <span className="text-orange-400 font-black text-sm">🥉</span>;
  return <span className="text-gray-600 font-bold text-sm w-6 text-center">#{rank}</span>;
}

function LeaderboardCard({
  title,
  icon,
  rows,
  valueLabel,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { username: string; avatar_url?: string | null; value: string }[];
  valueLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h2 className="text-lg font-black text-white">{title}</h2>
        </div>
        <p className="text-gray-500 text-sm text-center py-6">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-lg font-black text-white">{title}</h2>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <Link
            key={row.username}
            href={`/profile/${row.username}`}
            className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-800 transition-colors group"
          >
            <div className="w-7 flex items-center justify-center flex-shrink-0">
              <Medal rank={i + 1} />
            </div>
            <Avatar src={row.avatar_url} username={row.username} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors truncate block">
                {row.username}
              </span>
            </div>
            <div className="text-sm font-black text-green-400 flex-shrink-0">
              {row.value}
              <span className="text-xs text-gray-500 font-normal ml-1">{valueLabel}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const { topStreaks, topContestsWon, topCoins, topCash } = await getLeaderboardData();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Trophy size={28} className="text-green-400" />
          Leaderboard
        </h1>
        <p className="text-gray-400 mt-1 text-sm">Site-wide rankings across all players.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LeaderboardCard
          title="Consecutive Wins"
          icon={<Flame size={20} className="text-orange-400" />}
          valueLabel="wins"
          rows={topStreaks.map(s => ({
            username: (s as any).profiles?.username ?? 'Unknown',
            avatar_url: (s as any).profiles?.avatar_url,
            value: s.current_streak.toString(),
          }))}
        />

        <LeaderboardCard
          title="Most Contests Won"
          icon={<Award size={20} className="text-yellow-400" />}
          valueLabel="wins"
          rows={topContestsWon.map(p => ({
            username: p.username,
            avatar_url: p.avatar_url,
            value: p.count.toString(),
          }))}
        />

        <LeaderboardCard
          title="Most Sharpr Coins"
          icon={<Coins size={20} className="text-yellow-400" />}
          valueLabel="coins"
          rows={topCoins.map(p => ({
            username: p.username,
            avatar_url: p.avatar_url,
            value: p.gold_coins.toLocaleString(),
          }))}
        />

        <LeaderboardCard
          title="Most Sharpr Cash"
          icon={<SharprCashIcon size={20} />}
          valueLabel="SC"
          rows={topCash.map(p => ({
            username: p.username,
            avatar_url: p.avatar_url,
            value: `$${(p.sweeps_coins / 100).toFixed(2)}`,
          }))}
        />
      </div>
    </div>
  );
}
