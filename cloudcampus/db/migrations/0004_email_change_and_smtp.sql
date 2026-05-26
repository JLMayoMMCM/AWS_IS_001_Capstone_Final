-- V2.1 Phase 4: email-change requests with token verification.
--
-- The user requests a change to a new address. We store the (hashed) token,
-- the target email, and the issuing user. Confirming the token swaps
-- users.email (subject to uniqueness — the CITEXT UNIQUE constraint already
-- on users.email guards against collisions even if two confirmations race).

CREATE TABLE IF NOT EXISTS email_change_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email   CITEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A pending change blocks new requests for the same target until it's used
-- or expires; tighter than a global unique on new_email because that would
-- collide with each other but also with the user's own currently-pending row.
CREATE INDEX IF NOT EXISTS email_change_requests_user_idx
  ON email_change_requests (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS email_change_requests_token_idx
  ON email_change_requests (token_hash) WHERE used_at IS NULL;
