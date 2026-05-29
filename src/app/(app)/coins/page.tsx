'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Coins, Zap, Star, Crown, Gift } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import type { CoinPack } from '@/types';

const PaymentModal = dynamic(() => import('@/components/coins/PaymentModal'), { ssr: false });

const COIN_PACKS: CoinPack[] = [
  { id: 'starter', label: 'Starter', price_cents: 499,  gold_coins: 500,  sweeps_coins: 5  },
  { id: 'player',  label: 'Player',  price_cents: 999,  gold_coins: 1100, sweeps_coins: 11, popular: true },
  { id: 'pro',     label: 'Pro',     price_cents: 1999, gold_coins: 2400, sweeps_coins: 24 },
  { id: 'elite',   label: 'Elite',   price_cents: 4999, gold_coins: 6500, sweeps_coins: 65 },
];

const PACK_ICONS = [Coins, Zap, Star, Crown];

function customPrice(gold: number) { return (gold / 100).toFixed(2); }
function customSweeps(gold: number) { return Math.floor(gold / 100); }

export default function CoinsPage() {
  const [modal, setModal] = useState<{ packId: string; customGold?: number } | null>(null);
  const [success, setSuccess] = useState<{ gold: number; sweeps: number } | null>(null);
  const [customGold, setCustomGold] = useState('');
  const [dailyClaimable, setDailyClaimable] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    fetch('/api/coins/daily-bonus').then(r => r.json()).then(d => setDailyClaimable(d.claimable));
  }, []);

  const openModal = (packId: string, customGoldOverride?: number) => {
    setSuccess(null);
    setModal({ packId, customGold: customGoldOverride });
  };

  const handleSuccess = (gold: number, sweeps: number) => {
    setModal(null);
    setSuccess({ gold, sweeps });
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
        <p className="text-gray-400">Purchase Gold Coins to enter contests and receive bonus Sweeps Coins.</p>
        <div className="flex items-center justify-center gap-6 pt-1 text-sm">
          <span><span className="text-yellow-400 font-bold">🪙 Gold Coins</span> — contest entry only, no cash value</span>
          <span><span className="text-green-400 font-bold">💎 Sweeps Coins</span> — redeemable for cash prizes</span>
        </div>
      </div>

      {/* Purchase success banner */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-green-400">Payment successful!</div>
            <div className="text-sm text-gray-300 mt-0.5">
              <span className="text-yellow-400 font-semibold">{success.gold.toLocaleString()} GC</span>
              {' + '}
              <span className="text-green-400 font-semibold">{success.sweeps} SC</span>
              {' have been added to your account.'}
            </div>
          </div>
          <button onClick={() => setSuccess(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
      )}

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

      {/* Packs grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Coin Packs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COIN_PACKS.map((pack, i) => {
            const Icon = PACK_ICONS[i];
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
                      onClick={() => openModal(pack.id)}
                      className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${
                        pack.popular
                          ? 'bg-green-500 hover:bg-green-400 text-black'
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                    >
                      Buy {pack.label}
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
            onClick={() => openModal('custom', customGoldNum)}
            disabled={!customValid}
            className="w-full py-2.5 rounded-lg font-bold text-sm bg-yellow-500 hover:bg-yellow-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {customValid ? `Buy ${customGoldNum.toLocaleString()} GC for $${customPrice(customGoldNum)}` : 'Enter an amount (min 100 GC)'}
          </button>
        </CardBody>
      </Card>

      <p className="text-xs text-gray-600 text-center leading-relaxed">
        Gold Coins have no cash value. Sweeps Coins can be redeemed for prizes per <a href="/sweepstakes-rules" className="underline hover:text-gray-400">Official Rules</a>.
        Must be 18+. Void where prohibited. No purchase necessary — free Sweeps Coins available via <a href="/sweepstakes-rules" className="underline hover:text-gray-400">alternate method of entry</a>.
      </p>

      {/* Payment modal */}
      {modal && (
        <PaymentModal
          packId={modal.packId}
          customGold={modal.customGold}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
