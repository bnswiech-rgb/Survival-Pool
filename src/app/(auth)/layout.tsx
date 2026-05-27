import Link from 'next/link';
import { Trophy } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white hover:text-green-400 transition-colors mb-8">
        <Trophy size={28} className="text-green-500" />
        <span>Sharpr</span>
      </Link>
      {children}
    </div>
  );
}
