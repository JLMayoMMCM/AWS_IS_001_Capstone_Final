# Software Requirements Specification

**Project:** Student Organization Website
**Subtitle:** AWS-Hosted Web Platform for Members, Officers, and Public Visitors
**Conforms to:** ISO/IEC/IEEE 29148:2018
**Document Version:** 1.1
**Status:** Implemented (MVP)

---

## Document Control

### Revision History

| Version | Date | Author | Summary of changes |
|---------|------|--------|--------------------|
| 0.1 | Initial | Tech Committee | Feasibility framework drafted (architecture, cost, DB, rules). |
| 0.2 | Iteration 2 | Tech Committee | Members list/detail split. Added projects feature. |
| 0.3 | Iteration 3 | Tech Committee | Added wireframe design guide (shadcn neutral). |
| 0.4 | Iteration 4 | Tech Committee | Added events feature with 3-officer approval, officer role tier. |
| 1.0 | Iteration 5 | Tech Committee | Consolidated SRS per ISO/IEC/IEEE 29148:2018. |
| 1.1 | 2026-05-22 | Tech Committee | MVP implemented. Schema realized in `0001_initial_schema.sql`. Vocabulary tables replaced ENUMs; `site_settings` added; event approval rules moved into Postgres triggers (DR-11, DR-12, DR-13). FR-OFF-05/06/07 reworded to reflect trigger-based enforcement. |

### Approvals

| Role | Name | Signature / Date |
|------|------|------------------|
| Product Owner (President) | ______________________ | ______________________ |
| Technical Lead | ______________________ | ______________________ |
| Faculty Adviser | ______________________ | ______________________ |

### Reference Documents

- **[FEAS]** AWS Feasibility Framework v3 — sister document; covers cost, infra, and rationale.
- **[WIRE]** Wireframe Design Guide — sister document; covers UI tokens and per-page layout.
- **[IEEE-29148]** ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering.
- **[RFC-2119]** Key words for use in RFCs to Indicate Requirement Levels (MUST, SHOULD, MAY).

---

## Contents

1. Introduction
2. References
3. Specific Requirements
   - 3.1 External Interfaces
   - 3.2 Functions
   - 3.3 Usability Requirements
   - 3.4 Performance Requirements
   - 3.5 Logical Database Requirements
   - 3.6 Design Constraints
   - 3.7 Software System Attributes
   - 3.8 Supporting Information
4. Verification
5. Appendices

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for the Student Organization Website, a web application that serves public visitors, members, officers, and administrators of a student organization. The document follows ISO/IEC/IEEE 29148:2018 and is the authoritative source for what the system shall do; it complements the Feasibility Framework (which justifies the choice of AWS services) and the Wireframe Design Guide (which constrains the UI).

The intended audience includes developers implementing the system, the officer team accepting it, faculty advisers reviewing it, and future maintainers handing it off between academic terms.

### 1.2 Scope

#### 1.2.1 Product identification

Name: Student Organization Website (working title). Type: full-stack web application. Deployment target: AWS using Amplify Hosting, RDS for PostgreSQL, and Amazon S3.

#### 1.2.2 What the product does

- Presents the organization to the public: welcome page, officers, blogs, projects, events, and downloadable resources.
- Provides a member-only directory and private content (private blogs, resources, projects, and events).
- Lets officers create and submit events that require approval by three designated officer positions.
- Lets administrators register members and officers, approve blog and project submissions, manage resources and forms, configure officer positions, and view an audit trail of all sensitive actions.
- Embeds external Google Forms and Microsoft Forms so visitors and members can submit information without leaving the site.

#### 1.2.3 What the product does NOT do

- Does not host video conferencing, chat, or real-time messaging.
- Does not process payments, donations, or e-commerce transactions.
- Does not provide self-service signup; all accounts are admin-created.
- Does not replace the organization's official records system; the system is informational and operational, not legally authoritative.
- Does not provide email or SMS notifications in v1.0 (a candidate for a later release).

#### 1.2.4 Objectives and benefits

- Reduce the friction of finding officer contact info, event schedules, and shared resources.
- Make recruitment and engagement easier by surfacing projects and events to the public.
- Give officers a controlled, auditable place to publish events without going through ad-hoc messaging channels.
- Survive officer turnover with one canonical knowledge source (the schema, the audit log, this SRS).

### 1.3 Product Perspective

The system is a single Next.js application deployed on AWS Amplify Hosting. It uses one Amazon RDS PostgreSQL database for all structured data and one Amazon S3 bucket for binary assets (member photos, blog covers, project screenshots, event banners, downloadable resources). External services consumed by the system are limited to Google Forms and Microsoft Forms (read-only embeds). No other third-party services are required in v1.0.

The user interacts with the system through any modern web browser on desktop or mobile. There is no native mobile client; the responsive web UI serves both.

