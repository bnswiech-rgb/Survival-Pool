import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  const [{ data: pools }, { data: pendingPicks }, { data: adminActions }, { data: withdrawalRequests }] = await Promise.all([
    supabase
      .from('pools')
      .select('*, pool_participants(count)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('picks')
      .select('*, profiles(username), pools(name), rounds(round_number)')
      .in('status', ['pending', 'won', 'lost', 'push'])
      .order('submitted_at', { ascending: false })
      .limit(200),
    supabase
      .from('admin_actions')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('withdrawal_requests')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return (
    <AdminDashboardClient
      pools={(pools as any) ?? []}
      pendingPicks={(pendingPicks as any) ?? []}
      adminActions={(adminActions as any) ?? []}
      withdrawalRequests={(withdrawalRequests as any) ?? []}
    />
  );
}
