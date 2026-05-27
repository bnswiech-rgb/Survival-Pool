import Link from 'next/link';
import { Shield, Phone, Heart, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';

export default function ResponsibleGamingPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Shield size={28} className="text-green-400" />
          <h1 className="text-3xl font-black text-white">Responsible Gaming</h1>
        </div>
        <p className="text-gray-400">
          Sharpr is committed to providing a safe and fun experience. Playing should be entertaining — if it stops being fun, we want to help.
        </p>
      </div>

      {/* Crisis Banner */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 flex items-start gap-4">
        <Phone size={22} className="text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-white mb-1">Need help right now?</p>
          <p className="text-gray-300 text-sm">
            Call or text the <strong className="text-white">National Problem Gambling Helpline</strong> at{' '}
            <a href="tel:18005224700" className="text-green-400 hover:text-green-300 font-bold text-base">
              1-800-522-4700
            </a>
            {' '}— free, confidential, available 24/7.
          </p>
        </div>
      </div>

      {/* Warning Signs */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Warning Signs</h2>
        <p className="text-gray-400 text-sm">Problem gambling can affect anyone. Look out for these signs in yourself or someone you know:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Spending more time or money on contests than intended',
            'Chasing losses by continuing to play after losing',
            'Lying to family or friends about your playing activity',
            'Neglecting responsibilities, work, or relationships',
            'Feeling restless or irritable when trying to stop',
            'Borrowing money or selling possessions to fund play',
            'Feeling a need to play with increasing amounts to feel excitement',
            'Failed attempts to cut back or stop playing',
          ].map(sign => (
            <div key={sign} className="flex items-start gap-2 text-sm text-gray-300">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>{sign}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          If you recognize any of these signs, please use our self-exclusion tools or contact the helpline above.
        </p>
      </section>

      {/* Our Tools */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Tools We Provide</h2>
        <div className="space-y-3">
          <Card>
            <CardBody className="flex gap-4">
              <Clock size={22} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-1">Self-Exclusion</h3>
                <p className="text-sm text-gray-400">
                  Voluntarily lock your account for 30 days, 90 days, 180 days, or permanently. Self-exclusion is immediate — you will be signed out and unable to access contests for the duration. Available on your{' '}
                  <Link href="/dashboard" className="text-green-400 hover:text-green-300">profile page</Link>.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex gap-4">
              <Heart size={22} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-1">Play for Fun</h3>
                <p className="text-sm text-gray-400">
                  All contests on Sharpr are free to enter — no purchase is ever required to play. You can claim free daily coins and enter any contest without spending money. If you ever feel pressure to spend, step back and use our free-play options.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex gap-4">
              <Shield size={22} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-1">Account Closure</h3>
                <p className="text-sm text-gray-400">
                  You may request permanent account closure and deletion of your data at any time by contacting{' '}
                  <span className="text-green-400">legal@survivorpicks.com</span>. We will process your request within 30 days.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Healthy Play Tips */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Tips for Healthy Play</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          {[
            'Set a budget for coin purchases and stick to it — never spend more than you can afford to lose.',
            'Play for entertainment, not as a way to make money or solve financial problems.',
            'Take regular breaks and set time limits for yourself.',
            'Never play when you are stressed, upset, or under the influence.',
            'Keep playing in perspective — it\'s a game, and losses are part of it.',
            'Talk to someone if playing is affecting your relationships, finances, or mental health.',
          ].map(tip => (
            <li key={tip} className="flex items-start gap-2">
              <span className="text-green-400 font-bold flex-shrink-0">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* External Resources */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">External Resources</h2>
        <div className="space-y-3">
          {[
            {
              name: 'National Problem Gambling Helpline',
              detail: '1-800-522-4700 · ncpgambling.org',
              desc: 'Free, confidential 24/7 helpline. Call, text, or live chat.',
              url: 'https://www.ncpgambling.org',
            },
            {
              name: 'Gamblers Anonymous',
              detail: 'gamblersanonymous.org',
              desc: 'Peer support group with meetings nationwide and online.',
              url: 'https://www.gamblersanonymous.org',
            },
            {
              name: 'National Council on Problem Gambling',
              detail: 'ncpgambling.org',
              desc: 'Resources, treatment locator, and advocacy for problem gamblers.',
              url: 'https://www.ncpgambling.org',
            },
            {
              name: 'Substance Abuse and Mental Health Services Administration (SAMHSA)',
              detail: '1-800-662-4357 · samhsa.gov',
              desc: 'National helpline for mental health and substance use disorders.',
              url: 'https://www.samhsa.gov',
            },
          ].map(r => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white group-hover:text-green-400 transition-colors">{r.name}</div>
                  <div className="text-xs text-green-400 mt-0.5">{r.detail}</div>
                  <div className="text-sm text-gray-400 mt-1">{r.desc}</div>
                </div>
                <ExternalLink size={16} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors" />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Our Commitment */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-bold text-white">Our Commitment</h2>
        <div className="text-sm text-gray-300 space-y-2 leading-relaxed">
          <p>Sharpr enforces an 18+ age requirement on all accounts. We do not market to minors and do not allow underage participation.</p>
          <p>Our sweepstakes model is designed so that no purchase is ever required to play. Free Alternate Method of Entry (AMOE) ensures everyone has equal access to Sweeps Coins regardless of spending.</p>
          <p>We honor all self-exclusion requests immediately with no waiting period. Permanent self-exclusions are irrevocable for a minimum of 5 years.</p>
          <p>If you believe someone is using Sharpr in a manner harmful to themselves, please contact us at <span className="text-green-400">legal@survivorpicks.com</span>.</p>
        </div>
      </section>
    </div>
  );
}
