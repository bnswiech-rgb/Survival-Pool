-- Add invite_code to teams table for team-invite flow
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;
