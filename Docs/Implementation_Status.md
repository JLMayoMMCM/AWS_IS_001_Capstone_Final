# CloudCampus — Implementation Status

A point-in-time inventory of every V2 and V2.1 ask, with whether it landed and
where to find it. Sister docs:
[`V2_Implementation_Plan.md`](./V2_Implementation_Plan.md),
[`V2.1_Implementation_Plan.md`](./V2.1_Implementation_Plan.md).

Legend: ✅ implemented · 🟡 partial · ⏸ deferred · ❌ not implemented

---

## V2 — sprint foundations

| # | Item | Status | Notes |
|---|---|---|---|
| 0.1 | School-year entity (`school_years` table) | ✅ | Migration 0002. |
| 0.2 | `school_year_id` on officers + members | ✅ | Migration 0002, with the term-label sync trigger. |
| 0.3 | Membership history table | ✅ | `member_school_years`, migration 0002. |
| 0.4 | Single-incumbent officer rule | 🟡 → ✅ in V2.1 | V2 added `is_singleton`; **V2.1 replaced it with `max_incumbents`** so any position can have an integer cap. |
| 1 | Public registration + admin approval | ✅ | `/register`, `/admin/registrations`, `registration_requests` table. Email unique across active users + non-rejected requests. |
| 2 | Officer history, school-year admin | ✅ | `/admin/school-years` + officer-assignment dialog scopes to the current SY. |
| 3 | Forgot-password system | ✅ | `/forgot-password`, `/reset-password`, `password_reset_tokens`. Email sent via SMTP (V2.1 §4) once `smtp_email` / `smtp_pass` are set; falls back to stdout. |
| 4 | Announcements (officers only) | ✅ | `/announcements`, admin authoring page, `announcement_dismissals`, banner component. |
| 5 | Push notifications (Web Push / VAPID + outbox) | ❌ reverted | Built then removed at user's request. Tables dropped in the V2.1 cleanup. |
| 6 | Blog approval queue | ✅ | `/admin/blogs/approval` + `/api/admin/blogs/[id]/status`. |
| 7 | Officer singleton rule (President/VP/Sec) | superseded by V2.1 §0.1 | See V2.1 multi-incumbent below. |
| 8 | Full-width / full-page UI pass | 🟡 | Public layout uses a wide container; admin tables still inside `max-w-*` shells. Not blocking. |

---

## V2.1 — editing, approval rework, polish

### Phase 0 — schema (migration `0003_v2_1_editing_and_approval.sql`)

| # | Item | Status |
|---|---|---|
| 0.1 | Multi-incumbent positions (`max_incumbents`) + cap trigger | ✅ |
| 0.2 | 2/3-majority event approval + `revision_requested` decision | ✅ |
| 0.3 | `edited_at` / `previous_published_at` on blogs / projects / events | ✅ |
| 0.4 | Unique student-id across non-rejected registration requests | ✅ |
| 0.5 | Date-only announcement timestamps | ✅ |
| 0.6 | Drop `site_settings.term` (term derived from SY) | ✅ |
| 0.7 | `projects.published_url` | ✅ |

### Phase 1 — edit + re-approval

| Item | Status | Where |
|---|---|---|
| Author / admin can edit own blog | ✅ | `/blogs/[slug]/edit`, `PATCH /api/blogs/[id]` |
| Author / admin can edit own event | ✅ | `/events/[slug]/edit`, `PATCH /api/events/[id]` |
| Author / admin can edit own project | ✅ | `/projects/[id]/edit`, `PATCH /api/projects/[id]` |
| Save → flip status back to `pending` | ✅ | `updateBlog/Event/Project` in `lib/queries.ts` |
| Event edit also wipes prior officer votes | ✅ | `DELETE FROM event_approvals` in `updateEvent` |
| Rejected items are uneditable | ✅ | `EditNotAllowedError` + PATCH guard + redirect from edit page |
| Public listing filters to `status='approved'` | ✅ | `listBlogs` / `listEvents` / `listProjects` |
| Author sees own non-approved item on the detail page | ✅ | `/blogs/[slug]`, `/events/[slug]`, `/projects/[id]` |
| "Your drafts" section on listing pages | ⏸ | Queries (`getBlogs/Events/ProjectsByAuthor`) exist; the UI section on each listing page is not added yet. |

### Phase 2 — inline approval

| Item | Status | Where |
|---|---|---|
| Reusable `<ApprovalPanel />` component | ✅ | `components/cloudcampus/approval-panel.tsx` |
| Wired on `/blogs/[slug]`, `/events/[slug]`, `/projects/[id]` | ✅ | Visible to officers when status is `pending`. |
| Officers can approve / reject / request revision (events) | ✅ | Posts to `/api/events/[id]/approvals` or `/api/admin/blogs/[id]/status` / `/api/admin/projects/[id]/status`. |
| Blog + project status endpoints relaxed to officer+ | ✅ | Previously admin-only. |

