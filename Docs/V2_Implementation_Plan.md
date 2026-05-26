# CloudCampus V2 — Implementation Plan

**Baseline:** V1.1 (IAM integration, commit `520d5c0`)
**Target:** V2 — public registration, school-year lifecycle, password recovery, announcements, push notifications, blog approvals, officer-role rules, and UI refinements.
**Companion to:** `CHANGELOG.md`, `db/migrations/0001_initial_schema.sql`, SRS v1.1.

The plan is grouped by feature, then by layer (DB → API → server pages → client UI → cross-cutting). Each feature lists the touched files, new files, and the order in which they should land.

---

## 0. Cross-cutting foundations (do first)

These change the data model that almost every later feature depends on, so they ship as one migration before anything else.

### 0.1 School-year entity

New lookup table `school_years` becomes the spine for officer terms, member rosters, announcements, and history.

```sql
-- db/migrations/0002_v2_school_year_and_features.sql
CREATE TABLE school_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_year  INTEGER NOT NULL,            -- e.g. 2026
  end_year    INTEGER NOT NULL,            -- e.g. 2027
  label       TEXT GENERATED ALWAYS AS (start_year::text || '-' || end_year::text) STORED,
  starts_on   DATE NOT NULL,               -- effective start (e.g. 2026-08-01)
  ends_on     DATE NOT NULL,               -- effective end   (e.g. 2027-07-31)
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_years_year_order CHECK (end_year = start_year + 1),
  CONSTRAINT school_years_date_order CHECK (ends_on > starts_on),
  CONSTRAINT school_years_unique_range UNIQUE (start_year, end_year)
);

-- Exactly one current school year at a time (deferred so swaps are atomic).
CREATE UNIQUE INDEX school_years_one_current
  ON school_years (is_current) WHERE is_current;
```

Seed one row from the current `site_settings.term` value.

### 0.2 Wire `school_year_id` into officers and members

- `officers`: add `school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT`. **Keep** the existing `term_label` / `term_start` / `term_end` columns as denormalized labels — the SY foreign key is the source of truth, but the inline fields stay readable in `psql`, audit dumps, and any downstream report that hasn't been re-pointed at the join. The trigger that maintains them (on insert/update) is added in this migration.
- `members`: add `school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL`. Captures the SY in which a member was admitted.

### 0.3 Membership-history table

`members` is the current directory. History is the audit trail of which members were on the roster in which SY.

```sql
CREATE TABLE member_school_years (
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  status_id      UUID REFERENCES member_statuses(id) ON DELETE SET NULL,
  year_level_id  UUID REFERENCES year_levels(id) ON DELETE SET NULL,
  PRIMARY KEY (member_id, school_year_id)
);
```

Officer history already exists implicitly (`officers.is_current = FALSE` rows). After 0.2, officers naturally key by `school_year_id` — the existing rollover logic just sets `is_current = FALSE` on the outgoing SY.

### 0.4 DR-NEW: Single-incumbent positions

Add a per-position flag and enforce uniqueness per SY at the DB layer (defense-in-depth — the API will also pre-check).

```sql
ALTER TABLE officer_positions
  ADD COLUMN is_singleton BOOLEAN NOT NULL DEFAULT FALSE;

-- Pre-seed: President, Vice President, Secretary are singletons.
UPDATE officer_positions SET is_singleton = TRUE
 WHERE name IN ('President', 'Vice President', 'Secretary');

CREATE UNIQUE INDEX officers_singleton_per_sy
  ON officers (position_id, school_year_id)
  WHERE is_current;  -- only the active term is constrained
```

A trigger gates inserts so a non-singleton position can have many officers and a singleton cannot:

```sql
CREATE OR REPLACE FUNCTION enforce_singleton_position() ...
```

### 0.5 Files touched in this phase

- **New:** `db/migrations/0002_v2_school_year_and_features.sql`
- **Edit:** `lib/queries.ts` — `listOfficers`, `listPositions`, `listMembers` must join `school_years` and project `schoolYear: { id, label, isCurrent }`.
- **Edit:** `lib/types.ts` — add `SchoolYear`, extend `OfficerSummary`, `Member`, `Position`.
- **Edit:** `lib/org.ts` — `pastTerms` derived from `school_years` instead of a hardcoded array.

