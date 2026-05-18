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
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase puts tokens in the hash: #access_token=xxx&type=recovery
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
      // Set the session from the tokens in the URL
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) {
          setError('Invalid or expired reset link. Please request a new one.');
        } else {
          setReady(true);
        }
        setChecking(false);
      });
    } else {
      // No tokens in URL — check if already has a recovery session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setReady(true);
        } else {
          setError('Invalid or expired reset link. Please request a new one.');
        }
        setChecking(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (checking) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
        {!ready ? (
          <>
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 text-sm text-red-400 mb-4">
              {error}
            </div>
            <a href="/forgot-password" className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
              Request a new reset link
            </a>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
