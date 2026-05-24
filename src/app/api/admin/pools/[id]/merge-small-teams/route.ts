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

  // Get all participants with their team_id
  const { data: allParticipants } = await supabase
    .from('pool_participants')
    .select('id, team_id')
    .eq('pool_id', poolId)
    .not('team_id', 'is', null);

  if (!allParticipants?.length) return NextResponse.json({ merged: 0, deleted: 0 });

  // Count members per team
  const teamMembers = new Map<string, string[]>(); // teamId -> participantIds[]
  for (const p of allParticipants) {
    if (!teamMembers.has(p.team_id)) teamMembers.set(p.team_id, []);
    teamMembers.get(p.team_id)!.push(p.id);
  }

  // Find undersized teams (fewer than teamSize members), sorted by size descending
  const smallTeams = [...teamMembers.entries()]
    .filter(([, members]) => members.length < teamSize)
    .sort((a, b) => b[1].length - a[1].length);

  if (smallTeams.length <= 1) return NextResponse.json({ merged: 0, deleted: 0 });

  // Greedily merge: fill the largest small team first, then move on
  let merged = 0;
  let deleted = 0;
  const queue = [...smallTeams];

  while (queue.length > 1) {
    const [targetTeamId, targetMembers] = queue[0];
    const spotsAvailable = teamSize - targetMembers.length;

    if (spotsAvailable === 0) {
      queue.shift();
      continue;
    }

    // Take members from the last (smallest) team in queue
    const [sourceTeamId, sourceMembers] = queue[queue.length - 1];

    if (targetTeamId === sourceTeamId) break;

    const toMove = sourceMembers.splice(0, spotsAvailable);
    targetMembers.push(...toMove);

    // Reassign participants to target team
    const { error } = await supabase
      .from('pool_participants')
      .update({ team_id: targetTeamId })
      .in('id', toMove);

    if (!error) merged += toMove.length;

    // If source team is now empty, delete it
    if (sourceMembers.length === 0) {
      queue.pop();
      await supabase.from('teams').delete().eq('id', sourceTeamId);
      deleted++;
    }

    // If target is now full, move on
    if (targetMembers.length >= teamSize) {
      queue.shift();
    }
  }

  return NextResponse.json({ merged, deleted });
}
