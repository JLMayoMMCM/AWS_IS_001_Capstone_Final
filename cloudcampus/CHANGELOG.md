# Changelog

Notable changes to CloudCampus. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [MVP] — 2026-05-22

The MVP consolidates the public site, the member/officer area, the admin
suite, and the AWS data layer (RDS PostgreSQL + S3).

### Added

- **Resource preview** — `/resources/[id]` previews PDFs in an iframe and
  images inline; other types fall back to a download. Download forces an
  attachment; "open in new tab" serves inline.
- **Admin officer assignment** — assign members to officer positions for a
  school year and end terms; removed officers are kept as history. Officer
  positions can be added and removed.
- **Resource editing** — each resource can be renamed (title, description,
  category, visibility) or have its file replaced; the superseded S3 object
  is deleted.
- **Admin Forms manager** — `/admin/forms` adds, edits and removes form links.
- **Member administration** — a per-row actions menu (Edit, Reset password,
  Promote/Revoke admin, Deactivate/Reactivate) and an edit-details modal.
- **Categories manager** — `/admin/categories` is a CRUD UI for every lookup
  table (courses, year levels, resource/project categories, member statuses,
  form providers, officer positions).
- **Editable site content** — `/admin/content` edits the organization name,
  tagline, About copy, term and contact details (previously a code constant).
- **Embedded forms** — the public Forms page renders the live Google/Microsoft
  form in an iframe; admins paste the provider's `<iframe>` embed HTML.
- **Cover images** — blog posts, events and projects can carry an uploaded
  cover image, shown on cards and detail pages.
- **Attachments** — blog posts and projects can include image and link
  attachments, shown on their detail pages.
- **Project categories** — projects can be filed under a managed category.
- **Officer approvals access** — an "Approvals" nav link and an Events-page
  button surface the existing event-approval queue to officers.
- **Blog entry point** — a "Write a post" button on the Blog page.
- **Confirmation modals** — every save / submit / approve / destructive
  action is gated by a confirmation dialog.
- `npm run db:check` — read-only verification that the live schema matches
  the application code.

### Changed

- **Database normalized** — free-text and ENUM columns (course, year level,
  member status, form provider) became lookup tables with `ON DELETE SET
  NULL` foreign keys; projects gained a category.
- **Corner radii** aligned to the standard shadcn preset.
- **S3 object keys** follow one documented convention
  (`resources/`, `members/<id>/`, `covers/`, `attachments/`).
- "Open in a new tab" on the Forms page uses the form's share URL.
- Buttons, links and clickable rows received consistent hover and
  keyboard-focus styling.

### Fixed

- Stale or replaced S3 objects are now deleted (resource replace/delete,
  profile-photo change, abandoned uploads) instead of being orphaned.
- CSP `frame-src` allows `docs.google.com` and `*.cloud.microsoft` so
  Google and the newer Microsoft Forms host embed correctly.
- Dropdown-then-dialog focus/pointer-lock issues resolved with
  non-modal menus and confirmation dialogs.

### Database

The schema is a single consolidated migration, `0001_initial_schema.sql` —
the base tables plus the normalized lookup tables (`courses`, `year_levels`,
`member_statuses`, `form_providers`, `project_categories`) and the editable
`site_settings` table, with required reference data seeded in place.
