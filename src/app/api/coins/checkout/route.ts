import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import type { CoinPack } from '@/types';

// sweeps_coins stored in cents of Sharpr Cash (÷100 = dollar value, 1 Sharpr Cash = $1.00)
const COIN_PACKS: Record<string, CoinPack> = {
  starter: { id: 'starter', label: 'Starter',  price_cents: 500,  gold_coins: 500,  sweeps_coins: 400  },
  player:  { id: 'player',  label: 'Player',   price_cents: 1000, gold_coins: 1100, sweeps_coins: 800  },
  pro:     { id: 'pro',     label: 'Pro',       price_cents: 2000, gold_coins: 2400, sweeps_coins: 1600 },
  elite:   { id: 'elite',   label: 'Elite',     price_cents: 5000, gold_coins: 6500, sweeps_coins: 4500 },
};

// Custom: 100 Sharpr Coins = $1.00, 80% back as Sharpr Cash (stored in cents)
function buildCustomPack(goldCoins: number): CoinPack {
  const price_cents = Math.round((goldCoins / 100) * 100);
  const sweeps_coins = Math.floor(goldCoins * 0.8);
  return { id: 'custom', label: 'Custom', price_cents, gold_coins: goldCoins, sweeps_coins };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pack_id, custom_gold } = await request.json();

  // Deposit limit enforcement
  const { data: limProfile } = await supabase
    .from('profiles')
    .select('daily_deposit_limit_cents, deposit_spent_today_cents, deposit_window_start, self_excluded_until')
    .eq('id', user.id)
    .single();

  // Block self-excluded users from purchasing
  if (limProfile?.self_excluded_until && new Date(limProfile.self_excluded_until) > new Date()) {
    return NextResponse.json({ error: 'Your account is self-excluded' }, { status: 403 });
  }

  if (limProfile?.daily_deposit_limit_cents) {
    const windowStart = limProfile.deposit_window_start ? new Date(limProfile.deposit_window_start) : null;
    const now = new Date();
    const windowExpired = !windowStart || (now.getTime() - windowStart.getTime()) >= 24 * 60 * 60 * 1000;
    const spentToday = windowExpired ? 0 : (limProfile.deposit_spent_today_cents ?? 0);
    const remaining = limProfile.daily_deposit_limit_cents - spentToday;
    if (remaining <= 0) {
      return NextResponse.json({
        error: `You have reached your daily deposit limit of $${(limProfile.daily_deposit_limit_cents / 100).toFixed(2)}. Your limit resets in 24 hours.`,
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
    // Dev mode: grant coins directly without Stripe
    const { data: profile } = await supabase
      .from('profiles')
      .select('gold_coins, sweeps_coins, lifetime_gold_purchased')
      .eq('id', user.id)
      .single();

    await supabase.from('profiles').update({
      gold_coins: (profile?.gold_coins ?? 0) + pack.gold_coins,
      sweeps_coins: (profile?.sweeps_coins ?? 0) + pack.sweeps_coins,
      lifetime_gold_purchased: (profile?.lifetime_gold_purchased ?? 0) + pack.gold_coins,
    }).eq('id', user.id);

    await supabase.from('coin_transactions').insert({
      user_id: user.id,
      gold_delta: pack.gold_coins,
      sweeps_delta: pack.sweeps_coins,
      transaction_type: 'purchase',
      note: `Dev grant: ${pack.label} pack — ${pack.gold_coins} coins + $${(pack.sweeps_coins / 100).toFixed(2)} cash`,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ url: `${appUrl}/coins/success?pack=${pack.label}&gold=${pack.gold_coins}&sweeps=${pack.sweeps_coins}` });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });

  // Derive app URL from request headers — works on any domain/preview URL
  const origin = request.headers.get('origin') ?? request.headers.get('x-forwarded-host')
    ? `https://${request.headers.get('x-forwarded-host')}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://survival-pool.vercel.app');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: pack.price_cents,
          product_data: {
            name: `${pack.label} Pack — ${pack.gold_coins.toLocaleString()} Sharpr Coins`,
            description: `Includes $${(pack.sweeps_coins / 100).toFixed(2)} Sharpr Cash FREE`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        gold_coins: pack.gold_coins,
        sweeps_coins: pack.sweeps_coins,
      },
      success_url: `${origin}/coins/success?pack=${pack.label}&gold=${pack.gold_coins}&sweeps=${pack.sweeps_coins}`,
      cancel_url: `${origin}/coins`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('[checkout] Stripe error:', err.message);
    return NextResponse.json({ error: err.message ?? 'Failed to create checkout session' }, { status: 500 });
  }
}