---

## 1. Public registration + admin approval

### Data

```sql
CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE registration_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  student_id      TEXT,
  course_id       UUID REFERENCES courses(id) ON DELETE SET NULL,
  year_level_id   UUID REFERENCES year_levels(id) ON DELETE SET NULL,
  school_year_id  UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  status          registration_status NOT NULL DEFAULT 'pending',
  rejection_note  TEXT,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX registration_requests_status_idx
  ON registration_requests (status, created_at DESC);
```

The hash is stored at submit time so the admin's "approve" action just promotes the row into `users` + `members` without ever needing the cleartext.

### Routes

| Layer       | Path | Purpose |
|-------------|------|---------|
| Page        | `app/(public)/register/page.tsx`, `register-form.tsx` | The public form (email, password, full name, course, year). |
| API         | `app/api/auth/register/route.ts` | POST → insert into `registration_requests`. Re-uses bcrypt + the same rate-limit guard as `/api/auth/login`. |
| Page        | `app/(admin)/admin/registrations/page.tsx`, `registrations-admin-view.tsx` | Admin queue: approve, reject (with note), bulk approve. |
| API         | `app/api/admin/registrations/route.ts`, `[id]/route.ts` | List + per-row approve/reject. Approve = `INSERT INTO users + members` inside a transaction and mark the request `approved`. |

Add a `/register` link to `login-form.tsx` ("Don't have an account? Apply for membership").

### Validation rules

- Email must be unique across `users.email` AND non-rejected `registration_requests.email`.
- A rejected email can re-apply (status filter).
- Rate-limit: 3 registrations/hour/IP via `lib/rate-limit.ts`.

---

## 2. School-year system + officer/member history

### Admin UI

- New `app/(admin)/admin/school-years/page.tsx` — list, create (start year only — end is computed), set current, archive.
- Rolling over the current SY:
  1. Set outgoing SY `is_current = FALSE`.
  2. Set incoming SY `is_current = TRUE`.
  3. Run `UPDATE officers SET is_current = FALSE WHERE school_year_id = <outgoing>`.
  4. Snapshot the current roster into `member_school_years` for the outgoing SY.

Wrap the whole rollover in one transaction; it is invoked from a "Promote to current" button with a confirm dialog (the codebase already standardizes on `ConfirmDialog`).

### History views

- `app/(public)/officers/page.tsx` already has an SY selector backed by `pastTerms`. After 0.2 it pulls from `school_years` and queries officers filtered by `school_year_id`.
- New `app/(public)/members/history/page.tsx` (or a tab on the existing members page) shows the roster for a selected SY by joining `member_school_years`.
- `getOrg().term` is replaced by `getCurrentSchoolYear().label`; the admin Content page loses the free-text term editor.

### Files touched

- **New:** `app/(admin)/admin/school-years/{page,school-years-admin-view}.tsx`, `app/api/admin/school-years/route.ts`, `[id]/route.ts`.
- **Edit:** `app/(admin)/admin/officers/officers-admin-view.tsx` — the "Term" column reads the SY label; the assign-officer dialog defaults to the current SY.
- **Edit:** `app/api/admin/officers/route.ts` — assignment requires `school_year_id` and runs the singleton check from 0.4.
- **Edit:** `lib/queries.ts` — `listOfficers({ schoolYearId })`, `getCurrentSchoolYear()`, `listSchoolYears()`, `listMembersForSchoolYear(sy)`.
- **Edit:** `lib/org.ts` — `pastTerms` removed; consumers query the DB.

---

## 3. Forgot-password system

### Data

```sql
CREATE TABLE password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,                  -- sha256 of the emailed token
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id, expires_at DESC);
```

Only the hash is stored; the cleartext goes only into the email.

### Routes

