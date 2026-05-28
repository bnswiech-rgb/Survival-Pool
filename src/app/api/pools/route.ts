import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendNewPoolEmail } from '@/lib/email';

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
    max_losses, push_resets_streak, entry_fee_cents, entry_fee_coins, rake_percentage, start_date: raw_start_date, pick_deadline,
    round_frequency, push_rule, all_lose_rule, prize_structure, team_size,
  } = body;

  if (!name || !sport || !raw_start_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // $5,000 max prize pool per contest (NY/FL sweepstakes compliance)
  const MAX_PRIZE_POOL = 500_000;
  const feeCoins = entry_fee_coins ?? 0;
  const feeCents = entry_fee_cents ?? 0;
  const rake = rake_percentage ?? 10;
  if (max_entries && (feeCoins > 0 || feeCents > 0)) {
    const netCoins  = Math.round(feeCoins  * max_entries * (1 - rake / 100));
    const netCents  = Math.round(feeCents  * max_entries * (1 - rake / 100));
    if (netCoins > MAX_PRIZE_POOL || netCents > MAX_PRIZE_POOL) {
      return NextResponse.json({
        error: `Prize pool cannot exceed $5,000 per contest. Lower the entry fee or reduce max entries.`,
      }, { status: 400 });
    }
  }

  // For game_day pools, always use today as start_date so games are immediately available
  const isGameDay = (round_frequency ?? 'weekly') === 'game_day';
  const start_date = isGameDay
    ? (() => { const t = new Date(); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())).toISOString(); })()
    : raw_start_date;

  // Default pick_deadline to 9:30 PM ET on the start date if not provided
  const resolvedPickDeadline = pick_deadline ?? (() => {
    const d = new Date(start_date);
    d.setUTCHours(1, 30, 0, 0); // 9:30 PM EDT = 01:30 UTC next day
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  })();

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
    entry_fee_coins: entry_fee_coins ?? 0,
    rake_percentage: rake_percentage ?? 10,
    start_date,
    pick_deadline: resolvedPickDeadline,
    round_frequency: round_frequency ?? 'weekly',
    push_rule: push_rule ?? 'advance',
    all_lose_rule: all_lose_rule ?? 'repeat',
    prize_structure: prize_structure ?? 'winner_take_all',
    team_size: team_size ?? null,
    status: 'open',
    created_by: user.id,
    invite_code: inviteCode,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create first round deadline
  // For game_day: find next NBA game via ESPN (reliable, free, no key needed)
  // For others: 9:30 PM ET on start_date
  let firstRoundDeadline: Date;
  const now = new Date();

  if (isGameDay) {
    let firstGameDateStr: string | null = null;
    try {
      // Check today + next 3 days on ESPN scoreboard
      for (let offset = 0; offset <= 3; offset++) {
        const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`,
          { cache: 'no-store' },
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data?.events) && data.events.length > 0) {
          // Found a game day — use this date
          firstGameDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          break;
        }
      }
    } catch { /* fall through to fallback */ }

    if (firstGameDateStr) {
      const p = firstGameDateStr.split('-').map(Number);
      // 11:59 PM ET on game day = 03:59 UTC next day
      firstRoundDeadline = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1, 3, 59, 0, 0));
    } else {
      // Fallback: 11:59 PM ET tomorrow
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      firstRoundDeadline = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate() + 1, 3, 59, 0, 0));
    }
  } else {
    const dateOnly = start_date.substring(0, 10);
    const startParts = dateOnly.split('-').map(Number);
    firstRoundDeadline = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2] + 1, 1, 30, 0, 0)); // 9:30 PM ET
  }

  const { error: roundError } = await supabase.from('rounds').insert({
    pool_id: pool.id,
    round_number: 1,
    deadline: firstRoundDeadline.toISOString(),
    status: 'open',
  });

  if (roundError) {
    console.error('Failed to create first round:', roundError.message);
    // Don't block — pool is created, admin can manually create round
  }

  // Log activity
  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'create_pool',
    target_id: pool.id,
    metadata: { pool_name: name },
  });

  // Email all users about the new pool (fire-and-forget, never block the response)
  Promise.resolve().then(async () => {
    try {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js');
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { data: allUsers } = await serviceSupabase
        .from('profiles')
        .select('id')
        .neq('id', user.id);

      if (allUsers?.length) {
        const { data: authUsers } = await serviceSupabase.auth.admin.listUsers();
        const userIds = new Set(allUsers.map((u: any) => u.id));
        const emails = (authUsers?.users ?? [])
          .filter((u: any) => userIds.has(u.id) && u.email)
          .map((u: any) => u.email as string);

        await sendNewPoolEmail({
          id: pool.id,
          name: pool.name,
          contest_format: pool.contest_format,
          sport: pool.sport,
          target_streak: pool.target_streak,
          target_wins: pool.target_wins,
          prize_description: body.prize_description,
          entry_fee_cents: pool.entry_fee_cents,
        }, emails);
      }
    } catch (e) {
      console.error('Failed to send new pool emails:', e);
    }
  });

  return NextResponse.json({ pool }, { status: 201 });
}
