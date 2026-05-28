-- Track digital AMOE requests to enforce one-per-user-per-day limit
CREATE TABLE IF NOT EXISTS amoe_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'digital' CHECK (method IN ('digital', 'mail')),
  sweeps_awarded integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS amoe_requests_user_id_idx ON amoe_requests(user_id);
CREATE INDEX IF NOT EXISTS amoe_requests_created_at_idx ON amoe_requests(created_at);
