import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const { data: pool } = await supabase.from('pools').select('*').eq('id', id).single();

  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  if (pool.created_by !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { deadline } = body;

  // Get last round number
  const { data: lastRound } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('pool_id', id)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRoundNumber = (lastRound?.round_number ?? 0) + 1;

  // Auto-calculate deadline if not provided
  const computedDeadline = deadline ?? (() => {
    const d = new Date();
    if (pool.round_frequency === 'weekly') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    return d.toISOString();
  })();

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({ pool_id: id, round_number: nextRoundNumber, deadline: computedDeadline, status: 'open' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ round }, { status: 201 });
}
