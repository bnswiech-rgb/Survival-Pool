import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' as any });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id, username')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  let accountId = profile.stripe_connect_account_id;

  // Create a new Express account if one doesn't exist
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: { interval: 'manual' },
        },
      },
    });
    accountId = account.id;
    await serviceClient
      .from('profiles')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', user.id);
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/withdraw?connect=refresh`,
    return_url: `${origin}/withdraw?connect=success`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
