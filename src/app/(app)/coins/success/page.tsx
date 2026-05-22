import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  searchParams: Promise<{ pack?: string; gold?: string; sweeps?: string }>;
}

export default async function CoinsSuccessPage({ searchParams }: Props) {
  const { pack, gold, sweeps } = await searchParams;
  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-16">
      <CheckCircle2 size={56} className="text-green-400 mx-auto" />
      <div>
        <h1 className="text-3xl font-black text-white">Coins Added!</h1>
        {pack && (
          <p className="text-gray-400 mt-2">
            Your <span className="text-white font-bold">{pack} Pack</span> has been credited to your account.
          </p>
        )}
      </div>
      {(gold || sweeps) && (
        <div className="flex items-center justify-center gap-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          {gold && (
            <div>
              <div className="text-2xl font-black text-yellow-400">+{parseInt(gold).toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">Gold Coins</div>
            </div>
          )}
          {sweeps && (
            <div>
              <div className="text-2xl font-black text-green-400">+{parseInt(sweeps).toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">Sweeps Coins</div>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Link
          href="/pools"
          className="bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-6 rounded-xl transition-colors"
        >
          Browse Contests
        </Link>
        <Link href="/coins" className="text-gray-400 hover:text-white text-sm transition-colors">
          Buy more coins
        </Link>
      </div>
    </div>
  );
}