### 1.4 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| Guest | An unauthenticated visitor. Sees only public content. |
| Member | An authenticated user with role='member' in the users table. |
| Officer | A member who currently holds a row in the officers table with is_current = TRUE. |
| Approver Officer | An officer whose position has is_approver = TRUE. There must be exactly three. |
| Admin | A member with role='admin' in the users table. |
| RBAC | Role-Based Access Control. |
| RDS | Amazon Relational Database Service. |
| S3 | Amazon Simple Storage Service. |
| Amplify | AWS Amplify Hosting for full-stack web apps. |
| JWT | JSON Web Token used as a session cookie. |
| Pre-signed URL | A time-limited URL signed by the application that lets the browser fetch an S3 object without making the bucket public. |
| DDL | Data Definition Language (CREATE TABLE, etc.). |
| SSR | Server-Side Rendering. |
| UI | User Interface. |
| FR-x | Functional Requirement identifier (e.g., FR-AUTH-01). |
| NFR-x | Non-Functional Requirement identifier. |
| SHALL | Mandatory requirement (per RFC 2119, equivalent to MUST). |
| SHOULD | Recommended requirement; deviations require justification. |
| MAY | Optional requirement. |

### 1.5 Stakeholders

| Stakeholder | Role | Primary interest |
|-------------|------|------------------|
| Officer team (President, VP, Secretary, etc.) | Product owner | Day-to-day operation; event approval flow; control over content. |
| Members | End users | Easy access to resources, blogs, events; ability to maintain own profile. |
| Guests / prospective members | End users | Discover the organization, see what's happening, decide to join. |
| Administrators (subset of officers) | System operators | Manage accounts, content moderation, audit oversight. |
| Faculty adviser | Sponsor | Periodic review; ensure org compliance with university policy. |
| Next-term officers | Inheritors | Handover continuity; ability to operate the system after current team graduates. |

### 1.6 Operational Concept

A typical week of system operation: officers create events as needed; designated approver officers review and vote within the system; once three approvals are recorded, the event is published to the public events listing. Members submit blog posts and project entries; an admin reviews and approves them. Guests browse the welcome page, public events, and public resources without authentication. Members log in to access private content and update their own profile. Admins occasionally register new members, manage resources, and review the audit log.

### 1.7 Document Conventions

- Requirement language follows RFC 2119: SHALL/MUST = mandatory, SHOULD = recommended, MAY = optional.
- Requirement identifiers follow the pattern `<CATEGORY>-<NUMBER>` (e.g., FR-AUTH-01, NFR-PERF-02).
- Tables follow ISO 29148 recommendations: identifier, statement, source/rationale, verification method.
- References to other documents use bracketed tags: [FEAS], [WIRE].

---

## 2. References

- **[FEAS]** AWS Feasibility Framework v3 — internal document. Source of architecture, cost, and DB design rationale.
- **[WIRE]** Wireframe Design Guide — internal document. Source of UI tokens, layout, and component vocabulary.
- **[IEEE-29148]** ISO/IEC/IEEE 29148:2018, "Systems and software engineering — Life cycle processes — Requirements engineering."
- **[RFC-2119]** Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels," BCP 14, RFC 2119, March 1997.
- **[OWASP-ASVS]** OWASP Application Security Verification Standard v4.0.3.
- **[WCAG-2.1]** Web Content Accessibility Guidelines (WCAG) 2.1, W3C Recommendation.
- **[AWS-WA]** AWS Well-Architected Framework.
- **[POSTGRES]** PostgreSQL 16 official documentation.
- **[NEXT]** Next.js official documentation, version 14+ App Router.

---

## 3. Specific Requirements

This clause is the body of the SRS. It is organized per ISO 29148 §9.5.5: external interfaces, functions, usability, performance, logical database, design constraints, system attributes, and supporting information.

### 3.1 External Interfaces

#### 3.1.1 User Interfaces

The system SHALL present a responsive web UI conforming to the Wireframe Design Guide [WIRE]. The UI SHALL function on viewport widths from 320 px to 1920 px and on the latest two major versions of Chrome, Firefox, Safari, and Edge.

All page layouts, components, tokens, typography, color, and per-page behavior are governed by [WIRE]. The SRS does not duplicate those specifications; it incorporates them by reference.

#### 3.1.2 Hardware Interfaces

None. The system is browser-based and has no direct hardware interfaces.

#### 3.1.3 Software Interfaces

| Interface | Direction | Protocol | Purpose |
|-----------|-----------|----------|---------|
| Amazon RDS (PostgreSQL 16) | Outbound | TCP/5432 + SSL | All persistent structured data. SSL required (rds.force_ssl = 1). |
| Amazon S3 | Outbound | HTTPS | Binary asset storage. Access via pre-signed URLs. |
| Google Forms | Inbound iframe | HTTPS | Public form embedding on the `/forms` page. |
| Microsoft Forms | Inbound iframe | HTTPS | Public form embedding on the `/forms` page. |
| Browser (user agent) | Inbound | HTTPS | User access to the application. |

#### 3.1.4 Communications Interfaces

- All client/server communication SHALL use HTTPS (TLS 1.2 or higher).
- All database connections SHALL use SSL.
- Session state SHALL be conveyed via HttpOnly, Secure, SameSite=Lax cookies containing a signed JWT.
- File uploads and downloads SHALL bypass application servers via S3 pre-signed URLs.

### 3.2 Functions

Functional requirements are grouped by capability area. Each requirement has a stable identifier, a statement using RFC-2119 language, the source role(s) authorized to invoke it, and a verification method. Verification methods are abbreviated: **T** = test, **I** = inspection, **D** = demonstration, **A** = analysis.

