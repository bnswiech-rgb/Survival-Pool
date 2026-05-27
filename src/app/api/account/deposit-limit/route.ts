import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Increasing a limit requires a 24-hour cooling off period.
// Decreasing a limit or removing it takes effect immediately.
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { limit_cents } = await request.json();

  // null = remove limit; otherwise must be positive integer
  if (limit_cents !== null && (!Number.isInteger(limit_cents) || limit_cents < 100)) {
    return NextResponse.json({ error: 'Limit must be at least $1.00 or null to remove' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('daily_deposit_limit_cents, deposit_limit_set_at')
    .eq('id', user.id)
    .single();

  const currentLimit = profile?.daily_deposit_limit_cents ?? null;
  const lastSet = profile?.deposit_limit_set_at ? new Date(profile.deposit_limit_set_at) : null;

  const isIncrease = limit_cents !== null && (currentLimit === null || limit_cents > currentLimit);

  // Increasing a limit requires waiting 24h since last change
  if (isIncrease && lastSet && Date.now() - lastSet.getTime() < COOLDOWN_MS) {
    const available = new Date(lastSet.getTime() + COOLDOWN_MS);
    return NextResponse.json({
      error: `For your protection, limit increases require a 24-hour waiting period. You can increase your limit after ${available.toLocaleString()}.`,
    }, { status: 400 });
  }

  const { error } = await serviceClient
    .from('profiles')
    .update({
      daily_deposit_limit_cents: limit_cents,
      deposit_limit_set_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'Failed to update limit' }, { status: 500 });

  return NextResponse.json({ success: true, daily_deposit_limit_cents: limit_cents });
}
