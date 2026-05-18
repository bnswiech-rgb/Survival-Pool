'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
        {sent ? (
          <>
            <p className="text-gray-400 text-sm mb-6">Check your email for a reset link. It may take a minute to arrive.</p>
            <Link href="/login" className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              {error && (
                <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Send Reset Link
              </Button>
            </form>
            <p className="text-center text-gray-400 text-sm mt-4">
              <Link href="/login" className="text-green-400 hover:text-green-300 font-medium transition-colors">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
