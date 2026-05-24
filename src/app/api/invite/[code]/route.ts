import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, sport, contest_format, entry_fee_cents, visibility, status, created_by')
    .eq('invite_code', code)
    .single();

  if (!pool) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  const { count } = await supabase
    .from('pool_participants')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', pool.id);

  return NextResponse.json({ pool, participantCount: count ?? 0 });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('invite_code', code)
    .single();

  if (!pool) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  const allowActive = pool.contest_format === 'team_battle';
  if (pool.status !== 'open' && pool.status !== 'upcoming' && !(allowActive && pool.status === 'active')) {
    return NextResponse.json({ error: 'Contest is not open for entries' }, { status: 400 });
  }

  if (pool.max_entries) {
    const { count } = await supabase
      .from('pool_participants')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', pool.id);
    if ((count ?? 0) >= pool.max_entries) {
      return NextResponse.json({ error: 'Contest is full' }, { status: 400 });
    }
  }

  const { data: existing } = await supabase
    .from('pool_participants')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: 'Already joined this contest' }, { status: 400 });

  const { data: participant, error } = await supabase
    .from('pool_participants')
    .insert({
      pool_id: pool.id,
      user_id: user.id,
      payment_status: 'paid' as any,
      status: 'active',
      lives_remaining: pool.lives_count ?? 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: prof } = await supabase.from('profiles').select('pools_entered').eq('id', user.id).single();
  if (prof) await supabase.from('profiles').update({ pools_entered: prof.pools_entered + 1 }).eq('id', user.id);

  await supabase.from('activity_feed').insert({
    pool_id: pool.id,
    user_id: user.id,
    activity_type: 'joined_pool',
    metadata: { pool_name: pool.name },
  });

  return NextResponse.json({ participant, poolId: pool.id }, { status: 201 });
}
