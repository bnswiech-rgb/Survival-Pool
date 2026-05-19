import { createClient } from '@/lib/supabase/server';
import { PoolCard } from '@/components/pool/PoolCard';
import { Search } from 'lucide-react';
import type { Pool } from '@/types';

const SPORTS = ['All', 'NFL', 'NBA', 'MLB', 'NHL', 'CFB', 'CBB', 'Soccer', 'UFC', 'Other'];
const FORMATS = ['All', 'classic', 'lives', 'first_to_x', 'best_record', 'streak_race', 'team_battle'];
const FORMAT_LABELS: Record<string, string> = {
  classic: 'Classic', lives: 'Lives Mode', first_to_x: 'First To X',
  best_record: 'Best Record', streak_race: 'Streak Race', team_battle: 'Team Battle',
};

interface Props {
  searchParams: Promise<{ sport?: string; format?: string; status?: string; q?: string }>;
}

export default async function PoolsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('pools')
    .select('*, pool_participants(current_streak, status, profiles(username))')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (params.sport && params.sport !== 'All') query = query.eq('sport', params.sport);
  if (params.format && params.format !== 'All') query = query.eq('contest_format', params.format);
  if (params.status) query = query.eq('status', params.status);
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data: pools } = await query.limit(50);

  const enrichedPools = pools?.map((p: any) => {
    const participants = p.pool_participants ?? [];
    const participant_count = participants.length;
    const alive_count = participants.filter((pp: any) => pp.status === 'active' || pp.status === 'advanced').length;
    const leader_streak = participants.reduce((max: number, pp: any) => Math.max(max, pp.current_streak ?? 0), 0);
    const leaders_count = leader_streak > 0 ? participants.filter((pp: any) => (pp.current_streak ?? 0) === leader_streak).length : 0;
    return { ...p, participant_count, alive_count, leader_streak, leaders_count };
  }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">Browse Contests</h1>
        <p className="text-gray-400 mt-1">Find the perfect survival contest to enter.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <form className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search contests..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button type="submit" className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors">
            Search
          </button>
        </form>

        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-400 self-center">Sport:</span>
          {SPORTS.map(s => (
            <a
              key={s}
              href={`/pools?${new URLSearchParams({ ...params, sport: s })}`}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                (params.sport ?? 'All') === s
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {s}
            </a>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-400 self-center">Format:</span>
          {FORMATS.map(f => (
            <a
              key={f}
              href={`/pools?${new URLSearchParams({ ...params, format: f })}`}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                (params.format ?? 'All') === f
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {f === 'All' ? 'All' : FORMAT_LABELS[f]}
            </a>
          ))}
        </div>
      </div>

      {/* Results */}
      {enrichedPools.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No contests found.</p>
          <p className="text-sm mt-1">Try adjusting your filters or <a href="/pools/create" className="text-green-400 hover:text-green-300">create one</a>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrichedPools.map((pool: Pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}
