'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Zap, Star, Crown, Gift, Lock, DollarSign } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import type { CoinPack } from '@/types';

const PaymentModal = dynamic(() => import('@/components/coins/PaymentModal'), { ssr: false });

// sweeps_coins stored as cents of Sharpr Cash (÷100 = dollar value)
const COIN_PACKS: CoinPack[] = [
  { id: 'starter', label: 'Starter', price_cents: 500,  gold_coins: 500,  sweeps_coins: 400  },
  { id: 'player',  label: 'Player',  price_cents: 1000, gold_coins: 1100, sweeps_coins: 800,  popular: true },
  { id: 'pro',     label: 'Pro',     price_cents: 2000, gold_coins: 2400, sweeps_coins: 1600 },
  { id: 'elite',   label: 'Elite',   price_cents: 5000, gold_coins: 6500, sweeps_coins: 4500 },
];

const PACK_ICONS = [DollarSign, Zap, Star, Crown];

// Custom: enter cash amount → derive coins & price (80% ratio)
function cashToPrice(cash: number) { return cash / 0.8; }
function cashToCoins(cash: number) { return Math.round(cashToPrice(cash) * 100); }
function cashToSweepsStored(cash: number) { return Math.round(cash * 100); }

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

  const customCashNum = parseFloat(customCash) || 0;
  const customValid = customCashNum >= 1 && customCashNum <= 800;
  const customCoinsNeeded = cashToCoins(customCashNum);
  const customPriceNum = cashToPrice(customCashNum);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-white">Get Sharpr Cash</h1>
        <p className="text-gray-400">
          {restricted
            ? 'Your state does not allow cash prizes. Play free with Sharpr Coins.'
            : 'Choose how much Sharpr Cash you want. Redeemable at $1.00 each.'}
        </p>
      </div>

      {/* Purchase success banner */}
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

      {/* Restricted state */}
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

      {/* Packs + custom — hidden for restricted states */}
      {!restricted && (
        <>
          {/* Packs grid */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Sharpr Cash Packages</h2>
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
                      <CardBody className="space-y-3">
                        {/* Cash amount — hero */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-3xl font-black text-green-400">${cashValue}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Sharpr Cash</div>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Icon size={16} />
                            <span className="text-sm font-bold">{pack.label}</span>
                          </div>
                        </div>

                        {/* Coins required */}
                        <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-sm text-gray-400">
                          Requires purchase of{' '}
                          <span className="text-yellow-400 font-semibold">{pack.gold_coins.toLocaleString()} Sharpr Coins</span>
                        </div>

                        {/* Price + buy */}
                        <button
                          onClick={() => openModal(pack.id)}
                          className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${
                            pack.popular
                              ? 'bg-green-500 hover:bg-green-400 text-black'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                          }`}
                        >
                          Buy for ${(pack.price_cents / 100).toFixed(2)}
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
                <p className="text-sm text-gray-400 mt-0.5">Enter how much Sharpr Cash you want.</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Sharpr Cash amount</label>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold text-lg">$</span>
                    <input
                      type="number"
                      min="1"
                      max="800"
                      step="1"
                      placeholder="20.00"
                      value={customCash}
                      onChange={e => setCustomCash(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-green-500 text-sm"
                    />
                  </div>
                </div>

                {customCashNum >= 1 && (
                  <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-sm text-gray-400">
                    Requires purchase of{' '}
                    <span className="text-yellow-400 font-semibold">{customCoinsNeeded.toLocaleString()} Sharpr Coins</span>
                    {' '}• Price: <span className="text-white font-semibold">${customPriceNum.toFixed(2)}</span>
                  </div>
                )}

                <button
                  onClick={() => openModal('custom', customCoinsNeeded)}
                  disabled={!customValid}
                  className="w-full py-2.5 rounded-lg font-bold text-sm bg-green-500 hover:bg-green-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {customValid
                    ? `Get $${parseFloat(customCash).toFixed(2)} Sharpr Cash for $${customPriceNum.toFixed(2)}`
                    : 'Enter an amount ($1.00 – $800.00)'}
                </button>
              </div>

              {/* Policy note */}
              <div className="text-xs text-gray-600 pt-1 border-t border-gray-800">
                <button
                  onClick={() => policyRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="underline hover:text-gray-400"
                >
                  *Sharpr Cash bonus policy
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Policy fine print */}
          <div ref={policyRef} className="text-xs text-gray-600 leading-relaxed space-y-1 pt-2">
            <p>
              *To receive Sharpr Cash, you must purchase Sharpr Coins ($0.01 per coin). Sharpr Cash is a promotional bonus awarded at no charge — it is not purchased directly. Sharpr Coins have no cash value. Sharpr Cash is redeemable for cash prizes at $1.00 per Sharpr Cash, subject to a $50.00 minimum redemption and 1× playthrough requirement. See{' '}
              <a href="/sweepstakes-rules" className="underline hover:text-gray-400">Official Rules</a> for full details and eligibility.
            </p>
            <p>Must be 18+. Void where prohibited. No purchase necessary — free Sharpr Cash available via <a href="/sweepstakes-rules" className="underline hover:text-gray-400">alternate method of entry</a>.</p>
          </div>
        </>
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
