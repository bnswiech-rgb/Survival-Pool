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

  // Get current round
  const { data: currentRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('pool_id', poolId)
    .in('status', ['open', 'locked', 'grading'])
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get all participants
  const { data: allParticipants } = await supabase
    .from('pool_participants')
    .select('id, user_id, team_id')
    .eq('pool_id', poolId);

  if (!allParticipants?.length) return NextResponse.json({ teamsCreated: 0 });

  // Get picks for current round
  const pickMap = new Map<string, string>(); // user_id -> pick key
  if (currentRound) {
    const { data: picks } = await supabase
      .from('picks')
      .select('user_id, game, side, pick_type')
      .eq('round_id', currentRound.id);
    for (const p of picks ?? []) {
      pickMap.set(p.user_id, `${p.game}||${p.pick_type}||${p.side}`);
    }
  }

  // Group participants by team
  const teamGroups = new Map<string, typeof allParticipants>(); // teamId -> participants
  const noTeam: typeof allParticipants = [];
  for (const p of allParticipants) {
    if (!p.team_id) { noTeam.push(p); continue; }
    if (!teamGroups.has(p.team_id)) teamGroups.set(p.team_id, []);
    teamGroups.get(p.team_id)!.push(p);
  }

  // Determine which teams are valid (full size + all unique picks) vs need dissolving
  const validTeamIds = new Set<string>();
  const toDissolve: typeof allParticipants = [...noTeam];

  for (const [teamId, members] of teamGroups.entries()) {
    if (members.length < teamSize) {
      // Undersized — dissolve
      toDissolve.push(...members);
      continue;
    }
    // Check for duplicate picks
    const pickKeys = members.map(m => pickMap.get(m.user_id)).filter(Boolean);
    const uniqueKeys = new Set(pickKeys);
    if (pickKeys.length > 0 && uniqueKeys.size < pickKeys.length) {
      // Duplicate picks — dissolve
      toDissolve.push(...members);
    } else {
      // Valid team — keep it
      validTeamIds.add(teamId);
    }
  }

  if (toDissolve.length === 0) {
    return NextResponse.json({ teamsCreated: 0, totalPlayers: allParticipants.length, kept: validTeamIds.size, message: 'All teams are already valid' });
  }

  // Clear team_id for dissolved participants only
  await supabase
    .from('pool_participants')
    .update({ team_id: null })
    .in('id', toDissolve.map(p => p.id));

  // Delete dissolved teams (not valid ones)
  const dissolvedTeamIds = [...teamGroups.keys()].filter(id => !validTeamIds.has(id));
  if (dissolvedTeamIds.length > 0) {
    await supabase.from('teams').delete().in('id', dissolvedTeamIds);
  }

  // Now reassign dissolved players ensuring no duplicate picks per team
  const shuffle = <T>(arr: T[]) => arr.sort(() => Math.random() - 0.5);

  const playerPool = toDissolve.map(p => ({ participant: p, pickKey: pickMap.get(p.user_id) }));
  shuffle(playerPool);
  // Players with picks first
  playerPool.sort((a, b) => (a.pickKey ? 0 : 1) - (b.pickKey ? 0 : 1));

  const newTeams: (typeof allParticipants)[] = [];
  const used = new Set<string>();
  let currentTeam: typeof allParticipants = [];
  const unassigned = [...playerPool];

  while (unassigned.length > 0) {
    if (currentTeam.length === 0) used.clear();

    const idx = unassigned.findIndex(p => !p.pickKey || !used.has(p.pickKey));

    if (idx === -1) {
      if (currentTeam.length > 0) {
        newTeams.push(currentTeam);
        currentTeam = [];
        used.clear();
      } else {
        const p = unassigned.shift()!;
        currentTeam.push(p.participant);
        if (p.pickKey) used.add(p.pickKey);
      }
      continue;
    }

    const [{ participant, pickKey }] = unassigned.splice(idx, 1);
    currentTeam.push(participant);
    if (pickKey) used.add(pickKey);

    if (currentTeam.length >= teamSize) {
      newTeams.push(currentTeam);
      currentTeam = [];
      used.clear();
    }
  }
  if (currentTeam.length > 0) newTeams.push(currentTeam);

  // Create new teams
  let teamsCreated = 0;
  const existingTeamCount = validTeamIds.size;
  for (let i = 0; i < newTeams.length; i++) {
    const members = newTeams[i];
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ pool_id: poolId, name: `Team ${existingTeamCount + i + 1}`, captain_id: members[0].user_id, invite_code: inviteCode })
      .select()
      .single();

    if (teamError) continue;

    await supabase
      .from('pool_participants')
      .update({ team_id: team.id })
      .in('id', members.map(m => m.id));

    teamsCreated++;
  }

  return NextResponse.json({ teamsCreated, kept: validTeamIds.size, dissolved: dissolvedTeamIds.length, totalPlayers: allParticipants.length });
}
