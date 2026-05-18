import Link from 'next/link';
import { Users, Clock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { CountdownTimer } from './CountdownTimer';
import { formatCents, getContestFormatLabel, calculatePrizePool } from '@/lib/utils';
import type { Pool } from '@/types';

interface PoolCardProps {
  pool: Pool;
  showJoin?: boolean;
}

function getFormatBadgeVariant(format: string): 'green' | 'blue' | 'purple' | 'yellow' | 'red' | 'gray' {
  const map: Record<string, any> = {
    classic: 'green',
    lives: 'yellow',
    first_to_x: 'blue',
    best_record: 'purple',
    streak_race: 'red',
    team_battle: 'gray',
  };
  return map[format] ?? 'gray';
}

function getStatusBadgeVariant(status: string): 'green' | 'blue' | 'purple' | 'yellow' | 'red' | 'gray' {
  const map: Record<string, any> = {
    open: 'green',
    active: 'blue',
    upcoming: 'purple',
    locked: 'yellow',
    completed: 'gray',
    canceled: 'red',
  };
  return map[status] ?? 'gray';
}

export function PoolCard({ pool, showJoin = true }: PoolCardProps) {
  const paidEntries = pool.participant_count ?? 0;
  const { netPrizePool } = calculatePrizePool(pool.entry_fee_cents, paidEntries, pool.rake_percentage);
  const progressPct = pool.max_entries ? (paidEntries / pool.max_entries) * 100 : 0;

  return (
    <Link href={`/pools/${pool.id}`}>
      <Card className="hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-green-500/5 cursor-pointer h-full flex flex-col">
        <CardBody className="flex flex-col flex-1 gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate text-base">{pool.name}</h3>
              <div className="text-sm text-gray-400 mt-0.5">{pool.sport}</div>
            </div>
            <Badge variant={getStatusBadgeVariant(pool.status)}>{pool.status}</Badge>
          </div>

          {/* Format */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getFormatBadgeVariant(pool.contest_format)} className="self-start">
              {getContestFormatLabel(pool.contest_format)}
            </Badge>
            {pool.contest_format === 'streak_race' && pool.target_streak && (
              <span className="text-xs text-gray-400">First to <span className="text-white font-bold">{pool.target_streak}W</span> in a row wins</span>
            )}
            {pool.contest_format === 'first_to_x' && pool.target_wins && (
              <span className="text-xs text-gray-400">First to <span className="text-white font-bold">{pool.target_wins}W</span> wins</span>
            )}
          </div>

          {/* Prize */}
          <div className="bg-gray-800/50 rounded-lg px-3 py-2">
            {(pool as any).prize_description ? (
              <>
                <div className="text-xs text-gray-400">Prize</div>
                <div className="text-xl font-black text-green-400">{(pool as any).prize_description}</div>
                <div className="text-xs text-gray-500">Free entry</div>
              </>
            ) : pool.entry_fee_cents > 0 ? (
              <>
                <div className="text-xs text-gray-400">Prize Pool</div>
                <div className="text-xl font-black text-white">{formatCents(netPrizePool)}</div>
                <div className="text-xs text-gray-500">{formatCents(pool.entry_fee_cents)} entry</div>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-400">Contest</div>
                <div className="text-sm font-bold text-gray-300">Free · Bragging Rights</div>
              </>
            )}
          </div>

          {/* Entries */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-gray-400">
                <Users size={14} />
                <span>{paidEntries}{pool.max_entries ? ` / ${pool.max_entries}` : ''} entries</span>
              </div>
              {pool.alive_count !== undefined && pool.alive_count < paidEntries && (
                <span className="text-green-400 text-xs font-medium">{pool.alive_count} alive</span>
              )}
            </div>
            {pool.max_entries && (
              <Progress value={progressPct} max={100} className="h-1.5" />
            )}
          </div>

          {/* Deadline or leader streak */}
          {pool.contest_format === 'streak_race' ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-auto">
              <span>Leader: </span>
              <span className="text-green-400 font-bold">
                {(pool as any).leader_streak > 0
                  ? `${(pool as any).leader_name ? `${(pool as any).leader_name} ` : ''}${(pool as any).leader_streak}W`
                  : 'No winners yet'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-auto">
              <Clock size={13} />
              <span>Deadline: </span>
              <CountdownTimer deadline={pool.pick_deadline} />
            </div>
          )}

          {showJoin && (pool.contest_format === 'streak_race'
            ? pool.status !== 'completed' && pool.status !== 'canceled'
            : pool.status === 'open' || pool.status === 'upcoming') && (
            <div className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-4 py-2 rounded-lg text-center transition-colors mt-1">
              View Contest
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
