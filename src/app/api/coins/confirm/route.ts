import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { payment_intent_id } = await request.json();
  if (!payment_intent_id) return NextResponse.json({ error: 'Missing payment_intent_id' }, { status: 400 });

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(payment_intent_id);
  } catch (err: any) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (pi.status !== 'succeeded') {
    return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
  }

  const { user_id, gold_coins, sweeps_coins, pack_id } = pi.metadata ?? {};

  // Security: ensure the PI belongs to this user
  if (user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const goldAmount = parseInt(gold_coins ?? '0');
  const sweepsAmount = parseInt(sweeps_coins ?? '0');

  if (!goldAmount) return NextResponse.json({ error: 'Invalid pack metadata' }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Idempotency check
  const { data: existing } = await serviceClient
    .from('coin_transactions')
    .select('id')
    .eq('stripe_payment_intent_id', payment_intent_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, already_credited: true, gold_earned: goldAmount, sweeps_earned: sweepsAmount });
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('gold_coins, sweeps_coins, lifetime_gold_purchased, lifetime_sc_purchased, deposit_spent_today_cents, deposit_window_start')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const amountPaid = pi.amount;
  const windowStart = profile.deposit_window_start ? new Date(profile.deposit_window_start) : null;
  const windowExpired = !windowStart || (Date.now() - windowStart.getTime()) >= 24 * 60 * 60 * 1000;
  const newSpent = (windowExpired ? 0 : (profile.deposit_spent_today_cents ?? 0)) + amountPaid;

  await serviceClient.from('profiles').update({
    gold_coins: profile.gold_coins + goldAmount,
    sweeps_coins: profile.sweeps_coins + sweepsAmount,
    lifetime_gold_purchased: (profile.lifetime_gold_purchased ?? 0) + goldAmount,
    lifetime_sc_purchased: (profile.lifetime_sc_purchased ?? 0) + sweepsAmount,
    deposit_spent_today_cents: newSpent,
    deposit_window_start: windowExpired ? new Date().toISOString() : profile.deposit_window_start,
  }).eq('id', user.id);

  await serviceClient.from('coin_transactions').insert({
    user_id: user.id,
    gold_delta: goldAmount,
    sweeps_delta: sweepsAmount,
    transaction_type: 'purchase',
    stripe_payment_intent_id: payment_intent_id,
    note: `Pack: ${pack_id ?? 'unknown'} — $${(amountPaid / 100).toFixed(2)}`,
  });

  return NextResponse.json({ success: true, gold_earned: goldAmount, sweeps_earned: sweepsAmount });
}
