'use client';

import { useState, useEffect } from 'react';
import { Gift, Clock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';

interface Props {
  lastClaimAt: string | null;
}

function isAlreadyClaimed(lastClaimAt: string | null): boolean {
  if (!lastClaimAt) return false;
  const todayMidnightUTC = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  ));
  return new Date(lastClaimAt) >= todayMidnightUTC;
}

function formatCountdown(): string {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff = midnight.getTime() - now.getTime();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DailyClaimCard({ lastClaimAt }: Props) {
  const [claimed, setClaimed] = useState(() => isAlreadyClaimed(lastClaimAt));
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(formatCountdown);
  const [earned, setEarned] = useState<{ gold: number; sweeps: number } | null>(null);

  useEffect(() => {
    if (!claimed) return;
    const id = setInterval(() => setCountdown(formatCountdown()), 1000);
    return () => clearInterval(id);
  }, [claimed]);

  const handleClaim = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/coins/daily-bonus', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to claim');
      setEarned({ gold: data.gold_earned, sweeps: data.sweeps_earned });
      setClaimed(true);
      window.dispatchEvent(new Event('coins:updated'));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (claimed && !earned) {
    return (
      <Card className="border-gray-700">
        <CardBody className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-400">Daily coins claimed</p>
              <p className="text-xs text-gray-600">Next claim in <span className="text-gray-400 font-mono">{countdown}</span></p>
            </div>
          </div>
          <div className="text-xs text-gray-600">250 GC + 50 SC</div>
        </CardBody>
      </Card>
    );
  }

  if (earned) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardBody className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <Gift size={20} className="text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-400">+{earned.gold} GC & +{earned.sweeps} SC added!</p>
              <p className="text-xs text-gray-500">Next claim in <span className="font-mono">{countdown}</span></p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardBody className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <Gift size={20} className="text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Daily Free Coins</p>
            <p className="text-xs text-gray-400">Claim <span className="text-yellow-400 font-bold">250 GC</span> + <span className="text-purple-400 font-bold">50 SC</span> free every day</p>
          </div>
        </div>
        <button
          onClick={handleClaim}
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors flex-shrink-0"
        >
          {loading ? 'Claiming...' : 'Claim'}
        </button>
      </CardBody>
    </Card>
  );
}
