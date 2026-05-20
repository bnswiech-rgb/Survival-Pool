import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { pick_id, status } = await request.json();
  if (!pick_id || !['won', 'lost', 'push', 'void'].includes(status)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { error } = await supabase
    .from('picks')
    .update({ status, graded_at: new Date().toISOString(), is_locked: true })
    .eq('id', pick_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pick } = await supabase
    .from('picks')
    .select('*, profiles(username)')
    .eq('id', pick_id)
    .single();

  // Update participant stats
  const { data: participant } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', pick.pool_id)
    .eq('user_id', pick.user_id)
    .maybeSingle();

  // Do not update participant stats here — the cron/advance handles that correctly

  // Log admin action
  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'grade_pick',
    target_id: pick_id,
    metadata: { status, username: pick.profiles?.username },
  });

  return NextResponse.json({ pick });
}
