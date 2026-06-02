'use client';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardBody } from '@/components/ui/Card';
import type { ActivityItem } from '@/types';

const ACTIVITY_ICONS: Record<string, string> = {
  pick_submitted: '🏈',
  survived_round: '✅',
  eliminated: '💀',
  won_contest: '🏆',
  joined_pool: '👋',
  streak: '🔥',
};

function getActivityText(item: ActivityItem): { main: string; sub?: string } {
  const username = (item as any).profiles?.username || 'Someone';
  const poolName = item.pools?.name;
  switch (item.activity_type) {
    case 'pick_submitted': return { main: `${username} submitted their pick`, sub: poolName };
    case 'survived_round': {
      const remaining = item.metadata?.remaining;
      return {
        main: `${username} survived Round ${item.metadata?.round ?? ''}!`,
        sub: [poolName, remaining != null ? `${remaining} remaining` : null].filter(Boolean).join(' · '),
      };
    }
    case 'eliminated': return { main: `${username} was eliminated in Round ${item.metadata?.round ?? ''}`, sub: poolName };
    case 'won_contest': return { main: `${username} won the contest!`, sub: poolName };
    case 'joined_pool': return { main: `${username} joined a contest`, sub: poolName };
    case 'streak': return { main: `${username} is on a ${item.metadata?.streak ?? ''}-pick streak!`, sub: poolName };
    default: return { main: `${username} did something` };
  }
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-8 text-gray-500 text-sm">
          No recent activity yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const { main, sub } = getActivityText(item);
        return (
          <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg flex-shrink-0">
              {ACTIVITY_ICONS[item.activity_type] || '📌'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 leading-snug">{main}</p>
              {sub && <p className="text-xs text-green-500/70 mt-0.5 truncate">{sub}</p>}
              <p className="text-xs text-gray-600 mt-0.5">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
