-- =====================================================
-- COIN SYSTEM MIGRATION
-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- =====================================================

-- 1. Add coin columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gold_coins integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS sweeps_coins integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS lifetime_gold_purchased integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_daily_bonus_at timestamptz DEFAULT NULL;

-- 2. Add coin entry fee to pools (separate from cash entry_fee_cents)
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS entry_fee_coins integer DEFAULT 0 NOT NULL;

-- 3. Coin transactions ledger
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gold_delta integer NOT NULL DEFAULT 0,   -- positive = credit, negative = debit
  sweeps_delta integer NOT NULL DEFAULT 0,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'purchase',       -- bought a pack
    'pool_entry',     -- spent coins to enter a pool
    'pool_win',       -- won sweeps coins from a pool
    'daily_bonus',    -- free daily coins
    'admin_grant',    -- admin manually granted
    'refund'          -- refunded coins
  )),
  pool_id uuid REFERENCES pools(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS coin_transactions_user_id_idx ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS coin_transactions_created_at_idx ON coin_transactions(created_at DESC);

-- 4. Row Level Security for coin_transactions
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY "Users can view own coin transactions"
  ON coin_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (backend) can insert/update/delete
-- (no INSERT policy for authenticated role = only service key can write)
