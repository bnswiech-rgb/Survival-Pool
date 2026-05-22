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

// Custom amount: 100 GC = $1.00, 1 SC per 100 GC (no bulk discount)
function buildCustomPack(goldCoins: number): CoinPack {
  const price_cents = Math.round((goldCoins / 100) * 100); // $1 per 100 GC
  const sweeps_coins = Math.floor(goldCoins / 100);
  return { id: 'custom', label: 'Custom', price_cents, gold_coins: goldCoins, sweeps_coins };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pack_id, custom_gold } = await request.json();

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
      note: `Dev grant: ${pack.label} pack`,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ url: `${appUrl}/coins/success?pack=${pack.label}&gold=${pack.gold_coins}&sweeps=${pack.sweeps_coins}` });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: pack.price_cents,
        product_data: {
          name: `${pack.label} Pack — ${pack.gold_coins.toLocaleString()} Gold Coins`,
          description: `Includes ${pack.sweeps_coins} Sweeps Coins`,
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
    success_url: `${appUrl}/coins/success?pack=${pack.label}&gold=${pack.gold_coins}&sweeps=${pack.sweeps_coins}`,
    cancel_url: `${appUrl}/coins`,
  });

  return NextResponse.json({ url: session.url });
}
