import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SWEEPS_AWARD = 20; // $0.20 Sharpr Cash (stored as cents, 1 Sharpr Cash = $1.00)

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in to claim.' }, { status: 401 });

  // Check if user already claimed today (UTC day)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('amoe_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('method', 'digital')
    .gte('created_at', todayStart.toISOString())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You have already claimed your free Sharpr Cash today. Come back tomorrow.' }, { status: 400 });
  }

  // Award Sweeps Coins
  const { data: profile } = await supabase
    .from('profiles')
    .select('sweeps_coins')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

  await supabase
    .from('profiles')
    .update({ sweeps_coins: profile.sweeps_coins + SWEEPS_AWARD })
    .eq('id', user.id);

  await supabase.from('coin_transactions').insert({
    user_id: user.id,
    gold_delta: 0,
    sweeps_delta: SWEEPS_AWARD,
    transaction_type: 'daily_bonus',
    pool_id: null,
    note: 'Digital AMOE request',
  });

  await supabase.from('amoe_requests').insert({
    user_id: user.id,
    method: 'digital',
    sweeps_awarded: SWEEPS_AWARD,
  });

  return NextResponse.json({ success: true, sweeps_awarded: SWEEPS_AWARD });
}
