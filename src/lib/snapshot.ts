import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Universal snapshot — call before ANY destructive operation.
 * Saves full state to admin_actions so it can be inspected or restored.
 */
export async function snapshot(
  supabase: SupabaseClient,
  adminUserId: string,
  type: string,
  poolId: string,
) {
  const [
    { data: pool },
    { data: participants },
    { data: rounds },
    { data: picks },
    { data: teams },
  ] = await Promise.all([
    supabase.from('pools').select('*').eq('id', poolId).single(),
    supabase.from('pool_participants').select('*').eq('pool_id', poolId),
    supabase.from('rounds').select('*').eq('pool_id', poolId).order('round_number', { ascending: true }),
    supabase.from('picks').select('*').eq('pool_id', poolId),
    supabase.from('teams').select('*').eq('pool_id', poolId),
  ]);

  await supabase.from('admin_actions').insert({
    admin_user_id: adminUserId,
    action_type: `snapshot:${type}`,
    target_id: poolId,
    metadata: {
      pool,
      participants: participants ?? [],
      rounds: rounds ?? [],
      picks: picks ?? [],
      teams: teams ?? [],
    },
  });
}
