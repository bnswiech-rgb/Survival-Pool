import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/nav/Navbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar profile={profile} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-800 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="text-gray-500 text-xs">
            SurvivorPicks is a peer-to-peer sports picking contest platform. No sportsbook wagering occurs. Must be 18+. Not available where prohibited.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <a href="/terms" className="text-gray-600 hover:text-gray-400 transition-colors">Terms of Service</a>
            <span className="text-gray-700">·</span>
            <a href="/privacy" className="text-gray-600 hover:text-gray-400 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