#### 3.2.1 Authentication and Session Management

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-AUTH-01 | The system SHALL provide a login page accepting an email address and password. | All | T |
| FR-AUTH-02 | The system SHALL verify credentials against a bcrypt-hashed password stored in the users table. | All | T, I |
| FR-AUTH-03 | On successful authentication, the system SHALL issue a signed JWT as an HttpOnly Secure cookie containing user_id, member_id, role, and expiration. | All | T, I |
| FR-AUTH-04 | Sessions SHALL expire after 7 days of inactivity. The system MUST re-prompt for credentials after expiry. | All | T |
| FR-AUTH-05 | The system SHALL provide a logout action that clears the session cookie on the next response. | Authenticated | T |
| FR-AUTH-06 | The system SHALL NOT provide self-service account creation. New accounts are created exclusively by administrators (see FR-ADM-01). | Admin | I |
| FR-AUTH-07 | Password reset SHALL be initiated only by an administrator, who issues a one-time reset link to the member's email. | Admin | T |
| FR-AUTH-08 | Officer status SHALL be derived per-request by joining session.member_id to officers where is_current = TRUE — not baked into the JWT. | System | I, T |
| FR-AUTH-09 | After five consecutive failed login attempts within 10 minutes for the same email, the system SHALL temporarily lock further attempts for that email for 15 minutes. | System | T |

#### 3.2.2 Public (Guest) Access

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-PUB-01 | The system SHALL display a welcome page accessible without authentication, including mission, upcoming approved events, current officers, and the latest three approved public blogs. | Guest | D |
| FR-PUB-02 | Guests SHALL be able to view the public officers list. | Guest | T |
| FR-PUB-03 | Guests SHALL be able to view the members list restricted to name, photo, course, and year level only. | Guest | T, I |
| FR-PUB-04 | Guests SHALL NOT be able to open individual member detail pages; the system MUST return HTTP 403. | Guest | T |
| FR-PUB-05 | Guests SHALL be able to view approved blog posts marked public. | Guest | T |
| FR-PUB-06 | Guests SHALL be able to view approved projects marked public. | Guest | T |
| FR-PUB-07 | Guests SHALL be able to view approved events marked public. | Guest | T |
| FR-PUB-08 | Guests SHALL be able to download or preview resources marked public via pre-signed S3 URLs. | Guest | T |
| FR-PUB-09 | Guests SHALL be able to view the embedded forms page. | Guest | T |
| FR-PUB-10 | Private blogs, resources, projects, and events MUST NOT appear in any guest-accessible listing. | Guest | T, I |

#### 3.2.3 Member Capabilities

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-MEM-01 | Members SHALL be able to view the full member directory, including contact email, bio, and joined date. | Member+ | T |
| FR-MEM-02 | Members SHALL be able to open any member detail page showing profile, officer history, contributed projects, and authored blogs. | Member+ | T |
| FR-MEM-03 | Members SHALL be able to view private blogs, private resources, private projects, and private events. | Member+ | T |
| FR-MEM-04 | Members SHALL be able to edit their own profile fields: full_name, photo, course, year_level, bio, contact_email. | Member+ | T |
| FR-MEM-05 | Members MUST NOT be able to edit any other member's profile. The API SHALL enforce members.user_id = session.user_id on update. | Member+ | T, I |
| FR-MEM-06 | Members SHALL be able to submit a blog post. The new blog SHALL be saved with status = 'pending' and SHALL NOT be visible to anyone except admins until approved. | Member+ | T |
| FR-MEM-07 | Members SHALL be able to submit a project. The new project SHALL be saved with status = 'pending'. The submitting member SHALL be automatically inserted into project_contributors. | Member+ | T |
| FR-MEM-08 | Members MUST NOT be able to create events, upload resources, manage forms, or approve any content. | Member | T, I |

#### 3.2.4 Officer Capabilities

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-OFF-01 | Officers SHALL inherit all Member capabilities. | Officer+ | I |
| FR-OFF-02 | Officers SHALL be able to create events via a dedicated submission page. New events SHALL be saved with status = 'pending'. | Officer+ | T |
| FR-OFF-03 | Officers SHALL be able to edit their own pending events ONLY while no approval/rejection votes have yet been cast. Once any event_approvals row exists for the event, author edits SHALL be rejected with HTTP 409. | Officer+ | T, I |
| FR-OFF-04 | Officers holding an is_approver = TRUE position SHALL be able to cast exactly one approve or reject vote per event via `/events/approvals`. | Approver Officer | T |
| FR-OFF-05 | The system SHALL prevent an officer from voting on an event they themselves created. This rule SHALL be enforced both by the API (returning HTTP 403) and by a BEFORE INSERT trigger on `event_approvals`. | System | T, I |
| FR-OFF-06 | When the third 'approved' vote is recorded, the system SHALL atomically set events.status = 'approved' and events.approved_at = NOW() via an AFTER INSERT trigger on `event_approvals`. | System | T, I |
| FR-OFF-07 | Any single 'rejected' vote SHALL immediately set events.status = 'rejected'. The rejection comment SHALL be required (non-null, non-empty), enforced by a BEFORE INSERT trigger on `event_approvals`. | System | T, I |
| FR-OFF-08 | Officers MUST NOT be able to delete events, change officer_positions.is_approver flags, or bypass the three-vote requirement. | Officer | T, I |
| FR-OFF-09 | Officers SHALL be able to view their own queue of events: 'My pending events' and 'Events awaiting my vote'. | Officer+ | T |

