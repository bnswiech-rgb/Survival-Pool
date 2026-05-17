import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from('pools').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ pool: data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const { data: pool } = await supabase.from('pools').select('created_by').eq('id', id).single();

  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  if (pool.created_by !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { action, ...updates } = body;

  let statusUpdate: any = {};
  if (action === 'lock') statusUpdate = { status: 'locked' };
  else if (action === 'cancel') statusUpdate = { status: 'canceled' };
  else if (action === 'open') statusUpdate = { status: 'open' };
  else if (action === 'complete') statusUpdate = { status: 'completed' };

  const finalUpdates = { ...updates, ...statusUpdate, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('pools')
    .update(finalUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log admin action
  if (action) {
    await supabase.from('admin_actions').insert({
      admin_user_id: user.id,
      action_type: action,
      target_id: id,
      metadata: {},
    });
  }

  return NextResponse.json({ pool: data });
}
