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

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { user_id, gold_coins, sweeps_coins, pack_id } = session.metadata ?? {};

  if (!user_id || !gold_coins || !sweeps_coins) {
    return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
  }

  const goldAmount = parseInt(gold_coins);
  const sweepsAmount = parseInt(sweeps_coins);

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Idempotency: don't double-credit the same payment intent
  const { data: existing } = await supabase
    .from('coin_transactions')
    .select('id')
    .eq('stripe_payment_intent_id', session.payment_intent as string)
    .maybeSingle();

  if (existing) return NextResponse.json({ received: true });

  // Credit coins
  const { data: profile } = await supabase
    .from('profiles')
    .select('gold_coins, sweeps_coins, lifetime_gold_purchased, deposit_spent_today_cents, deposit_window_start')
    .eq('id', user_id)
    .single();

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const amountPaid = session.amount_total ?? 0;
  const windowStart = profile.deposit_window_start ? new Date(profile.deposit_window_start) : null;
  const windowExpired = !windowStart || (Date.now() - windowStart.getTime()) >= 24 * 60 * 60 * 1000;
  const newSpent = (windowExpired ? 0 : (profile.deposit_spent_today_cents ?? 0)) + amountPaid;

  await supabase.from('profiles').update({
    gold_coins: profile.gold_coins + goldAmount,
    sweeps_coins: profile.sweeps_coins + sweepsAmount,
    lifetime_gold_purchased: profile.lifetime_gold_purchased + goldAmount,
    deposit_spent_today_cents: newSpent,
    deposit_window_start: windowExpired ? new Date().toISOString() : profile.deposit_window_start,
  }).eq('id', user_id);

  await supabase.from('coin_transactions').insert({
    user_id,
    gold_delta: goldAmount,
    sweeps_delta: sweepsAmount,
    transaction_type: 'purchase',
    stripe_payment_intent_id: session.payment_intent as string,
    note: `Pack: ${pack_id ?? 'unknown'} — $${((session.amount_total ?? 0) / 100).toFixed(2)}`,
  });

  return NextResponse.json({ received: true });
}
