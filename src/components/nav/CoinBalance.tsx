'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';

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
    // Refresh balance when window regains focus (e.g. after claiming on another tab)
    window.addEventListener('focus', refresh);
    // Also listen for a custom event dispatched after daily claim
    window.addEventListener('coins:updated', refresh as EventListener);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('coins:updated', refresh as EventListener);
    };
  }, [refresh]);

  return (
    <Link
      href="/coins"
      className="hidden sm:flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
    >
      <Coins size={14} />
      <span>{gold.toLocaleString()} GC</span>
      {sweeps > 0 && (
        <span className="text-green-400 ml-1">{sweeps.toLocaleString()} SC</span>
      )}
    </Link>
  );
}
