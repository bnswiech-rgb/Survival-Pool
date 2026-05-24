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
  const pickMap = new Map<string, string>(); // user_id -> pick key (game+side)
  if (currentRound) {
    const { data: picks } = await supabase
      .from('picks')
      .select('user_id, game, side, pick_type')
      .eq('round_id', currentRound.id);
    for (const p of picks ?? []) {
      const key = `${p.game}||${p.pick_type}||${p.side}`;
      pickMap.set(p.user_id, key);
    }
  }

  // Delete all existing teams for this pool
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('pool_id', poolId);

  if (existingTeams?.length) {
    // Clear team_id from all participants first
    await supabase
      .from('pool_participants')
      .update({ team_id: null })
      .eq('pool_id', poolId);

    // Delete all teams
    await supabase
      .from('teams')
      .delete()
      .eq('pool_id', poolId);
  }

  // Group participants by their pick key, shuffle within each group
  const pickGroups = new Map<string, typeof allParticipants>();
  const noPick: typeof allParticipants = [];

  for (const p of allParticipants) {
    const key = pickMap.get(p.user_id);
    if (!key) {
      noPick.push(p);
    } else {
      if (!pickGroups.has(key)) pickGroups.set(key, []);
      pickGroups.get(key)!.push(p);
    }
  }

  // Shuffle within each group
  const shuffle = <T>(arr: T[]) => arr.sort(() => Math.random() - 0.5);
  for (const group of pickGroups.values()) shuffle(group);
  shuffle(noPick);

  // Round-robin deal players into teams ensuring no duplicate picks per team
  // Strategy: sort groups by size desc, deal one player per group per team slot
  const groups = [...pickGroups.values()].sort((a, b) => b.length - a.length);

  // Build a flat ordered list: interleave groups so adjacent players have different picks
  const ordered: typeof allParticipants = [];
  let remaining = groups.flatMap(g => g);

  // Greedy: for each team slot, pick from a group not already used in this team
  const teams: (typeof allParticipants)[] = [];
  const used = new Set<string>(); // pick keys used in current team
  let currentTeam: typeof allParticipants = [];

  // Pool of players sorted so we try to spread picks
  const playerPool: { participant: (typeof allParticipants)[0], pickKey: string | undefined }[] = [
    ...allParticipants.map(p => ({ participant: p, pickKey: pickMap.get(p.user_id) }))
  ];
  shuffle(playerPool);

  // Sort: players with picks first, then no-picks
  playerPool.sort((a, b) => (a.pickKey ? 0 : 1) - (b.pickKey ? 0 : 1));

  const unassigned = [...playerPool];

  while (unassigned.length > 0) {
    if (currentTeam.length === 0) {
      used.clear();
    }

    // Find first player whose pick key isn't used in this team
    const idx = unassigned.findIndex(p => !p.pickKey || !used.has(p.pickKey));

    if (idx === -1) {
      // All remaining players have conflicting picks — start a new team with first available
      if (currentTeam.length > 0) {
        teams.push(currentTeam);
        currentTeam = [];
        used.clear();
      } else {
        // Force-add anyway to avoid infinite loop
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
      teams.push(currentTeam);
      currentTeam = [];
      used.clear();
    }
  }

  // Push last partial team if any
  if (currentTeam.length > 0) teams.push(currentTeam);

  // Create teams and assign participants
  let teamsCreated = 0;
  for (let i = 0; i < teams.length; i++) {
    const members = teams[i];
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ pool_id: poolId, name: `Team ${i + 1}`, captain_id: members[0].user_id, invite_code: inviteCode })
      .select()
      .single();

    if (teamError) continue;

    await supabase
      .from('pool_participants')
      .update({ team_id: team.id })
      .in('id', members.map(m => m.id));

    teamsCreated++;
  }

  return NextResponse.json({ teamsCreated, totalPlayers: allParticipants.length });
}
