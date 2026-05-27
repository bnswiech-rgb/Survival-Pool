import Link from 'next/link';
import { Trophy, Shield, Zap, Users, Star, Target, TrendingUp, Award } from 'lucide-react';
import { Navbar } from '@/components/nav/Navbar';
import { createClient } from '@/lib/supabase/server';
import { AuthHashHandler } from '@/components/AuthHashHandler';

const features = [
  { icon: Shield, title: 'Classic Survival', desc: 'One pick per round. Lose once, you\'re out. Last survivor wins.', color: 'text-green-400' },
  { icon: Zap, title: 'Lives Mode', desc: 'Start with multiple lives. Burn through them before getting eliminated.', color: 'text-yellow-400' },
  { icon: Target, title: 'First To X Wins', desc: 'Race to reach the target win count before everyone else.', color: 'text-blue-400' },
  { icon: TrendingUp, title: 'Best Record', desc: 'Most wins after N rounds wins. Tiebreaker goes to fewest losses.', color: 'text-purple-400' },
  { icon: Star, title: 'Streak Race', desc: 'Build a consecutive win streak to claim victory.', color: 'text-orange-400' },
  { icon: Users, title: 'Team Battle', desc: 'Join a team. Coordinate picks. Last team standing wins.', color: 'text-pink-400' },
];

const steps = [
  { n: '1', title: 'Join a Contest', desc: 'Browse public contests or join private ones with an invite code. Pay the entry fee to get in.' },
  { n: '2', title: 'Submit Your Pick', desc: 'Each round, select a game and submit your pick before the deadline. Eligibility rules apply.' },
  { n: '3', title: 'Survive & Win', desc: 'Win your pick to advance. Lose and you\'re eliminated. Last survivor claims the prize pool.' },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <AuthHashHandler />
      <Navbar profile={profile} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6 text-green-400 text-sm font-medium">
            <Trophy size={14} /> Peer-to-Peer Sports Survival Contests
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
            Survive Every Pick.<br />
            <span className="text-green-400">Win the Pool.</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join peer-to-peer survival picking contests. Submit one pick per round, win to survive, lose and you&apos;re eliminated. The last survivor takes the prize pool.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pools"
              className="bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-8 py-4 rounded-xl transition-all duration-150 hover:scale-105 inline-block"
            >
              Browse Contests
            </Link>
            <Link
              href="/pools/create"
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg px-8 py-4 rounded-xl border border-gray-700 transition-all duration-150 hover:scale-105 inline-block"
            >
              Create Contest
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-black text-green-400">24</div>
            <div className="text-gray-400 text-sm mt-1">Live Contests</div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">$48,200</div>
            <div className="text-gray-400 text-sm mt-1">Prize Pool</div>
          </div>
          <div>
            <div className="text-3xl font-black text-purple-400">1,847</div>
            <div className="text-gray-400 text-sm mt-1">Active Survivors</div>
          </div>
        </div>
      </section>

      {/* Contest Formats */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Six Ways to Compete</h2>
          <p className="text-gray-400 max-w-xl mx-auto">Choose from six exciting contest formats, each with unique rules and strategies.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors group">
              <f.icon size={28} className={`${f.color} mb-4 group-hover:scale-110 transition-transform`} />
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400">Get started in minutes. No complicated setup required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center text-green-400 font-black text-xl mx-auto mb-4">
                  {s.n}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 max-w-7xl mx-auto px-4 text-center">
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-green-900/20 border border-gray-800 rounded-2xl p-12">
          <Award size={48} className="text-green-400 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Compete?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Join thousands of sports fans competing in survival picking contests. Create your free account and enter your first contest today.
          </p>
          {!user && (
            <Link
              href="/signup"
              className="bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-10 py-4 rounded-xl transition-all hover:scale-105 inline-block"
            >
              Create Free Account
            </Link>
          )}
          {user && (
            <Link
              href="/pools"
              className="bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-10 py-4 rounded-xl transition-all hover:scale-105 inline-block"
            >
              Browse Contests
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy size={20} className="text-green-500" />
            <span className="font-bold text-white">Sharpr</span>
          </div>
          <div className="flex justify-center gap-6 text-gray-400 text-sm mb-4">
            <Link href="/rules" className="hover:text-white transition-colors">Rules</Link>
            <Link href="/pools" className="hover:text-white transition-colors">Browse</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
          <p className="text-gray-500 text-xs max-w-2xl mx-auto">
            Sharpr is a peer-to-peer sports picking contest platform. No sportsbook wagering occurs. Must be 18+. Not available where prohibited. Please play responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}
