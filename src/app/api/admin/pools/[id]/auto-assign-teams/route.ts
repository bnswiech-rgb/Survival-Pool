import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: poolId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pool } = await supabase.from('pools').select('team_size').eq('id', poolId).single();
  const teamSize = pool?.team_size ?? 3;

  // Get all participants without a team
  const { data: solo } = await supabase
    .from('pool_participants')
    .select('id, user_id')
    .eq('pool_id', poolId)
    .is('team_id', null);

  if (!solo?.length) return NextResponse.json({ teamsCreated: 0, assigned: 0 });

  // Shuffle randomly
  const shuffled = [...solo].sort(() => Math.random() - 0.5);

  let teamsCreated = 0;
  let assigned = 0;

  for (let i = 0; i < shuffled.length; i += teamSize) {
    const members = shuffled.slice(i, i + teamSize);
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const teamName = `Team ${teamsCreated + 1}`;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ pool_id: poolId, name: teamName, captain_id: members[0].user_id, invite_code: inviteCode })
      .select()
      .single();

    if (teamError) continue;

    const { error: assignError } = await supabase
      .from('pool_participants')
      .update({ team_id: team.id })
      .in('id', members.map(m => m.id));

    if (!assignError) {
      teamsCreated++;
      assigned += members.length;
    }
  }

  return NextResponse.json({ teamsCreated, assigned });
}
