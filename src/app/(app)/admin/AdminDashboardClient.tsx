'use client';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';
import Link from 'next/link';

const TABS = ['Pools', 'Grade Picks', 'Actions Log'];

interface Props {
  pools: any[];
  pendingPicks: any[];
  adminActions: any[];
}

export function AdminDashboardClient({ pools: initialPools, pendingPicks: initialPicks, adminActions }: Props) {
  const [activeTab, setActiveTab] = useState('Pools');
  const [picks, setPicks] = useState(initialPicks);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [autoGrading, setAutoGrading] = useState(false);

  const runAutoGrade = async () => {
    setAutoGrading(true);
    try {
      const res = await fetch('/api/cron/grade');
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else toast.success(`Graded ${data.graded ?? 0} picks, advanced ${data.advancedRounds ?? 0} rounds, found ${data.overdueRoundsFound ?? 0} overdue rounds`);
    } catch {
      toast.error('Failed to run grader');
    }
    setAutoGrading(false);
  };

  const gradePick = async (pickId: string, status: 'won' | 'lost' | 'push' | 'void') => {
    setGradingId(pickId);
    const res = await fetch('/api/admin/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pick_id: pickId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed to grade pick');
    } else {
      toast.success(`Pick graded: ${status}`);
      setPicks(prev => prev.filter(p => p.id !== pickId));
    }
    setGradingId(null);
  };

  const resetRound = async (poolId: string) => {
    const res = await fetch('/api/admin/reset-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool_id: poolId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Reset failed'); return; }
    toast.success('Round reset — running grader...');
    await runAutoGrade();
  };

  const poolAction = async (poolId: string, action: string) => {
    const res = await fetch(`/api/pools/${poolId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Action failed');
    else toast.success(`Pool ${action} successful`);
  };

  const advanceRound = async (poolId: string) => {
    const res = await fetch(`/api/admin/pools/${poolId}/advance`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to advance round');
    else toast.success('Round advanced!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-purple-400" />
          <div>
            <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Manage contests, grade picks, track actions.</p>
          </div>
        </div>
        <Button onClick={runAutoGrade} loading={autoGrading} size="sm">
          Grade Now
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardBody className="text-center">
          <div className="text-2xl font-black text-white">{initialPools.length}</div>
          <div className="text-xs text-gray-400">Total Pools</div>
        </CardBody></Card>
        <Card><CardBody className="text-center">
          <div className="text-2xl font-black text-yellow-400">{picks.length}</div>
          <div className="text-xs text-gray-400">Pending Grades</div>
        </CardBody></Card>
        <Card><CardBody className="text-center">
          <div className="text-2xl font-black text-purple-400">{adminActions.length}</div>
          <div className="text-xs text-gray-400">Recent Actions</div>
        </CardBody></Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-white border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {tab === 'Grade Picks' && picks.length > 0 && (
              <span className="ml-2 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                {picks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pools Tab */}
      {activeTab === 'Pools' && (
        <div className="space-y-3">
          {initialPools.length === 0 ? (
            <Card><CardBody className="text-center py-8 text-gray-500">No pools yet.</CardBody></Card>
          ) : (
            initialPools.map((pool: any) => (
              <Card key={pool.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/pools/${pool.id}`} className="font-bold text-white hover:text-green-400 transition-colors">
                          {pool.name}
                        </Link>
                        <Badge variant={pool.status === 'active' || pool.status === 'open' ? 'green' : pool.status === 'completed' ? 'gray' : 'purple'}>
                          {pool.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {pool.sport} · {pool.contest_format} · {pool.pool_participants?.[0]?.count ?? 0} entries
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="secondary" onClick={() => poolAction(pool.id, 'lock')}>
                        Lock
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => advanceRound(pool.id)}>
                        Advance Round
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => resetRound(pool.id)}>
                        Reset Round
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => poolAction(pool.id, 'cancel')}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Grade Picks Tab */}
      {activeTab === 'Grade Picks' && (
        <div className="space-y-3">
          {picks.length === 0 ? (
            <Card><CardBody className="text-center py-8 text-gray-500">No pending picks to grade.</CardBody></Card>
          ) : (
            picks.map((pick: any) => (
              <Card key={pick.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{pick.profiles?.username}</span>
                        <span className="text-gray-400 text-sm">in {pick.pools?.name}</span>
                        <Badge variant="gray">Round {pick.rounds?.round_number}</Badge>
                      </div>
                      <div className="text-sm text-gray-300 mt-1">{pick.game}</div>
                      <div className="text-sm text-white font-medium">
                        {pick.side} ({pick.line_value}) · {pick.american_odds > 0 ? '+' : ''}{pick.american_odds} · {pick.pick_type}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Submitted {formatDistanceToNow(new Date(pick.submitted_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(['won', 'lost', 'push', 'void'] as const).map(s => (
                        <Button
                          key={s}
                          size="sm"
                          loading={gradingId === pick.id}
                          variant={s === 'won' ? 'primary' : s === 'lost' ? 'danger' : 'secondary'}
                          onClick={() => gradePick(pick.id, s)}
                        >
                          {s === 'won' ? '✓ Won' : s === 'lost' ? '✗ Lost' : s === 'push' ? '↔ Push' : '∅ Void'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Actions Log */}
      {activeTab === 'Actions Log' && (
        <div className="space-y-3">
          {adminActions.length === 0 ? (
            <Card><CardBody className="text-center py-8 text-gray-500">No admin actions yet.</CardBody></Card>
          ) : (
            adminActions.map((action: any) => (
              <div key={action.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-purple-400">{action.profiles?.username ?? 'Admin'}</span>
                    <span className="text-gray-400">performed</span>
                    <span className="text-white font-medium">{action.action_type}</span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                  </span>
                </div>
                {action.metadata && Object.keys(action.metadata).length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {JSON.stringify(action.metadata)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
