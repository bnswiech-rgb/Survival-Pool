'use client';

import { useState } from 'react';
import { Coins, Zap, Star, Crown, CheckCircle2, Info } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import type { CoinPack } from '@/types';

const COIN_PACKS: CoinPack[] = [
  {
    id: 'starter',
    label: 'Starter',
    price_cents: 499,
    gold_coins: 500,
    sweeps_coins: 5,
  },
  {
    id: 'player',
    label: 'Player',
    price_cents: 999,
    gold_coins: 1100,
    sweeps_coins: 11,
    popular: true,
  },
  {
    id: 'pro',
    label: 'Pro',
    price_cents: 1999,
    gold_coins: 2400,
    sweeps_coins: 24,
  },
  {
    id: 'elite',
    label: 'Elite',
    price_cents: 4999,
    gold_coins: 6500,
    sweeps_coins: 65,
  },
];

const PACK_ICONS = [Coins, Zap, Star, Crown];

export default function CoinsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleBuy = async (pack: CoinPack) => {
    setLoading(pack.id);
    try {
      const res = await fetch('/api/coins/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: pack.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      // Redirect to Stripe checkout
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-white">Buy Coins</h1>
        <p className="text-gray-400">
          Gold Coins are used to enter contests. Every pack includes bonus Sweeps Coins — redeem them for real cash prizes.
        </p>
      </div>

      {/* Sweepstakes info banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
        <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-300">
          <span className="font-bold text-blue-200">No purchase necessary.</span> You can request free Sweeps Coins by mail. See <a href="/sweepstakes-rules" className="underline hover:text-white">Official Rules</a> for details. Void where prohibited.
        </p>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} className="text-green-400" />
          <p className="text-sm text-green-300 font-medium">{success}</p>
        </div>
      )}

      {/* Packs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COIN_PACKS.map((pack, i) => {
          const Icon = PACK_ICONS[i];
          const isLoading = loading === pack.id;
          return (
            <div key={pack.id} className="relative">
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-green-500 text-black text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wide">
                    Most Popular
                  </span>
                </div>
              )}
              <Card className={pack.popular ? 'border-green-500/50 bg-gray-900' : ''}>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={20} className="text-yellow-400" />
                      <span className="font-bold text-white text-lg">{pack.label}</span>
                    </div>
                    <span className="text-2xl font-black text-white">
                      ${(pack.price_cents / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Gold Coins</span>
                      <span className="font-bold text-yellow-400">{pack.gold_coins.toLocaleString()} GC</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Sweeps Coins (bonus)</span>
                      <span className="font-bold text-green-400">{pack.sweeps_coins.toLocaleString()} SC</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-800">
                      <span>Value per $</span>
                      <span>{(pack.gold_coins / (pack.price_cents / 100)).toFixed(0)} GC / $1</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuy(pack)}
                    disabled={!!loading}
                    className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${
                      pack.popular
                        ? 'bg-green-500 hover:bg-green-400 text-black'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? 'Processing…' : `Buy ${pack.label}`}
                  </button>
                </CardBody>
              </Card>
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: '🪙', title: 'Buy Gold Coins', desc: 'Purchase a pack to get Gold Coins + bonus Sweeps Coins.' },
            { icon: '🏆', title: 'Enter Contests', desc: 'Use Gold Coins to enter pick\'em pools and compete.' },
            { icon: '💸', title: 'Win & Redeem', desc: 'Winners earn Sweeps Coins — redeem for real cash prizes.' },
          ].map((step) => (
            <Card key={step.title}>
              <CardBody className="text-center space-y-2">
                <div className="text-3xl">{step.icon}</div>
                <div className="font-bold text-white text-sm">{step.title}</div>
                <div className="text-xs text-gray-400">{step.desc}</div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        Gold Coins have no cash value. Sweeps Coins can be redeemed for prizes per Official Rules.
        Must be 18+. Not available in FL, ID, MT, WA, or where prohibited by law.
      </p>
    </div>
  );
}
