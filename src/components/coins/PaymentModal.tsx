'use client';

import { useState, useEffect, useCallback } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { X, Coins, ShieldCheck } from 'lucide-react';
import type { CoinPack } from '@/types';

/* ─── Inner form (needs Elements context) ──────────────────────────── */
function CheckoutForm({
  pack,
  onSuccess,
  onClose,
}: {
  pack: CoinPack;
  onSuccess: (gold: number, sweeps: number) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/coins/success`,
      },
    });

    if (error) {
      setErrorMsg(error.message ?? 'Payment failed.');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        const res = await fetch('/api/coins/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to credit coins');
        window.dispatchEvent(new Event('coins:updated'));
        onSuccess(data.gold_earned, data.sweeps_earned);
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    } else {
      setErrorMsg('Payment did not complete. Please try again.');
    }

    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Pack summary */}
      <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-white text-lg">{pack.label} Pack</div>
          <div className="text-sm text-gray-400 mt-0.5">
            <span className="text-yellow-400 font-semibold">{pack.gold_coins.toLocaleString()} Sharpr Coins</span>
            {' + '}
            <span className="text-green-400 font-semibold">${(pack.sweeps_coins / 100).toFixed(2)} Sharpr Cash FREE</span>
          </div>
        </div>
        <div className="text-2xl font-black text-white">${(pack.price_cents / 100).toFixed(2)}</div>
      </div>

      {/* Stripe Elements */}
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {errorMsg && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 rounded-xl font-black text-base bg-green-500 hover:bg-green-400 text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Processing…' : `Pay $${(pack.price_cents / 100).toFixed(2)}`}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <ShieldCheck size={13} />
        <span>Secured by Stripe · 256-bit SSL</span>
      </div>
    </form>
  );
}

/* ─── Outer modal (fetches client_secret, mounts Elements) ─────────── */
interface PaymentModalProps {
  packId: string;
  customGold?: number;
  onClose: () => void;
  onSuccess: (gold: number, sweeps: number) => void;
}

export default function PaymentModal({ packId, customGold, onClose, onSuccess }: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchIntent = useCallback(async () => {
    try {
      const body: any = { pack_id: packId };
      if (packId === 'custom') body.custom_gold = customGold;
      const res = await fetch('/api/coins/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
      setClientSecret(data.client_secret);
      setPack(data.pack);
    } catch (err: any) {
      setFetchError(err.message);
    }
  }, [packId, customGold]);

  useEffect(() => {
    fetchIntent();
  }, [fetchIntent]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const stripeElementsOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'night' as const,
          variables: {
            colorPrimary: '#22c55e',
            colorBackground: '#1f2937',
            colorText: '#f9fafb',
            colorDanger: '#f87171',
            fontFamily: 'inherit',
            borderRadius: '8px',
          },
          rules: {
            '.Input': { border: '1px solid #374151', backgroundColor: '#111827' },
            '.Input:focus': { border: '1px solid #22c55e', boxShadow: '0 0 0 1px #22c55e' },
            '.Label': { color: '#9ca3af', fontSize: '12px' },
            '.Tab': { border: '1px solid #374151', backgroundColor: '#1f2937' },
            '.Tab--selected': { border: '1px solid #22c55e', backgroundColor: '#1f2937' },
          },
        },
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-yellow-400" />
            <span className="font-black text-white text-lg">Purchase Coins</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {fetchError ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-red-400 text-sm">{fetchError}</div>
              <button
                onClick={() => { setFetchError(null); fetchIntent(); }}
                className="text-xs text-gray-400 underline hover:text-white"
              >
                Try again
              </button>
            </div>
          ) : !clientSecret || !pack ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Elements stripe={getStripe()} options={stripeElementsOptions!}>
              <CheckoutForm pack={pack} onSuccess={onSuccess} onClose={onClose} />
            </Elements>
          )}
        </div>

        <div className="px-5 pb-4 text-xs text-gray-600 text-center">
          Gold Coins have no cash value. Sweeps Coins redeemable per{' '}
          <a href="/sweepstakes-rules" className="underline hover:text-gray-400">Official Rules</a>.
        </div>
      </div>
    </div>
  );
}
