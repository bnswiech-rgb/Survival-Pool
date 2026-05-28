-- Add pool_type column to pools table.
-- 'free' = Gold Coins prizes only, open to all users including banned-state users.
-- 'cash' = legacy behavior: Sweeps Coins prizes, blocked for users in banned states.

ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS pool_type text NOT NULL DEFAULT 'cash'
  CHECK (pool_type IN ('cash', 'free'));

CREATE INDEX IF NOT EXISTS pools_pool_type_idx ON pools(pool_type);
