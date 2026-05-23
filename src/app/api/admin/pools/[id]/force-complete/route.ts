import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: poolId } = await params;

  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pool } = await supabase.from('pools').select('*').eq('id', poolId).single();
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  const { data: participants } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', poolId)
    .in('status', ['active', 'advanced']);

  if (!participants?.length) return NextResponse.json({ error: 'No active participants' }, { status: 400 });

  // Find winner: for streak_race use current_streak, otherwise use wins
  let winnerId: string;
  if (pool.contest_format === 'streak_race') {
    const best = participants.reduce((a: any, b: any) => (b.current_streak > a.current_streak ? b : a));
    winnerId = best.id;
  } else {
    const best = participants.reduce((a: any, b: any) => (b.wins > a.wins ? b : a));
    winnerId = best.id;
  }

  // Crown winner, eliminate everyone else
  for (const p of participants) {
    if (p.id === winnerId) {
      await supabase.from('pool_participants').update({ status: 'winner' }).eq('id', p.id);
    } else {
      await supabase.from('pool_participants').update({ status: 'eliminated' }).eq('id', p.id);
    }
  }

  // Close all open rounds
  await supabase.from('rounds').update({ status: 'completed' }).eq('pool_id', poolId).eq('status', 'open');

  // Complete the pool
  await supabase.from('pools').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', poolId);

  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'force_complete_pool',
    target_id: poolId,
    metadata: { pool_name: pool.name, winner_participant_id: winnerId },
  });

  return NextResponse.json({ success: true, winner_participant_id: winnerId });
}