#### 3.2.5 Administrator Capabilities

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-ADM-01 | Administrators SHALL be able to register new members. The operation SHALL create a users row and a members row in a single database transaction. | Admin | T |
| FR-ADM-02 | Administrators SHALL be able to edit, deactivate, or reactivate any member. | Admin | T |
| FR-ADM-03 | Administrators SHALL be able to grant or revoke the admin role on any existing member, EXCEPT they SHALL NOT be able to revoke their own admin role. | Admin | T, I |
| FR-ADM-04 | Administrators SHALL be able to register, edit, and deactivate officers. | Admin | T |
| FR-ADM-05 | Administrators SHALL be able to manage officer_positions: rename, reorder, and set the is_approver flag. The system MUST reject any change that leaves the count of is_approver = TRUE rows different from exactly 3. | Admin | T, I |
| FR-ADM-06 | Administrators SHALL be able to approve or reject blog submissions. | Admin | T |
| FR-ADM-07 | Administrators SHALL be able to approve, reject, edit, archive, or delete any project. Administrators SHALL be able to edit the project_contributors list. | Admin | T |
| FR-ADM-08 | Administrators SHALL be able to edit, cancel, or delete any event regardless of approval state. | Admin | T |
| FR-ADM-09 | Administrators SHALL be able to force-approve an event, bypassing the three-vote requirement. Every force-approval SHALL write an audit_log row with action = 'FORCE_APPROVE_EVENT'. | Admin | T, I |
| FR-ADM-10 | Administrators SHALL be able to upload resources, set category and visibility, and edit metadata. | Admin | T |
| FR-ADM-11 | Administrators SHALL be able to manage resource_categories: create, rename, delete. Deleting a category SHALL set category_id = NULL on affected resources; resources MUST NOT be implicitly deleted. | Admin | T, I |
| FR-ADM-12 | Administrators SHALL be able to add, edit, and disable form_links. | Admin | T |
| FR-ADM-13 | Administrators SHALL be able to view, filter, and inspect every entry in the audit log. | Admin | T |

#### 3.2.6 Content: Blogs, Projects, Events, Resources, Forms

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-BLOG-01 | Blogs SHALL support a cover image, body in Markdown, embedded images, and external links. | — | D |
| FR-BLOG-02 | Blog visibility SHALL be settable to public or private at submission and edit time. | Member+ | T |
| FR-BLOG-03 | Blog status transitions SHALL be: draft → pending → approved \| rejected. Only admins SHALL move blogs to approved or rejected. | Admin | T, I |
| FR-PROJ-01 | Projects SHALL store: title, description, body (Markdown), repo_url, live_url, tech_stack, tags, cover image, status, visibility, started_on, completed_on. | — | I |
| FR-PROJ-02 | Projects SHALL support multiple contributors via project_contributors with a role_on_project label. | — | I |
| FR-PROJ-03 | Project status transitions follow the same pattern as blogs, plus an 'archived' state available to admins. | Admin | T, I |
| FR-EVT-01 | Events SHALL store: title, description, body (Markdown), cover image, location text, optional location_url, starts_at, ends_at, status, visibility, created_by. | — | I |
| FR-EVT-02 | The database SHALL enforce ends_at > starts_at via a CHECK constraint. | System | T, I |
| FR-EVT-03 | Approved public events SHALL appear on the public `/events` page grouped into 'Upcoming' (starts_at >= NOW()) and 'Past' (starts_at < NOW()). | — | T |
| FR-EVT-04 | Each event detail page SHALL provide an 'Add to calendar' action producing a valid .ics file or Google Calendar deep-link. | — | T |
| FR-RES-01 | Resources SHALL store metadata only in RDS; the binary SHALL reside in S3. | — | I |
| FR-RES-02 | Resources SHALL support PDF in-browser preview via iframe or PDF.js. Image resources SHALL render inline. Other file types SHALL offer a download action. | — | T |
| FR-RES-03 | Resource downloads SHALL be served via pre-signed S3 URLs with a maximum validity of 15 minutes. | System | T, I |
| FR-FORM-01 | The `/forms` page SHALL render each active form_links row as an embedded iframe. | — | T |
| FR-FORM-02 | The system SHALL accept both Google Forms and Microsoft Forms URLs and SHALL derive an iframe-safe embed URL for each provider. | Admin | T |

#### 3.2.7 Audit Trail

| ID | Requirement | Roles | Verify |
|----|-------------|-------|--------|
| FR-AUD-01 | The system SHALL record one audit_log row per write to users, members, officers, officer_positions, blogs (on status change), projects (on status change), events, event_approvals, resources, and form_links. | System | T, I |
| FR-AUD-02 | Audit rows SHALL contain: actor_id, action, entity, entity_id, before_data (JSONB), after_data (JSONB), ip_address, created_at. | System | I |
| FR-AUD-03 | The audit_log table SHALL be append-only. UPDATE and DELETE on audit_log MUST be denied at the database role level. | System | T, I |
| FR-AUD-04 | Administrators SHALL be able to filter the audit log by actor, target entity, action type, and date range. | Admin | T |

### 3.3 Usability Requirements

