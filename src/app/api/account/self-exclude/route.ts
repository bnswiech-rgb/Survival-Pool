import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const DURATION_MAP: Record<string, number | null> = {
  '30d':  30,
  '90d':  90,
  '180d': 180,
  'permanent': null, // null = use far-future date
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { duration } = await request.json();
  if (!Object.keys(DURATION_MAP).includes(duration)) {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Check if already self-excluded
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('self_excluded_until')
    .eq('id', user.id)
    .single();

  if (profile?.self_excluded_until) {
    const currentExclusion = new Date(profile.self_excluded_until);
    if (currentExclusion > new Date()) {
      return NextResponse.json({ error: 'Account is already self-excluded' }, { status: 400 });
    }
  }

  const days = DURATION_MAP[duration];
  // Permanent = 50 years from now
  const excludedUntil = days === null
    ? new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await serviceClient
    .from('profiles')
    .update({
      self_excluded_until: excludedUntil,
      self_exclusion_requested_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'Failed to apply self-exclusion' }, { status: 500 });

  // Sign the user out immediately
  await supabase.auth.signOut();

  return NextResponse.json({ success: true, excluded_until: excludedUntil });
}
