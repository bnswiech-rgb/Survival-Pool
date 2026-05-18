import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEligiblePick } from '@/lib/eligibility';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get('round_id');

  let query = supabase
    .from('picks')
    .select('*, profiles(username, avatar_url)')
    .eq('pool_id', id)
    .order('submitted_at', { ascending: false });

  if (roundId) query = query.eq('round_id', roundId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter hidden picks (before deadline, not own, not admin)
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null };

  let isDeadlinePassed = false;
  if (roundId) {
    const { data: round } = await supabase.from('rounds').select('deadline').eq('id', roundId).single();
    isDeadlinePassed = round ? new Date(round.deadline) < new Date() : false;
  } else {
    const { data: pool } = await supabase.from('pools').select('pick_deadline').eq('id', id).single();
    isDeadlinePassed = pool ? new Date(pool.pick_deadline) < new Date() : false;
  }
  const isAdmin = profile?.role === 'admin';

  const filtered = data?.filter((pick: any) => {
    if (isAdmin || isDeadlinePassed) return true;
    return pick.user_id === user?.id;
  });

  return NextResponse.json({ picks: filtered });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { round_id, sport, league, game, pick_type, side, line_value, american_odds, game_start_time } = body;

  if (!round_id || !game || !pick_type || !side || !line_value || american_odds === undefined || !game_start_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate eligibility
  if (!isEligiblePick(pick_type, american_odds)) {
    return NextResponse.json({ error: 'Pick does not meet eligibility requirements' }, { status: 400 });
  }

  // Check round is open
  const { data: round } = await supabase.from('rounds').select('*').eq('id', round_id).single();
  if (!round || round.status !== 'open') {
    return NextResponse.json({ error: 'Round is not open for picks' }, { status: 400 });
  }

  // Check round deadline
  if (new Date(round.deadline) < new Date()) {
    return NextResponse.json({ error: 'Pick deadline has passed' }, { status: 400 });
  }

  // Check game hasn't started yet
  if (new Date(game_start_time) <= new Date()) {
    return NextResponse.json({ error: 'That game has already started' }, { status: 400 });
  }

  // Check participant is active
  const { data: participant } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!participant) return NextResponse.json({ error: 'Not a participant in this contest' }, { status: 403 });
  if (participant.status === 'eliminated') return NextResponse.json({ error: 'You are eliminated from this contest' }, { status: 400 });

  // Upsert pick
  const { data: pick, error } = await supabase
    .from('picks')
    .upsert({
      pool_id: id,
      round_id,
      user_id: user.id,
      sport,
      league: league ?? null,
      game,
      pick_type,
      side,
      line_value,
      american_odds,
      game_start_time,
      status: 'pending',
      is_locked: false,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'pool_id,round_id,user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Activity
  await supabase.from('activity_feed').insert({
    pool_id: id,
    user_id: user.id,
    activity_type: 'pick_submitted',
    metadata: { round: round.round_number },
  });

  return NextResponse.json({ pick }, { status: 201 });
}
