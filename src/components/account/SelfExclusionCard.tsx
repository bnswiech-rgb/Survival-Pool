'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const DURATION_OPTIONS = [
  { value: '30d',       label: '30 Days',   desc: 'Short break' },
  { value: '90d',       label: '90 Days',   desc: '3 months' },
  { value: '180d',      label: '180 Days',  desc: '6 months' },
  { value: 'permanent', label: 'Permanent', desc: 'Irrevocable for 5 years' },
];

export function SelfExclusionCard() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!selected || !confirmed) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <Card className="border-yellow-500/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-yellow-400" />
          <h3 className="font-bold text-white">Responsible Gaming</h3>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-gray-400">
          If you feel you need a break, you can self-exclude your account. During exclusion you will not be able to enter contests or access your account.
        </p>

        <div className="flex items-center justify-between gap-3 text-sm">
          <a href="tel:18005224700" className="text-green-400 hover:text-green-300 font-medium">
            Help: 1-800-522-4700
          </a>
          <a href="/responsible-gaming" className="text-gray-400 hover:text-gray-300">
            Learn more
          </a>
        </div>

        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="w-full border border-yellow-500/30 hover:border-yellow-500/60 text-yellow-400 hover:text-yellow-300 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Self-Exclude Account
          </button>
        ) : (
          <div className="space-y-4 border border-yellow-500/20 rounded-xl p-4 bg-yellow-500/5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-200">
                Self-exclusion is immediate and cannot be easily reversed. Choose your exclusion period:
              </p>
            </div>

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
                onClick={() => { setOpen(false); setSelected(''); setConfirmed(false); }}
                className="flex-1 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected || !confirmed || loading}
                className="flex-1 text-sm font-bold bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black py-2 rounded-lg transition-colors"
              >
                {loading ? 'Applying...' : 'Confirm Exclusion'}
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
