'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Gift, Lock } from 'lucide-react';
import { SharprCashIcon } from '@/components/ui/SharprCashIcon';
import { Card, CardBody } from '@/components/ui/Card';
import type { CoinPack } from '@/types';

const PaymentModal = dynamic(() => import('@/components/coins/PaymentModal'), { ssr: false });

const COIN_PACKS: CoinPack[] = [
  { id: 'starter', label: 'Starter', price_cents: 500,  gold_coins: 50,  sweeps_coins: 400  },
  { id: 'player',  label: 'Player',  price_cents: 1000, gold_coins: 110, sweeps_coins: 800,  popular: true },
  { id: 'pro',     label: 'Pro',     price_cents: 2000, gold_coins: 240, sweeps_coins: 1600 },
  { id: 'elite',   label: 'Elite',   price_cents: 5000, gold_coins: 650, sweeps_coins: 4500 },
];

// User enters spend amount → derive coins and SC received (80% back as cash)
// 10 coins per $1 spent (1 coin = $0.10)
function spendToCoins(spend: number) { return Math.round(spend * 10); }
function spendToCashDisplay(spend: number) { return (spend * 0.8).toFixed(2); }


export default function CoinsPage() {
  const [modal, setModal] = useState<{ packId: string; customGold?: number } | null>(null);
  const [success, setSuccess] = useState<{ gold: number; sweeps: number } | null>(null);
  const [customCash, setCustomCash] = useState('');
  const [dailyClaimable, setDailyClaimable] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const policyRef = useRef<HTMLDivElement>(null);

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

  const customSpendNum = parseFloat(customCash) || 0;
  const customValid = customSpendNum >= 1 && customSpendNum <= 1000;
  const customCoins = spendToCoins(customSpendNum);
  const customSCDisplay = spendToCashDisplay(customSpendNum);

  return (
    <div className="max-w-xl mx-auto space-y-6">

      {/* Success banner */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-green-400">Payment successful!</div>
            <div className="text-sm text-gray-300 mt-0.5">
              <span className="text-green-400 font-semibold">${(success.sweeps / 100).toFixed(2)} Sharpr Cash</span>
              {' + '}
              <span className="text-yellow-400 font-semibold">{success.gold.toLocaleString()} Sharpr Coins</span>
              {' added to your account.'}
            </div>
          </div>
          <button onClick={() => setSuccess(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
      )}

      {restricted ? (
        /* Restricted state */
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black text-white">Sharpr Cash</h1>
            <p className="text-gray-500 text-sm">Cash prize contests are not available in your state.</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-center space-y-2">
            <Lock size={24} className="text-gray-500 mx-auto" />
            <div className="font-bold text-white">Free Play Only</div>
            <p className="text-sm text-gray-400">
              You can still play free pools and earn Sharpr Coins daily.
              See <a href="/sweepstakes-rules" className="underline hover:text-gray-300">Official Rules</a> for alternate entry options.
            </p>
          </div>
        </div>
      ) : (
        /* Purchase UI */
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black text-white">Sharpr Cash</h1>
            <p className="text-gray-400 text-sm">
              Enter desired Sharpr Cash bonus
              <button
                onClick={() => policyRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="text-gray-500 hover:text-gray-300 ml-0.5"
              >*</button>
            </p>
          </div>

          {/* Custom input */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus-within:border-green-500 transition-colors">
              <SharprCashIcon size={28} />
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                placeholder="0.00"
                value={customCash}
                onChange={e => setCustomCash(e.target.value)}
                className="flex-1 bg-transparent text-white text-2xl font-bold focus:outline-none placeholder-gray-700"
              />
            </div>

            {customSpendNum >= 1 && (
              <div className="text-xs text-gray-500 px-1">
                You receive: <span className="text-green-400 font-semibold">${customSCDisplay} Sharpr Cash</span>
                {' + '}
                <span className="text-yellow-400 font-semibold">{customCoins.toLocaleString()} Sharpr Coins</span>
              </div>
            )}

            <button
              onClick={() => openModal('custom', customCoins)}
              disabled={!customValid}
              className="w-full py-3 rounded-xl font-black text-base bg-green-500 hover:bg-green-400 text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {customValid
                ? `Buy for $${parseFloat(customCash).toFixed(2)}`
                : 'Enter an amount'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600 uppercase tracking-widest">or select amount</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Pack tiles */}
          <div className="grid grid-cols-2 gap-3">
            {COIN_PACKS.map((pack) => {
              const cashValue = (pack.sweeps_coins / 100).toFixed(2);
              return (
                <button
                  key={pack.id}
                  onClick={() => openModal(pack.id)}
                  className={`relative text-left rounded-xl border transition-colors p-4 space-y-2 ${
                    pack.popular
                      ? 'border-green-500/60 bg-green-500/5 hover:bg-green-500/10'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-2.5 left-3 bg-green-500 text-black text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Popular
                    </span>
                  )}
                  {/* Cash amount */}
                  <div className="flex items-center gap-1.5">
                    <SharprCashIcon size={18} />
                    <span className="text-xl font-black text-green-400">{cashValue}</span>
                  </div>
                  <div className="h-px bg-gray-800" />
                  {/* Coins */}
                  <div className="text-xs text-yellow-400 font-semibold">{pack.gold_coins.toLocaleString()} coins</div>
                  {/* Price */}
                  <div className="text-xs text-gray-500">${(pack.price_cents / 100).toFixed(2)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily bonus */}
      <Card className={dailyClaimable || dailyClaimed ? 'border-yellow-500/40' : ''}>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Gift size={18} className="text-yellow-400" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Daily Login Bonus</div>
                <div className="text-xs text-gray-400">
                  {dailyClaimed
                    ? '✅ Claimed — come back tomorrow!'
                    : restricted
                      ? '250 Sharpr Coins free every day'
                      : '250 Sharpr Coins + $0.20 Sharpr Cash free daily'}
                </div>
              </div>
            </div>
            {!dailyClaimed && (
              <button
                onClick={handleDailyBonus}
                disabled={!dailyClaimable || dailyClaiming}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  dailyClaimable
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {dailyClaiming ? 'Claiming…' : dailyClaimable ? 'Claim' : 'Claimed'}
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Policy footnote */}
      {!restricted && (
        <div ref={policyRef} className="text-xs text-gray-600 leading-relaxed space-y-1">
          <p>
            *To receive Sharpr Cash, you must purchase Sharpr Coins ($0.01 per coin). Sharpr Cash is a promotional bonus awarded at no charge — it is not purchased directly. Sharpr Coins have no cash value. Sharpr Cash is redeemable at $1.00 each, subject to a $50.00 minimum and 1× playthrough requirement. See{' '}
            <a href="/sweepstakes-rules" className="underline hover:text-gray-400">Official Rules</a>.
          </p>
          <p>Must be 18+. Void where prohibited. No purchase necessary — free Sharpr Cash available via <a href="/sweepstakes-rules" className="underline hover:text-gray-400">alternate method of entry</a>.</p>
        </div>
      )}

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
