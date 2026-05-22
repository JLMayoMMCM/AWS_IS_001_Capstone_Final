# Wireframe Design Guide

**Project:** Student Organization Website
**Stack:** Next.js + Tailwind + shadcn/ui
**Theme:** shadcn neutral defaults
**Font:** Inter (sans), JetBrains Mono (code/inline only)

This guide tells Claude how to design every screen in the app. It is not code — it is the rulebook Claude consults before producing a mockup, a sketch, or an implementation. If a future request says "design the projects page," Claude opens this guide first and follows it.

---

## 1. Design Principles

These principles override aesthetic preferences when they conflict.

1. **Clean over decorative.** White/near-white surfaces, generous whitespace, hairline borders. No drop shadows on cards by default (use border + subtle elevation only on interactive lift).
2. **One screen, one job.** Each page answers one question. Welcome answers "what is this org"; members list answers "who is in it." Don't pile features onto a page because there's room.
3. **Mobile-first, not mobile-afterthought.** Sketch the 375px layout first. Desktop is the 375px layout with more breathing room and a sidebar where it earns its place.
4. **shadcn primitives only.** Cards, Buttons, Inputs, Tabs, Dialogs, Sheets, DropdownMenus, Tables, Badges, Avatars, Skeletons. No custom components unless the guide explicitly approves one.
5. **Inter everywhere.** Inter for all UI text. No display fonts, no script fonts, no second sans.
6. **Type does the work, not color.** Hierarchy comes from weight and size — color is reserved for status (success/warning/destructive) and the single primary action.
7. **Quiet color.** Neutral grays carry 90% of the surface. Primary appears only on the one main CTA per screen and on active states.
8. **Never invent tokens.** Every color is a shadcn CSS variable. Every spacing value is a Tailwind step. Every radius is `--radius` or a derivative.

---

## 2. Design Tokens (shadcn Neutral)

These are the only values Claude uses. If a design needs a value not listed here, Claude picks the nearest one — it does not invent.

### 2.1 Color (CSS variables)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--background` | `oklch(1 0 0)` (white) | `oklch(0.145 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Body text |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card surface |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text on card |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Dropdowns, popovers |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | Primary CTA, active states |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Text on primary |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary buttons, chips |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary text, metadata |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Hover states |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Destructive actions |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | All borders |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Input borders |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus ring |

**Status tokens (extension — not in default shadcn, but Claude uses these for blog/project approval states):**

| Token | Use | Light example | Dark example |
|-------|-----|---------------|--------------|
| `--success` | Approved | `oklch(0.55 0.15 145)` | `oklch(0.65 0.15 145)` |
| `--warning` | Pending | `oklch(0.70 0.15 75)` | `oklch(0.75 0.15 75)` |
| `--info` | Public/Private label | uses `--muted-foreground` | same |

### 2.2 Typography

**Font:** Inter (variable, 100–900). Load via `next/font/google` with `display: 'swap'`.

| Role | Class / Size | Weight | Tracking | Use |
|------|--------------|--------|----------|-----|
| Display | `text-4xl md:text-5xl` (36/48px) | 700 | `-0.02em` | Hero/welcome headline only |
| H1 | `text-3xl md:text-4xl` (30/36px) | 700 | `-0.02em` | Page titles |
| H2 | `text-2xl md:text-3xl` (24/30px) | 600 | `-0.01em` | Section headings |
| H3 | `text-xl` (20px) | 600 | normal | Card titles, subsections |
| H4 | `text-lg` (18px) | 600 | normal | Small section labels |
| Body | `text-base` (16px) | 400 | normal | Default paragraph |
| Body-sm | `text-sm` (14px) | 400 | normal | Cards, dense lists |
| Caption | `text-xs` (12px) | 500 | `0.01em` | Metadata, timestamps |
| Label | `text-sm` (14px) | 500 | normal | Form labels |

**Rules:**
- Line-height: `leading-tight` (1.2) for ≥24px text, `leading-normal` (1.5) for body, `leading-relaxed` (1.625) for long-form (blog body).
- Max measure: prose blocks cap at `max-w-prose` (~65ch).
- Never stack two heading levels with no body between them — if needed, drop the lower one.

### 2.3 Spacing

Tailwind scale only. Don't invent fractional values.

| Use | Class | px |
|-----|-------|-----|
| Inside a chip/badge | `p-1` to `p-2` | 4–8 |
| Inside an input | `px-3 py-2` | 12 / 8 |
| Inside a card | `p-4 md:p-6` | 16 / 24 |
| Between stacked card items | `space-y-3` | 12 |
| Between sections on a page | `space-y-8 md:space-y-12` | 32 / 48 |
| Page outer padding | `px-4 md:px-6 lg:px-8` | 16 / 24 / 32 |
| Page top padding under nav | `pt-6 md:pt-10` | 24 / 40 |

