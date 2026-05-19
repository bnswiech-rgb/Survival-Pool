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

  if (participant) {
    if (status === 'won') {
      await supabase.from('pool_participants').update({
        wins: participant.wins + 1,
      }).eq('id', participant.id);
      // Profile wins updated via separate fetch to avoid type error
      const { data: prof } = await supabase.from('profiles').select('wins').eq('id', pick.user_id).single();
      if (prof) await supabase.from('profiles').update({ wins: prof.wins + 1 }).eq('id', pick.user_id);
    } else if (status === 'lost') {
      await supabase.from('pool_participants').update({
        losses: participant.losses + 1,
      }).eq('id', participant.id);
    } else if (status === 'push') {
      await supabase.from('pool_participants').update({
        pushes: participant.pushes + 1,
      }).eq('id', participant.id);
    }
  }

  // Log admin action
  await supabase.from('admin_actions').insert({
    admin_user_id: user.id,
    action_type: 'grade_pick',
    target_id: pick_id,
    metadata: { status, username: pick.profiles?.username },
  });

  return NextResponse.json({ pick });
}
