import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { snapshotTeams } from '@/lib/teamSnapshot';

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

  // Get picks for current round — use pick id as the unique key so we're exact
  const pickMap = new Map<string, string>(); // user_id -> pick_id
  if (currentRound) {
    const { data: picks } = await supabase
      .from('picks')
      .select('id, user_id, game, side, pick_type, line_value')
      .eq('round_id', currentRound.id);
    for (const p of picks ?? []) {
      // Key: exact game + pick_type + side + line_value to avoid false collisions
      const key = `${(p.game ?? '').toLowerCase().trim()}||${p.pick_type}||${(p.side ?? '').toLowerCase().trim()}||${p.line_value ?? ''}`;
      pickMap.set(p.user_id, key);
    }
  }

  // Group participants by team
  const teamGroups = new Map<string, typeof allParticipants>();
  const noTeam: typeof allParticipants = [];
  for (const p of allParticipants) {
    if (!p.team_id) { noTeam.push(p); continue; }
    if (!teamGroups.has(p.team_id)) teamGroups.set(p.team_id, []);
    teamGroups.get(p.team_id)!.push(p);
  }

  // A team is valid ONLY if:
  // 1. It has exactly teamSize members
  // 2. No two members share an identical pick key (only checked if all members have picks)
  const validTeamIds = new Set<string>();
  const toDissolve: typeof allParticipants = [...noTeam];

  for (const [teamId, members] of teamGroups.entries()) {
    // Must be full size
    if (members.length !== teamSize) {
      toDissolve.push(...members);
      continue;
    }

    // Check for duplicate picks — only if every member has a pick
    const picks = members.map(m => pickMap.get(m.user_id));
    const allHavePicks = picks.every(k => !!k);

    if (allHavePicks) {
      const uniquePicks = new Set(picks as string[]);
      if (uniquePicks.size < picks.length) {
        // Confirmed duplicate picks — dissolve
        toDissolve.push(...members);
        continue;
      }
    }

    // Team is valid — keep it
    validTeamIds.add(teamId);
  }

  // Snapshot before any changes
  await snapshotTeams(supabase, poolId, user.id, 'reassign-teams');

  if (toDissolve.length === 0) {
    return NextResponse.json({ teamsCreated: 0, kept: validTeamIds.size, dissolved: 0, message: 'All teams are already valid' });
  }

  // Clear team_id only for dissolved participants
  await supabase
    .from('pool_participants')
    .update({ team_id: null })
    .in('id', toDissolve.map(p => p.id));

  // Delete dissolved teams only
  const dissolvedTeamIds = [...teamGroups.keys()].filter(id => !validTeamIds.has(id));
  if (dissolvedTeamIds.length > 0) {
    await supabase.from('teams').delete().in('id', dissolvedTeamIds);
  }

  // Reassign dissolved players, ensuring no duplicate picks per team
  const shuffle = <T>(arr: T[]) => arr.sort(() => Math.random() - 0.5);
  const playerPool = toDissolve.map(p => ({ participant: p, pickKey: pickMap.get(p.user_id) }));
  shuffle(playerPool);
  playerPool.sort((a, b) => (a.pickKey ? 0 : 1) - (b.pickKey ? 0 : 1));

  const newTeams: (typeof allParticipants)[] = [];
  const usedKeys = new Set<string>();
  let currentTeam: typeof allParticipants = [];
  const unassigned = [...playerPool];

  while (unassigned.length > 0) {
    if (currentTeam.length === 0) usedKeys.clear();

    const idx = unassigned.findIndex(p => !p.pickKey || !usedKeys.has(p.pickKey));

    if (idx === -1) {
      // Can't avoid duplicate — finalize current team and start fresh
      if (currentTeam.length > 0) {
        newTeams.push(currentTeam);
        currentTeam = [];
        usedKeys.clear();
      } else {
        // Force-add to avoid infinite loop
        const p = unassigned.shift()!;
        currentTeam.push(p.participant);
        if (p.pickKey) usedKeys.add(p.pickKey);
      }
      continue;
    }

    const [{ participant, pickKey }] = unassigned.splice(idx, 1);
    currentTeam.push(participant);
    if (pickKey) usedKeys.add(pickKey);

    if (currentTeam.length >= teamSize) {
      newTeams.push(currentTeam);
      currentTeam = [];
      usedKeys.clear();
    }
  }
  if (currentTeam.length > 0) newTeams.push(currentTeam);

  // Create new teams
  let teamsCreated = 0;
  const offset = validTeamIds.size;
  for (let i = 0; i < newTeams.length; i++) {
    const members = newTeams[i];
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ pool_id: poolId, name: `Team ${offset + i + 1}`, captain_id: members[0].user_id, invite_code: inviteCode })
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