### 2.4 Radius, Border, Elevation

- **Radius scale:** `--radius: 0.625rem` (10px). Use `rounded-md` (6px) for inputs/buttons, `rounded-lg` (8px) for cards, `rounded-xl` (12px) for hero panels, `rounded-full` only for avatars and pill badges.
- **Border:** `border border-border` is the default. Never use `border-2` unless representing focus on a non-input.
- **Elevation:** No shadows on default state. On hover, cards may lift with `hover:shadow-sm transition-shadow`. Dialogs and popovers use shadcn defaults — Claude does not override.

### 2.5 Iconography

- **Library:** lucide-react only. No mixing icon sets.
- **Sizes:** `h-4 w-4` inside buttons and inline with body text. `h-5 w-5` on nav items. `h-6 w-6` for empty-state illustrations.
- **Color:** Inherit `currentColor`. Don't color icons separately from their text.
- **Stroke:** Lucide default (2). Don't change.

---

## 3. Layout System

### 3.1 Breakpoints

| Name | Min width | Layout shift |
|------|-----------|--------------|
| Mobile | 0 | Single column, hamburger nav, bottom-aligned primary CTA on long forms |
| Tablet | `md:` 768px | Two-column grids appear, nav becomes horizontal |
| Desktop | `lg:` 1024px | Sidebar appears on admin pages, three-column grids enabled |
| Wide | `xl:` 1280px | Content max-width caps; no further expansion |

### 3.2 Container

Public pages: `max-w-6xl mx-auto px-4 md:px-6 lg:px-8`.
Admin pages (with sidebar): full width minus sidebar; main pane uses `max-w-5xl`.
Long-form blog body: `max-w-2xl` centered.

### 3.3 Global Chrome

**Top navigation (public, all screens):**
- Height: `h-14` (56px). Sticky. `bg-background/80 backdrop-blur` with `border-b border-border`.
- Left: logo + org name (text-base font-semibold).
- Center (desktop): nav links — Officers, Members, Projects, Events, Blogs, Resources, Forms.
- Right: Login button (`variant="outline"` if logged out; Avatar dropdown if logged in).
- Mobile: logo left, hamburger right, links collapse into a `Sheet` from the right.

**Admin sidebar (admin pages only, `lg:` and up):**
- Width: `w-60`. Fixed left. `bg-muted/40 border-r border-border`.
- Sections: Dashboard, Content, Officers, Members, Blogs, Projects, Events, Resources, Forms, Roles, Audit.
- Active item: `bg-accent text-accent-foreground rounded-md`.
- Mobile/tablet: sidebar collapses into a `Sheet` triggered from a top-bar menu icon.

**Footer (public):**
- Three columns on desktop (collapses to stacked on mobile): About / Quick links / Contact.
- `text-sm text-muted-foreground`, `border-t border-border`, `py-10`.

---

## 4. Component Vocabulary

These are the only shadcn building blocks Claude uses in mockups. If a page seems to need something else, Claude composes it from these.

