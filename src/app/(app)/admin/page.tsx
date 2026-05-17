import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  const [{ data: pools }, { data: pendingPicks }, { data: adminActions }] = await Promise.all([
    supabase
      .from('pools')
      .select('*, pool_participants(count)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('picks')
      .select('*, profiles(username), pools(name), rounds(round_number)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(100),
    supabase
      .from('admin_actions')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <AdminDashboardClient
      pools={(pools as any) ?? []}
      pendingPicks={(pendingPicks as any) ?? []}
      adminActions={(adminActions as any) ?? []}
    />
  );
}
