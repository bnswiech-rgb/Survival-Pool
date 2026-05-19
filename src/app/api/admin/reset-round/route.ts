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

  // Find the round that actually has picks (the one that needs regrading)
  const { data: allRounds } = await supabase
    .from('rounds')
    .select('id, round_number')
    .eq('pool_id', pool_id)
    .order('round_number', { ascending: true });

  if (!allRounds?.length) return NextResponse.json({ error: 'No rounds found' }, { status: 400 });

  // Find which round has picks
  let targetRound = allRounds[0];
  for (const r of allRounds) {
    const { count } = await supabase.from('picks').select('*', { count: 'exact', head: true }).eq('round_id', r.id);
    if ((count ?? 0) > 0) { targetRound = r; break; }
  }

  // Delete any rounds after the target round
  for (const r of allRounds) {
    if (r.round_number > targetRound.round_number) {
      await supabase.from('rounds').delete().eq('id', r.id);
    }
  }

  // Reset target round to open — keep picks as-is (already graded won/lost)
  // The grader will find this overdue open round and reapply participant updates correctly
  await supabase.from('rounds').update({ status: 'open' }).eq('id', targetRound.id);

  return NextResponse.json({ success: true, round: targetRound.round_number });
}
