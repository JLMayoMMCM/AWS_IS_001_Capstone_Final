-- Add (or reset) an admin account.
--
-- Account:  jlmayo@mcm.edu.ph   role = admin
--
-- HOW TO USE
--   1. Replace __REPLACE_WITH_PASSWORD__ below with the desired plaintext
--      password (keep the single quotes). Optionally edit the full name.
--   2. Run the whole file against the cloudcampus database — in pgAdmin open it
--      and hit Execute, or:
--        psql "$DATABASE_URL" -f db/add-admin.sql
--      Connect as the master user (cloudcampus) or the app user
--      (cloudcampus_app); both have the rights this needs.
--
-- NOTES
--   - The password is bcrypt-hashed in the database via pgcrypto's crypt()
--     with work factor 12 — the same scheme lib/auth.ts verifies. The
--     plaintext is never stored.
--   - Idempotent: re-running resets the password and re-asserts admin/active.
--   - This file is NOT a migration; db:migrate ignores it (it only reads
--     db/migrations/). Do not commit it with a real password filled in.

BEGIN;

WITH params AS (
  SELECT
    'jlmayo@mcm.edu.ph'::citext        AS email,
    '$2a$12$xPRFSjAj.ycbKbKgXOFIDuqaru22Kf9Cb9zBgGSort/MKI9SzNFsS'::text  AS plain_password,   -- <<< EDIT THIS
    'JL Mayo'::text                    AS full_name
),
upsert_user AS (
  INSERT INTO users (email, password_hash, role, is_active)
  SELECT email, crypt(plain_password, gen_salt('bf', 12)), 'admin', TRUE
  FROM params
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        role          = 'admin',
        is_active     = TRUE
  RETURNING id
)
INSERT INTO members (user_id, full_name, contact_email, status_id)
SELECT u.id, p.full_name, p.email,
       (SELECT id FROM member_statuses WHERE name = 'Active' LIMIT 1)
FROM upsert_user u CROSS JOIN params p
ON CONFLICT (user_id) DO UPDATE
  SET full_name     = EXCLUDED.full_name,
      contact_email = EXCLUDED.contact_email;

COMMIT;

-- Verify:
--   SELECT u.email, u.role, u.is_active, m.full_name
--     FROM users u JOIN members m ON m.user_id = u.id
--    WHERE u.email = 'jlmayo@mcm.edu.ph';
