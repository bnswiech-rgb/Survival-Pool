import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ userIds: [] });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Only for team_battle pools
  const { data: pool } = await supabase.from('pools').select('contest_format').eq('id', id).single();
  if (pool?.contest_format !== 'team_battle') return NextResponse.json({ userIds: [] });

  const { data: round } = await supabase
    .from('rounds')
    .select('id')
    .eq('pool_id', id)
    .neq('status', 'completed')
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!round) return NextResponse.json({ userIds: [] });

  const { data: picks } = await supabase
    .from('picks')
    .select('user_id')
    .eq('round_id', round.id);

  return NextResponse.json({ userIds: (picks ?? []).map((p: any) => p.user_id) });
}
