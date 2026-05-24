import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body = await request.json().catch(() => ({}));

  // Use provided deadline or default to tonight at 9:30 PM ET (1:30 AM UTC next day)
  let newDeadline: string;
  if (body.deadline) {
    newDeadline = new Date(body.deadline).toISOString();
  } else {
    // 9:30 PM ET = 01:30 UTC next calendar day
    // Get today's date in ET (UTC-4 EDT / UTC-5 CDT) — use UTC-4 as conservative EDT
    const nowET = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const y = nowET.getUTCFullYear();
    const m = nowET.getUTCMonth();
    const day = nowET.getUTCDate();
    // 9:30 PM ET on today's ET date = 01:30 UTC the following UTC day
    newDeadline = new Date(Date.UTC(y, m, day + 1, 1, 30, 0, 0)).toISOString();
  }

  // Find the latest round for this pool (any status)
  const { data: round } = await supabase
    .from('rounds')
    .select('id, round_number, deadline')
    .eq('pool_id', id)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!round) {
    // No round exists — create round 1
    const { data: newRound, error: createError } = await supabase
      .from('rounds')
      .insert({ pool_id: id, round_number: 1, deadline: newDeadline, status: 'open' })
      .select()
      .single();
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
    return NextResponse.json({ round_number: 1, new_deadline: newDeadline, created: true });
  }

  const { error } = await supabase
    .from('rounds')
    .update({ deadline: newDeadline, status: 'open' })
    .eq('id', round.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ round_number: round.round_number, new_deadline: newDeadline });
}