| Layer | Path |
|-------|------|
| Page  | `app/(public)/forgot-password/{page,forgot-form}.tsx` |
| Page  | `app/(public)/reset-password/{page,reset-form}.tsx` (reads `?token=…`) |
| API   | `app/api/auth/forgot-password/route.ts` — accepts an email, always returns 200 (don't leak account existence), generates a 32-byte token, hashes + stores it, sends the email. |
| API   | `app/api/auth/reset-password/route.ts` — accepts `{ token, new_password }`, validates not-used + not-expired, updates `users.password_hash`, marks `used_at`. |

### Email delivery

Use Amazon SES (already aligned with the AWS posture in `Docs/AWS_Feasibility_Framework.md`). Add `lib/email.ts` with `sendPasswordResetEmail({ to, link })`. The from-address and SES region come from env vars (`SES_FROM`, `AWS_REGION`). For local dev, log the link to stdout when `SES_FROM` is unset — keeps the loop tight without forcing SES creds in dev.

### UI

Replace the "Forgot your password? Contact an officer" line in `login-form.tsx:90-96` with `<Link href="/forgot-password">…</Link>`.

---

## 4. Announcements (officers only)

### Data

```sql
CREATE TYPE announcement_level      AS ENUM ('normal', 'elevated', 'critical');
CREATE TYPE announcement_audience   AS ENUM ('public', 'members', 'officers');

CREATE TABLE announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  level         announcement_level    NOT NULL DEFAULT 'normal',
  audience      announcement_audience NOT NULL DEFAULT 'members',
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,              -- when to stop showing it
  pinned_until  TIMESTAMPTZ,              -- promote above feed until this date
  author_id     UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  push_sent_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT announcements_expires_after_published CHECK (expires_at IS NULL OR expires_at > published_at)
);
CREATE INDEX announcements_feed_idx
  ON announcements (audience, published_at DESC) WHERE expires_at IS NULL OR expires_at > now();
```

### Display rules (date-centric)

A query helper `listAnnouncementsForViewer(session, now)` returns the items where:
- `audience = 'public'` OR (`audience = 'members'` and the session has `member+`) OR (`audience = 'officers'` and `officer+`),
- `published_at <= now` AND (`expires_at IS NULL` OR `expires_at > now`),
- ordered by: pinned-and-still-valid first, then `level` (critical → elevated → normal), then `published_at DESC`.

### Routes

| Layer | Path |
|-------|------|
| Page (public) | `app/(public)/announcements/page.tsx` |
| Page (officer authoring) | `app/(admin)/admin/announcements/{page,announcements-admin-view}.tsx` — gated by `requireRole('officer')`. |
| API | `app/api/admin/announcements/route.ts`, `[id]/route.ts` |
| Component | `components/cloudcampus/announcement-banner.tsx` — renders critical/elevated items at the top of the layout for in-audience viewers. |

Embed the banner in `app/(public)/layout.tsx` so it appears site-wide.

---

## 5. Push notifications

### Data

```sql
CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT NOT NULL,                 -- Web Push keys
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_events    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_forms     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_blogs     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_announcements BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_outbox (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('event','form','blog','announcement')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  link         TEXT,
  sent_at      TIMESTAMPTZ,
  failure      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_pending_idx
  ON notification_outbox (sent_at) WHERE sent_at IS NULL;
```

### Transport

Web Push (VAPID). Reasons over SNS/APNs: it works for the browser-first audience the SRS targets, requires no app-store presence, and falls back gracefully when the user denies permission.

- **New:** `public/service-worker.js`, `lib/push.ts` (uses the `web-push` npm package).
- **New:** `app/api/notifications/subscribe/route.ts`, `unsubscribe/route.ts`, `preferences/route.ts`.
- **Env:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### Dispatch points

After a successful approval transaction (so we never push for content that never went live):

| Trigger | Channel | Audience query |
|---------|---------|----------------|
| Event status → `approved` | `event` | All members opted in (`notify_events`). |
| `form_links` row inserted with `visibility='public'` | `form` | Members + public subscribers opted in. |
| Blog status → `approved` | `blog` | Members opted in. |
| Announcement insert/update | `announcement` | Honor the announcement's audience and `notify_announcements`. |

Implementation: add `enqueueNotification(channel, payload, audienceFilter)` to `lib/push.ts`. Call sites are in the existing approval routes (`app/api/admin/blogs/...`, `app/api/admin/events/...`, etc.). The outbox is drained synchronously after enqueue in V2 — keep it simple — but the table is structured so a future cron worker can take over without code changes.

### UI

- **New:** `app/(public)/profile/notifications/page.tsx` (or a section on the existing profile page) — per-channel toggles + a "Enable push on this device" button that calls `Notification.requestPermission` and registers the subscription.
- The service worker handles `push` events and posts to the OS notification surface.

---

## 6. Blog approvals

The schema already has `blogs.status = 'pending'` (see `0001_initial_schema.sql:190`). V1 implemented event approvals only — blogs ship as `pending` but no admin/officer screen consumes them.

### Routes

- **New:** `app/(admin)/admin/blogs/approval/page.tsx` (the directory already exists — empty in V1). Officer-level access.
- **New:** `app/api/admin/blogs/[id]/approve/route.ts`, `reject/route.ts`. On approve: set `status='approved'`, `approved_by`, `approved_at`, `published_at`. On reject: set `status='rejected'` and require a comment (mirrors event-rejection logic).
- **Edit:** `app/(public)/blogs/blogs-view.tsx` — author sees their own pending posts with a "Pending review" badge.
- **Dispatch:** the approval route enqueues a `blog` push to the audience defined by the post's `visibility`.

---

## 7. Officer rules (President / VP / Secretary singletons)

Already structurally enforced by 0.4. Add UX on top:

- `officers-admin-view.tsx`: when an admin opens the assign dialog and picks a singleton position, the position dropdown shows `(occupied — Jane Doe)` and the submit button stays disabled until they end the existing term first.
- `app/api/admin/officers/route.ts`: pre-flight check returns 409 with a structured `{ error, currentHolder: {...} }` so the dialog can show the conflict.
- Categories admin (`/admin/categories`) exposes `is_singleton` as a checkbox per position so future bylaws changes don't need code.

---

## 8. UI refinement — full-width / full-page

Audit pass over the global layout. Current layouts use a centered `max-w-*` container; V2 lets each route opt into full-bleed.

- **Edit:** `app/(public)/layout.tsx` and `app/(admin)/layout.tsx` — replace the hardcoded `container mx-auto` wrapper with a slot-driven container. Pages that benefit from full width (`/blogs`, `/projects`, admin tables) opt in via a `full-bleed` flag.
- **Edit:** every admin table page — switch the outer wrapper from `max-w-5xl` to `w-full`. Tables already scroll horizontally on overflow, so widening the viewport is a pure win.
- **Edit:** `components/cloudcampus/page-header.tsx` — tighten the spacing so titles don't look stranded at full width.

Run the dev server and visit the redesigned pages at 1280, 1440, 1920 widths before merging — the `run` skill is set up for this.

---

## Migration order

1. `0002_v2_school_year_and_features.sql` — sections 0, 1, 2 schema, 3 schema, 4 schema, 5 schema all bundled (one round-trip to RDS).
2. Backfill: seed one `school_years` row from `site_settings.term`; backfill `officers.school_year_id` from `term_label`; backfill `members.school_year_id` for active rows.
3. **Retain** the legacy `officers.term_label/term_start/term_end` columns and `site_settings.term`. The SY foreign key is the source of truth; the inline fields are kept as denormalized labels (cheap human-readable cache, useful in psql/audit dumps and for any external report not yet re-pointed at the join). A trigger keeps them in sync with `school_years` on insert/update of officers.
4. Code rolls out in feature order (1 → 8). Push notifications (5) and blog approvals (6) can be reordered freely; everything else has the dependencies above.

## Out of scope for V2

- SMS / email digests of announcements (push only).
- Cross-organization features (multi-tenant tables).
- Mobile-app push (web push only — no native shell).
- Officer election workflow (the admin still does the assignment manually).

## Verification checklist

- `npm run db:check` passes after migration + backfill.
- A new user can register → admin approves → user signs in.
- A user can reset their password via the email link without contacting an officer.
- An officer can publish a `critical` announcement and members receive a push.
- A blog post submitted by a member becomes visible to the public only after officer approval.
- Assigning a second President for the current SY is rejected by the API (409) AND by the DB (unique index).
- Browsing `/officers?sy=2024-2025` shows the historical roster.
- All admin tables render edge-to-edge at 1920px without horizontal scrollbars on the page body.
