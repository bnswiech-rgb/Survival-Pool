-- Add team_size column to pools (number of players per team in team_battle format)
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS team_size integer DEFAULT NULL;
