import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const DAILY_GOLD = 25;          // Sharpr Coins for everyone (10 coins per $1, so 25 = $2.50 value)
const DAILY_SWEEPS = 20;        // $0.20 Sharpr Cash for everyone (stored as cents)
const DAILY_SWEEPS_PAID = 40;   // $0.40 Sharpr Cash for paid players (stored as cents)

function nextMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function isClaimable(lastBonusAt: string | null): boolean {
  if (!lastBonusAt) return true;
  const last = new Date(lastBonusAt);
  const now = new Date();
  const todayMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return last < todayMidnightUTC;
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_daily_bonus_at, lifetime_gold_purchased')
    .eq('id', user.id)
    .single();

  const claimable = isClaimable(profile?.last_daily_bonus_at ?? null);
  const isPaid = (profile?.lifetime_gold_purchased ?? 0) > 0;
  const sweepsToday = isPaid ? DAILY_SWEEPS_PAID : DAILY_SWEEPS;
  const nextClaimAt = claimable ? null : nextMidnightUTC().toISOString();
  return NextResponse.json({ claimable, gold: DAILY_GOLD, sweeps: sweepsToday, next_claim_at: nextClaimAt });
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('gold_coins, sweeps_coins, last_daily_bonus_at, lifetime_gold_purchased')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!isClaimable(profile.last_daily_bonus_at)) {
    return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
  }

  const isPaid = (profile.lifetime_gold_purchased ?? 0) > 0;
  const sweepsToAward = isPaid ? DAILY_SWEEPS_PAID : DAILY_SWEEPS;

  await serviceClient.from('profiles').update({
    gold_coins: profile.gold_coins + DAILY_GOLD,
    sweeps_coins: profile.sweeps_coins + sweepsToAward,
    last_daily_bonus_at: new Date().toISOString(),
  }).eq('id', user.id);

  await serviceClient.from('coin_transactions').insert({
    user_id: user.id,
    gold_delta: DAILY_GOLD,
    sweeps_delta: sweepsToAward,
    transaction_type: 'daily_bonus',
    note: `Daily bonus — ${DAILY_GOLD} Sharpr Coins + $${(sweepsToAward / 100).toFixed(2)} Sharpr Cash${isPaid ? ' (paid player)' : ''}`,
  });

  return NextResponse.json({
    success: true,
    gold_earned: DAILY_GOLD,
    sweeps_earned: sweepsToAward,
    new_gold_coins: profile.gold_coins + DAILY_GOLD,
    new_sweeps_coins: profile.sweeps_coins + sweepsToAward,
    next_claim_at: nextMidnightUTC().toISOString(),
  });
}
