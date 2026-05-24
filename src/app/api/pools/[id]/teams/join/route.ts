import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { invite_code } = body;
  if (!invite_code?.trim()) return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });

  // Must be a participant without a team
  const { data: participant } = await supabase
    .from('pool_participants')
    .select('id, team_id')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!participant) return NextResponse.json({ error: 'Not a participant in this contest' }, { status: 403 });
  if (participant.team_id) return NextResponse.json({ error: 'You are already on a team' }, { status: 400 });

  // Look up the team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('pool_id', id)
    .eq('invite_code', invite_code.trim().toUpperCase())
    .maybeSingle();
  if (!team) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });

  // Check team size
  const { data: pool } = await supabase.from('pools').select('team_size').eq('id', id).single();
  if (pool?.team_size) {
    const { count } = await supabase
      .from('pool_participants')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', id)
      .eq('team_id', team.id);
    if ((count ?? 0) >= pool.team_size) {
      return NextResponse.json({ error: 'This team is full' }, { status: 400 });
    }
  }

  // Join the team
  const { error } = await supabase
    .from('pool_participants')
    .update({ team_id: team.id })
    .eq('id', participant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Track which team invite code was used
  await supabase.from('activity_feed').insert({
    pool_id: id,
    user_id: user.id,
    activity_type: 'joined_team',
    metadata: { team_id: team.id, team_name: team.name, team_invite_code: invite_code.trim().toUpperCase() },
  });

  return NextResponse.json({ team });
}
