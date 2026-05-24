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

  // Get all participants without a team (solo players to assign)
  const { data: solo } = await supabase
    .from('pool_participants')
    .select('id, user_id')
    .eq('pool_id', poolId)
    .is('team_id', null);

  if (!solo?.length) return NextResponse.json({ teamsCreated: 0, assigned: 0, filled: 0 });

  // Find incomplete teams (have members but fewer than teamSize)
  const { data: allParticipants } = await supabase
    .from('pool_participants')
    .select('id, team_id')
    .eq('pool_id', poolId)
    .not('team_id', 'is', null);

  // Count members per team
  const teamMemberCount = new Map<string, number>();
  for (const p of allParticipants ?? []) {
    teamMemberCount.set(p.team_id, (teamMemberCount.get(p.team_id) ?? 0) + 1);
  }

  // Teams that need more members, sorted by most members first (fill biggest gaps last)
  const incompleteTeams = [...teamMemberCount.entries()]
    .filter(([, count]) => count < teamSize)
    .sort((a, b) => b[1] - a[1]); // most members first so nearly-full teams get filled first

  // Shuffle solo players
  const queue = [...solo].sort(() => Math.random() - 0.5);

  let filled = 0;
  let teamsCreated = 0;
  let assigned = 0;

  // Step 1: Fill incomplete teams
  for (const [teamId, currentCount] of incompleteTeams) {
    const spotsNeeded = teamSize - currentCount;
    const toAssign = queue.splice(0, spotsNeeded);
    if (!toAssign.length) break;

    const { error } = await supabase
      .from('pool_participants')
      .update({ team_id: teamId })
      .in('id', toAssign.map(m => m.id));

    if (!error) filled += toAssign.length;
  }

  // Step 2: Create new full teams from remaining solo players
  // Any leftover players that can't form a complete team get removed from the pool
  const fullTeamCount = Math.floor(queue.length / teamSize);
  const leftoverStart = fullTeamCount * teamSize;
  const leftovers = queue.slice(leftoverStart); // players that can't form a complete team
  const toGroup = queue.slice(0, leftoverStart);

  for (let i = 0; i < toGroup.length; i += teamSize) {
    const members = toGroup.slice(i, i + teamSize);
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

  // Remove leftover players who couldn't form a complete team
  let voided = 0;
  if (leftovers.length > 0) {
    const { error: voidError } = await supabase
      .from('pool_participants')
      .delete()
      .in('id', leftovers.map(m => m.id));

    if (!voidError) voided = leftovers.length;
  }

  return NextResponse.json({ teamsCreated, assigned, filled, voided });
}
