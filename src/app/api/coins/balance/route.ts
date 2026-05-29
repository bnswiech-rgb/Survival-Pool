import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('gold_coins, sweeps_coins, lifetime_sc_purchased, lifetime_sc_wagered')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    gold_coins: profile?.gold_coins ?? 0,
    sweeps_coins: profile?.sweeps_coins ?? 0,
    lifetime_sc_purchased: profile?.lifetime_sc_purchased ?? 0,
    lifetime_sc_wagered: profile?.lifetime_sc_wagered ?? 0,
  });
}
