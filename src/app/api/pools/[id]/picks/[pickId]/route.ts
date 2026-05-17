import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEligiblePick } from '@/lib/eligibility';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pickId: string }> }
) {
  const { id, pickId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: pick } = await supabase.from('picks').select('*').eq('id', pickId).single();
  if (!pick) return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
  if (pick.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (pick.is_locked) return NextResponse.json({ error: 'Pick is locked and cannot be changed' }, { status: 400 });

  const body = await request.json();
  const { sport, league, game, pick_type, side, line_value, american_odds, game_start_time } = body;

  if (american_odds !== undefined && pick_type) {
    if (!isEligiblePick(pick_type, american_odds)) {
      return NextResponse.json({ error: 'Pick does not meet eligibility requirements' }, { status: 400 });
    }
  }

  const { data: updated, error } = await supabase
    .from('picks')
    .update({ sport, league, game, pick_type, side, line_value, american_odds, game_start_time })
    .eq('id', pickId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pick: updated });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pickId: string }> }
) {
  const { id, pickId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { status } = await request.json();
  if (!['won', 'lost', 'push', 'void'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: pick, error } = await supabase
    .from('picks')
    .update({ status, graded_at: new Date().toISOString() })
    .eq('id', pickId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pick });
}
