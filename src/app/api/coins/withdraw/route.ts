import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const MIN_WITHDRAWAL_CENTS = 2500; // $25.00 Sharpr Cash

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount_cents, payment_method, payment_handle } = await request.json();

  if (!amount_cents || amount_cents < MIN_WITHDRAWAL_CENTS) {
    return NextResponse.json({ error: `Minimum withdrawal is $${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}` }, { status: 400 });
  }

  const isStripeConnect = payment_method === 'bank_transfer';
  if (!isStripeConnect && !['paypal', 'venmo'].includes(payment_method)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
  }
  if (!isStripeConnect && !payment_handle?.trim()) {
    return NextResponse.json({ error: 'Payment details are required' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('sweeps_coins, self_excluded_until, lifetime_sc_purchased, lifetime_sc_wagered, stripe_connect_account_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  if (profile.self_excluded_until && new Date(profile.self_excluded_until) > new Date()) {
    return NextResponse.json({ error: 'Your account is self-excluded' }, { status: 403 });
  }

  if ((profile.sweeps_coins ?? 0) < amount_cents) {
    return NextResponse.json({ error: 'Insufficient Sharpr Cash balance' }, { status: 400 });
  }

  // Playthrough check: only SC earned through winnings is withdrawable
  const scPurchased = profile.lifetime_sc_purchased ?? 0;
  const scWagered = profile.lifetime_sc_wagered ?? 0;
  const lockedSC = Math.max(0, scPurchased - scWagered);
  const withdrawable = Math.max(0, (profile.sweeps_coins ?? 0) - lockedSC);

  if (withdrawable < MIN_WITHDRAWAL_CENTS) {
    const needed = lockedSC > 0
      ? `Enter more contests to unlock your Sharpr Cash ($${(lockedSC / 100).toFixed(2)} locked pending playthrough).`
      : 'Minimum withdrawal is $25.00.';
    return NextResponse.json({ error: needed }, { status: 400 });
  }

  if (amount_cents > withdrawable) {
    return NextResponse.json({
      error: `Only $${(withdrawable / 100).toFixed(2)} of your balance is available to withdraw. The rest is locked pending playthrough.`,
    }, { status: 400 });
  }

  // For bank transfer, verify Connect account is fully onboarded
  if (isStripeConnect) {
    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({ error: 'No bank account connected. Please connect your bank first.' }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as any });
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
    if (!account.payouts_enabled) {
      return NextResponse.json({ error: 'Your bank account is not fully verified yet.' }, { status: 400 });
    }
  }

  // Check no pending withdrawal already
  const { data: existing } = await serviceClient
    .from('withdrawal_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending withdrawal request.' }, { status: 400 });
  }

  // Deduct balance
  await serviceClient.from('profiles').update({
    sweeps_coins: profile.sweeps_coins - amount_cents,
  }).eq('id', user.id);

  await serviceClient.from('coin_transactions').insert({
    user_id: user.id,
    gold_delta: 0,
    sweeps_delta: -amount_cents,
    transaction_type: 'withdrawal',
    note: `Withdrawal — $${(amount_cents / 100).toFixed(2)} via ${payment_method}`,
  });

  // For bank transfer: fire Stripe Transfer immediately
  if (isStripeConnect) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as any });
    let stripeTransferId: string | null = null;
    let transferError: string | null = null;

    try {
      const transfer = await stripe.transfers.create({
        amount: amount_cents,
        currency: 'usd',
        destination: profile.stripe_connect_account_id!,
        description: `Sharpr withdrawal — $${(amount_cents / 100).toFixed(2)}`,
      });
      stripeTransferId = transfer.id;
    } catch (err: any) {
      transferError = err?.message ?? 'Transfer failed';
    }

    if (transferError) {
      // Rollback balance deduction
      await serviceClient.from('profiles').update({ sweeps_coins: profile.sweeps_coins }).eq('id', user.id);
      return NextResponse.json({ error: `Payout failed: ${transferError}` }, { status: 500 });
    }

    const { data: withdrawalRequest, error } = await serviceClient
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount_cents,
        payment_method: 'bank_transfer',
        payment_handle: 'Stripe Connect',
        status: 'paid',
        stripe_transfer_id: stripeTransferId,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      await serviceClient.from('profiles').update({ sweeps_coins: profile.sweeps_coins }).eq('id', user.id);
      return NextResponse.json({ error: 'Failed to record withdrawal' }, { status: 500 });
    }

    return NextResponse.json({ success: true, request_id: withdrawalRequest.id, amount: amount_cents, instant: true });
  }

  // PayPal/Venmo: manual processing
  const { data: withdrawalRequest, error } = await serviceClient
    .from('withdrawal_requests')
    .insert({
      user_id: user.id,
      amount_cents,
      payment_method,
      payment_handle: payment_handle.trim(),
    })
    .select()
    .single();

  if (error) {
    await serviceClient.from('profiles').update({ sweeps_coins: profile.sweeps_coins }).eq('id', user.id);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }

  return NextResponse.json({ success: true, request_id: withdrawalRequest.id, amount: amount_cents, instant: false });
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: requests } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ requests: requests ?? [] });
}
