ALTER TABLE pools ADD COLUMN IF NOT EXISTS team_formation text CHECK (team_formation IN ('invite', 'random'));
