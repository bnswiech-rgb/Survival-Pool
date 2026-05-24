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

  if (!solo?.length) return NextResponse.json({ teamsCreated: 0, assigned: 0, filled: 0, voided: 0 });

  // Find which solo players have submitted a pick this round
  const { data: currentRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('pool_id', poolId)
    .in('status', ['open', 'grading'])
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const submittedUserIds = new Set<string>();
  if (currentRound) {
    const { data: submittedPicks } = await supabase
      .from('picks')
      .select('user_id')
      .eq('round_id', currentRound.id)
      .in('user_id', solo.map((s: any) => s.user_id));
    for (const p of submittedPicks ?? []) submittedUserIds.add(p.user_id);
  }

  // Split solos into submitted and not submitted, both shuffled
  const withPick = [...solo.filter((s: any) => submittedUserIds.has(s.user_id))].sort(() => Math.random() - 0.5);
  const withoutPick = [...solo.filter((s: any) => !submittedUserIds.has(s.user_id))].sort(() => Math.random() - 0.5);

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

  // Teams that need more members, sorted by most members first
  const incompleteTeams = [...teamMemberCount.entries()]
    .filter(([, count]) => count < teamSize)
    .sort((a, b) => b[1] - a[1]);

  // Queue: pick-submitted solos first, then no-pick solos
  const queue = [...withPick, ...withoutPick];

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
  // Leftover players who couldn't form a complete team:
  // - if they have a pick, keep them (add to nearest incomplete team or form undersized team as last resort)
  // - if they have no pick, boot them
  const fullTeamCount = Math.floor(queue.length / teamSize);
  const leftoverStart = fullTeamCount * teamSize;
  const leftovers = queue.slice(leftoverStart);
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

  // Handle leftovers: boot no-pick solos, keep pick-submitted solos
  let voided = 0;
  if (leftovers.length > 0) {
    const leftoverWithPick = leftovers.filter((m: any) => submittedUserIds.has(m.user_id));
    const leftoverNoPick = leftovers.filter((m: any) => !submittedUserIds.has(m.user_id));

    // Boot no-pick leftovers
    if (leftoverNoPick.length > 0) {
      const { error: voidError } = await supabase
        .from('pool_participants')
        .delete()
        .in('id', leftoverNoPick.map((m: any) => m.id));
      if (!voidError) voided = leftoverNoPick.length;
    }

    // Pick-submitted leftovers: add to the last created team (they'll be short but at least have picks)
    if (leftoverWithPick.length > 0 && teamsCreated > 0) {
      // Find the last team we created by querying recent teams for this pool
      const { data: lastTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastTeam) {
        await supabase
          .from('pool_participants')
          .update({ team_id: lastTeam.id })
          .in('id', leftoverWithPick.map((m: any) => m.id));
        assigned += leftoverWithPick.length;
      }
    }
  }

  return NextResponse.json({ teamsCreated, assigned, filled, voided });
}