| ID | Requirement | Verify |
|----|-------------|--------|
| NFR-USE-01 | All pages SHALL be responsive across viewport widths 320–1920 px without horizontal scrolling. | T |
| NFR-USE-02 | All interactive elements SHALL have a visible keyboard focus indicator meeting WCAG 2.1 AA contrast. | T, I |
| NFR-USE-03 | Text contrast SHALL meet WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text. | T |
| NFR-USE-04 | Every icon-only button SHALL have an aria-label. | I |
| NFR-USE-05 | Every image SHALL have alt text; decorative images SHALL use alt="". | I |
| NFR-USE-06 | All forms SHALL provide inline validation messages bound via aria-describedby. | T, I |
| NFR-USE-07 | First-time users SHALL be able to complete a primary task (find an officer, download a resource, view an upcoming event) in under three clicks from the welcome page. | T, D |
| NFR-USE-08 | The UI SHALL support light and dark modes; both modes MUST satisfy contrast requirements. | T |
| NFR-USE-09 | Loading states SHALL use Skeleton placeholders that mirror the final layout, not spinners alone. | I |
| NFR-USE-10 | The system SHALL provide a skip-to-content link on every page, visually hidden until focused. | T, I |

### 3.4 Performance Requirements

| ID | Requirement | Verify |
|----|-------------|--------|
| NFR-PERF-01 | The welcome page SHALL achieve First Contentful Paint under 2.0 s on a 4G connection (1.6 Mbps, 150 ms RTT) using a mid-tier mobile device. | T, A |
| NFR-PERF-02 | Server-rendered pages SHALL return a response in under 800 ms at the 95th percentile, measured at the application server. | T, A |
| NFR-PERF-03 | API routes performing a single primary RDS query SHALL respond in under 300 ms at the 95th percentile. | T, A |
| NFR-PERF-04 | Resource downloads SHALL be served directly from S3 via pre-signed URLs and SHALL NOT proxy through the application tier. | T, I |
| NFR-PERF-05 | The system SHALL support at least 200 concurrent authenticated users without violating other performance NFRs (typical peak for a student organization during a recruitment drive). | T, A |
| NFR-PERF-06 | Page weight SHALL NOT exceed 500 KB compressed for the welcome page in its default state. | T, A |

### 3.5 Logical Database Requirements

This section summarizes the data model normatively. The complete DDL is published in the Feasibility Framework [FEAS §6.3] and is incorporated by reference.

#### 3.5.1 Entities (informative summary)

| Entity | Purpose |
|--------|---------|
| users | Authentication identity. One row per person who can log in. |
| members | Profile data. 1:1 with users. References lookup tables for course, year_level, and status. |
| courses | Admin-managed lookup: degree programs. Referenced by `members.course_id`. |
| year_levels | Admin-managed lookup, seeded with Year 1–4. |
| member_statuses | Admin-managed lookup, seeded with Active, For Renewal, Inactive, Alumni. |
| officer_positions | Lookup of position titles. Exactly 3 rows have `is_approver = TRUE` (enforced by trigger). |
| officers | Officer assignments per term. References members and officer_positions. |
| blogs | Blog posts. Approval workflow (draft → pending → approved/rejected). |
| blog_attachments | Extra images, external links, or resource references per blog. |
| projects | Member projects with repo / live links, category, and contributor list. |
| project_categories | Admin-managed lookup, seeded with Web, Mobile, Cloud, Data & AI, Hardware, Research. |
| project_contributors | Many-to-many between members and projects. |
| project_attachments | Extra screenshots and external links per project. |
| events | Organization events. Multi-officer approval workflow. |
| event_approvals | One vote per required officer position. Unique on (event_id, position_id). Validated and finalized by triggers. |
| resources | Resource metadata; binary lives in S3. |
| resource_categories | Lookup table for resources. |
| form_links | External Google/Microsoft Forms embeds. References form_providers. |
| form_providers | Admin-managed lookup, seeded with Google, Microsoft. |
| site_settings | Single-row CMS for the organization profile (org_name, tagline, about, term, contact info). |
| audit_log | Append-only record of all sensitive writes. UPDATE/DELETE denied at the database (DR-07). |

#### 3.5.2 Data Requirements

| ID | Requirement | Verify |
|----|-------------|--------|
| DR-01 | All identifier columns SHALL be UUID v4 generated by gen_random_uuid(). | I |
| DR-02 | All timestamp columns SHALL be TIMESTAMPTZ in UTC. | I |
| DR-03 | Email columns (`users.email`, `members.contact_email`) SHALL use the CITEXT case-insensitive type. | I |
| DR-04 | The events table SHALL enforce ends_at > starts_at via a CHECK constraint. | T, I |
| DR-05 | The event_approvals table SHALL enforce UNIQUE (event_id, position_id). | T, I |
| DR-06 | The officer_positions table SHALL be constrained — via a DEFERRABLE INITIALLY DEFERRED constraint trigger — such that exactly 3 rows have is_approver = TRUE at the end of every transaction. | T, I |
| DR-07 | The audit_log table SHALL deny UPDATE and DELETE at the database level via a BEFORE UPDATE OR DELETE trigger, not only by application role privileges. | T, I |
| DR-08 | Database access from the application SHALL use SSL (rds.force_ssl = 1). | T, I |
| DR-09 | RDS automated backups SHALL be enabled with retention of at least 7 days. | I |
| DR-10 | Data integrity across related tables SHALL be enforced by foreign keys with explicit ON DELETE policies (CASCADE, RESTRICT, or SET NULL) per the schema in [FEAS §6.3]. | I |
| DR-11 | Admin-managed vocabularies (`courses`, `year_levels`, `member_statuses`, `project_categories`, `form_providers`) SHALL be modelled as lookup tables, not ENUM types, so admins can add or rename values without a schema migration. Foreign keys into these tables SHALL use ON DELETE SET NULL. | I |
| DR-12 | Event approval rules (FR-OFF-04, FR-OFF-05, FR-OFF-06, FR-OFF-07) SHALL be enforced by database triggers on `event_approvals` (BEFORE INSERT for validation, AFTER INSERT for status finalization), not solely by application code. | T, I |
| DR-13 | The `site_settings` table SHALL be a single-row table whose primary key is a BOOLEAN constrained to TRUE, guaranteeing at most one organization profile exists. | I |

