'use client';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { getContestFormatLabel } from '@/lib/utils';
import type { Pool, PoolParticipant } from '@/types';
import Link from 'next/link';

interface Props {
  participants: PoolParticipant[];
  pool: Pool;
}

type SortKey = 'rank' | 'wins' | 'losses' | 'streak' | 'lives' | 'rounds_survived';

function getStatusBadgeVariant(status: string): 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple' {
  const map: Record<string, any> = {
    active: 'green', advanced: 'green', eliminated: 'red', winner: 'yellow',
  };
  return map[status] ?? 'gray';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Active', advanced: 'Advanced', eliminated: 'Eliminated', winner: 'Winner',
  };
  return map[status] ?? status;
}

function sortParticipants(participants: PoolParticipant[], key: SortKey, format: string): PoolParticipant[] {
  const arr = [...participants];
  // Winners always first, eliminated always last
  arr.sort((a, b) => {
    if (a.status === 'winner' && b.status !== 'winner') return -1;
    if (b.status === 'winner' && a.status !== 'winner') return 1;
    if (a.status === 'eliminated' && b.status !== 'eliminated') return 1;
    if (b.status === 'eliminated' && a.status !== 'eliminated') return -1;

    if (key === 'wins') return b.wins - a.wins;
    if (key === 'losses') return a.losses - b.losses;
    if (key === 'streak') return b.current_streak - a.current_streak;
    if (key === 'lives') return b.lives_remaining - a.lives_remaining;
    if (key === 'rounds_survived') return b.rounds_survived - a.rounds_survived;
    // Default rank
    if (format === 'streak_race') return b.current_streak - a.current_streak;
    if (format === 'best_record' || format === 'first_to_x') {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    }
    if (format === 'lives') return b.lives_remaining - a.lives_remaining;
    return b.wins - a.wins;
  });
  return arr;
}

export function StandingsTable({ participants, pool }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const sorted = sortParticipants(participants, sortKey, pool.contest_format);

  const showLives = pool.contest_format === 'lives';
  const showStreak = pool.contest_format === 'streak_race' || pool.contest_format === 'first_to_x';

  const ThBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => setSortKey(k)}
      className={`text-xs font-medium transition-colors ${sortKey === k ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
    >
      {label} {sortKey === k ? '↓' : ''}
    </button>
  );

  if (participants.length === 0) {
    return <div className="text-center py-12 text-gray-500">No participants yet.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Standings</h3>
        <div className="text-sm text-gray-400">{participants.length} entries</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left"><ThBtn k="rank" label="Rank" /></th>
              <th className="px-4 py-3 text-left text-gray-500 text-xs font-medium">Survivor</th>
              <th className="px-4 py-3 text-center"><ThBtn k="wins" label="W" /></th>
              <th className="px-4 py-3 text-center"><ThBtn k="losses" label="L" /></th>
              <th className="px-4 py-3 text-center text-gray-500 text-xs font-medium">P</th>
              {showLives && <th className="px-4 py-3 text-center"><ThBtn k="lives" label="Lives" /></th>}
              {showStreak && <th className="px-4 py-3 text-center"><ThBtn k="streak" label="Streak" /></th>}
              <th className="px-4 py-3 text-center"><ThBtn k="rounds_survived" label="Rounds" /></th>
              <th className="px-4 py-3 text-center text-gray-500 text-xs font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const isEliminated = p.status === 'eliminated';
              return (
                <tr
                  key={p.id}
                  className={`border-b border-gray-800 transition-colors ${
                    isEliminated ? 'opacity-50 bg-red-500/5' : 'hover:bg-gray-800/50'
                  } ${p.status === 'winner' ? 'bg-yellow-500/5' : ''}`}
                >
                  <td className="px-4 py-3 text-center font-bold text-gray-400">
                    {p.status === 'winner' ? '🏆' : isEliminated ? '💀' : `#${idx + 1}`}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/profile/${(p as any).profiles?.username ?? ''}`}
                      className="flex items-center gap-2 hover:text-green-400 transition-colors"
                    >
                      <Avatar src={(p as any).profiles?.avatar_url} username={(p as any).profiles?.username ?? '?'} size="xs" />
                      <span className={`font-medium ${isEliminated ? 'text-gray-500' : 'text-white'}`}>
                        {(p as any).profiles?.username ?? 'Unknown'}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-green-400 font-bold">{p.wins}</td>
                  <td className="px-4 py-3 text-center text-red-400 font-bold">{p.losses}</td>
                  <td className="px-4 py-3 text-center text-blue-400">{p.pushes}</td>
                  {showLives && (
                    <td className="px-4 py-3 text-center">
                      <span className={p.lives_remaining <= 1 ? 'text-red-400 font-bold' : 'text-yellow-400 font-bold'}>
                        {p.lives_remaining}
                      </span>
                    </td>
                  )}
                  {showStreak && (
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${p.current_streak >= 3 ? 'text-orange-400' : 'text-gray-300'}`}>
                        {p.current_streak > 0 ? `${p.current_streak}🔥` : p.current_streak}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-gray-300">{p.rounds_survived}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={getStatusBadgeVariant(p.status)}>
                      {getStatusLabel(p.status)}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
