import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_connect_account_id) {
    return NextResponse.json({ connected: false });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' as any });

  const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);

  return NextResponse.json({
    connected: account.charges_enabled && account.payouts_enabled,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
  });
}