### 3.6 Design Constraints

| ID | Constraint | Verify |
|----|------------|--------|
| DC-01 | The system SHALL be implemented as a single Next.js 14+ application using the App Router. | I |
| DC-02 | The application SHALL be deployed to AWS Amplify Hosting. | I |
| DC-03 | The application SHALL use Amazon RDS for PostgreSQL 16 as its sole relational store. | I |
| DC-04 | Binary assets SHALL be stored in a single Amazon S3 bucket with Block Public Access enabled. | I |
| DC-05 | The UI SHALL be built using shadcn/ui primitives only, as enumerated in [WIRE §4]. | I |
| DC-06 | The UI SHALL use Inter as its sole UI typeface and JetBrains Mono for code/inline-code contexts. | I |
| DC-07 | No third-party service beyond AWS, Google Forms, and Microsoft Forms SHALL be required for v1.0. | I |
| DC-08 | The system SHALL NOT introduce a separate identity provider (e.g., Cognito) in v1.0. Authentication is self-managed via the users table + JWT cookies. | I |
| DC-09 | Total monthly AWS cost SHALL remain under USD $50 for typical student-organization usage (200 concurrent peak, 20 GB resource storage). | A |
| DC-10 | All source code SHALL be hosted in a single Git repository and SHALL be deployable via Amplify's Git integration. | I |

### 3.7 Software System Attributes

#### 3.7.1 Security

| ID | Requirement | Verify |
|----|-------------|--------|
| NFR-SEC-01 | Passwords SHALL be stored only as bcrypt hashes with a work factor of at least 12. | I, T |
| NFR-SEC-02 | Authentication tokens SHALL be conveyed only via HttpOnly Secure SameSite=Lax cookies. Tokens MUST NOT be exposed to JavaScript. | I, T |
| NFR-SEC-03 | All HTTP traffic SHALL be served over TLS 1.2 or higher. HTTP requests SHALL be redirected to HTTPS. | T |
| NFR-SEC-04 | The RDS instance SHALL reside in a private subnet, accessible only from the application's Amplify compute. | I |
| NFR-SEC-05 | The S3 bucket SHALL have Block Public Access enabled and SHALL be accessible only via pre-signed URLs signed by the application IAM role. | I, T |
| NFR-SEC-06 | Secrets (DB connection string, JWT secret, S3 bucket name, IAM keys) SHALL be stored exclusively in Amplify environment variables and MUST NOT appear in source control. | I |
| NFR-SEC-07 | User-submitted Markdown SHALL be rendered with HTML sanitization that strips script tags, event handler attributes, and javascript: URLs. | T, I |
| NFR-SEC-08 | The system SHALL apply RBAC at the API layer; UI-level hiding alone is insufficient. Every protected endpoint MUST re-check the session role before acting. | T, I |
| NFR-SEC-09 | The application SHALL set Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, and Strict-Transport-Security HTTP headers on every response. | T, I |
| NFR-SEC-10 | Rate limiting SHALL be applied to `/api/auth/login` (FR-AUTH-09) and to other write endpoints at a baseline of 60 requests per minute per session. | T |

#### 3.7.2 Reliability

| ID | Requirement | Verify |
|----|-------------|--------|
| NFR-REL-01 | The system SHALL target 99.5% availability monthly, excluding scheduled maintenance. | A |
| NFR-REL-02 | RDS automated backups SHALL run daily with at least 7-day retention. | I |
| NFR-REL-03 | S3 versioning SHALL be enabled on the asset bucket so accidental overwrites are recoverable. | I |
| NFR-REL-04 | The application SHALL handle transient database connection failures by retrying once with exponential backoff before surfacing an error to the user. | T |

#### 3.7.3 Maintainability

| ID | Requirement | Verify |
|----|-------------|--------|
| NFR-MNT-01 | The codebase SHALL follow a single conventional structure (Next.js App Router layout) with clear separation between pages, API routes, database access, and UI components. | I |
| NFR-MNT-02 | All database schema changes SHALL be applied via migration files committed to the repository. | I |
| NFR-MNT-03 | The repository SHALL include a README documenting local setup, environment variables, and deployment steps. | I |
| NFR-MNT-04 | The repository SHALL include a HANDOVER document with the runbook for officer transitions across academic years. | I |

