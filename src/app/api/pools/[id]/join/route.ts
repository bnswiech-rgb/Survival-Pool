import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserState, isRestrictedState } from '@/lib/geo';
import { parseTeamScoring } from '@/lib/utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: pool } = await supabase.from('pools').select('*').eq('id', id).single();
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

  // Geo block: restricted-state users cannot join cash pools
  if ((pool as any).pool_type === 'cash') {
    const userState = getUserState(request.headers);
    if (isRestrictedState(userState)) {
      return NextResponse.json({ error: 'Cash pools are not available in your state.' }, { status: 403 });
    }
  }

  const joinableStatuses = (pool.contest_format === 'streak_race' || pool.contest_format === 'team_battle' || pool.round_frequency === 'game_day')
    ? ['open', 'upcoming', 'active']
    : ['open', 'upcoming'];
  if (!joinableStatuses.includes(pool.status)) {
    return NextResponse.json({ error: 'Contest is not open for entries' }, { status: 400 });
  }

  // Check max entries
  const { count: currentCount } = await supabase
    .from('pool_participants')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', id);

  if (pool.max_entries && (currentCount ?? 0) >= pool.max_entries) {
    return NextResponse.json({ error: 'Contest is full' }, { status: 400 });
  }

  // $4,999 max prize pool per contest — stays under FL §849.094 $5,000 filing threshold
  const MAX_PRIZE_POOL = 499_900;
  const rake = pool.rake_percentage ?? 10;
  const newCount = (currentCount ?? 0) + 1;
  if ((pool.entry_fee_coins ?? 0) > 0 || pool.entry_fee_cents > 0) {
    const netCoins = Math.round((pool.entry_fee_coins ?? 0) * newCount * (1 - rake / 100));
    const netCents = Math.round(pool.entry_fee_cents * newCount * (1 - rake / 100));
    if (netCoins > MAX_PRIZE_POOL || netCents > MAX_PRIZE_POOL) {
      return NextResponse.json({ error: 'This contest has reached its maximum prize pool of $4,999.' }, { status: 400 });
    }
  }

  // Check already joined
  const { data: existing } = await supabase
    .from('pool_participants')
    .select('id')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Already joined this contest' }, { status: 400 });

  // Coin entry fee: deduct gold coins if required
  if ((pool.entry_fee_coins ?? 0) > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gold_coins')
      .eq('id', user.id)
      .single();
    if (!profile || profile.gold_coins < pool.entry_fee_coins) {
      return NextResponse.json({ error: 'Not enough Gold Coins to enter this contest' }, { status: 400 });
    }
    await supabase
      .from('profiles')
      .update({ gold_coins: profile.gold_coins - pool.entry_fee_coins })
      .eq('id', user.id);
    await supabase.from('coin_transactions').insert({
      user_id: user.id,
      gold_delta: -pool.entry_fee_coins,
      sweeps_delta: 0,
      transaction_type: 'pool_entry',
      pool_id: id,
      note: `Entered: ${pool.name}`,
    });
  }

  // Cash entry fee: deduct SC and track playthrough
  if (pool.entry_fee_cents > 0) {
    const { data: scProfile } = await supabase
      .from('profiles')
      .select('sweeps_coins, lifetime_sc_wagered')
      .eq('id', user.id)
      .single();
    if (!scProfile || (scProfile.sweeps_coins ?? 0) < pool.entry_fee_cents) {
      return NextResponse.json({ error: 'Not enough Sharpr Cash to enter this contest' }, { status: 400 });
    }
    await supabase.from('profiles').update({
      sweeps_coins: scProfile.sweeps_coins - pool.entry_fee_cents,
      lifetime_sc_wagered: (scProfile.lifetime_sc_wagered ?? 0) + pool.entry_fee_cents,
    }).eq('id', user.id);
    await supabase.from('coin_transactions').insert({
      user_id: user.id,
      gold_delta: 0,
      sweeps_delta: -pool.entry_fee_cents,
      transaction_type: 'pool_entry',
      pool_id: id,
      note: `Entered: ${pool.name}`,
    });
  }

  // For team_battle with random formation, auto-assign to a team
  let assignedTeamId: string | null = null;
  const { teamFormation } = parseTeamScoring(pool.team_scoring);
  if (pool.contest_format === 'team_battle' && teamFormation === 'random' && pool.team_size) {
    // Find an existing team with fewer than team_size members
    const { data: allParticipants } = await supabase
      .from('pool_participants')
      .select('team_id')
      .eq('pool_id', id)
      .not('team_id', 'is', null);

    const teamCounts = new Map<string, number>();
    for (const p of allParticipants ?? []) {
      const tid = (p as any).team_id;
      if (tid) teamCounts.set(tid, (teamCounts.get(tid) ?? 0) + 1);
    }

    // Find team with space
    for (const [tid, count] of teamCounts) {
      if (count < pool.team_size) {
        assignedTeamId = tid;
        break;
      }
    }

    // No team with space — create a new one
    if (!assignedTeamId) {
      assignedTeamId = crypto.randomUUID();
    }
  }

  // Join pool
  const { data: participant, error } = await supabase
    .from('pool_participants')
    .insert({
      pool_id: id,
      user_id: user.id,
      payment_status: 'paid' as any,
      status: 'active',
      lives_remaining: pool.lives_count ?? 1,
      ...(assignedTeamId ? { team_id: assignedTeamId } : {}),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update profile stats
  const { data: prof } = await supabase.from('profiles').select('pools_entered').eq('id', user.id).single();
  if (prof) await supabase.from('profiles').update({ pools_entered: prof.pools_entered + 1 }).eq('id', user.id);

  // Activity feed
  await supabase.from('activity_feed').insert({
    pool_id: id,
    user_id: user.id,
    activity_type: 'joined_pool',
    metadata: { pool_name: pool.name },
  });

  return NextResponse.json({ participant }, { status: 201 });
}
