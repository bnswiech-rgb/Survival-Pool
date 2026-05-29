import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!stripeKey || stripeKey === 'sk_test_placeholder') {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle both PaymentIntent and legacy Checkout Session events
  let userId: string | undefined;
  let goldCoins: string | undefined;
  let sweepsCoins: string | undefined;
  let packId: string | undefined;
  let paymentIntentId: string | undefined;
  let amountPaid = 0;

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    userId = pi.metadata?.user_id;
    goldCoins = pi.metadata?.gold_coins;
    sweepsCoins = pi.metadata?.sweeps_coins;
    packId = pi.metadata?.pack_id;
    paymentIntentId = pi.id;
    amountPaid = pi.amount;
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    userId = session.metadata?.user_id;
    goldCoins = session.metadata?.gold_coins;
    sweepsCoins = session.metadata?.sweeps_coins;
    packId = session.metadata?.pack_id;
    paymentIntentId = session.payment_intent as string;
    amountPaid = session.amount_total ?? 0;
  } else {
    return NextResponse.json({ received: true });
  }

  if (!userId || !goldCoins || !sweepsCoins || !paymentIntentId) {
    return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
  }

  const goldAmount = parseInt(goldCoins);
  const sweepsAmount = parseInt(sweepsCoins);

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Idempotency: don't double-credit the same payment intent
  const { data: existing } = await supabase
    .from('coin_transactions')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (existing) return NextResponse.json({ received: true });

  // Credit coins
  const { data: profile } = await supabase
    .from('profiles')
    .select('gold_coins, sweeps_coins, lifetime_gold_purchased, lifetime_sc_purchased, deposit_spent_today_cents, deposit_window_start')
    .eq('id', userId)
    .single();

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const windowStart = profile.deposit_window_start ? new Date(profile.deposit_window_start) : null;
  const windowExpired = !windowStart || (Date.now() - windowStart.getTime()) >= 24 * 60 * 60 * 1000;
  const newSpent = (windowExpired ? 0 : (profile.deposit_spent_today_cents ?? 0)) + amountPaid;

  await supabase.from('profiles').update({
    gold_coins: profile.gold_coins + goldAmount,
    sweeps_coins: profile.sweeps_coins + sweepsAmount,
    lifetime_gold_purchased: (profile.lifetime_gold_purchased ?? 0) + goldAmount,
    lifetime_sc_purchased: (profile.lifetime_sc_purchased ?? 0) + sweepsAmount,
    deposit_spent_today_cents: newSpent,
    deposit_window_start: windowExpired ? new Date().toISOString() : profile.deposit_window_start,
  }).eq('id', userId);

  await supabase.from('coin_transactions').insert({
    user_id: userId,
    gold_delta: goldAmount,
    sweeps_delta: sweepsAmount,
    transaction_type: 'purchase',
    stripe_payment_intent_id: paymentIntentId,
    note: `Pack: ${packId ?? 'unknown'} — $${(amountPaid / 100).toFixed(2)}`,
  });

  return NextResponse.json({ received: true });
}
