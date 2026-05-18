'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getContestFormatLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Users, Trophy } from 'lucide-react';

interface InvitePool {
  id: string;
  name: string;
  sport: string;
  contest_format: string;
  entry_fee_cents: number;
  visibility: string;
  status: string;
  created_by: string;
}

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();

  const [pool, setPool] = useState<InvitePool | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then(async res => {
        if (res.status === 401) {
          router.replace(`/login?redirect=/invite/${code}`);
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Invite not found');
        } else {
          setPool(data.pool);
          setParticipantCount(data.participantCount);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load invite');
        setLoading(false);
      });
  }, [code, router]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/invite/${code}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      toast.success('Successfully joined the contest!');
      router.push(`/pools/${data.poolId}`);
    } catch (e: any) {
      toast.error(e.message);
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center text-gray-400">Loading invite...</div>
    );
  }

  if (error || !pool) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <Card>
          <CardBody className="text-center py-10">
            <div className="text-4xl mb-3">🔗</div>
            <div className="text-white font-bold mb-1">Invite Not Found</div>
            <div className="text-gray-400 text-sm">{error ?? 'This invite link is invalid or has expired.'}</div>
            <Button className="mt-6" variant="secondary" onClick={() => router.push('/')}>Go Home</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const isOpen = pool.status === 'open' || pool.status === 'upcoming';

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-black text-white">You&apos;re Invited!</h1>
        <p className="text-gray-400 mt-1 text-sm">Someone invited you to join a survival picking contest.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-lg">{pool.name}</h2>
            <Badge variant={isOpen ? 'green' : 'red'}>
              {isOpen ? 'Open' : pool.status}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <div className="text-xs text-gray-500">Sport</div>
              <div className="font-medium text-white mt-0.5">{pool.sport}</div>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <div className="text-xs text-gray-500">Format</div>
              <div className="font-medium text-white mt-0.5">{getContestFormatLabel(pool.contest_format as any)}</div>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <div className="text-xs text-gray-500">Entry Fee</div>
              <div className="font-medium text-white mt-0.5">Free</div>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Users size={12} />Participants</div>
              <div className="font-medium text-white mt-0.5">{participantCount}</div>
            </div>
          </div>

          {isOpen ? (
            <Button className="w-full" size="lg" onClick={handleJoin} loading={joining}>
              <Trophy size={16} className="mr-2" />
              Join Contest
            </Button>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center text-red-400 text-sm font-medium">
              {pool.status === 'completed' ? 'This contest has ended.' : 'This contest is no longer accepting entries.'}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
