'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, Trophy, ChevronDown, Shield, LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { CoinBalance } from '@/components/nav/CoinBalance';
import type { Profile } from '@/types';

interface NavbarProps {
  profile?: Profile | null;
}

export function Navbar({ profile }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white hover:text-green-400 transition-colors">
            <Trophy size={24} className="text-green-500" />
            <span>Sharpr</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {profile && (
              <>
                <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/pools" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                  Browse Contests
                </Link>
                <Link href="/pools/create" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                  Create Contest
                </Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* CoinBalance hidden until payments go live */}
            {profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                >
                  <Avatar src={profile.avatar_url} username={profile.username} size="sm" />
                  <span className="hidden sm:block text-sm font-medium">{profile.username}</span>
                  <ChevronDown size={16} />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-20 py-1">
                      <Link
                        href={`/profile/${profile.username}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={16} /> Profile
                      </Link>
                      {profile.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Shield size={16} /> Admin Panel
                        </Link>
                      )}
                      <hr className="border-gray-800 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 transition-colors"
                      >
                        <LogOut size={16} /> Log Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden text-gray-400 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-gray-800 space-y-2">
            {profile ? (
              <>
                <Link href="/dashboard" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/pools" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                  Browse Contests
                </Link>
                <Link href="/pools/create" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                  Create Contest
                </Link>
                <Link href={`/profile/${profile.username}`} className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                  Profile
                </Link>
                {profile.role === 'admin' && (
                  <Link href="/admin" className="block px-4 py-2 text-purple-400 hover:text-purple-300 hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                  Log In
                </Link>
                <Link href="/signup" className="block px-4 py-2 text-green-400 hover:text-green-300 hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setMobileOpen(false)}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
