import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Snapshot current team state for a pool into admin_actions.
 * Call this BEFORE any destructive team operation.
 */
export async function snapshotTeams(supabase: SupabaseClient, poolId: string, adminUserId: string, reason: string) {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, captain_id, invite_code')
    .eq('pool_id', poolId);

  const { data: participants } = await supabase
    .from('pool_participants')
    .select('id, user_id, team_id')
    .eq('pool_id', poolId);

  await supabase.from('admin_actions').insert({
    admin_user_id: adminUserId,
    action_type: 'team_snapshot',
    target_id: poolId,
    metadata: {
      reason,
      pool_id: poolId,
      teams: teams ?? [],
      participants: (participants ?? []).map(p => ({ id: p.id, user_id: p.user_id, team_id: p.team_id })),
    },
  });
}