| Pattern | Built from |
|---------|-----------|
| Page header (title + actions) | `<h1>` + Button(s) in a flex row |
| Section block | `<section>` with `space-y-4`, an H2, optional muted-foreground subtitle |
| Card list (members, projects, resources) | `Card` grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` |
| Detail page hero | Cover image (16:9) + title + metadata badges + action buttons |
| Tab switch (e.g., Public vs Private resources) | `Tabs` with `TabsList` + `TabsTrigger` |
| Empty state | Lucide icon (h-12 w-12, muted-foreground) + h3 + body-sm + single CTA, centered, `py-16` |
| Loading | `Skeleton` blocks matching the final layout (never a spinner alone) |
| Confirmations | `AlertDialog` for destructive; `Dialog` for create/edit |
| Mobile actions menu | `DropdownMenu` triggered by `MoreVertical` icon |
| Notifications/feedback | `Sonner` toast (`useToast` hook), top-right desktop, top-center mobile |
| Forms | shadcn `Form` + `Input`/`Textarea`/`Select`/`Switch`. Labels above field, helper text below, error text replaces helper |
| Status pills | `Badge` with variant: secondary (Pending), default (Approved), destructive (Rejected), outline (Draft) |
| Filters | `Select` for one-of, `ToggleGroup` for visual filters, `Input` with `Search` icon for free-text |
| Tables (admin only) | shadcn `Table` with sticky header; row hover `bg-muted/50` |
| File preview | PDF: `iframe`. Image: `<img>` with `object-cover`. Other: filename + size + download button |

---

## 5. Per-Page Wireframes

Each page below specifies: **purpose**, **mobile layout** (375px), **desktop layout** (≥1024px), **components used**, and **states**.

Order follows the site map in the feasibility doc (v2).

---

### 5.1 `/` — Welcome (Public)

**Purpose:** First impression. Mission, upcoming events, current officers preview, latest 3 blogs, CTA to join/login.

**Mobile (375px), top → bottom:**
1. Top nav (sticky)
2. Hero block: `pt-10 pb-12 text-center`
   - Display headline (org name or tagline), 2 lines max
   - Subhead (`text-base text-muted-foreground`), 2 lines max
   - Two buttons stacked: primary "Join Us" → `/login`, ghost "Learn more" → scrolls to about
3. "About" section: H2 + 2-paragraph body
4. "Upcoming events" section: up to 3 EventCard rows (see §5.13). If no upcoming events, hide the section entirely.
5. "Current officers" preview: 4 officer cards in a 1-column stack with avatar, name, role
6. "Latest from the blog" section: 3 blog cards stacked (image 16:9, title, date)
7. "Get involved" band: muted-background full-bleed section with H2, body, primary CTA
8. Footer

**Desktop (≥1024px):**
- Hero: same content, left-aligned, max-w-2xl, with an illustration/photo to the right (12-col grid: text 7 cols, image 5 cols).
- Upcoming events: `grid-cols-3 gap-6`.
- Officers preview: 4 cards in a row (`grid-cols-4 gap-6`).
- Blog cards: `grid-cols-3 gap-6`.
- Get-involved band: text left, CTA right, on a single row.

**Components:** Button, Card, Avatar, Badge.

**States:** No-events → hide section. No-officers → hide that section. No-blogs → hide that section. Don't show empty placeholders on the welcome page.

---

### 5.2 `/login` (Public)

**Purpose:** Authenticate existing members. No self-signup.

**Mobile:**
- Centered card, `max-w-sm`, vertically centered with `min-h-screen flex items-center`.
- Card contents: small org logo, h2 "Welcome back", body-sm muted "Sign in to access member resources.", Email input, Password input, primary "Sign in" button full-width, link "Forgot password?" below in muted-foreground text-sm.

**Desktop:**
- Same card, centered on the viewport. No side illustration — keep it focused.

**Components:** Card, Input, Button, Label, Form.

**States:** Loading → button shows spinner + disabled. Error → Alert with `variant="destructive"` above the form fields.

---

### 5.3 `/officers` (Public)

**Purpose:** Show current officer roster with photos and positions.

**Mobile:** 1-column list of officer cards. Each card: avatar (h-16 w-16), name (h3), position (text-sm muted-foreground), term (caption).

**Desktop:** `grid-cols-3 gap-6`. Cards same as mobile but with avatar at h-20 w-20 and centered.

**Top of page:** H1 "Officers" + small body-sm muted subtitle with current term label, e.g. "AY 2025–2026".

**Components:** Card, Avatar, Badge (for "President", "VP", etc. shown as outline badge).

**States:** Past-term toggle in top-right of the page header — a `Select` or `Tabs` letting visitors view past officers. Empty term → empty state component.

---

### 5.4 `/members` — Members List (Public, gated fields)

**Purpose:** Show the directory. Guests see limited fields; members see full fields.

**Mobile:**
1. H1 "Members" + body-sm muted subtitle "X active members"
2. Search input (full width, `Search` icon left) + a `Select` filter for year level
3. 1-column card list. Each card:
   - Avatar (h-12 w-12) left
   - Name + course/year on the right
   - **For guests:** stop here. No contact info.
   - **For logged-in members:** add a row of body-sm muted with email, plus a `ChevronRight` icon hint that the card opens a detail page
4. Pagination at the bottom (shadcn Pagination)

**Desktop:** Same content. `grid-cols-2 xl:grid-cols-3 gap-4`. Search bar left, filter right, same row.

**Components:** Card, Avatar, Input (with Search icon), Select, Pagination.

**States:**
- Guest: card is non-interactive (no hover lift, no link). A subtle note at the top: "Log in to view full profiles."
- Member: card is a link to `/members/[id]`. Hover lift enabled.
- Loading: 6 Skeleton cards (avatar circle + 2 text lines).
- Empty: "No members match your search."

---

### 5.5 `/members/[id]` — Member Detail (Member only)

**Purpose:** Full profile for one member. Guests get a 403 page.

**Mobile, top → bottom:**
1. Back link "← Members"
2. Profile header card:
   - Avatar (h-24 w-24), centered
   - Name (h1)
   - Course + year (body-sm muted)
   - Status badge ("Active", "Alumni")
   - Contact button row: Email (mailto link, secondary button), optional socials
3. Bio section (H2 "About", body)
4. Officer history (H2 + small Card list: role + term)
5. Projects contributed (H2 + ProjectCard list, 1 column)
6. Blogs authored (H2 + small list of blog titles + dates)

**Desktop:** Two-column layout. Left column (4/12): profile header card stays sticky (`sticky top-20`). Right column (8/12): the four sections (bio, officers, projects, blogs) stacked.

**Components:** Card, Avatar, Badge, Button, Separator.

**States:**
- Guest hitting this URL → render `/403` page (see §5.16).
- Editing own profile → an "Edit profile" button replaces the contact button block, linking to `/profile`.
- No projects / no blogs → hide that section silently (don't show empty placeholders on a profile).

---

### 5.6 `/forms` (Public)

**Purpose:** Embed external Google Forms / Microsoft Forms.

**Mobile:**
1. H1 "Forms"
2. Subtitle body-sm muted "Recruitment, feedback, and registration"
3. `Tabs` if there are multiple forms: tab labels show the form titles. Below the tab strip, the active form renders in an iframe at `aspect-[3/4]` minimum height, `min-h-[600px]`, `rounded-lg border border-border`.

**Desktop:** Same, with iframe `min-h-[800px]`.

**Components:** Tabs, Card (as iframe wrapper).

**States:**
- Single form → no tabs, just the iframe and the form title as h2 above it.
- No forms → empty state.
- Iframe loading → Skeleton placeholder at the same height.

---

### 5.7 `/blogs` (Public / Member-aware)

**Purpose:** List approved blog posts.

**Mobile:** 1-column blog card list. Card:
- Cover image (16:9 aspect, `object-cover`, `rounded-t-lg`)
- Padding block: title (h3), excerpt (2 lines body-sm muted, `line-clamp-2`), metadata row (author avatar + name + caption date)
- Private badge if `visibility = 'private'` (only members see these cards at all)

**Desktop:** `grid-cols-2 lg:grid-cols-3 gap-6`.

**Header:** H1 "Blog" + a `Select` "Sort by: Latest / Oldest" on the right. Optional `ToggleGroup` "All / Public / Private" — Private appears only for logged-in members.

**Components:** Card, Avatar, Badge, Select, ToggleGroup.

---

### 5.8 `/blogs/[slug]` (Public / Member-aware)

**Purpose:** Read one blog post.

**Mobile:**
1. Back link
2. Cover image (full-bleed within container, 16:9)
3. Title (h1), metadata row (author avatar + name + date + private badge if applicable)
4. Body — `max-w-prose` rendered markdown:
   - Paragraphs at body size, leading-relaxed
   - Embedded images centered, rounded-md, with optional caption below in caption style
   - External links use the default link style (underline on hover, `text-primary`)
5. Bottom: "Related" section with up to 3 small blog cards

**Desktop:** Same, but body capped at `max-w-2xl` centered. Right rail not used — keep focus on reading.

**Components:** Avatar, Badge, Card (for related), Separator.

---

### 5.9 `/resources` (Public / Member-aware)

**Purpose:** Browse downloadable resources.

**Mobile:**
1. H1 "Resources"
2. Search input + Category `Select`
3. 1-column resource list. Each row is a Card with:
   - Icon (lucide, by category — `FileText`, `FileSpreadsheet`, etc.) in a `h-10 w-10` rounded-md `bg-muted` square
   - Title (h4) + description (1 line, line-clamp-1, muted)
   - Right side: file size in caption + a `Download` icon button (ghost)
   - If private, an outline Badge "Members only"

**Desktop:** Same content, `grid-cols-2 gap-4`. Filter row sits above the grid.

**Components:** Card, Input, Select, Button (ghost icon), Badge.

**States:** Guests don't see private resources at all (filter them out server-side).

---

### 5.10 `/resources/[id]` (Public / Member-aware)

**Purpose:** Preview and download a single resource.

**Mobile:**
1. Back link
2. Resource header: icon + title (h1) + category badge + private badge if applicable
3. Description body
4. **PDF preview:** full-width iframe, `aspect-[3/4]`, `rounded-lg border`. **Image preview:** `<img>` `rounded-lg`. **Other files:** centered card with filename, size, "Open in new tab" + "Download" buttons.
5. Metadata footer: Uploaded by (Avatar + name), Date, Size, MIME type — in a 2-column key/value grid

**Desktop:** Two-column: preview left (8/12), metadata + actions card right (4/12, sticky).

**Components:** Card, Badge, Button, Avatar.

---

### 5.11 `/projects` — Projects List (Public / Member-aware)

**Purpose:** Show member projects with quick links to repo / live demo.

**Mobile:**
1. H1 "Projects"
2. `Input` search + `Select` for tag/tech-stack filter
3. 1-column ProjectCard list. ProjectCard:
   - Cover image (16:9)
   - Padding block:
     - Title (h3) + private badge if applicable
     - Description (line-clamp-2, body-sm muted)
     - Tech-stack chips row (up to 3 visible + "+N" overflow). Use `Badge variant="secondary"`.
     - Contributors row: stack of overlapping avatars (`-space-x-2`), max 4 visible + "+N", body-sm muted
     - Bottom row: two ghost icon buttons — `Github` icon → repo_url, `ExternalLink` icon → live_url. Hide whichever is null.

**Desktop:** `grid-cols-2 lg:grid-cols-3 gap-6`.

**Components:** Card, Badge, Avatar (overlap stack), Button (ghost icon), Input, Select.

**States:**
- Guests only see `status='approved'` AND `visibility='public'`.
- Loading: 6 Skeleton cards.
- Empty: empty state with `Sparkles` icon, "No projects yet" + (for members) a "Submit a project" button.

---

### 5.12 `/projects/[id]` — Project Detail (Public / Member-aware)

**Purpose:** Full project showcase.

**Mobile:**
1. Back link "← Projects"
2. Hero: cover image (16:9, rounded-lg)
3. Title (h1) + status badge + private badge if applicable
4. Subtitle: short description (body, muted)
5. Action row: two primary-style buttons side by side — "View Repository" (`Github` icon + label) and "Live Demo" (`ExternalLink` icon + label). Hide whichever is null. If only one exists, it's full-width.
6. Tech-stack section: H3 "Built with" + a chip row of all tech-stack badges
7. Description: H3 "About this project" + body markdown (`max-w-prose`)
8. Contributors: H3 "Contributors" + list of member rows (avatar + name + role_on_project, each row a link to `/members/[id]`)
9. Timeline: small key/value pair — Started: date · Completed: date (or "Ongoing")
10. Attachments: gallery of screenshots in a 2-column grid, click to lightbox (Dialog)
11. External links: list of labeled links (e.g., "Devpost", "Demo video")

**Desktop:** Two-column. Left (8/12): hero image + description + contributors + attachments. Right (4/12, sticky): a "Project info" Card holding the action buttons, tech-stack chips, timeline, and any external links.

**Components:** Card, Badge, Button, Avatar, Separator, Dialog (for attachment lightbox).

---

### 5.13 `/events` — Events List (Public / Member-aware)

**Purpose:** Show approved org events grouped by Upcoming and Past.

**Mobile (375px), top → bottom:**
1. Page header row: H1 "Events" left. If session has officer role, primary button "New event" → `/events/new` on the right (button-only, no label on mobile if cramped; use `Plus` icon).
2. `Tabs` strip: "Upcoming" (default) · "Past". Member-aware: a third "All" tab appears for officers/admins showing pending too.
3. Filter row: visibility `ToggleGroup` (only shown to members: All / Public / Private) on its own line.
4. 1-column EventCard list. **EventCard** structure:
   - Cover image strip on the left (h-24 w-24, rounded-md, object-cover) — if no cover, a muted-background square with `CalendarDays` icon centered.
   - Right column (flex-1):
     - Title (h4, font-semibold, line-clamp-1)
     - Datetime row: `Calendar` icon + formatted date and time (body-sm, muted-foreground). Format example: "Sat, Nov 15 · 2:00 – 5:00 PM"
     - Location row: `MapPin` icon + location text (body-sm muted, line-clamp-1)
     - Bottom: status pill if relevant. "Upcoming in 3 days" (secondary Badge with `Clock` icon) on cards within 7 days; "Private" (outline Badge) on private events; "Pending approval" (warning Badge) for officers viewing not-yet-approved events.

**Desktop (≥1024px):**
- Same content. Event cards become full-width row cards (cover h-32 w-48 left, content right) OR a 2-column grid (`grid-cols-2 gap-6`) when cover-prominent layout is preferred. Default to the row layout for date-scannability.

**Components:** Card, Badge, Tabs, ToggleGroup, Button.

**States:**
- Guests only see `status='approved'` AND `visibility='public'`.
- Loading: 4 Skeleton EventCards.
- Empty Upcoming: empty state with `CalendarOff` icon, "No upcoming events" + (for officers) primary "Create event" button.
- Empty Past: simpler text-only "No past events yet."

---

### 5.14 `/events/[slug]` — Event Detail (Public / Member-aware)

**Purpose:** Full event details with calendar add and map link.

**Mobile, top → bottom:**
1. Back link "← Events"
2. Cover image (16:9, full-bleed within container, rounded-lg)
3. Status row: status Badge ("Upcoming" / "Past" / "Cancelled") + private Badge if applicable
4. Title (h1)
5. **Datetime block** in a Card with muted background, `p-4 rounded-lg`:
   - `Calendar` icon h-5 w-5 + "Sat, November 15, 2025" (body, font-medium)
   - `Clock` icon h-5 w-5 + "2:00 PM – 5:00 PM" (body, font-medium)
   - Below, ghost button row: "Add to Google Calendar" + "Add to Apple Calendar" (icon + label, ghost variant). On mobile these collapse into a single `DropdownMenu` triggered by a single "Add to calendar" button.
6. **Location block** in a Card:
   - `MapPin` icon + location text
   - If location_url present, a secondary button "Open map" → opens external link with `_blank`
7. Description: H3 "About this event" + body markdown (`max-w-prose`)
8. Created-by footer (muted, body-sm): "Organized by [Officer Avatar + Name + Position Badge]"

**Desktop:** Two-column. Left (8/12): cover image + title + description. Right (4/12, sticky `top-20`): two stacked Cards — datetime + add-to-calendar in one, location + map link in another, organizer info below.

**Components:** Card, Badge, Button, Avatar, DropdownMenu, Separator.

**States:**
- Past event: muted overall tone, status Badge changes to "Past". No calendar-add button. Body stays.
- Cancelled: destructive-outline banner above the title: "This event was cancelled." Body stays accessible for record.
- Pending (officers viewing own event): yellow warning banner above title: "Pending — N of 3 approvals received."

---

### 5.15 `/events/new` & `/events/approvals` (Officer-only)

These two pages share access rules — only members with a current `officers` row reach them. Members see a 403; guests redirect to login.

#### 5.15.1 `/events/new` — Submit Event

**Mobile:**
1. Back link "← Events"
2. H1 "Create event"
3. Body-sm muted: "Your event will be sent to the 3 approver positions for review."
4. Form Card (single column, sections separated by `Separator`):
   - **Basics:** Title (Input), Slug (Input — auto-generated from title, editable), Description (Textarea — short, 200 char counter)
   - **When:** Starts at (DatePicker + TimePicker), Ends at (DatePicker + TimePicker). Inline validation: ends must be after starts.
   - **Where:** Location (Input), Location URL (Input, type=url, optional, helper text "Google Maps or meeting link")
   - **Details:** Body markdown (Textarea, rows=8) with a small body-sm muted helper "Markdown supported: **bold**, *italic*, [link](url), images via upload."
   - **Cover image:** dropzone (use shadcn-compatible file input with preview)
   - **Visibility:** Switch with label "Public" (default ON). Below switch, muted helper explaining what each means.
5. Sticky bottom action bar (mobile): "Submit for approval" primary full-width; "Save as draft" ghost above it; "Cancel" text link top-left.

**Desktop:** Same form, `max-w-2xl`. Action buttons inline bottom-right (Cancel ghost · Save draft outline · Submit primary).

**Components:** Form, Input, Textarea, DatePicker, Switch, Button, Card, Separator.

**States:**
- Editing existing pending event (no votes yet): same form pre-filled; submit button reads "Update". A muted note above the form: "You can edit this event until the first vote is cast."
- Editing locked (≥1 vote exists): form is read-only with a clear muted banner "This event is now under review. Contact an admin to make changes."
- Submission success: Sonner toast "Event submitted for approval" + redirect to `/events/[slug]` showing pending state.

#### 5.15.2 `/events/approvals` — Vote Queue (Approver Officers Only)

This page is visible only to officers who hold one of the 3 `is_approver=TRUE` positions. Other officers and members see a 403.

**Mobile:**
1. H1 "Event approvals"
2. Subtitle body-sm muted: "X events awaiting your vote · You vote as [Position Name]"
3. `Tabs` strip: "Awaiting my vote" (default) · "Already voted" · "All pending"
4. EventApprovalCard list (1-column). **EventApprovalCard** structure:
   - Card header: title (h4) + small Badge showing days-until-event ("In 12 days")
   - Sub-row: created_by avatar + "Submitted by [Name], [Position]" + caption-style relative time ("3 hours ago")
   - 1-line description (line-clamp-1, muted)
   - **Approval status row** (the distinctive UI for this page): 3 small chips in a row, one per approver position, each showing the position name and an icon — `Check` (green) for approved, `X` (red) for rejected, `Clock` (muted) for pending. The current user's chip is highlighted with a ring (`ring-2 ring-ring`).
   - Bottom action row: ghost "Preview" (opens Sheet) · destructive-outline "Reject" · primary "Approve". If current user already voted, the buttons are disabled and replaced with a body-sm muted "You voted [Approved/Rejected] on [date]".

**Desktop:** Same content as 1-column list (don't grid — each row needs to read like a queue item). Use `max-w-3xl mx-auto`.

**Reject flow:** Clicking Reject opens an AlertDialog: H3 "Reject this event?", a Textarea labeled "Reason (required)", "Cancel" ghost + destructive "Confirm reject" buttons. Submitting writes the vote with `decision='rejected'` and the reason as `comment`.

**Approve flow:** Clicking Approve opens a small Dialog confirming "Approve this event?" (no required comment, but optional). On submit, write vote with `decision='approved'`. If this is the 3rd approval, server-side transition flips `events.status='approved'` and the UI shows a success toast "Event approved and published."

**Components:** Card, Badge, Button, Tabs, AlertDialog, Dialog, Sheet (for preview), Avatar, Textarea.

**States:**
- Empty "Awaiting my vote": empty state with `Inbox` icon, "All caught up — no events need your vote."
- Empty "Already voted": "You haven't voted on any events yet."
- Vacant approver position (some other approver position has no current officer assigned): a muted Alert at the top of the page: "Heads up: the [Position Name] position is currently vacant. Events can't be fully approved until this is filled. Contact an admin." (See Hard Safety Rule in feasibility doc.)

---

### 5.16 `/profile` (Member)

**Purpose:** Edit own profile.

**Mobile:**
1. H1 "Your profile"
2. Form Card:
   - Avatar uploader at the top (current avatar + small "Change photo" ghost button below)
   - Inputs grouped into sections with Separators between them:
     - **Identity:** Full name, Student ID (read-only — set by admin), Course, Year level (Select)
     - **About:** Bio (Textarea, rows=4)
     - **Contact:** Contact email (Input, type=email)
   - Sticky bottom action bar on mobile: "Save changes" primary button full-width, "Cancel" ghost above it
3. Below the form, a destructive-tone Card "Sign out" with a single destructive button

**Desktop:** Same form, max-w-2xl, action buttons inline at the bottom right (Cancel ghost, Save primary).

**Components:** Form, Input, Textarea, Select, Button, Avatar, Separator, Card.

**States:** Saving → button shows spinner. Success → Sonner toast "Profile updated". Validation errors inline under each field.

---

### 5.17 Admin pages — shared layout

**Layout:**
- Sidebar (described in §3.3) is the persistent left rail on `lg:` and up.
- Main pane starts with a page header row: H1 left, primary action button right ("New project", "Register member", etc.).
- Below the header: filter row (Search input + Select filters) if applicable.
- Then a `Table` or grid of items.

**`/admin` dashboard:**
- 4 stat cards in a row (`grid-cols-2 lg:grid-cols-4 gap-4`): Total members · Pending blogs · Pending projects · Pending events
- Below: two-column section — "Recent activity" (audit feed) + "Pending approvals" (list with Approve/Reject buttons; mixes blogs, projects, and admin-force-approve actions for events)
- If any approver position is currently vacant, a destructive-outline Alert appears at the top: "[Position Name] is vacant — events cannot be fully approved. Assign an officer."

**`/admin/content`:** A vertical Tabs sidebar (Welcome page · Officers page · Footer) with a form on the right per tab. Save button sticky at the bottom of the form.

**`/admin/officers`:** Two stacked sections.
- Section A — **Positions** (top): a small horizontal Card row, one Card per position, each showing the position name, an `is_approver` Badge ("Approver" with `ShieldCheck` icon when true), display_order, and `MoreVertical` menu (Rename · Toggle approver · Reorder). Inline rule reminder: "Exactly 3 positions must be marked Approver."
- Section B — **Officers** (below): Table view (Name · Position · Term · Status · Actions). Actions column has a `MoreVertical` DropdownMenu: Edit, Deactivate, Reorder. "New officer" button in page header opens a Dialog with a member picker.

**`/admin/members`:** Table view (Avatar · Name · Email · Role · Status · Joined). Each row has a `DropdownMenu`: Edit, Reset password, Promote to admin, Deactivate. "Register member" in page header opens a Dialog (Email · Full name · Initial password — generated).

**`/admin/blogs/approval`:** A list, not a table. Each pending blog gets a Card showing cover, title, author avatar+name, submitted-on date, excerpt — with three buttons: Preview (ghost), Approve (primary), Reject (destructive outline). Reject opens an AlertDialog asking for a reason.

**`/admin/projects`:** Same pattern as blog approval (Card list with Preview / Approve / Reject), plus a `Tabs` strip at the top: Pending · Approved · Rejected · Archived.

**`/admin/events`:** `Tabs` strip at top: Pending · Approved · Past · Cancelled · All. Each tab renders a Table (Cover thumb · Title · When · Location · Created by · Approval status · Actions).
- The **Approval status** column shows the same 3-chip approver-position visualization used on `/events/approvals` so admins see at a glance who has and hasn't voted.
- The **Actions** column has a `MoreVertical` menu: Preview, Edit, Force-approve (only if status='pending' — opens AlertDialog warning that this bypasses officer review and is logged), Cancel (sets status='cancelled'), Delete (destructive, opens AlertDialog).
- Page-header buttons: none — admins do not create events; they only override.

**`/admin/resources`:** Table (Icon · Title · Category · Size · Visibility · Uploaded by · Actions). Page header has "Upload resource" button → Dialog with file dropzone, title, description, category Select, visibility Switch.

**`/admin/roles`:** Simple Table of admins (Name · Email · Promoted on · By). One-button-per-row "Revoke admin" (disabled for self). A second section below: "Members" Table with a "Promote to admin" button per row.

**`/admin/audit`:** Filter row at top (Actor Select · Action Select · Date range). Below: a Table (When · Actor · Action · Entity · Target · IP). Clicking a row opens a Sheet from the right showing the JSONB before/after diff side-by-side. Event-related actions to surface clearly with distinct badges: `CREATE_EVENT`, `VOTE_APPROVE_EVENT`, `VOTE_REJECT_EVENT`, `FORCE_APPROVE_EVENT`, `CANCEL_EVENT`, `DELETE_EVENT`.

**Components:** All shadcn primitives listed in §4 plus Sheet (for audit detail and the mobile sidebar).

---

### 5.18 Auth-related screens

- **Logged-out users hitting a member URL:** Don't show a half-empty page. Redirect to `/login?next=<path>`. The login page shows a small muted note at the top of the form: "Sign in to continue to [page name]."
- **403 page** (member-only URL accessed by guest who is logged in but disallowed — e.g., a hypothetical role mismatch): Centered, `Lock` icon (h-12 w-12 muted-foreground), h2 "Members only", body-sm "This page is visible to logged-in members.", primary button "Sign in" + ghost "Back to home". (For the practical case where there are only 3 roles, this rarely triggers — most disallowed access redirects to /login.)
- **404 page:** Same layout, `Compass` icon, h2 "Page not found", body-sm, primary "Back to home".

---

## 6. Interaction & Motion

- **Transitions:** Use Tailwind's built-in `transition-colors`, `transition-shadow`, `transition-transform`. Duration `duration-150` for hovers, `duration-200` for layout shifts.
- **Hover:** Cards lift with `hover:shadow-sm hover:-translate-y-0.5`. Buttons darken via shadcn defaults. Links underline.
- **Focus:** Always visible. Use shadcn's default `ring-2 ring-ring ring-offset-2`. Never remove focus rings.
- **Page transitions:** None. Keep navigations instant; rely on Skeleton states.
- **Toasts:** Sonner. Auto-dismiss 4s. One toast at a time for the same channel; stack different channels.
- **Skeletons over spinners:** Whenever the layout is known, render Skeleton blocks that match. Spinners only inside buttons during submit.

---

## 7. Accessibility Floor

- Color contrast: body text on background ≥ 4.5:1, large text ≥ 3:1. shadcn neutral defaults already meet this — don't introduce custom colors that break it.
- Every interactive element has a visible focus state.
- Every icon-only button has an `aria-label`.
- Every image has alt text. Decorative images use `alt=""`.
- Form fields have associated `<Label>`. Errors are announced via `aria-describedby`.
- Modals trap focus (shadcn Dialog handles this — don't bypass).
- Skip-to-content link at the top of every page, visually hidden until focused.
- Don't rely on color alone for status (always pair with text or icon — e.g., "Pending" badge with clock icon).

---

## 8. Dark Mode

Built-in via shadcn `.dark` class on `<html>`. Claude does not produce light-only mockups.

Switch UI: a single `Sun` / `Moon` toggle in the top nav (right side, before the user avatar). Toggle uses a `DropdownMenu` with Light / Dark / System options. Persist preference in `localStorage` (handled by `next-themes`).

All colors in mockups must work in both modes — Claude tests against `--background` and `--foreground` token pairs, not hex values.

---

## 9. What Claude Does Before Designing a Page

Sequence Claude follows when asked to mock up or design any screen:

1. Open this guide. Identify which page in §5 the request maps to (or which existing page is closest if new).
2. Note the components from §4 that apply.
3. Sketch the mobile layout first using only tokens from §2.
4. Add desktop variations from §3.1 breakpoints.
5. Specify states from the per-page entry (loading, empty, error, role variations across guest / member / officer / admin).
6. Annotate any deviations and why (deviations require a reason; default is to follow this guide).

When Claude produces a visual mockup, it uses only the tokens and components in this guide. If the user asks for something outside the guide (e.g., "make it more colorful"), Claude flags the conflict and either updates the guide or notes the page-specific exception.

---

## 10. Out of Scope

Claude does not, in mockups for this project:

- Use gradients (the org brand is "clean", not "playful").
- Use display fonts or any font besides Inter / JetBrains Mono.
- Use emoji as UI decoration (allowed in user-generated content like blogs, never in chrome).
- Use color to differentiate categories (use icons + labels).
- Use background images on cards.
- Use animated illustrations or Lottie.
- Add carousels (use grids; the user can scroll).
- Add modals for content that could be a page (modals are for confirmations and quick edits only).
