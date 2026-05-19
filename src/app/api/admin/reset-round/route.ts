import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { pool_id } = await request.json();
  if (!pool_id) return NextResponse.json({ error: 'Missing pool_id' }, { status: 400 });

  // Reset all participants to active with zeroed stats
  await supabase
    .from('pool_participants')
    .update({ current_streak: 0, wins: 0, losses: 0, pushes: 0, status: 'active', eliminated_round: null })
    .eq('pool_id', pool_id);

  // Reset latest round to open so grader can reprocess it
  const { data: latestRound } = await supabase
    .from('rounds')
    .select('id, round_number')
    .eq('pool_id', pool_id)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRound) {
    await supabase.from('rounds').update({ status: 'open' }).eq('id', latestRound.id);
    // Reset all picks in this round back to pending so they get regraded
    await supabase.from('picks').update({ status: 'pending', graded_at: null }).eq('round_id', latestRound.id);
  }

  return NextResponse.json({ success: true, round: latestRound?.round_number });
}
