import Link from 'next/link';
import { Trophy, Shield } from 'lucide-react';

interface Props {
  searchParams: Promise<{ until?: string }>;
}

export default async function SelfExcludedPage({ searchParams }: Props) {
  const { until } = await searchParams;

  const isPermanent = until
    ? new Date(until).getFullYear() > new Date().getFullYear() + 10
    : false;

  const formattedDate = until && !isPermanent
    ? new Date(until).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <nav className="border-b border-gray-800 py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 font-bold text-white w-fit">
            <Trophy size={20} className="text-green-500" />
            Sharpr
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 mx-auto">
            <Shield size={32} className="text-blue-400" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white mb-2">Account Self-Excluded</h1>
            {isPermanent ? (
              <p className="text-gray-400">
                Your account is permanently self-excluded. You will not be able to access Sharpr contests.
              </p>
            ) : formattedDate ? (
              <p className="text-gray-400">
                Your account is self-excluded until <span className="text-white font-semibold">{formattedDate}</span>. You will not be able to access Sharpr until after this date.
              </p>
            ) : (
              <p className="text-gray-400">
                Your account is currently self-excluded from Sharpr.
              </p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left space-y-3">
            <p className="text-sm font-semibold text-white">Need help?</p>
            <p className="text-sm text-gray-400">
              If you're experiencing issues with gambling, please reach out to these free, confidential resources:
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-white font-medium">National Problem Gambling Helpline</span>
                <br />
                <span className="text-green-400">1-800-522-4700</span>
                <span className="text-gray-500"> — 24/7 call, text, or chat</span>
              </li>
              <li>
                <span className="text-white font-medium">Gamblers Anonymous</span>
                <br />
                <a href="https://www.gamblersanonymous.org" className="text-green-400 hover:text-green-300" target="_blank" rel="noopener noreferrer">gamblersanonymous.org</a>
              </li>
              <li>
                <span className="text-white font-medium">National Council on Problem Gambling</span>
                <br />
                <a href="https://www.ncpgambling.org" className="text-green-400 hover:text-green-300" target="_blank" rel="noopener noreferrer">ncpgambling.org</a>
              </li>
            </ul>
          </div>

          <p className="text-xs text-gray-600">
            To request removal of a permanent self-exclusion or for account questions, contact{' '}
            <span className="text-gray-400">legal@survivorpicks.com</span>. Note: permanent self-exclusions
            are irrevocable for a minimum of 5 years.
          </p>
        </div>
      </div>
    </div>
  );
}
