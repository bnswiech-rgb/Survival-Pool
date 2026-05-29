'use client';

import { useState, useEffect } from 'react';
import { Coins, Zap, Star, Crown, Info, Gift } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import type { CoinPack } from '@/types';

const COIN_PACKS: CoinPack[] = [
  { id: 'starter', label: 'Starter', price_cents: 499,  gold_coins: 500,  sweeps_coins: 5  },
  { id: 'player',  label: 'Player',  price_cents: 999,  gold_coins: 1100, sweeps_coins: 11, popular: true },
  { id: 'pro',     label: 'Pro',     price_cents: 1999, gold_coins: 2400, sweeps_coins: 24 },
  { id: 'elite',   label: 'Elite',   price_cents: 4999, gold_coins: 6500, sweeps_coins: 65 },
];

const PACK_ICONS = [Coins, Zap, Star, Crown];

// 100 GC = $1.00, 1 SC per 100 GC
function customPrice(gold: number) { return (gold / 100).toFixed(2); }
function customSweeps(gold: number) { return Math.floor(gold / 100); }

export default function CoinsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [customGold, setCustomGold] = useState('');
  const [dailyClaimable, setDailyClaimable] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    fetch('/api/coins/daily-bonus').then(r => r.json()).then(d => setDailyClaimable(d.claimable));
  }, []);

  const handleBuy = async (packId: string, goldOverride?: number) => {
    setLoading(packId);
    try {
      const body: any = { pack_id: packId };
      if (packId === 'custom') body.custom_gold = goldOverride;
      const res = await fetch('/api/coins/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleDailyBonus = async () => {
    setDailyClaiming(true);
    try {
      const res = await fetch('/api/coins/daily-bonus', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDailyClaimed(true);
      setDailyClaimable(false);
      window.dispatchEvent(new Event('coins:updated'));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDailyClaiming(false);
    }
  };

  const customGoldNum = parseInt(customGold) || 0;
  const customValid = customGoldNum >= 100 && customGoldNum <= 100000;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-white">Get Coins</h1>
        <p className="text-gray-400">
          Gold Coins enter you into contests. Every purchase includes bonus Sweeps Coins — redeem them for cash prizes.
        </p>
      </div>

      {/* Daily bonus */}
      <Card className={dailyClaimable || dailyClaimed ? 'border-yellow-500/40' : ''}>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Gift size={20} className="text-yellow-400" />
              </div>
              <div>
                <div className="font-bold text-white">Daily Login Bonus</div>
                <div className="text-sm text-gray-400">
                  {dailyClaimed ? '✅ Claimed for today — come back tomorrow!' : 'Claim 250 GC + 5 SC free every day'}
                </div>
              </div>
            </div>
            {!dailyClaimed && (
              <button
                onClick={handleDailyBonus}
                disabled={!dailyClaimable || dailyClaiming}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                  dailyClaimable
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {dailyClaiming ? 'Claiming…' : dailyClaimable ? 'Claim Free Coins' : 'Already Claimed'}
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Sweepstakes info */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
        <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-300">
          <span className="font-bold text-blue-200">No purchase necessary.</span> You can request free Sweeps Coins by mail. See <a href="/sweepstakes-rules" className="underline hover:text-white">Official Rules</a> for details. Void where prohibited.
        </p>
      </div>

      {/* Packs grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Coin Packs</h2>
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
                <Card className={pack.popular ? 'border-green-500/50' : ''}>
                  <CardBody className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={20} className="text-yellow-400" />
                        <span className="font-bold text-white text-lg">{pack.label}</span>
                      </div>
                      <span className="text-2xl font-black text-white">${(pack.price_cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Gold Coins</span>
                        <span className="font-bold text-yellow-400">{pack.gold_coins.toLocaleString()} GC</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Sweeps Coins</span>
                        <span className="font-bold text-green-400">{pack.sweeps_coins.toLocaleString()} SC</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-800">
                        <span>Value</span>
                        <span>{(pack.gold_coins / (pack.price_cents / 100)).toFixed(0)} GC / $1</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBuy(pack.id)}
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
      </div>

      {/* Custom amount */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h3 className="font-bold text-white">Custom Amount</h3>
            <p className="text-sm text-gray-400 mt-0.5">Buy exactly how many Gold Coins you want. 100 GC = $1.00.</p>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Gold Coins</label>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                placeholder="e.g. 750"
                value={customGold}
                onChange={e => setCustomGold(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-yellow-500 text-sm"
              />
            </div>
            {customGoldNum >= 100 && (
              <div className="space-y-1 text-right flex-shrink-0">
                <div className="text-xs text-gray-500">You get</div>
                <div className="text-sm font-bold text-yellow-400">{customGoldNum.toLocaleString()} GC + <span className="text-green-400">{customSweeps(customGoldNum)} SC</span></div>
                <div className="text-xs text-gray-500">${customPrice(customGoldNum)}</div>
              </div>
            )}
          </div>
          <button
            onClick={() => handleBuy('custom', customGoldNum)}
            disabled={!customValid || !!loading}
            className="w-full py-2.5 rounded-lg font-bold text-sm bg-yellow-500 hover:bg-yellow-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading === 'custom' ? 'Processing…' : customValid ? `Buy ${customGoldNum.toLocaleString()} GC for $${customPrice(customGoldNum)}` : 'Enter an amount (min 100 GC)'}
          </button>
        </CardBody>
      </Card>

      <p className="text-xs text-gray-600 text-center">
        Gold Coins have no cash value. Sweeps Coins can be redeemed for prizes per Official Rules.
        Must be 18+. Not available in FL, ID, MT, WA, or where prohibited by law.
      </p>
    </div>
  );
}
