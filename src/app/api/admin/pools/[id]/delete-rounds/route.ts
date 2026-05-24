import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { snapshot } from '@/lib/snapshot';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: poolId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { from_round } = await request.json();
  if (!from_round || typeof from_round !== 'number') {
    return NextResponse.json({ error: 'from_round (number) required' }, { status: 400 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Delete picks for those rounds first (FK constraint)
  const { data: roundsToDelete } = await supabase
    .from('rounds')
    .select('id, round_number')
    .eq('pool_id', poolId)
    .gte('round_number', from_round);

  if (!roundsToDelete?.length) {
    return NextResponse.json({ error: 'No rounds found at or above that number' }, { status: 404 });
  }

  await snapshot(supabase, user.id, 'delete-rounds', poolId);

  const roundIds = roundsToDelete.map((r: any) => r.id);

  await supabase.from('picks').delete().in('round_id', roundIds);
  await supabase.from('rounds').delete().in('id', roundIds);

  // Reset the round below back to open
  const prevRound = from_round - 1;
  await supabase
    .from('rounds')
    .update({ status: 'open' })
    .eq('pool_id', poolId)
    .eq('round_number', prevRound);

  return NextResponse.json({
    deleted: roundsToDelete.map((r: any) => r.round_number),
    reopened: prevRound,
  });
}
