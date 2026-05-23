import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: teams, error } = await supabase
    .from('teams')
    .select('*, pool_participants(user_id, profiles(username, avatar_url))')
    .eq('pool_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 });

  // Must be a participant
  const { data: participant } = await supabase
    .from('pool_participants')
    .select('id, team_id')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!participant) return NextResponse.json({ error: 'Not a participant in this contest' }, { status: 403 });
  if (participant.team_id) return NextResponse.json({ error: 'You are already on a team' }, { status: 400 });

  // Create team with invite code
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({ pool_id: id, name: name.trim(), captain_id: user.id, invite_code: inviteCode })
    .select()
    .single();
  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });

  // Assign creator to the team
  const { error: assignError } = await supabase
    .from('pool_participants')
    .update({ team_id: team.id })
    .eq('id', participant.id);
  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });

  return NextResponse.json({ team }, { status: 201 });
}
