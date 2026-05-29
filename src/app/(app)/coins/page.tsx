'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Coins, Zap, Star, Crown, Gift, Lock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import type { CoinPack } from '@/types';

const PaymentModal = dynamic(() => import('@/components/coins/PaymentModal'), { ssr: false });

// Stored sweeps_coins are in cents of Sharpr Cash (÷100 = dollars)
// 1 Sharpr Cash = $1.00 redeemable
const COIN_PACKS: CoinPack[] = [
  { id: 'starter', label: 'Starter', price_cents: 499,  gold_coins: 500,  sweeps_coins: 400  },
  { id: 'player',  label: 'Player',  price_cents: 999,  gold_coins: 1100, sweeps_coins: 800,  popular: true },
  { id: 'pro',     label: 'Pro',     price_cents: 1999, gold_coins: 2400, sweeps_coins: 1600 },
  { id: 'elite',   label: 'Elite',   price_cents: 4999, gold_coins: 6500, sweeps_coins: 4000 },
];

const PACK_ICONS = [Coins, Zap, Star, Crown];

// Custom: 100 Sharpr Coins = $1.00, 80% back as Sharpr Cash
function customPrice(coins: number) { return (coins / 100).toFixed(2); }
function customCash(coins: number) { return (Math.floor(coins * 0.8) / 100).toFixed(2); }
function customCashStored(coins: number) { return Math.floor(coins * 0.8); }

export default function CoinsPage() {
  const [modal, setModal] = useState<{ packId: string; customGold?: number } | null>(null);
  const [success, setSuccess] = useState<{ gold: number; sweeps: number } | null>(null);
  const [customCoins, setCustomCoins] = useState('');
  const [dailyClaimable, setDailyClaimable] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    fetch('/api/coins/daily-bonus').then(r => r.json()).then(d => setDailyClaimable(d.claimable));
    fetch('/api/user/geo').then(r => r.json()).then(d => setRestricted(d.restricted));
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

  const customCoinsNum = parseInt(customCoins) || 0;
  const customValid = customCoinsNum >= 100 && customCoinsNum <= 100000;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-white">Get Coins</h1>
        <p className="text-gray-400">
          {restricted
            ? 'Your state does not allow cash prizes. Play free with Sharpr Coins.'
            : 'Purchase Sharpr Coins and receive Sharpr Cash to enter contests and win real prizes.'}
        </p>
        <div className="flex items-center justify-center gap-6 pt-1 text-sm flex-wrap">
          <span><span className="text-yellow-400 font-bold">🪙 Sharpr Coins</span> — for entertainment only, no cash value</span>
          {!restricted && <span><span className="text-green-400 font-bold">💵 Sharpr Cash</span> — redeemable for cash at $1.00 each</span>}
        </div>
      </div>

      {/* Purchase success banner */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-green-400">Payment successful!</div>
            <div className="text-sm text-gray-300 mt-0.5">
              <span className="text-yellow-400 font-semibold">{success.gold.toLocaleString()} Sharpr Coins</span>
              {' + '}
              <span className="text-green-400 font-semibold">${(success.sweeps / 100).toFixed(2)} Sharpr Cash</span>
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
                  {dailyClaimed
                    ? '✅ Claimed for today — come back tomorrow!'
                    : restricted
                      ? 'Claim 250 Sharpr Coins free every day'
                      : 'Claim 250 Sharpr Coins + $0.20 Sharpr Cash free every day'}
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
                {dailyClaiming ? 'Claiming…' : dailyClaimable ? 'Claim Free Bonus' : 'Already Claimed'}
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Restricted state: free play only message */}
      {restricted && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-center space-y-2">
          <Lock size={24} className="text-gray-500 mx-auto" />
          <div className="font-bold text-white">Free Play Only</div>
          <p className="text-sm text-gray-400">
            Cash prize contests are not available in your state. You can still play free pools and earn Sharpr Coins.
            Check out <a href="/sweepstakes-rules" className="underline hover:text-gray-300">Official Rules</a> for alternate entry options.
          </p>
        </div>
      )}

      {/* Packs grid — hidden for restricted states */}
      {!restricted && (
        <>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Coin Packs</h2>
            <p className="text-sm text-gray-500 mb-4">Purchase Sharpr Coins and receive Sharpr Cash FREE as a promotional bonus.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COIN_PACKS.map((pack, i) => {
                const Icon = PACK_ICONS[i];
                const cashValue = (pack.sweeps_coins / 100).toFixed(2);
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
                            <span className="text-gray-400">Sharpr Coins</span>
                            <span className="font-bold text-yellow-400">{pack.gold_coins.toLocaleString()} coins</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Sharpr Cash <span className="text-xs text-gray-600">(FREE bonus)</span></span>
                            <span className="font-bold text-green-400">${cashValue}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-800">
                            <span>1 Sharpr Cash = $1.00 redeemable</span>
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
                <p className="text-sm text-gray-400 mt-0.5">Choose exactly how many Sharpr Coins you want. 100 coins = $1.00. Receive 80% back as Sharpr Cash FREE.</p>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Sharpr Coins</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    step="100"
                    placeholder="e.g. 1000"
                    value={customCoins}
                    onChange={e => setCustomCoins(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-yellow-500 text-sm"
                  />
                </div>
                {customCoinsNum >= 100 && (
                  <div className="space-y-1 text-right flex-shrink-0">
                    <div className="text-xs text-gray-500">You get</div>
                    <div className="text-sm font-bold text-yellow-400">{customCoinsNum.toLocaleString()} coins</div>
                    <div className="text-sm font-bold text-green-400">+ ${customCash(customCoinsNum)} cash</div>
                    <div className="text-xs text-gray-500">${customPrice(customCoinsNum)}</div>
                  </div>
                )}
              </div>
              <button
                onClick={() => openModal('custom', customCoinsNum)}
                disabled={!customValid}
                className="w-full py-2.5 rounded-lg font-bold text-sm bg-yellow-500 hover:bg-yellow-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {customValid
                  ? `Buy ${customCoinsNum.toLocaleString()} Sharpr Coins for $${customPrice(customCoinsNum)}`
                  : 'Enter an amount (min 100 coins)'}
              </button>
            </CardBody>
          </Card>
        </>
      )}

      <p className="text-xs text-gray-600 text-center leading-relaxed">
        Sharpr Coins are for entertainment only and have no cash value. Sharpr Cash is redeemable for prizes at $1.00 each per{' '}
        <a href="/sweepstakes-rules" className="underline hover:text-gray-400">Official Rules</a>.
        Must be 18+. Void where prohibited. No purchase necessary — free Sharpr Cash available via{' '}
        <a href="/sweepstakes-rules" className="underline hover:text-gray-400">alternate method of entry</a>.
      </p>

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
