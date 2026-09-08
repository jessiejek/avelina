-- Web push (Firebase Cloud Messaging) device tokens.
-- One row per browser/device that has granted notification permission.
-- A single user signed in on 3 devices => 3 rows, all notified.

CREATE TABLE IF NOT EXISTS push_tokens (
  token       text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'customer',  -- 'admin' | 'customer' (snapshot of users.role at registration)
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);
CREATE INDEX IF NOT EXISTS push_tokens_role_idx ON push_tokens (role);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON push_tokens;
CREATE POLICY "allow_all" ON push_tokens FOR ALL USING (true) WITH CHECK (true);
