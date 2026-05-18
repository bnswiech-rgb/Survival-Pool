'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace('#', ''));
    if (params.get('type') === 'recovery') {
      router.replace('/reset-password' + hash);
    }
  }, [router]);

  return null;
}
