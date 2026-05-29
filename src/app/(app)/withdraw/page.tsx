'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { SharprCashIcon } from '@/components/ui/SharprCashIcon';
import { CheckCircle2, Clock, XCircle, AlertCircle, Building2, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';

const MIN_WITHDRAWAL = 2500; // cents of SC = $25.00

type PaymentMethod = 'bank_transfer' | 'paypal' | 'venmo';

const METHOD_LABELS: Record<PaymentMethod, { label: string; placeholder: string; desc: string }> = {
  bank_transfer: { label: 'Bank Account', placeholder: '', desc: 'Instant via Stripe' },
  paypal:        { label: 'PayPal',        placeholder: 'PayPal email address', desc: '1-3 days, manual' },
  venmo:         { label: 'Venmo',         placeholder: 'Venmo @handle',        desc: '1-3 days, manual' },
};

const STATUS_STYLES: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending:  { icon: Clock,        color: 'text-yellow-400', label: 'Pending' },
  approved: { icon: CheckCircle2, color: 'text-blue-400',   label: 'Approved' },
  paid:     { icon: CheckCircle2, color: 'text-green-400',  label: 'Paid' },
  rejected: { icon: XCircle,      color: 'text-red-400',    label: 'Rejected' },
};

export default function WithdrawPage() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawable, setWithdrawable] = useState<number | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [handle, setHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [instant, setInstant] = useState(false);

  // Stripe Connect status
  const [connectStatus, setConnectStatus] = useState<'loading' | 'connected' | 'not_connected' | 'incomplete'>('loading');
  const [connectLoading, setConnectLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [balRes, reqRes, statusRes] = await Promise.all([
      fetch('/api/coins/balance').then(r => r.json()),
      fetch('/api/coins/withdraw').then(r => r.json()),
      fetch('/api/connect/status').then(r => r.json()),
    ]);

    const bal = balRes.sweeps_coins ?? 0;
    const purchased = balRes.lifetime_sc_purchased ?? 0;
    const wagered = balRes.lifetime_sc_wagered ?? 0;
    const locked = Math.max(0, purchased - wagered);
    setBalance(bal);
    setWithdrawable(Math.max(0, bal - locked));
    setRequests(reqRes.requests ?? []);

    if (statusRes.connected) setConnectStatus('connected');
    else if (statusRes.details_submitted) setConnectStatus('incomplete');
    else setConnectStatus('not_connected');
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const connect = searchParams.get('connect');
    if (connect === 'success') {
      loadData();
    }
  }, [searchParams, loadData]);

  const handleConnectBank = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch('/api/connect/onboard', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setConnectLoading(false);
    }
  };

  const amountNum = parseFloat(amount) || 0;
  const amountCents = Math.round(amountNum * 100);
  const balanceDollars = balance !== null ? (balance / 100).toFixed(2) : '…';
  const withdrawableDollars = withdrawable !== null ? (withdrawable / 100).toFixed(2) : '…';
  const lockedAmount = balance !== null && withdrawable !== null ? balance - withdrawable : 0;
  const canWithdraw = withdrawable !== null && withdrawable >= MIN_WITHDRAWAL;
  const amountValid = amountCents >= MIN_WITHDRAWAL && amountCents <= (withdrawable ?? 0);
  const handleValid = method === 'bank_transfer' ? connectStatus === 'connected' : !!handle.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/coins/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: amountCents,
          payment_method: method,
          payment_handle: method === 'bank_transfer' ? 'Stripe Connect' : handle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
      setInstant(data.instant ?? false);
      setWithdrawable(w => w !== null ? w - amountCents : w);
      setBalance(b => b !== null ? b - amountCents : b);
      setRequests(r => [{
        id: data.request_id,
        amount_cents: amountCents,
        payment_method: method,
        status: data.instant ? 'paid' : 'pending',
        created_at: new Date().toISOString(),
      }, ...r]);
      setAmount('');
      setHandle('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequest = requests.find(r => r.status === 'pending');

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">Withdraw</h1>
        <p className="text-gray-400 text-sm mt-1">Redeem your Sharpr Cash for real money.</p>
      </div>

      {/* Balance card */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Withdrawable Sharpr Cash</div>
              <div className="flex items-center gap-2">
                <SharprCashIcon size={28} />
                <span className="text-3xl font-black text-green-400">${withdrawableDollars}</span>
              </div>
              {lockedAmount > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  ${(lockedAmount / 100).toFixed(2)} locked — enter contests to unlock.
                </div>
              )}
              {withdrawable !== null && withdrawable < MIN_WITHDRAWAL && withdrawable >= 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Minimum withdrawal is $25.00 — you need ${((MIN_WITHDRAWAL - withdrawable) / 100).toFixed(2)} more.
                </div>
              )}
            </div>
            <div className="text-right text-xs text-gray-600 space-y-1">
              <div>Total: ${balanceDollars}</div>
              <div>Min: $25.00</div>
              <div>Rate: 1 SC = $1.00</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Success banner */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-green-400">
              {instant ? 'Withdrawal sent!' : 'Request submitted!'}
            </div>
            <div className="text-sm text-gray-400">
              {instant
                ? 'Your funds are on the way — typically arrive within 1-2 business days.'
                : "We'll process your withdrawal manually within 3 business days."}
            </div>
          </div>
        </div>
      )}

      {/* Pending block */}
      {pendingRequest && !success && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-yellow-400">Withdrawal pending</div>
            <div className="text-sm text-gray-400">
              ${(pendingRequest.amount_cents / 100).toFixed(2)} via {METHOD_LABELS[pendingRequest.payment_method as PaymentMethod]?.label} — processing within 3 business days.
            </div>
          </div>
        </div>
      )}

      {/* Bank Connect card */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-blue-400" />
              <span className="font-bold text-white text-sm">Bank Account</span>
              <span className="text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full">Instant</span>
            </div>
            {connectStatus === 'loading' && <Loader2 size={16} className="text-gray-500 animate-spin" />}
            {connectStatus === 'connected' && <span className="text-xs text-green-400 font-bold">Connected ✓</span>}
            {(connectStatus === 'not_connected' || connectStatus === 'incomplete') && (
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {connectLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                {connectStatus === 'incomplete' ? 'Finish Setup' : 'Connect Bank'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Connect your bank account via Stripe for automatic withdrawals. Funds arrive in 1-2 business days.
          </p>
        </CardBody>
      </Card>

      {/* Withdrawal form */}
      {canWithdraw && !pendingRequest && (
        <Card>
          <CardBody className="space-y-5">
            <h2 className="font-bold text-white">Request Withdrawal</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wide">Amount</label>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 focus-within:border-green-500 transition-colors">
                  <SharprCashIcon size={18} />
                  <input
                    type="number"
                    min="25"
                    max={(withdrawable! / 100).toFixed(2)}
                    step="0.01"
                    placeholder="25.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 bg-transparent text-white font-bold focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount((withdrawable! / 100).toFixed(2))}
                    className="text-xs text-green-400 hover:text-green-300 font-bold"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wide">Payout Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMethod(m); setHandle(''); }}
                      className={`py-2 px-1 rounded-lg text-xs font-bold border transition-colors ${
                        method === m
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <div>{METHOD_LABELS[m].label}</div>
                      <div className="text-gray-500 font-normal mt-0.5">{METHOD_LABELS[m].desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank transfer — show connect status */}
              {method === 'bank_transfer' && (
                <div>
                  {connectStatus === 'connected' ? (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5 text-sm text-green-400">
                      <CheckCircle2 size={16} />
                      Bank account connected — funds sent automatically on submission.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5 text-sm text-yellow-400">
                      <AlertCircle size={16} />
                      Connect your bank account above before withdrawing.
                    </div>
                  )}
                </div>
              )}

              {/* PayPal / Venmo handle */}
              {method !== 'bank_transfer' && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">{METHOD_LABELS[method].label} Details</label>
                  <input
                    type="text"
                    placeholder={METHOD_LABELS[method].placeholder}
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-green-500 text-sm"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!amountValid || !handleValid || submitting}
                className="w-full py-3 rounded-xl font-black text-sm bg-green-500 hover:bg-green-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processing…' : amountValid ? `Withdraw $${amountNum.toFixed(2)}` : 'Enter a valid amount'}
              </button>
            </form>

            <p className="text-xs text-gray-600 leading-relaxed">
              Identity verification may be required for larger withdrawals. All prizes are subject to applicable taxes. See <a href="/sweepstakes-rules" className="underline hover:text-gray-400">Official Rules</a>.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Request history */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-white text-sm">Withdrawal History</h2>
          {requests.map(req => {
            const s = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending;
            const Icon = s.icon;
            return (
              <div key={req.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon size={16} className={s.color} />
                  <div>
                    <div className="text-sm font-bold text-white">${(req.amount_cents / 100).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{METHOD_LABELS[req.payment_method as PaymentMethod]?.label ?? req.payment_method} · {new Date(req.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
