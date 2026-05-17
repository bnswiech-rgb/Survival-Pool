import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function calculatePrizePool(entryFeeCents: number, paidEntries: number, rakePercentage: number) {
  const grossPot = entryFeeCents * paidEntries;
  const platformFee = Math.round(grossPot * (rakePercentage / 100));
  const netPrizePool = grossPot - platformFee;
  return { grossPot, platformFee, netPrizePool };
}

export function formatOdds(americanOdds: number): string {
  return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': case 'advanced': case 'winner': case 'won': return 'text-green-400';
    case 'eliminated': case 'lost': return 'text-red-400';
    case 'pending': return 'text-yellow-400';
    case 'push': case 'void': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'active': case 'advanced': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'eliminated': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'winner': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'upcoming': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'completed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export function timeUntil(dateString: string): string {
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getContestFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    classic: 'Classic Survival',
    lives: 'Lives Mode',
    first_to_x: 'First To X Wins',
    best_record: 'Best Record',
    streak_race: 'Streak Race',
    team_battle: 'Team Battle',
  };
  return labels[format] || format;
}

export function getParticipantBadge(participant: any, pool: any): string {
  if (participant.status === 'winner') return '🏆 Winner';
  if (participant.status === 'eliminated') return '❌ Eliminated';
  if (pool.contest_format === 'lives') {
    if (participant.lives_remaining === 1) return '⚠️ 1 Life Left';
    return `💚 ${participant.lives_remaining} Lives`;
  }
  if (pool.contest_format === 'streak_race') {
    if (participant.current_streak >= 3) return '🔥 On Fire';
    if (participant.current_streak > 0) return `🎯 ${participant.current_streak} Streak`;
  }
  if (pool.contest_format === 'first_to_x') {
    const winsNeeded = pool.target_wins - participant.wins;
    if (winsNeeded === 1) return '⚡ One Win Away';
  }
  return '✅ Alive';
}
