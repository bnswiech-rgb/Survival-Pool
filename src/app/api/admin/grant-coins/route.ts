import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { username, gold_delta, sweeps_delta, note } = await request.json();
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 });
  const gold = parseInt(gold_delta) || 0;
  const sweeps = parseInt(sweeps_delta) || 0;
  if (gold === 0 && sweeps === 0) return NextResponse.json({ error: 'Must grant at least some coins' }, { status: 400 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: target } = await supabase
    .from('profiles')
    .select('id, username, gold_coins, sweeps_coins')
    .eq('username', username)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: `User "${username}" not found` }, { status: 404 });

  await supabase.from('profiles').update({
    gold_coins: Math.max(0, (target.gold_coins ?? 0) + gold),
    sweeps_coins: Math.max(0, (target.sweeps_coins ?? 0) + sweeps),
  }).eq('id', target.id);

  await supabase.from('coin_transactions').insert({
    user_id: target.id,
    gold_delta: gold,
    sweeps_delta: sweeps,
    transaction_type: 'admin_grant',
    note: note || `Admin grant by ${user.id}`,
  });

  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'grant_coins',
    target_id: target.id,
    metadata: { username: target.username, gold_delta: gold, sweeps_delta: sweeps, note },
  });

  return NextResponse.json({
    success: true,
    username: target.username,
    new_gold: Math.max(0, (target.gold_coins ?? 0) + gold),
    new_sweeps: Math.max(0, (target.sweeps_coins ?? 0) + sweeps),
  });
}
