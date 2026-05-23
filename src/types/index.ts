export type UserRole = 'user' | 'admin';
export type PoolStatus = 'upcoming' | 'open' | 'locked' | 'active' | 'completed' | 'canceled';
export type PickType = 'spread' | 'total' | 'moneyline';
export type PickStatus = 'pending' | 'won' | 'lost' | 'push' | 'void';
export type ParticipantStatus = 'active' | 'advanced' | 'eliminated' | 'winner';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'waived';
export type RoundStatus = 'open' | 'locked' | 'grading' | 'completed';
export type ContestFormat = 'classic' | 'lives' | 'first_to_x' | 'best_record' | 'streak_race' | 'team_battle';
export type PushRule = 'advance' | 'eliminate' | 'repeat';
export type AllLoseRule = 'repeat' | 'split' | 'tiebreak';
export type MessageType = 'user' | 'system' | 'pinned';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  role: UserRole;
  wins: number;
  losses: number;
  pushes: number;
  pools_entered: number;
  pools_won: number;
  gold_coins: number;
  sweeps_coins: number;
  lifetime_gold_purchased: number;
  last_daily_bonus_at: string | null;
  created_at: string;
}

export type CoinTransactionType =
  | 'purchase'
  | 'pool_entry'
  | 'pool_win'
  | 'daily_bonus'
  | 'admin_grant'
  | 'refund';

export interface CoinTransaction {
  id: string;
  user_id: string;
  gold_delta: number;
  sweeps_delta: number;
  transaction_type: CoinTransactionType;
  pool_id: string | null;
  stripe_payment_intent_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CoinPack {
  id: string;
  label: string;
  price_cents: number;
  gold_coins: number;
  sweeps_coins: number;
  popular?: boolean;
}

export interface Pool {
  id: string;
  name: string;
  sport: string;
  entry_fee_cents: number;
  entry_fee_coins: number;
  rake_percentage: number;
  max_entries: number | null;
  start_date: string;
  pick_deadline: string;
  round_frequency: 'daily' | 'weekly';
  status: PoolStatus;
  visibility: 'public' | 'private';
  invite_code: string;
  push_rule: PushRule;
  all_lose_rule: AllLoseRule;
  prize_structure: string;
  contest_format: ContestFormat;
  lives_count: number;
  target_wins: number;
  target_streak: number;
  max_losses: number | null;
  contest_duration_rounds: number | null;
  push_resets_streak: boolean;
  tiebreaker_active: boolean;
  team_scoring: string | null;
  team_size: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed
  participant_count?: number;
  alive_count?: number;
  gross_pot?: number;
  platform_fee?: number;
  net_prize_pool?: number;
}

export interface PoolParticipant {
  id: string;
  pool_id: string;
  user_id: string;
  team_id: string | null;
  payment_status: PaymentStatus;
  status: ParticipantStatus;
  lives_remaining: number;
  current_streak: number;
  wins: number;
  losses: number;
  pushes: number;
  rounds_survived: number;
  eliminated_round: number | null;
  prize_amount_cents: number | null;
  joined_at: string;
  profile?: Profile;
}

export interface Round {
  id: string;
  pool_id: string;
  round_number: number;
  deadline: string;
  status: RoundStatus;
  created_at: string;
}

export interface Pick {
  id: string;
  pool_id: string;
  round_id: string;
  user_id: string;
  sport: string;
  league: string | null;
  game: string;
  pick_type: PickType;
  side: string;
  line_value: string;
  american_odds: number;
  game_start_time: string;
  status: PickStatus;
  is_locked: boolean;
  submitted_at: string;
  locked_at: string | null;
  graded_at: string | null;
  profile?: Profile;
}

export interface PoolMessage {
  id: string;
  pool_id: string;
  user_id: string | null;
  message: string | null;
  message_type: MessageType;
  reactions: Record<string, string[]>;
  mentions: string[];
  created_at: string;
  profile?: Profile;
}

export interface Payment {
  id: string;
  pool_id: string;
  user_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  status: string;
  provider: string;
  provider_payment_id: string | null;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  pool_id: string | null;
  user_id: string | null;
  activity_type: string;
  metadata: Record<string, any>;
  created_at: string;
  profile?: Profile;
}

export interface Team {
  id: string;
  pool_id: string;
  name: string;
  captain_id: string | null;
  created_at: string;
}