#### 3.7.4 Portability

| ID | Requirement | Verify |
|----|-------------|--------|
| NFR-POR-01 | The application SHALL run on Node.js 20 LTS or newer. | T |
| NFR-POR-02 | Developers SHALL be able to run the full stack locally using a Docker-Compose configuration that provisions PostgreSQL and a local S3-compatible store (e.g., MinIO). | T, D |
| NFR-POR-03 | The system MUST NOT depend on Amplify-proprietary features that prevent migration to standard Node hosting; preferred patterns are framework-native and portable. | I |

### 3.8 Supporting Information

#### 3.8.1 Use Cases (Summary)

| UC-ID | Actor | Use case | Brief |
|-------|-------|----------|-------|
| UC-01 | Guest | Browse welcome page | Visitor lands on `/`, sees mission, upcoming events, blogs, CTAs. |
| UC-02 | Guest | View officers | Visitor views public officer roster. |
| UC-03 | Member | Log in | Member submits credentials, receives session cookie. |
| UC-04 | Member | Edit own profile | Member updates own profile fields. |
| UC-05 | Member | Submit blog | Member submits blog (status=pending) for admin approval. |
| UC-06 | Member | Submit project | Member submits project (status=pending), is added as contributor. |
| UC-07 | Officer | Create event | Officer submits new event (status=pending). |
| UC-08 | Approver Officer | Vote on event | Approver officer casts approve or reject vote on a pending event. |
| UC-09 | System | Finalize event | System sets events.status='approved' on third approve vote, transactionally. |
| UC-10 | Admin | Register member | Admin creates a users + members row. |
| UC-11 | Admin | Approve blog/project | Admin moves item from pending to approved or rejected. |
| UC-12 | Admin | Force-approve event | Admin bypasses three-vote rule; action is audit-logged. |
| UC-13 | Admin | Upload resource | Admin uploads file to S3 and creates resources metadata row. |
| UC-14 | Admin | Inspect audit log | Admin filters and views audit_log entries. |

#### 3.8.2 Assumptions and Dependencies

- The organization has an active AWS account with billing enabled and is eligible for the Free Tier in year 1.
- The organization has a custom domain (or will register one) and is willing to configure DNS for Amplify.
- Members have valid email addresses for password reset and account creation.
- Google Forms and Microsoft Forms remain available for iframe embedding under their current terms of use.
- PostgreSQL 16 remains supported in RDS for the project's expected lifespan.

---

## 4. Verification

Per ISO/IEC/IEEE 29148 §9.5.6, each requirement carries a verification method. This section consolidates the verification strategy and acceptance criteria.

### 4.1 Verification Methods

| Code | Method | When used |
|------|--------|-----------|
| T | Test | Automated or manual functional testing producing observable, repeatable results. |
| I | Inspection | Code review, schema review, configuration audit, documentation check. |
| D | Demonstration | Live walkthrough showing the system meets the requirement. |
| A | Analysis | Calculation, modeling, or measurement against an external standard (e.g., cost, performance budget). |

### 4.2 Acceptance Criteria

The system is considered ready for v1.0 release when ALL of the following are true:

- Every FR-* requirement passes its specified verification method.
- Every NFR-* requirement has been measured at least once and meets its threshold.
- The audit log records the expected entries for one full end-to-end exercise of each role (UC-01 through UC-14).
- The three-officer event approval flow has been exercised in both happy-path (3 approvals) and rejection-path (1 rejection) scenarios.
- Administrator force-approval has been exercised and confirmed to write a FORCE_APPROVE_EVENT audit entry.
- A simulated officer turnover (revoking and reassigning approver positions) has been performed without service interruption.
- Page load and API performance NFRs have been measured under load (NFR-PERF-01 through 06).
- Security headers (NFR-SEC-09) are present on every response; a manual penetration check against OWASP Top 10 has been performed and findings remediated.
- README and HANDOVER documents are present and have been validated by an officer not involved in development.

### 4.3 Traceability

Each requirement traces to one or more reference documents and to one or more verification artifacts. Full traceability is maintained in the project's test plan; the matrix below shows the top-level mapping.

| Requirement group | Traces to | Verified by |
|-------------------|-----------|-------------|
| FR-AUTH-* | [FEAS §5.4], [FEAS §7] | Auth test suite, manual login walkthrough |
| FR-PUB-* | [WIRE §5.1–5.10], [FEAS §7] | End-to-end browser tests, manual guest walkthrough |
| FR-MEM-* | [WIRE §5.4–5.16], [FEAS §7] | Role-isolation test suite |
| FR-OFF-* | [WIRE §5.13–5.15], [FEAS §6.3, §7] | Officer-workflow test suite (happy + reject paths) |
| FR-ADM-* | [WIRE §5.17], [FEAS §7] | Admin-workflow test suite + audit-log inspection |
| FR-AUD-* | [FEAS §6.3 audit_log, §7.3] | Schema inspection + UPDATE/DELETE denial test |
| NFR-USE-* | [WIRE entire] | Lighthouse + axe + manual walkthrough |
| NFR-PERF-* | [FEAS §3] | Lighthouse + synthetic load test |
| NFR-SEC-* | [FEAS §3.5], [OWASP-ASVS] | Configuration audit + manual pen check |
| DC-* | [FEAS §3, §4] | Architecture review |

