import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetch('/api/stripe/config')
      .then(r => r.json())
      .then(({ publishableKey }) => {
        if (!publishableKey) return null;
        return loadStripe(publishableKey);
      })
      .catch(() => null);
  }
  return stripePromise;
}
