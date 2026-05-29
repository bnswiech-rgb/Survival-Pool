'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { SharprCashIcon } from '@/components/ui/SharprCashIcon';

interface Props {
  initialGold: number;
  initialSweeps: number;
}

export function CoinBalance({ initialGold, initialSweeps }: Props) {
  const [gold, setGold] = useState(initialGold);
  const [sweeps, setSweeps] = useState(initialSweeps);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/coins/balance', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setGold(data.gold_coins ?? gold);
      setSweeps(data.sweeps_coins ?? sweeps);
    } catch { /* silent */ }
  }, [gold, sweeps]);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    window.addEventListener('coins:updated', refresh as EventListener);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('coins:updated', refresh as EventListener);
    };
  }, [refresh]);

  return (
    <Link
      href="/coins"
      className="hidden sm:flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
    >
      <span className="flex items-center gap-1 text-yellow-400">
        <Coins size={13} />
        {gold.toLocaleString()}
      </span>
      <span className="text-gray-600">|</span>
      <span className="flex items-center gap-1 text-green-400">
        <SharprCashIcon size={14} />
        {(sweeps / 100).toFixed(2)}
      </span>
    </Link>
  );
}
