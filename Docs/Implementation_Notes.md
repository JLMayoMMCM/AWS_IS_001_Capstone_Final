# Implementation Notes

**Project:** CloudCampus — Student Organization Website
**Status:** MVP complete — 2026-05-22
**Companion to:** SRS v1.0, AWS Feasibility Framework v3, Wireframe Design Guide

This document records how the implemented MVP relates to the requirements
baseline. The SRS, Feasibility Framework and Wireframe Guide remain the
specification of record; this note captures the decisions, additions and
schema evolution that occurred during build so the three are not read as
exhaustive of the delivered system.

---

## 1. Scope delivered

Every functional area in SRS §3.2 is implemented: authentication and roles,
the public site, the members' area, the officer event-approval workflow, and
the admin suite. The AWS data layer in FEAS §3 is live — RDS PostgreSQL and
S3, reached through `lib/db.ts` and `lib/s3.ts`.

## 2. Capabilities added during implementation

These extend the SRS §3.2 baseline; they are consistent with its intent but
were specified at build time rather than in v1.0.

| Area | Addition |
|------|----------|
| Officers | Admin assignment of members to positions for a term; add/remove of positions; ended terms retained as history. |
| Resources | In-browser preview (PDF/image); rename and file-replace, not only create/delete. |
| Forms | An admin CRUD page for form links; live Google/Microsoft embeds via pasted embed HTML. |
| Members | Per-member admin actions — edit details, reset password, activate/deactivate (status + login together). |
| Content | Editable organization profile (name, tagline, About, term, contact) — formerly a code constant. |
| Categories | A single admin UI managing every lookup vocabulary. |
| Media | Cover images for blogs, events and projects; image/link attachments on blogs and projects. |
| Members | New `For Renewal` member status alongside Active / Inactive / Alumni. |

## 3. Database (SRS §3.5)

The schema is a single consolidated migration, `0001_initial_schema.sql`.
Beyond the SRS §3.5 logical model it:

- **Normalizes vocabularies into lookup tables** — `courses`, `year_levels`,
  `member_statuses`, `form_providers`, `project_categories` (alongside the
  existing `resource_categories` / `officer_positions`). What were free-text
  columns or ENUM types are now foreign keys. Every lookup foreign key uses
  `ON DELETE SET NULL` — removing a vocabulary value clears references rather
  than failing, which is the contract the Categories admin UI depends on.
- **Adds `site_settings`** — a single-row table holding the editable
  organization profile (§2 above).

Required reference data (year levels, member statuses, form providers,
project categories, the organization profile) is seeded inline by the
migrations themselves. The placeholder `seed.sql` was removed during the
V2.1 cleanup pass — the first admin is created with
`node scripts/_create-admin.mjs <email> <password>`. Migrations are ordered
and immutable (NFR-MNT-02); `npm run db:check` verifies the live schema
against the application code.

## 4. Conventions adopted

- **AWS resource naming** — `cloudcampus-aws-<service>` (see DEPLOYMENT.md).
- **S3 object keys** — one documented layout: `resources/<uuid>.<ext>`,
  `members/<memberId>/avatar-<uuid>.<ext>`, `covers/<uuid>.<ext>`,
  `attachments/<uuid>.<ext>`. The database stores only the key; the browser
  reaches objects through short-lived pre-signed URLs.
- **UI (WIRE)** — shadcn/ui on the wireframe's neutral tokens; corner radii
  follow the standard shadcn preset. Every save/confirm/destructive action is
  gated by a confirmation dialog.
- **Auth** — optimistic role gate in `proxy.ts`; per-page and per-route
  enforcement is authoritative (SRS §3.2 access rules).

## 5. Known follow-ups

Tracked but outside the MVP:

- Post-deployment hardening — RDS lockdown, IAM role over keys, forced SSL
  (DEPLOYMENT.md "Post-deployment hardening").
- Project submission form does not yet expose a category picker on the public
  side, though the category data model and admin management exist.
- Attachments are set at creation time; there is no post-hoc reorder/edit UI.

---

*Revision history*

| Date | Summary |
|------|---------|
| 2026-05-22 | Initial implementation notes — MVP complete. |