---

## 5. Appendices

### 5.1 Appendix A — Role Capability Matrix

Reproduced from [FEAS §7.1] for ease of reference. The authoritative version is in [FEAS].

| Capability | Guest | Member | Officer | Admin | Enforcement |
|------------|-------|--------|---------|-------|-------------|
| View welcome page | Yes | Yes | Yes | Yes | FR-PUB-01 |
| View members list — limited fields | Yes | Yes | Yes | Yes | FR-PUB-03 |
| View members list — full fields | No | Yes | Yes | Yes | FR-MEM-01 |
| View individual member detail page | No | Yes | Yes | Yes | FR-PUB-04, FR-MEM-02 |
| View private blogs / resources / projects | No | Yes | Yes | Yes | FR-MEM-03 |
| View public events | Yes | Yes | Yes | Yes | FR-PUB-07 |
| View private events | No | Yes | Yes | Yes | FR-MEM-03 |
| Edit OWN profile | No | Yes | Yes | Yes | FR-MEM-04 |
| Edit ANY member profile | No | No | No | Yes | FR-ADM-02 |
| Submit blog (pending) | No | Yes | Yes | Yes | FR-MEM-06 |
| Submit project (pending) | No | Yes | Yes | Yes | FR-MEM-07 |
| Create event (pending) | No | No | Yes | Yes | FR-OFF-02 |
| Edit own pending event (no votes yet) | No | No | Yes | Yes | FR-OFF-03 |
| Vote on event (approver positions only) | No | No | Yes* | Yes | FR-OFF-04, FR-OFF-05 |
| Approve/reject blogs | No | No | No | Yes | FR-ADM-06 |
| Approve/reject/edit projects | No | No | No | Yes | FR-ADM-07 |
| Edit, cancel, delete any event | No | No | No | Yes | FR-ADM-08 |
| Force-approve event | No | No | No | Yes | FR-ADM-09 |
| Upload / edit / delete resources | No | No | No | Yes | FR-ADM-10 |
| Manage officer_positions | No | No | No | Yes | FR-ADM-05 |
| Grant / revoke admin | No | No | No | Yes | FR-ADM-03 |
| View audit trail | No | No | No | Yes | FR-ADM-13, FR-AUD-04 |

*\* Only officers holding a position with is_approver = TRUE, and never on events they themselves created.*

### 5.2 Appendix B — Event Approval State Machine

```
                ┌──────────┐
                │  draft   │ (officer working in /events/new)
                └────┬─────┘
                     │  submit
                     v
                ┌──────────┐
            ┌──>│ pending  │
            │   └────┬─────┘
            │        │
 any single │        ├──> approver vote = 'approved' (1st, 2nd)
 vote =     │        │    (status stays pending)
 'rejected' │        │
            │        ├──> 3rd 'approved' vote, in same txn:
            │        │    ┌──────────┐
            │        │    │ approved │
            │        │    └────┬─────┘
            │        │         │
            │        │         ├─> after starts_at < NOW(), UI labels
            │        │         │   the event 'Past' (state stays
            │        │         │   'approved' or moves to 'completed'
            │        │         │   via scheduled job).
            │        │         │
            │        │         └─> admin can: edit, cancel, delete
            │        │
            │        ├──> admin force_approve → approved (audit-logged)
            │        │
            │        v
            │   ┌──────────┐
            └───│ rejected │   (terminal unless admin re-opens by edit)
                └──────────┘

                ┌───────────┐
 any state ───> │ cancelled │   (admin only; reversible by admin edit)
                └───────────┘
```

### 5.3 Appendix C — Open Issues

| Issue | Description | Disposition |
|-------|-------------|-------------|
| OI-01 | Email notifications for event approvals are not in v1.0; reliance on the in-app queue could delay approvals. | Tracked for v1.1; mitigated by Admin dashboard alert when approver position is vacant. |
| OI-02 | Single-AZ RDS introduces RPO/RTO risk during AZ outage. | Accepted for cost reasons; revisit if user base grows beyond 500. |
| OI-03 | No self-service password reset; admin-initiated only. | Intentional v1.0 simplification; revisit in v1.1. |
| OI-04 | Past events remain in 'approved' status; transition to 'completed' relies on a future scheduled job. | Acceptable; status filter in UI uses (status='approved' AND ends_at < NOW()) as 'Past'. |

### 5.4 Appendix D — Sister Documents Mapping

This SRS is one of three documents. The mapping below clarifies which document is authoritative for which decision.

| Decision area | Authoritative document | This SRS's role |
|---------------|------------------------|-----------------|
| Cost / Budget | [FEAS §4] | Sets the budget constraint DC-09; rationale lives in [FEAS]. |
| AWS architecture | [FEAS §3] | Sets the design constraints DC-01 through DC-04. |
| DB schema | [FEAS §6.3] | Summarized in §3.5.1; full DDL by reference. |
| UI tokens, layout | [WIRE §1 through §10] | Constrained by NFR-USE-* and §3.6 design constraints DC-05, DC-06. |
| Functional behavior | This SRS §3.2 | Authoritative. |
| Verification plan | This SRS §4 | Authoritative. |
| Acceptance criteria | This SRS §4.2 | Authoritative. |
