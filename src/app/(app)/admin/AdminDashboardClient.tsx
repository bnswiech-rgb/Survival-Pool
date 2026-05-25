'use client';
import { useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';
import Link from 'next/link';

const TABS = ['Pools', 'Grade Picks', 'Users & Coins', 'Actions Log'];

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
  const [pickSearch, setPickSearch] = useState('');

  const runAutoGrade = async () => {
    setAutoGrading(true);
    try {
      const res = await fetch('/api/admin/run-grader', { method: 'POST' });
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || data.error) toast.error(data.error || `HTTP ${res.status}`);
      else toast.success(`Advanced ${data.advancedRounds ?? 0} rounds`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to run grader');
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

  const regradeRound = async (poolId: string) => {
    const res = await fetch('/api/admin/regrade-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool_id: poolId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Regrade failed'); return; }
    toast.success(`Round ${data.round} reset for regrading — running grader...`);
    await runAutoGrade();
  };

  const resetRound = async (poolId: string) => {
    const res = await fetch('/api/admin/reset-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool_id: poolId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Reset failed'); return; }
    toast.success(`Round reset: ${data.eliminated ?? 0} eliminated, ${data.advanced ?? 0} advanced`);
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

  const rebuildStats = async (poolId: string, poolName: string) => {
    if (!confirm(`Rebuild stats for "${poolName}"? This replays all completed rounds to fix wins/losses/streaks.`)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/rebuild-stats`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to rebuild stats');
    else toast.success(`Stats rebuilt — ${data.roundsProcessed} rounds replayed`);
  };

  const extendDeadline = async (poolId: string) => {
    const res = await fetch(`/api/admin/pools/${poolId}/extend-deadline`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to extend deadline');
    else toast.success(`Round ${data.round_number} deadline set to ${new Date(data.new_deadline).toLocaleString()}`);
  };

  const autoAssignTeams = async (poolId: string, poolName: string) => {
    if (!confirm(`Randomly assign all teamless participants in "${poolName}" into teams? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/auto-assign-teams`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to assign teams');
    else toast.success(`Created ${data.teamsCreated} teams, assigned ${data.assigned} players${data.voided ? `, removed ${data.voided} (couldn't form full team)` : ''}`);
  };

  const mergeSmallTeams = async (poolId: string, poolName: string) => {
    if (!confirm(`Merge undersized teams in "${poolName}" together? Solo/duo teams will be combined.`)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/merge-small-teams`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to merge teams');
    else toast.success(`Merged ${data.merged} players, removed ${data.deleted} empty teams`);
  };

  const restoreTeams = async (poolId: string, poolName: string) => {
    if (!confirm(`Restore "${poolName}" teams to the last snapshot? This will undo any team changes made since the snapshot.`)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/restore-teams`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to restore teams');
    else toast.success(`Restored ${data.teams} teams from snapshot at ${new Date(data.snapshotAt).toLocaleString()}`);
  };

  const reassignTeams = async (poolId: string, poolName: string) => {
    if (!confirm(`Reassign ALL teams in "${poolName}" from scratch, ensuring no teammates share the same pick? This replaces all existing teams.`)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/reassign-teams`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to reassign teams');
    else toast.success(`Reassigned ${data.totalPlayers} players into ${data.teamsCreated} teams (no duplicate picks)`);
  };

  const deleteRoundsFrom = async (poolId: string, poolName: string) => {
    const input = prompt(`Delete rounds from which number onward in "${poolName}"?\n(e.g. enter 7 to delete rounds 7, 8, 9... and reopen round 6)`);
    const from_round = parseInt(input ?? '');
    if (isNaN(from_round)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/delete-rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_round }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to delete rounds');
    else toast.success(`Deleted rounds ${data.deleted.join(', ')} — round ${data.reopened} reopened`);
  };

  // Coin grant state
  const [grantUsername, setGrantUsername] = useState('');
  const [grantGold, setGrantGold] = useState('');
  const [grantSweeps, setGrantSweeps] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);

  const grantCoins = async () => {
    if (!grantUsername.trim()) { toast.error('Enter a username'); return; }
    if (!grantGold && !grantSweeps) { toast.error('Enter at least one coin amount'); return; }
    setGranting(true);
    try {
      const res = await fetch('/api/admin/grant-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: grantUsername.trim(),
          gold_delta: parseInt(grantGold) || 0,
          sweeps_delta: parseInt(grantSweeps) || 0,
          note: grantNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || 'Failed to grant coins');
      else {
        toast.success(`Granted to ${data.username} — ${data.new_gold.toLocaleString()} GC, ${data.new_sweeps.toLocaleString()} SC`);
        setGrantUsername(''); setGrantGold(''); setGrantSweeps(''); setGrantNote('');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
    setGranting(false);
  };

  const forceComplete = async (poolId: string, poolName: string) => {
    if (!confirm(`Force complete "${poolName}"? This will crown the leader as winner and close the pool.`)) return;
    const res = await fetch(`/api/admin/pools/${poolId}/force-complete`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed to force complete');
    else toast.success('Pool completed and winner crowned!');
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
                      <Button size="sm" variant="secondary" onClick={() => rebuildStats(pool.id, pool.name)}>
                        Rebuild Stats
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => extendDeadline(pool.id)}>
                        Extend Deadline
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => advanceRound(pool.id)}>
                        Advance Round
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => regradeRound(pool.id)}>
                        Regrade Round
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => resetRound(pool.id)}>
                        Reset Round
                      </Button>
                      {pool.contest_format === 'team_battle' && (
                        <Button size="sm" variant="secondary" onClick={() => autoAssignTeams(pool.id, pool.name)}>
                          Auto-Assign Teams
                        </Button>
                      )}
                      {pool.contest_format === 'team_battle' && (
                        <Button size="sm" variant="secondary" onClick={() => mergeSmallTeams(pool.id, pool.name)}>
                          Merge Small Teams
                        </Button>
                      )}
                      {pool.contest_format === 'team_battle' && (
                        <Button size="sm" variant="secondary" onClick={() => reassignTeams(pool.id, pool.name)}>
                          Reassign Teams
                        </Button>
                      )}
                      {pool.contest_format === 'team_battle' && (
                        <Button size="sm" variant="secondary" onClick={() => restoreTeams(pool.id, pool.name)}>
                          Restore Teams
                        </Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => deleteRoundsFrom(pool.id, pool.name)}>
                        Delete Rounds
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => forceComplete(pool.id, pool.name)}>
                        Force Complete
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
          <input
            placeholder="Search by team, player, or pool..."
            value={pickSearch}
            onChange={e => setPickSearch(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {picks.filter((p: any) => !pickSearch || JSON.stringify(p).toLowerCase().includes(pickSearch.toLowerCase())).length === 0 ? (
            <Card><CardBody className="text-center py-8 text-gray-500">No picks found.</CardBody></Card>
          ) : (
            picks.filter((p: any) => !pickSearch || JSON.stringify(p).toLowerCase().includes(pickSearch.toLowerCase())).map((pick: any) => (
              <Card key={pick.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{pick.profiles?.username}</span>
                        <span className="text-gray-400 text-sm">in {pick.pools?.name}</span>
                        <Badge variant="gray">Round {pick.rounds?.round_number}</Badge>
                        <Badge variant={pick.status === 'won' ? 'green' : pick.status === 'lost' ? 'red' : pick.status === 'push' ? 'blue' : 'yellow'}>
                          {pick.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-300 mt-1">{pick.game}</div>
                      <div className="text-sm text-white font-medium">
                        {pick.pick_type === 'moneyline' ? `${pick.side} ML` : pick.pick_type === 'total' ? pick.line_value : `${pick.side} ${pick.line_value}`} · {pick.american_odds > 0 ? '+' : ''}{pick.american_odds}
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

      {/* Users & Coins Tab */}
      {activeTab === 'Users & Coins' && (
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <h3 className="font-bold text-white">Grant Coins to User</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wide">Username</label>
                  <input
                    placeholder="exactusername"
                    value={grantUsername}
                    onChange={e => setGrantUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wide">Note (optional)</label>
                  <input
                    placeholder="Reason for grant…"
                    value={grantNote}
                    onChange={e => setGrantNote(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-yellow-400 uppercase tracking-wide">Gold Coins (GC)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={grantGold}
                    onChange={e => setGrantGold(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-green-400 uppercase tracking-wide">Sweeps Coins (SC)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={grantSweeps}
                    onChange={e => setGrantSweeps(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <Button onClick={grantCoins} loading={granting} variant="primary">
                Grant Coins
              </Button>
            </CardBody>
          </Card>
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
