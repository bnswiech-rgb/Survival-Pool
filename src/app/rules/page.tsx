import Link from 'next/link';
import { Trophy, Shield, AlertTriangle } from 'lucide-react';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Simple nav */}
      <nav className="border-b border-gray-800 py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="flex items-center gap-2 font-bold text-white hover:text-green-400 transition-colors w-fit">
            <Trophy size={20} className="text-green-500" />
            Sharpr
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <div>
          <h1 className="text-4xl font-black text-white mb-3">Contest Rules</h1>
          <p className="text-gray-400 text-lg">Everything you need to know about how Sharpr contests work.</p>
        </div>

        {/* Compliance Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 flex gap-3">
          <AlertTriangle size={24} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-yellow-400 mb-1">Important Notice</div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Sharpr is a peer-to-peer sports picking contest platform. This is NOT a sportsbook. No wagering occurs on our platform. Entry fees are pooled among participants and redistributed as prizes per contest rules. Must be 18 years of age or older. Not available where prohibited by law. Please play responsibly.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-3">How Contests Work</h2>
          <div className="text-gray-300 space-y-3 leading-relaxed">
            <p>Sharpr hosts peer-to-peer survival picking contests where participants compete against each other, not against the house. Entry fees are collected, a small platform fee is deducted, and the remaining prize pool is distributed to survivors per the contest rules.</p>
            <p>Each round, every active participant submits exactly one eligible pick before the deadline. After the round closes, picks are graded and participants either advance or are eliminated based on the contest format.</p>
          </div>
        </section>

        {/* Pick Eligibility */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-3">Pick Eligibility Rules</h2>
          <p className="text-gray-400 text-sm">These rules ensure fair competition and prevent heavy favorites from dominating.</p>
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-2">Spread Picks</h3>
              <p className="text-gray-300 text-sm">Odds must be between -115 and -105. Standard juice only. No picks with odds outside this tight range.</p>
              <div className="mt-3 flex gap-3 text-xs">
                <span className="text-green-400">✓ Allowed: -110, -115, -105</span>
                <span className="text-red-400">✗ Blocked: -120, +100</span>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-2">Total (Over/Under) Picks</h3>
              <p className="text-gray-300 text-sm">Same as spreads — odds must be between -115 and -105.</p>
              <div className="mt-3 flex gap-3 text-xs">
                <span className="text-green-400">✓ Allowed: -110, -105</span>
                <span className="text-red-400">✗ Blocked: -120, +100</span>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-2">Moneyline Picks</h3>
              <p className="text-gray-300 text-sm">Moneyline must be -150 or better (less negative). Positive odds (+100 and better) are always allowed. Heavy favorites are blocked.</p>
              <div className="mt-3 flex gap-3 flex-wrap text-xs">
                <span className="text-green-400">✓ Allowed: -150, -140, -120, -110, +100, +200</span>
                <span className="text-red-400">✗ Blocked: -151, -160, -200, -300</span>
              </div>
            </div>
          </div>
        </section>

        {/* Contest Formats */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-3">Contest Formats</h2>
          <div className="space-y-4">
            {[
              { name: 'Classic Survival', desc: 'Each participant has one life. Submit a pick each round. Win and you advance. Lose once and you\'re eliminated. Last survivor wins.' },
              { name: 'Lives Mode', desc: 'Participants start with a configured number of lives (e.g., 3). Each loss costs one life. Run out of lives and you\'re eliminated. Push rules per contest settings.' },
              { name: 'First To X Wins', desc: 'Race to reach the target win count first. First participant to hit the goal is declared the winner. Optional max-loss elimination available.' },
              { name: 'Best Record', desc: 'Compete over a set number of rounds. The participant with the best record (most wins, fewest losses as tiebreaker) wins at the end.' },
              { name: 'Streak Race', desc: 'First to build the target number of consecutive wins wins. A loss resets your streak to zero. Push may or may not reset streak per contest settings.' },
              { name: 'Team Battle', desc: 'Participants are divided into teams. Teams compete using classic survival rules. The last team with active members wins.' },
            ].map(f => (
              <div key={f.name} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-bold text-white mb-2">{f.name}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Push and All-Lose Rules */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-3">Special Rules</h2>
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Push / Void Rules</h3>
              <p className="text-gray-300 text-sm mb-3">When a pick results in a push (no winner) or is voided:</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><strong className="text-white">Advance:</strong> The participant advances as if they won.</li>
                <li><strong className="text-white">Eliminate:</strong> The participant is eliminated as if they lost.</li>
                <li><strong className="text-white">Repeat:</strong> The participant must submit a new pick next round.</li>
              </ul>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">All-Lose Rules</h3>
              <p className="text-gray-300 text-sm mb-3">When every remaining participant loses in the same round:</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><strong className="text-white">Repeat Round:</strong> Everyone survives and the round replays.</li>
                <li><strong className="text-white">Split Prize:</strong> Prize pool is split equally among all participants.</li>
                <li><strong className="text-white">Tiebreaker:</strong> Best W-L record determines the winner.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Fees */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-3">Fees & Prizes</h2>
          <div className="text-gray-300 space-y-3 text-sm leading-relaxed">
            <p>Entry fees are set by the contest creator. A platform rake (typically 5-15%) is deducted from the gross prize pool before distribution. The net prize pool is distributed to the contest winner(s) per the configured prize structure.</p>
            <p>Free contests have no entry fee and no prize pool — they are purely for fun and bragging rights.</p>
            <p>All fees and prize distributions are clearly shown before joining any contest.</p>
          </div>
        </section>

        {/* Responsible Play */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-400" />
            <h2 className="text-xl font-bold text-white">Responsible Play</h2>
          </div>
          <div className="text-gray-300 text-sm space-y-2 leading-relaxed">
            <p>Sharpr is committed to responsible play. Participation in picking contests should be fun and social.</p>
            <p><strong className="text-white">Must be 18+.</strong> By creating an account and joining contests, you confirm you are at least 18 years of age.</p>
            <p><strong className="text-white">Know your limits.</strong> Only enter contests with entry fees you can afford to lose. Never enter more than you are comfortable with.</p>
            <p><strong className="text-white">Not available where prohibited.</strong> It is your responsibility to ensure participation in peer-to-peer picking contests is legal in your jurisdiction.</p>
            <p>If you or someone you know has concerns about problem gambling, please contact the <strong className="text-white">National Problem Gambling Helpline: 1-800-522-4700</strong>.</p>
          </div>
        </section>

        <div className="text-center text-gray-500 text-sm pb-8">
          <p>Sharpr is a peer-to-peer sports picking contest platform. No sportsbook wagering occurs.</p>
          <p className="mt-1">Must be 18+. Not available where prohibited. Play responsibly.</p>
        </div>
      </div>
    </div>
  );
}
