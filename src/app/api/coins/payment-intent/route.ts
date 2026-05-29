import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import type { CoinPack } from '@/types';

const COIN_PACKS: Record<string, CoinPack> = {
  starter: { id: 'starter', label: 'Starter',  price_cents: 499,  gold_coins: 500,  sweeps_coins: 5  },
  player:  { id: 'player',  label: 'Player',   price_cents: 999,  gold_coins: 1100, sweeps_coins: 11 },
  pro:     { id: 'pro',     label: 'Pro',       price_cents: 1999, gold_coins: 2400, sweeps_coins: 24 },
  elite:   { id: 'elite',   label: 'Elite',     price_cents: 4999, gold_coins: 6500, sweeps_coins: 65 },
};

function buildCustomPack(goldCoins: number): CoinPack {
  const price_cents = Math.round((goldCoins / 100) * 100);
  const sweeps_coins = Math.floor(goldCoins / 100);
  return { id: 'custom', label: 'Custom', price_cents, gold_coins: goldCoins, sweeps_coins };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pack_id, custom_gold } = await request.json();

  // Self-exclusion + deposit limit check
  const { data: limProfile } = await supabase
    .from('profiles')
    .select('daily_deposit_limit_cents, deposit_spent_today_cents, deposit_window_start, self_excluded_until')
    .eq('id', user.id)
    .single();

  if (limProfile?.self_excluded_until && new Date(limProfile.self_excluded_until) > new Date()) {
    return NextResponse.json({ error: 'Your account is self-excluded' }, { status: 403 });
  }

  if (limProfile?.daily_deposit_limit_cents) {
    const windowStart = limProfile.deposit_window_start ? new Date(limProfile.deposit_window_start) : null;
    const windowExpired = !windowStart || (Date.now() - windowStart.getTime()) >= 24 * 60 * 60 * 1000;
    const spentToday = windowExpired ? 0 : (limProfile.deposit_spent_today_cents ?? 0);
    const remaining = limProfile.daily_deposit_limit_cents - spentToday;
    if (remaining <= 0) {
      return NextResponse.json({
        error: `You've reached your daily deposit limit of $${(limProfile.daily_deposit_limit_cents / 100).toFixed(2)}.`,
      }, { status: 400 });
    }
  }

  let pack: CoinPack;
  if (pack_id === 'custom') {
    const gold = parseInt(custom_gold);
    if (!gold || gold < 100 || gold > 100000) {
      return NextResponse.json({ error: 'Custom amount must be between 100 and 100,000 GC' }, { status: 400 });
    }
    pack = buildCustomPack(gold);
  } else {
    pack = COIN_PACKS[pack_id];
    if (!pack) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey === 'sk_test_placeholder') {
    return NextResponse.json({ error: 'Stripe not configured in this environment' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pack.price_cents,
      currency: 'usd',
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        gold_coins: String(pack.gold_coins),
        sweeps_coins: String(pack.sweeps_coins),
      },
      description: `${pack.label} Pack — ${pack.gold_coins.toLocaleString()} Gold Coins`,
    });

    return NextResponse.json({ client_secret: paymentIntent.client_secret, pack });
  } catch (err: any) {
    console.error('[payment-intent] Stripe error:', err.message);
    return NextResponse.json({ error: err.message ?? 'Failed to create payment intent' }, { status: 500 });
  }
}
