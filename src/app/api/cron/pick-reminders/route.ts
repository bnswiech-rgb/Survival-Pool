import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendPickReminderEmail } from '@/lib/email';

// Runs every hour via Vercel cron.
// Sends a reminder to active participants who haven't picked yet,
// when the round deadline is 2-3 hours away.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h from now
  const windowEnd   = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3h from now

  // Find open rounds with deadline in the 2-3 hour window
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, pool_id, round_number, deadline')
    .eq('status', 'open')
    .gte('deadline', windowStart.toISOString())
    .lte('deadline', windowEnd.toISOString());

  if (!rounds?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const round of rounds) {
    // Get active participants in this pool
    const { data: participants } = await supabase
      .from('pool_participants')
      .select('user_id')
      .eq('pool_id', round.pool_id)
      .in('status', ['active', 'advanced']);

    if (!participants?.length) continue;

    // Find who has already picked this round
    const { data: picks } = await supabase
      .from('picks')
      .select('user_id')
      .eq('round_id', round.id);

    const pickedUserIds = new Set((picks ?? []).map((p: any) => p.user_id));
    const unpickedIds = participants
      .map((p: any) => p.user_id)
      .filter((id: string) => !pickedUserIds.has(id));

    if (!unpickedIds.length) continue;

    // Get pool name
    const { data: pool } = await supabase
      .from('pools')
      .select('name')
      .eq('id', round.pool_id)
      .single();

    // Get user emails and usernames
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', unpickedIds);

    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]));
    const emailMap = Object.fromEntries(
      (authUsers?.users ?? []).map((u: any) => [u.id, u.email])
    );

    const deadlineEt = new Date(round.deadline).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: 'America/New_York', timeZoneName: 'short',
    });

    for (const userId of unpickedIds) {
      const email = emailMap[userId];
      const username = profileMap[userId];
      if (!email || !username) continue;

      try {
        await sendPickReminderEmail(email, {
          username,
          poolName: pool?.name ?? 'your contest',
          poolId: round.pool_id,
          roundNumber: round.round_number,
          deadlineEt,
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send reminder to ${email}:`, e);
      }
    }
  }

  return NextResponse.json({ sent });
}
