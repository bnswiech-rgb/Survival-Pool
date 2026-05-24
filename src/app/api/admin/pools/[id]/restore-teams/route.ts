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

  // Find the most recent team_snapshot for this pool
  const { data: snapshot } = await supabase
    .from('admin_actions')
    .select('metadata, created_at')
    .eq('action_type', 'team_snapshot')
    .eq('target_id', poolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) return NextResponse.json({ error: 'No snapshot found for this pool' }, { status: 404 });

  const { teams, participants } = snapshot.metadata as {
    teams: { id: string; name: string; captain_id: string; invite_code: string }[];
    participants: { id: string; user_id: string; team_id: string | null }[];
  };

  // 1. Delete all current teams for this pool
  await supabase.from('pool_participants').update({ team_id: null }).eq('pool_id', poolId);
  await supabase.from('teams').delete().eq('pool_id', poolId);

  // 2. Recreate snapshot teams
  for (const team of teams) {
    await supabase.from('teams').insert({
      id: team.id,
      pool_id: poolId,
      name: team.name,
      captain_id: team.captain_id,
      invite_code: team.invite_code,
    });
  }

  // 3. Restore participant team assignments
  for (const p of participants) {
    await supabase
      .from('pool_participants')
      .update({ team_id: p.team_id })
      .eq('id', p.id);
  }

  return NextResponse.json({ restored: true, teams: teams.length, snapshotAt: snapshot.created_at });
}