### Phase 3 — course combobox

| Item | Status |
|---|---|
| `<CourseCombobox />` (searchable, strict-match) | ✅ — `components/cloudcampus/course-combobox.tsx` |
| Wired into `profile-form.tsx` | ✅ |
| Wired into `register-form.tsx` (public registration) | ⏸ |
| Wired into `registrations-admin-view.tsx` (admin queue) | ⏸ |
| `Member.courseId` exposed; API accepts `courseId` | ✅ |

### Phase 4 — email change with verification

| Item | Status | Where |
|---|---|---|
| `email_change_requests` table | ✅ | Migration 0004. |
| SMTP delivery (Nodemailer + Gmail) | ✅ | `lib/email.ts`; `smtp_email` / `smtp_pass` env vars, stdout fallback. |
| `POST /api/profile/email/initiate` (re-auth + send) | ✅ |  |
| `POST /api/profile/email/confirm` (consume token) | ✅ |  |
| `/profile/change-email/confirm?token=…` page | ✅ |  |
| "Change email" UI on profile | ✅ | New inline form on `profile-form.tsx`. |
| "Use account email for contact email" button | ✅ |  |
| Restored `sendPasswordResetEmail` on forgot-password | ✅ |  |
| Restored `sendRegistrationDecisionEmail` on approve / reject | ✅ |  |

### Phase 5 — members + registration cleanup

| Item | Status |
|---|---|
| Move "+ Register member" from `/admin/members` to `/admin/registrations` | ⏸ |
| Add full member columns (name, student ID, course, year, status, SY, contact, joined, last active) to admin table | ⏸ |
| Email unique across active users + non-rejected requests | ✅ — already enforced in V2 |
| Student ID unique across members + non-rejected requests | ✅ — V2.1 §0.4 |

### Phase 6 — site settings + announcement polish

| Item | Status |
|---|---|
| `/admin/content`: term editor → read-only school-year display | ✅ |
| `/admin/school-years`: integer-only start / end year inputs | ✅ — already integer-only in V2 |
| Announcement form: `datetime-local` → `date` | ✅ |
| Announcement schema columns converted to `DATE` | ✅ — V2.1 §0.5 |

### Phase 7 — QOL

| Item | Status |
|---|---|
| Logout does a full reload (drops cached role state) | ✅ — `window.location.assign("/")` in all 3 sign-out paths |
| Button hover responsiveness | ✅ — verified in `components/ui/button.tsx` (already has `transition-all` + per-variant hover) |
| Page-enter animation on public layout | ✅ — `motion-safe:animate-in motion-safe:fade-in-50` on `<main>` |

### Other requested items

| Item | Status |
|---|---|
| Add edit position (admin UI for `officer_positions`) | ⏸ |
| Refresh after logout | ✅ |
| Database updates for required changes | ✅ — migrations 0003 + 0004 applied to RDS |

---

## Cross-cutting infrastructure

| Item | Status |
|---|---|
| Multi-incumbent positions (UI + DB) | ✅ — capacity shown as `(filled/cap)` in officer-assign dialog |
| 2/3-majority event approval + revision-request flow | ✅ |
| Deferred-upload S3 (`uploadFile` helper) | ✅ — `components/cloudcampus/file-upload.tsx` |
| S3 IAM-credentialed access from Amplify SSR | ✅ — `cloudcampus-aws-amplify-role` |
| RDS IAM-authenticated app connection (`DATABASE_IAM_AUTH=true`) | ✅ |
| Gmail SMTP delivery | ✅ |
| Notification system (push + outbox) | ❌ — reverted |
| Route 53 hosted zone for `amazonlc-mmcm.space` | ❌ — reverted |

---

## What's deferred and why

- **"Your drafts" listing-page sections** — needs three small UI sections plus
  visibility consideration; not breaking, just convenience.
- **Course combobox on the register form + registrations admin** — same swap as
  profile-form; ~30 min.
- **Admin Members refactor + full columns / move "Register member"** —
  mechanical UI work; ~1 turn.
- **Edit position dialog** — needs a new admin sub-page for
  `officer_positions` with name / order / `is_approver` / `max_incumbents`.

None of the deferred items block any of the in-place flows. They're listed in
priority order in the V2.1 plan §Deferred.

---

## What's not coming back

- Push notifications / web-push / outbox / notification preferences.
- Route 53 hosting for `amazonlc-mmcm.space` (Vercel still owns the domain).
- The placeholder `db/seed.sql` (removed in the V2.1 cleanup; lookup data is
  inlined into the migrations themselves).
