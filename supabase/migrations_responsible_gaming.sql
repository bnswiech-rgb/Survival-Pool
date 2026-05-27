-- Responsible Gaming: self-exclusion + deposit limits
-- Run this in Supabase SQL editor

-- Add self-exclusion columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS self_excluded_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS self_exclusion_requested_at timestamptz DEFAULT NULL;

-- Deposit limit columns
-- daily_deposit_limit_cents: maximum spend per rolling 24h window (NULL = no limit)
-- deposit_limit_set_at: when the limit was last set (cooldown enforcement)
-- deposit_spent_today_cents: running total for current window
-- deposit_window_start: start of the current 24h window
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_deposit_limit_cents integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deposit_limit_set_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deposit_spent_today_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_window_start timestamptz DEFAULT NULL;

-- Index for efficient lookups on exclusion status
CREATE INDEX IF NOT EXISTS idx_profiles_self_excluded ON profiles (self_excluded_until)
  WHERE self_excluded_until IS NOT NULL;
