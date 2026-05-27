'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const DURATION_OPTIONS = [
  { value: '30d',       label: '30 Days',   desc: 'Short break' },
  { value: '90d',       label: '90 Days',   desc: '3 months' },
  { value: '180d',      label: '180 Days',  desc: '6 months' },
  { value: 'permanent', label: 'Permanent', desc: 'Irrevocable for 5 years' },
];

const LIMIT_PRESETS = [
  { label: '$5',   cents: 500   },
  { label: '$10',  cents: 1000  },
  { label: '$25',  cents: 2500  },
  { label: '$50',  cents: 5000  },
  { label: '$100', cents: 10000 },
];

interface Props {
  currentLimitCents?: number | null;
}

export function SelfExclusionCard({ currentLimitCents }: Props) {
  // Self-exclusion state
  const [exclusionOpen, setExclusionOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [exclusionLoading, setExclusionLoading] = useState(false);

  // Deposit limit state
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitCents, setLimitCents] = useState<number | null>(currentLimitCents ?? null);
  const [limitInput, setLimitInput] = useState(
    currentLimitCents ? (currentLimitCents / 100).toString() : ''
  );
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');

  const router = useRouter();

  const handleSelfExclude = async () => {
    if (!selected || !confirmed) return;
    setExclusionLoading(true);
    try {
      const res = await fetch('/api/account/self-exclude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      router.push('/self-excluded');
    } catch (err: any) {
      alert(err.message);
      setExclusionLoading(false);
    }
  };

  const handleSetLimit = async (newCents: number | null) => {
    setLimitLoading(true);
    setLimitMsg('');
    try {
      const res = await fetch('/api/account/deposit-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit_cents: newCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setLimitCents(newCents);
      setLimitInput(newCents ? (newCents / 100).toString() : '');
      setLimitMsg(newCents ? `Daily limit set to $${(newCents / 100).toFixed(2)}` : 'Deposit limit removed.');
      setLimitOpen(false);
    } catch (err: any) {
      setLimitMsg(err.message);
    } finally {
      setLimitLoading(false);
    }
  };

  const parsedCustomCents = Math.round(parseFloat(limitInput) * 100);
  const customValid = !isNaN(parsedCustomCents) && parsedCustomCents >= 100;

  return (
    <Card className="border-yellow-500/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-yellow-400" />
          <h3 className="font-bold text-white">Responsible Gaming</h3>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-gray-400">
          Tools to help you stay in control of your play.
        </p>

        <div className="flex items-center justify-between gap-3 text-sm">
          <a href="tel:18005224700" className="text-green-400 hover:text-green-300 font-medium">
            Help: 1-800-522-4700
          </a>
          <a href="/responsible-gaming" className="text-gray-400 hover:text-gray-300">
            Learn more
          </a>
        </div>

        {/* Deposit Limit Section */}
        <div className="border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-blue-400" />
              <span className="text-sm font-semibold text-white">Daily Deposit Limit</span>
            </div>
            {limitCents ? (
              <span className="text-xs text-blue-400 font-medium">${(limitCents / 100).toFixed(2)}/day</span>
            ) : (
              <span className="text-xs text-gray-500">No limit set</span>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Limits take effect immediately. Increases require a 24-hour waiting period.
          </p>

          {limitMsg && (
            <p className={`text-xs ${limitMsg.startsWith('Daily') || limitMsg.startsWith('Deposit limit removed') ? 'text-green-400' : 'text-red-400'}`}>
              {limitMsg}
            </p>
          )}

          {!limitOpen ? (
            <button
              onClick={() => setLimitOpen(true)}
              className="w-full border border-blue-500/30 hover:border-blue-500/60 text-blue-400 hover:text-blue-300 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {limitCents ? 'Change Limit' : 'Set a Limit'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1.5">
                {LIMIT_PRESETS.map(p => (
                  <button
                    key={p.cents}
                    onClick={() => { setLimitInput((p.cents / 100).toString()); }}
                    className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      parsedCustomCents === p.cents
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-gray-700 hover:border-gray-600 text-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  placeholder="Custom amount"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-500 text-xs">/day</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setLimitOpen(false); setLimitMsg(''); }}
                  className="flex-1 text-sm text-gray-400 hover:text-white border border-gray-700 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {limitCents && (
                  <button
                    onClick={() => handleSetLimit(null)}
                    disabled={limitLoading}
                    className="flex-1 text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 py-2 rounded-lg transition-colors disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={() => handleSetLimit(parsedCustomCents)}
                  disabled={!customValid || limitLoading}
                  className="flex-1 text-sm font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors"
                >
                  {limitLoading ? 'Saving...' : 'Set Limit'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Self-Exclusion Section */}
        <div className="border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            <span className="text-sm font-semibold text-white">Self-Exclusion</span>
          </div>
          <p className="text-xs text-gray-500">
            Temporarily or permanently lock your account. You will be signed out immediately and unable to access contests.
          </p>

          {!exclusionOpen ? (
            <button
              onClick={() => setExclusionOpen(true)}
              className="w-full border border-yellow-500/30 hover:border-yellow-500/60 text-yellow-400 hover:text-yellow-300 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Self-Exclude Account
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${
                      selected === opt.value
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{opt.label}</div>
                    <div className="text-xs text-gray-400">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {selected && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5 accent-yellow-500"
                  />
                  <span className="text-xs text-gray-300">
                    I understand this will immediately lock my account
                    {selected === 'permanent' ? ' permanently (minimum 5 years)' : ` for ${DURATION_OPTIONS.find(o => o.value === selected)?.label}`}
                    {' '}and I will be signed out.
                  </span>
                </label>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setExclusionOpen(false); setSelected(''); setConfirmed(false); }}
                  className="flex-1 text-sm text-gray-400 hover:text-white border border-gray-700 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelfExclude}
                  disabled={!selected || !confirmed || exclusionLoading}
                  className="flex-1 text-sm font-bold bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black py-2 rounded-lg transition-colors"
                >
                  {exclusionLoading ? 'Applying...' : 'Confirm Exclusion'}
                </button>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
