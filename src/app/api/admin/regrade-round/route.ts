import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { snapshot } from '@/lib/snapshot';

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { pool_id } = await request.json();
  if (!pool_id) return NextResponse.json({ error: 'Missing pool_id' }, { status: 400 });

  // Find the last completed round
  const { data: round } = await supabase
    .from('rounds')
    .select('id, round_number')
    .eq('pool_id', pool_id)
    .eq('status', 'completed')
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!round) return NextResponse.json({ error: 'No completed round found' }, { status: 400 });

  await snapshot(supabase, user.id, 'regrade-round', pool_id);

  // Reset all picks in that round to pending so cron regrads them
  await supabase
    .from('picks')
    .update({ status: 'pending', graded_at: null, is_locked: false })
    .eq('round_id', round.id)
    .neq('status', 'pending');

  // Reset round to open so the advance logic re-runs after grading
  await supabase.from('rounds').update({ status: 'open' }).eq('id', round.id);

  // Reset all participant stats for this pool to 0 so they get recomputed
  await supabase
    .from('pool_participants')
    .update({ wins: 0, losses: 0, current_streak: 0, status: 'active', eliminated_round: null })
    .eq('pool_id', pool_id);

  return NextResponse.json({ success: true, round: round.round_number });
}
