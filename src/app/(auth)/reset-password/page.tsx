'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase puts the session tokens in the URL hash after a reset link click
    // We need to detect the recovery session
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    // Also check if already has a session from the hash
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, [supabase]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">Loading reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
        <p className="text-gray-400 text-sm mb-6">Enter your new password below.</p>
        <form onSubmit={handleReset} className="space-y-4">
          <Input
            id="password"
            label="New Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            hint="At least 8 characters"
          />
          <Input
            id="confirm"
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
