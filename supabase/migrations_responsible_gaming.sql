-- Responsible Gaming: self-exclusion support
-- Run this in Supabase SQL editor

-- Add self-exclusion columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS self_excluded_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS self_exclusion_requested_at timestamptz DEFAULT NULL;

-- Index for efficient lookups on exclusion status
CREATE INDEX IF NOT EXISTS idx_profiles_self_excluded ON profiles (self_excluded_until)
  WHERE self_excluded_until IS NOT NULL;
