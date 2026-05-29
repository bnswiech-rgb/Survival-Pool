-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 5000), -- min $50.00 (stored SC)
  payment_method text NOT NULL CHECK (payment_method IN ('paypal', 'venmo', 'check')),
  payment_handle text NOT NULL, -- PayPal email, Venmo @handle, or mailing address
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_id_idx ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx ON withdrawal_requests(status);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Only authenticated users can insert their own requests
CREATE POLICY "Users can insert own withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
