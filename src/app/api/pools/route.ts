import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const format = searchParams.get('format');
  const status = searchParams.get('status');

  let query = supabase
    .from('pools')
    .select('*, pool_participants(count)')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50);

  if (sport) query = query.eq('sport', sport);
  if (format) query = query.eq('contest_format', format);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pools: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, sport, visibility, max_entries, contest_format, lives_count, target_wins, target_streak,
    max_losses, push_resets_streak, entry_fee_cents, rake_percentage, start_date, pick_deadline,
    round_frequency, push_rule, all_lose_rule, prize_structure,
  } = body;

  if (!name || !sport || !start_date || !pick_deadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: pool, error } = await supabase.from('pools').insert({
    name,
    sport,
    visibility: visibility ?? 'public',
    max_entries: max_entries ?? null,
    contest_format: contest_format ?? 'classic',
    lives_count: lives_count ?? 1,
    target_wins: target_wins ?? 5,
    target_streak: target_streak ?? 5,
    max_losses: max_losses ?? null,
    push_resets_streak: push_resets_streak ?? false,
    entry_fee_cents: entry_fee_cents ?? 0,
    rake_percentage: rake_percentage ?? 10,
    start_date,
    pick_deadline,
    round_frequency: round_frequency ?? 'weekly',
    push_rule: push_rule ?? 'advance',
    all_lose_rule: all_lose_rule ?? 'repeat',
    prize_structure: prize_structure ?? 'winner_take_all',
    status: 'open',
    created_by: user.id,
    invite_code: inviteCode,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create first round — deadline is tonight at 9:30 PM ET (1:30 AM UTC next day)
  // If that's already passed, use tomorrow at 9:30 PM ET
  const now = new Date();
  const tonightDeadline = new Date();
  tonightDeadline.setUTCHours(1, 30, 0, 0); // 9:30 PM EDT = 01:30 UTC
  if (tonightDeadline <= now) {
    tonightDeadline.setUTCDate(tonightDeadline.getUTCDate() + 1);
  }

  await supabase.from('rounds').insert({
    pool_id: pool.id,
    round_number: 1,
    deadline: tonightDeadline.toISOString(),
    status: 'open',
  });

  // Log activity
  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'create_pool',
    target_id: pool.id,
    metadata: { pool_name: name },
  });

  return NextResponse.json({ pool }, { status: 201 });
}
