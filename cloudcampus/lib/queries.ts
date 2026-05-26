import type { PoolClient, QueryResultRow } from "pg";

import { pool } from "@/lib/db";
import { formatBytes, formatDate, formatEventWhen } from "@/lib/format";
import {
  LOOKUP_TABLES,
  type LookupKey,
  type LookupRow,
} from "@/lib/lookups";
import type { StoredRole } from "@/lib/jwt";
import { defaultOrg, type OrgInfo } from "@/lib/org";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementLevel,
  Attachment,
  BlogPost,
  FormLink,
  Member,
  OfficerSummary,
  OrgEvent,
  Project,
  RegistrationRequest,
  ResourceItem,
  ResourceType,
  SchoolYear,
} from "@/lib/types";
import type { Session } from "@/lib/session";

/** Builds the in-app URL that serves an S3 media object (cover / attachment). */
function mediaUrl(s3Key: string | null | undefined): string | null {
  return s3Key ? `/api/media?key=${encodeURIComponent(s3Key)}` : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Maps a json_agg of attachment rows into the application Attachment shape. */
function mapAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: any) => {
    const isImage = a.kind === "image";
    return {
      id: a.id as string,
      kind: isImage ? "image" : "link",
      imageUrl: isImage ? mediaUrl(a.s3_key) : null,
      key: isImage ? (a.s3_key ?? null) : null,
      url: isImage ? null : (a.url ?? null),
      label: a.label ?? "",
    };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** An attachment as submitted by a create form. */
export interface AttachmentInput {
  kind: "image" | "link";
  /** S3 key when kind === "image". */
  key: string | null;
  /** External URL when kind === "link". */
  url: string | null;
  label: string;
}

/** Parses and cleans the attachments array submitted by a create form. */
export function parseAttachments(value: unknown): AttachmentInput[] {
  if (!Array.isArray(value)) return [];
  const out: AttachmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const kind = a.kind === "image" ? "image" : "link";
    const key = typeof a.key === "string" && a.key ? a.key : null;
    const url =
      typeof a.url === "string" && a.url.trim() ? a.url.trim() : null;
    if (kind === "image" ? !key : !url) continue;
    out.push({
      kind,
      key,
      url,
      label: typeof a.label === "string" ? a.label.trim() : "",
    });
  }
  return out;
}

/** Inserts a create form's attachments into blog_attachments/project_attachments. */
async function insertAttachments(
  client: PoolClient,
  table: "blog_attachments" | "project_attachments",
  fkColumn: "blog_id" | "project_id",
  labelColumn: "caption" | "label",
  ownerId: string,
  items: AttachmentInput[],
): Promise<void> {
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    if (a.kind === "image" ? !a.key : !a.url) continue;
    await client.query(
      `INSERT INTO ${table} (${fkColumn}, kind, s3_key, url, ${labelColumn}, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ownerId,
        a.kind === "image" ? "image" : "external_link",
        a.kind === "image" ? a.key : null,
        a.kind === "link" ? a.url : null,
        a.label,
        i,
      ],
    );
  }
}

// Server-only data access. Never import from a client component.
//
// Query functions map snake_case rows into the camelCase domain types in
// lib/types.ts and fill derived display fields (dateLabel, excerpt, coverAlt).

// --- Resilient reads --------------------------------------------------------

const DATABASE_CONFIGURED = Boolean(process.env.DATABASE_URL);
let warnedAboutDatabase = false;
const missingRelationsWarned = new Set<string>();

function warnOnce(reason: string): void {
  if (warnedAboutDatabase) return;
  warnedAboutDatabase = true;
  console.warn(`[db] ${reason} — pages will render with no data.`);
}

/** True when an error means the database is unreachable, not a query bug. */
function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH", "ECONNRESET"].includes(
      code,
    )
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("connect") ||
    message.includes("terminated") ||
    message.includes("getaddrinfo")
  );
}

/**
 * Runs a read query, degrading to an empty result when:
 *  - DATABASE_URL is unset, or
 *  - the database is unreachable, or
 *  - the relation doesn't exist (Postgres 42P01 / 42703) — i.e. a pending
 *    migration. This keeps the public layout from 500ing every page when V2
 *    code is deployed before `npm run db:migrate` has been run.
 *
 * A real SQL error (constraint violation, type mismatch on a column that DOES
 * exist) still throws so genuine bugs are not hidden.
 */
async function readQuery(
  text: string,
  params?: unknown[],
): Promise<{ rows: QueryResultRow[] }> {
  if (!DATABASE_CONFIGURED) {
    warnOnce("DATABASE_URL is not set");
    return { rows: [] };
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (isConnectionError(err)) {
      warnOnce("database is unreachable");
      return { rows: [] };
    }
    const code = (err as { code?: string } | null)?.code ?? "";
    // 42P01 = undefined_table, 42703 = undefined_column. Both mean the schema
    // is behind the code — usually a pending migration.
    if (code === "42P01" || code === "42703") {
      const message = err instanceof Error ? err.message : String(err);
      if (!missingRelationsWarned.has(message)) {
        missingRelationsWarned.add(message);
        console.warn(
          `[db] schema out of date (${message}) — run \`npm run db:migrate\`. Returning empty result so pages still render.`,
        );
      }
      return { rows: [] };
    }
    throw err;
  }
}

// --- Auth (used by lib/auth.ts) ---------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  role: StoredRole;
  isActive: boolean;
  memberId: string;
}

export async function findAuthUserByEmail(
  email: string,
): Promise<AuthUser | null> {
  const { rows } = await readQuery(
    `SELECT u.id, u.email, u.password_hash, u.role, u.is_active, m.id AS member_id
       FROM users u JOIN members m ON m.user_id = u.id
      WHERE u.email = $1`,
    [email],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role === "admin" ? "admin" : "member",
    isActive: r.is_active === true,
    memberId: r.member_id,
  };
}

export async function isCurrentOfficer(memberId: string): Promise<boolean> {
  const { rows } = await readQuery(
    `SELECT EXISTS (
       SELECT 1 FROM officers WHERE member_id = $1 AND is_current
     ) AS is_officer`,
    [memberId],
  );
  return rows[0]?.is_officer === true;
}

// --- Mapping helpers --------------------------------------------------------

function paragraphs(markdown: string | null): string[] {
  return (markdown ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function excerptOf(markdown: string | null): string {
  const first = paragraphs(markdown)[0] ?? "";
  return first.length > 180 ? `${first.slice(0, 177)}…` : first;
}

const RESOURCE_TYPE_BY_EXT: Record<string, ResourceType> = {
  pdf: "pdf",
  doc: "docx",
  docx: "docx",
  xls: "xlsx",
  xlsx: "xlsx",
  ppt: "pptx",
  pptx: "pptx",
  zip: "zip",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
};

function resourceTypeOf(fileName: string): ResourceType {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return RESOURCE_TYPE_BY_EXT[ext] ?? "pdf";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEvent(r: any): OrgEvent {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    dateLabel: formatEventWhen(r.starts_at, r.ends_at),
    location: r.location ?? "",
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    coverAlt: `${r.title} cover image`,
    coverUrl: mediaUrl(r.cover_s3_key),
    coverKey: r.cover_s3_key ?? null,
    summary: r.description,
    body: paragraphs(r.body_markdown),
    bodyMarkdown: r.body_markdown ?? "",
    locationNote: "",
    locationUrl: r.location_url ?? null,
    visibility: r.visibility,
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.creator_name ?? "",
    createdByPosition: r.creator_position ?? null,
  };
}

function mapBlog(r: any): BlogPost {
  const date = new Date(r.published_at ?? r.created_at).toISOString();
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: excerptOf(r.body_markdown),
    authorId: r.author_id,
    author: r.author_name ?? "",
    date,
    dateLabel: formatDate(date),
    visibility: r.visibility,
    status: r.status,
    coverAlt: `${r.title} cover image`,
    coverUrl: mediaUrl(r.cover_s3_key),
    coverKey: r.cover_s3_key ?? null,
    body: paragraphs(r.body_markdown),
    bodyMarkdown: r.body_markdown ?? "",
    attachments: mapAttachments(r.attachments),
  };
}

function mapProject(r: any): Project {
  return {
    id: r.id,
    title: r.title,
    summary: r.description,
    body: paragraphs(r.body_markdown),
    bodyMarkdown: r.body_markdown ?? "",
    status: r.status,
    visibility: r.visibility,
    stack: r.tech_stack ?? [],
    tags: r.tags ?? [],
    categoryId: r.category_id ?? null,
    contributors: (r.contributors ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      course: c.course ?? null,
      roleOnProject: c.role_on_project ?? null,
    })),
    submittedBy: r.submitted_by,
    repoUrl: r.repo_url ?? null,
    liveUrl: r.live_url ?? null,
    publishedUrl: r.published_url ?? null,
    startedOn: r.started_on ? formatDate(r.started_on) : "—",
    completedOn: r.completed_on ? formatDate(r.completed_on) : "Ongoing",
    coverAlt: `${r.title} cover image`,
    coverUrl: mediaUrl(r.cover_s3_key),
    coverKey: r.cover_s3_key ?? null,
    category: r.category_name ?? null,
    attachments: mapAttachments(r.attachments),
  };
}

function mapResource(r: any): ResourceItem {
  const date = new Date(r.created_at).toISOString();
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    category: r.category_name ?? "Uncategorized",
    type: resourceTypeOf(r.file_name),
    size: formatBytes(Number(r.size_bytes)),
    fileName: r.file_name,
    s3Key: r.s3_key,
    visibility: r.visibility,
    uploadedBy: r.uploaded_by,
    date,
    dateLabel: formatDate(date),
  };
}

function mapMember(r: any): Member {
  return {
    id: r.id,
    name: r.full_name,
    studentId: r.student_id ?? null,
    course: r.course ?? null,
    courseId: r.course_id ?? null,
    year: r.year_level ?? null,
    status: (r.status ?? "Active") as Member["status"],
    email: r.contact_email ?? null,
    accountEmail: r.account_email ?? "",
    bio: r.bio ?? null,
    role: r.role ?? "member",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Event SELECT fragment (creator name + position) ------------------------

const EVENT_SELECT = `
  SELECT e.*, m.full_name AS creator_name,
    (SELECT p.name FROM officers o
       JOIN officer_positions p ON p.id = o.position_id
      WHERE o.member_id = e.created_by AND o.is_current
      ORDER BY p.display_order LIMIT 1) AS creator_position
    FROM events e
    JOIN members m ON m.id = e.created_by`;

// --- Events -----------------------------------------------------------------

/** Events list. Public viewers see only approved+public. Members see approved
 *  (any visibility). Drafts/pending/rejected/revision_requested are surfaced
 *  via {@link getEventsByAuthor} on the "your drafts" panel, not here. */
export async function listEvents(privileged: boolean): Promise<OrgEvent[]> {
  const vis = privileged ? "" : `AND e.visibility = 'public'`;
  const { rows } = await readQuery(
    `${EVENT_SELECT} WHERE e.status = 'approved' ${vis} ORDER BY e.starts_at`,
  );
  return rows.map(mapEvent);
}

/** Every event created by `memberId`, all statuses, for the drafts panel. */
export async function getEventsByAuthor(memberId: string): Promise<OrgEvent[]> {
  const { rows } = await readQuery(
    `${EVENT_SELECT} WHERE e.created_by = $1 ORDER BY e.starts_at DESC`,
    [memberId],
  );
  return rows.map(mapEvent);
}

/** Up to `limit` upcoming, approved, public events for the welcome page. */
export async function getUpcomingPublicEvents(limit = 3): Promise<OrgEvent[]> {
  const { rows } = await readQuery(
    `${EVENT_SELECT}
      WHERE e.status = 'approved' AND e.visibility = 'public'
        AND e.starts_at >= now()
      ORDER BY e.starts_at LIMIT $1`,
    [limit],
  );
  return rows.map(mapEvent);
}

export async function getEvent(slug: string): Promise<OrgEvent | null> {
  const { rows } = await readQuery(`${EVENT_SELECT} WHERE e.slug = $1`, [slug]);
  return rows.length ? mapEvent(rows[0]) : null;
}

// --- Blogs ------------------------------------------------------------------

const BLOG_SELECT = `
  SELECT b.*, m.full_name AS author_name,
    COALESCE((
      SELECT json_agg(json_build_object(
               'id', a.id, 'kind', a.kind, 's3_key', a.s3_key,
               'url', a.url, 'label', a.caption)
             ORDER BY a.position)
        FROM blog_attachments a WHERE a.blog_id = b.id
    ), '[]'::json) AS attachments
    FROM blogs b
    JOIN members m ON m.id = b.author_id`;

/** Approved blogs; private posts only when `includePrivate`. */
export async function listBlogs(includePrivate: boolean): Promise<BlogPost[]> {
  const vis = includePrivate ? "" : `AND b.visibility = 'public'`;
  const { rows } = await readQuery(
    `${BLOG_SELECT}
      WHERE b.status = 'approved' ${vis}
      ORDER BY COALESCE(b.published_at, b.created_at) DESC`,
  );
  return rows.map(mapBlog);
}

export async function getLatestPublicBlogs(limit = 3): Promise<BlogPost[]> {
  const { rows } = await readQuery(
    `${BLOG_SELECT}
      WHERE b.status = 'approved' AND b.visibility = 'public'
      ORDER BY COALESCE(b.published_at, b.created_at) DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapBlog);
}

export async function getBlog(slug: string): Promise<BlogPost | null> {
  const { rows } = await readQuery(`${BLOG_SELECT} WHERE b.slug = $1`, [slug]);
  return rows.length ? mapBlog(rows[0]) : null;
}

export async function getRelatedBlogs(
  excludeId: string,
  includePrivate: boolean,
  limit = 3,
): Promise<BlogPost[]> {
  const vis = includePrivate ? "" : `AND b.visibility = 'public'`;
  const { rows } = await readQuery(
    `${BLOG_SELECT}
      WHERE b.status = 'approved' AND b.id <> $1 ${vis}
      ORDER BY COALESCE(b.published_at, b.created_at) DESC LIMIT $2`,
    [excludeId, limit],
  );
  return rows.map(mapBlog);
}

/** Every blog by `memberId`, ALL statuses, for the author's drafts panel. */
export async function getBlogsByAuthor(memberId: string): Promise<BlogPost[]> {
  const { rows } = await readQuery(
    `${BLOG_SELECT}
      WHERE b.author_id = $1
      ORDER BY COALESCE(b.published_at, b.created_at, b.edited_at, b.created_at) DESC`,
    [memberId],
  );
  return rows.map(mapBlog);
}

// --- Projects ---------------------------------------------------------------

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT name FROM project_categories WHERE id = p.category_id)
      AS category_name,
    COALESCE((
      SELECT json_agg(json_build_object(
               'id', m.id, 'name', m.full_name,
               'course', (SELECT name FROM courses WHERE id = m.course_id),
               'role_on_project', pc.role_on_project)
             ORDER BY pc.display_order)
        FROM project_contributors pc
        JOIN members m ON m.id = pc.member_id
       WHERE pc.project_id = p.id
    ), '[]'::json) AS contributors,
    COALESCE((
      SELECT json_agg(json_build_object(
               'id', a.id, 'kind', a.kind, 's3_key', a.s3_key,
               'url', a.url, 'label', a.label)
             ORDER BY a.position)
        FROM project_attachments a WHERE a.project_id = p.id
    ), '[]'::json) AS attachments
    FROM projects p`;

/** Projects list. Guests see approved+public only; members see approved
 *  with any visibility. Drafts/pending/rejected/revision are on
 *  {@link getProjectsByContributor} for the contributor's drafts panel. */
export async function listProjects(privileged: boolean): Promise<Project[]> {
  const vis = privileged ? "" : `AND p.visibility = 'public'`;
  const { rows } = await readQuery(
    `${PROJECT_SELECT} WHERE p.status = 'approved' ${vis} ORDER BY p.created_at DESC`,
  );
  return rows.map(mapProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const { rows } = await readQuery(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  return rows.length ? mapProject(rows[0]) : null;
}

export async function getProjectsByContributor(
  memberId: string,
): Promise<Project[]> {
  const { rows } = await readQuery(
    `${PROJECT_SELECT}
      WHERE EXISTS (
        SELECT 1 FROM project_contributors pc
         WHERE pc.project_id = p.id AND pc.member_id = $1
      )
      ORDER BY p.created_at DESC`,
    [memberId],
  );
  return rows.map(mapProject);
}

// --- Resources --------------------------------------------------------------

const RESOURCE_SELECT = `
  SELECT r.*, c.name AS category_name
    FROM resources r
    LEFT JOIN resource_categories c ON c.id = r.category_id`;

export async function listResources(
  includePrivate: boolean,
): Promise<ResourceItem[]> {
  const vis = includePrivate ? "" : `WHERE r.visibility = 'public'`;
  const { rows } = await readQuery(
    `${RESOURCE_SELECT} ${vis} ORDER BY r.created_at DESC`,
  );
  return rows.map(mapResource);
}

export async function getResource(id: string): Promise<ResourceItem | null> {
  const { rows } = await readQuery(`${RESOURCE_SELECT} WHERE r.id = $1`, [id]);
  return rows.length ? mapResource(rows[0]) : null;
}

export async function listResourceCategories(): Promise<string[]> {
  const { rows } = await readQuery(
    `SELECT name FROM resource_categories ORDER BY name`,
  );
  return rows.map((r) => r.name);
}

// --- Members & officers -----------------------------------------------------

const MEMBER_SELECT = `
  SELECT m.id, m.full_name, m.student_id, m.contact_email, m.bio,
         u.role, u.email AS account_email,
         c.name AS course, m.course_id,
         y.display_order AS year_level, s.name AS status
    FROM members m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN year_levels y ON y.id = m.year_level_id
    LEFT JOIN member_statuses s ON s.id = m.status_id`;

export async function listMembers(): Promise<Member[]> {
  const { rows } = await readQuery(`${MEMBER_SELECT} ORDER BY m.full_name`);
  return rows.map(mapMember);
}

export async function getMember(id: string): Promise<Member | null> {
  const { rows } = await readQuery(`${MEMBER_SELECT} WHERE m.id = $1`, [id]);
  return rows.length ? mapMember(rows[0]) : null;
}

function mapOfficer(r: Record<string, unknown>): OfficerSummary {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    name: r.full_name as string,
    position: r.position_name as string,
    term: (r.school_year_label as string) ?? (r.term_label as string) ?? "",
    schoolYearId: (r.school_year_id as string) ?? "",
    isApprover: r.is_approver as boolean,
    order: r.display_order as number,
  };
}

const OFFICER_SELECT = `
  SELECT o.id, o.member_id, o.school_year_id, m.full_name,
         p.name AS position_name, p.is_approver, p.display_order,
         sy.label AS school_year_label
    FROM officers o
    JOIN members m ON m.id = o.member_id
    JOIN officer_positions p ON p.id = o.position_id
    JOIN school_years sy ON sy.id = o.school_year_id`;

/** Current officers, ordered by position, for the officers roster page. */
export async function listOfficers(
  schoolYearId?: string,
): Promise<OfficerSummary[]> {
  if (schoolYearId) {
    const { rows } = await readQuery(
      `${OFFICER_SELECT} WHERE o.school_year_id = $1
        ORDER BY p.display_order, m.full_name`,
      [schoolYearId],
    );
    return rows.map(mapOfficer);
  }
  const { rows } = await readQuery(
    `${OFFICER_SELECT} WHERE o.is_current ORDER BY p.display_order`,
  );
  return rows.map(mapOfficer);
}

/** All officer roles a member has held, for their profile page. */
export async function getOfficerHistory(
  memberId: string,
): Promise<OfficerSummary[]> {
  const { rows } = await readQuery(
    `${OFFICER_SELECT}
      WHERE o.member_id = $1
      ORDER BY sy.start_year DESC, p.display_order`,
    [memberId],
  );
  return rows.map(mapOfficer);
}

// --- Forms ------------------------------------------------------------------

export async function listForms(includePrivate: boolean): Promise<FormLink[]> {
  const vis = includePrivate ? "" : `AND f.visibility = 'public'`;
  const { rows } = await readQuery(
    `SELECT f.id, f.title, f.description, lower(p.name) AS provider,
            f.embed_url, f.url, f.visibility
       FROM form_links f
       LEFT JOIN form_providers p ON p.id = f.provider_id
      WHERE f.is_active = TRUE ${vis}
      ORDER BY f.display_order, f.title`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    provider: r.provider ?? "google",
    embedHtml: r.embed_url ?? r.url,
    url: r.url,
    visibility: r.visibility,
  }));
}

// --- Writes (Phase 5 member/officer features) -------------------------------

async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

/** A slug unique within `table`, suffixed if the base is taken. */
async function uniqueSlug(
  client: PoolClient,
  table: "blogs" | "events" | "projects",
  title: string,
): Promise<string> {
  const base = slugify(title);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate =
      attempt === 0
        ? base
        : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { rows } = await client.query(
      `SELECT 1 FROM ${table} WHERE slug = $1`,
      [candidate],
    );
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Resolves a course name to its id, creating the course row if it is new
 * (FR-ADM-11). Returns null for blank input.
 */
async function courseIdForName(name: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const { rows } = await pool.query(
    `INSERT INTO courses (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [trimmed],
  );
  return rows[0].id as string;
}

/** Updates the editable fields of a member's own profile (FR-MEM-04). */
export async function updateMemberProfile(
  memberId: string,
  fields: {
    name: string;
    /** V2.1: the form sends `courseId` from the combobox. The legacy `course`
     *  (a free-text name) is kept as a fallback so older clients keep working
     *  until the dropdown rollout completes. */
    courseId: string | null;
    course?: string | null;
    year: number | null;
    bio: string | null;
    contactEmail: string | null;
  },
): Promise<void> {
  const resolvedCourseId =
    fields.courseId ?? (await courseIdForName(fields.course ?? null));
  await pool.query(
    `UPDATE members
        SET full_name = $2, course_id = $3,
            year_level_id = (
              SELECT id FROM year_levels WHERE display_order = $4
            ),
            bio = $5, contact_email = $6
      WHERE id = $1`,
    [
      memberId,
      fields.name,
      resolvedCourseId,
      fields.year,
      fields.bio,
      fields.contactEmail,
    ],
  );
}

/** Submits a blog post with status 'pending' (FR-MEM-06). Returns the slug. */
export async function createBlog(input: {
  authorId: string;
  title: string;
  bodyMarkdown: string;
  visibility: "public" | "private";
  coverS3Key: string | null;
  attachments: AttachmentInput[];
}): Promise<string> {
  return withTransaction(async (client) => {
    const slug = await uniqueSlug(client, "blogs", input.title);
    const { rows } = await client.query(
      `INSERT INTO blogs
         (author_id, title, slug, body_markdown, status, visibility,
          cover_s3_key)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6) RETURNING id`,
      [
        input.authorId,
        input.title,
        slug,
        input.bodyMarkdown,
        input.visibility,
        input.coverS3Key,
      ],
    );
    await insertAttachments(
      client,
      "blog_attachments",
      "blog_id",
      "caption",
      rows[0].id,
      input.attachments,
    );
    return slug;
  });
}

/** Submits a project with status 'pending'; adds the submitter as a
 *  contributor (FR-MEM-07). Returns the project id. */
export async function createProject(input: {
  submittedBy: string;
  title: string;
  description: string;
  bodyMarkdown: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  techStack: string[];
  tags: string[];
  visibility: "public" | "private";
  categoryId: string | null;
  coverS3Key: string | null;
  attachments: AttachmentInput[];
}): Promise<string> {
  return withTransaction(async (client) => {
    const slug = await uniqueSlug(client, "projects", input.title);
    const { rows } = await client.query(
      `INSERT INTO projects
         (title, slug, description, body_markdown, repo_url, live_url,
          tech_stack, tags, status, visibility, submitted_by,
          category_id, cover_s3_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11,$12)
       RETURNING id`,
      [
        input.title,
        slug,
        input.description,
        input.bodyMarkdown,
        input.repoUrl,
        input.liveUrl,
        input.techStack,
        input.tags,
        input.visibility,
        input.submittedBy,
        input.categoryId,
        input.coverS3Key,
      ],
    );
    const projectId = rows[0].id;
    await client.query(
      `INSERT INTO project_contributors (project_id, member_id, role_on_project)
       VALUES ($1, $2, 'Submitter')`,
      [projectId, input.submittedBy],
    );
    await insertAttachments(
      client,
      "project_attachments",
      "project_id",
      "label",
      projectId,
      input.attachments,
    );
    return projectId;
  });
}

/** Creates an event with status 'pending' (FR-OFF-02). Returns the slug. */
export async function createEvent(input: {
  createdBy: string;
  title: string;
  description: string;
  bodyMarkdown: string | null;
  location: string | null;
  locationUrl: string | null;
  startsAt: string;
  endsAt: string;
  visibility: "public" | "private";
  coverS3Key: string | null;
}): Promise<string> {
  return withTransaction(async (client) => {
    const slug = await uniqueSlug(client, "events", input.title);
    await client.query(
      `INSERT INTO events
         (title, slug, description, body_markdown, location, location_url,
          starts_at, ends_at, status, visibility, created_by, cover_s3_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11)`,
      [
        input.title,
        slug,
        input.description,
        input.bodyMarkdown,
        input.location,
        input.locationUrl,
        input.startsAt,
        input.endsAt,
        input.visibility,
        input.createdBy,
        input.coverS3Key,
      ],
    );
    return slug;
  });
}

// --- Edit + re-approval (V2.1) ---------------------------------------------

/**
 * Shared edit semantics for blogs/events/projects per V2.1 plan:
 *   - Only the original author (or an admin) may PATCH the row.
 *   - A row in 'rejected' status is permanent — no edits.
 *   - On any change the status flips to 'pending', edited_at = now(),
 *     and `previous_published_at` preserves the original publish stamp
 *     (so officers see "previously approved on …" in the queue).
 *   - For events, votes are wiped so approvers vote from scratch.
 *   - Attachments are replaced atomically (delete + reinsert).
 */
export class EditNotAllowedError extends Error {
  constructor(public reason: "not_author" | "rejected" | "not_found") {
    super(reason);
  }
}

async function assertEditable(
  client: PoolClient,
  table: "blogs" | "events" | "projects",
  authorColumn: "author_id" | "created_by" | "submitted_by",
  id: string,
  memberId: string,
  isAdmin: boolean,
): Promise<{ status: string; published_at: string | null }> {
  const { rows } = await client.query(
    `SELECT status, ${authorColumn} AS author, published_at
       FROM ${table} WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw new EditNotAllowedError("not_found");
  const r = rows[0];
  if (!isAdmin && r.author !== memberId) {
    throw new EditNotAllowedError("not_author");
  }
  if (r.status === "rejected") throw new EditNotAllowedError("rejected");
  return r;
}

export async function updateBlog(input: {
  id: string;
  memberId: string;
  isAdmin: boolean;
  title: string;
  bodyMarkdown: string;
  visibility: "public" | "private";
  coverS3Key: string | null;
  attachments: AttachmentInput[];
}): Promise<void> {
  await withTransaction(async (client) => {
    const before = await assertEditable(
      client,
      "blogs",
      "author_id",
      input.id,
      input.memberId,
      input.isAdmin,
    );
    await client.query(
      `UPDATE blogs
          SET title = $2, body_markdown = $3, visibility = $4,
              cover_s3_key = $5,
              status = 'pending',
              edited_at = now(),
              approved_at = NULL,
              approved_by = NULL,
              published_at = NULL,
              previous_published_at = COALESCE(previous_published_at, $6)
        WHERE id = $1`,
      [
        input.id,
        input.title,
        input.bodyMarkdown,
        input.visibility,
        input.coverS3Key,
        before.published_at,
      ],
    );
    await client.query("DELETE FROM blog_attachments WHERE blog_id = $1", [
      input.id,
    ]);
    await insertAttachments(
      client,
      "blog_attachments",
      "blog_id",
      "caption",
      input.id,
      input.attachments,
    );
  });
}

export async function updateProject(input: {
  id: string;
  memberId: string;
  isAdmin: boolean;
  title: string;
  description: string;
  bodyMarkdown: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  publishedUrl: string | null;
  techStack: string[];
  tags: string[];
  visibility: "public" | "private";
  categoryId: string | null;
  coverS3Key: string | null;
  attachments: AttachmentInput[];
}): Promise<void> {
  await withTransaction(async (client) => {
    const before = await assertEditable(
      client,
      "projects",
      "submitted_by",
      input.id,
      input.memberId,
      input.isAdmin,
    );
    await client.query(
      `UPDATE projects
          SET title = $2, description = $3, body_markdown = $4,
              repo_url = $5, live_url = $6, published_url = $7,
              tech_stack = $8, tags = $9, visibility = $10,
              category_id = $11, cover_s3_key = $12,
              status = 'pending',
              edited_at = now(),
              previous_published_at = COALESCE(previous_published_at, $13)
        WHERE id = $1`,
      [
        input.id,
        input.title,
        input.description,
        input.bodyMarkdown,
        input.repoUrl,
        input.liveUrl,
        input.publishedUrl,
        input.techStack,
        input.tags,
        input.visibility,
        input.categoryId,
        input.coverS3Key,
        before.published_at,
      ],
    );
    await client.query(
      "DELETE FROM project_attachments WHERE project_id = $1",
      [input.id],
    );
    await insertAttachments(
      client,
      "project_attachments",
      "project_id",
      "label",
      input.id,
      input.attachments,
    );
  });
}

export async function updateEvent(input: {
  id: string;
  memberId: string;
  isAdmin: boolean;
  title: string;
  description: string;
  bodyMarkdown: string | null;
  location: string | null;
  locationUrl: string | null;
  startsAt: string;
  endsAt: string;
  visibility: "public" | "private";
  coverS3Key: string | null;
}): Promise<void> {
  await withTransaction(async (client) => {
    await assertEditable(
      client,
      "events",
      "created_by",
      input.id,
      input.memberId,
      input.isAdmin,
    );
    await client.query(
      `UPDATE events
          SET title = $2, description = $3, body_markdown = $4,
              location = $5, location_url = $6,
              starts_at = $7, ends_at = $8,
              visibility = $9, cover_s3_key = $10,
              status = 'pending',
              edited_at = now(),
              approved_at = NULL
        WHERE id = $1`,
      [
        input.id,
        input.title,
        input.description,
        input.bodyMarkdown,
        input.location,
        input.locationUrl,
        input.startsAt,
        input.endsAt,
        input.visibility,
        input.coverS3Key,
      ],
    );
    // Wipe all votes for a clean re-approval round.
    await client.query("DELETE FROM event_approvals WHERE event_id = $1", [
      input.id,
    ]);
  });
}

export interface CurrentOfficer {
  officerId: string;
  positionId: string;
  positionName: string;
  isApprover: boolean;
}

/** The member's current officer assignment, if any. */
export async function getCurrentOfficer(
  memberId: string,
): Promise<CurrentOfficer | null> {
  const { rows } = await readQuery(
    `SELECT o.id AS officer_id, p.id AS position_id, p.name, p.is_approver
       FROM officers o
       JOIN officer_positions p ON p.id = o.position_id
      WHERE o.member_id = $1 AND o.is_current
      ORDER BY p.display_order LIMIT 1`,
    [memberId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    officerId: r.officer_id,
    positionId: r.position_id,
    positionName: r.name,
    isApprover: r.is_approver,
  };
}

export interface ApprovalVote {
  positionId: string;
  positionName: string;
  decision: "approved" | "rejected" | null;
}

/** Pending events with each approver position's current vote. */
export async function listPendingEvents(): Promise<
  Array<OrgEvent & { votes: ApprovalVote[] }>
> {
  const { rows } = await readQuery(
    `${EVENT_SELECT} WHERE e.status = 'pending' ORDER BY e.starts_at`,
  );
  const positions = await readQuery(
    `SELECT id, name FROM officer_positions WHERE is_approver ORDER BY display_order`,
  );
  const result = [];
  for (const row of rows) {
    const { rows: voteRows } = await readQuery(
      `SELECT position_id, decision FROM event_approvals WHERE event_id = $1`,
      [row.id],
    );
    const voteByPosition = new Map(
      voteRows.map((v) => [v.position_id, v.decision]),
    );
    result.push({
      ...mapEvent(row),
      votes: positions.rows.map((p) => ({
        positionId: p.id,
        positionName: p.name,
        decision: voteByPosition.get(p.id) ?? null,
      })),
    });
  }
  return result;
}

/**
 * Records an approval vote. The database triggers validate the vote
 * (approver position, current officer, no self-vote, rejection comment) and
 * advance the event status — see migration 0001.
 */
export async function castEventVote(input: {
  eventId: string;
  positionId: string;
  officerId: string;
  decision: "approved" | "rejected" | "revision_requested";
  comment: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO event_approvals (event_id, position_id, officer_id, decision, comment)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.eventId,
      input.positionId,
      input.officerId,
      input.decision,
      input.comment,
    ],
  );
}

/** Casts a project-approval vote (V2.1 extension). Validation + status
 *  finalization happen via project_approvals triggers in migration 0005. */
export async function castProjectVote(input: {
  projectId: string;
  positionId: string;
  officerId: string;
  decision: "approved" | "rejected" | "revision_requested";
  comment: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO project_approvals (project_id, position_id, officer_id, decision, comment)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.projectId,
      input.positionId,
      input.officerId,
      input.decision,
      input.comment,
    ],
  );
}

// --- Admin: audit log -------------------------------------------------------

/**
 * Appends a row to the audit log (FR-AUD-01/02). The audit_log table is
 * append-only; this is the only way rows are ever added.
 */
export async function writeAudit(input: {
  actorUserId: string;
  action: string;
  entity: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log
       (actor_id, action, entity, entity_id, before_data, after_data, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.actorUserId,
      input.action,
      input.entity,
      input.entityId,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.ip ?? null,
    ],
  );
}

export interface AuditEntry {
  id: string;
  at: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
}

export async function listAuditEntries(limit = 200): Promise<AuditEntry[]> {
  const { rows } = await readQuery(
    `SELECT a.id, a.created_at, a.action, a.entity, a.entity_id,
            a.ip_address, a.before_data, a.after_data,
            COALESCE(m.full_name, u.email) AS actor_name
       FROM audit_log a
       JOIN users u ON u.id = a.actor_id
       LEFT JOIN members m ON m.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    at: new Date(r.created_at).toISOString(),
    actorName: r.actor_name,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id ?? null,
    ip: r.ip_address ?? null,
    before: r.before_data ?? null,
    after: r.after_data ?? null,
  }));
}

// --- Admin: dashboard -------------------------------------------------------

export interface DashboardStats {
  activeMembers: number;
  pendingBlogs: number;
  pendingProjects: number;
  pendingEvents: number;
  /** Approver positions with no current officer assigned. */
  vacantApproverPositions: string[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { rows } = await readQuery(
    `SELECT
       (SELECT count(*) FROM members m
          JOIN member_statuses s ON s.id = m.status_id
         WHERE s.name = 'Active')                               AS active_members,
       (SELECT count(*) FROM blogs WHERE status = 'pending')    AS pending_blogs,
       (SELECT count(*) FROM projects WHERE status = 'pending') AS pending_projects,
       (SELECT count(*) FROM events WHERE status = 'pending')   AS pending_events`,
  );
  const counts = rows[0] ?? {};
  const { rows: vacant } = await readQuery(
    `SELECT p.name FROM officer_positions p
      WHERE p.is_approver
        AND NOT EXISTS (
          SELECT 1 FROM officers o WHERE o.position_id = p.id AND o.is_current
        )
      ORDER BY p.display_order`,
  );
  return {
    activeMembers: Number(counts.active_members ?? 0),
    pendingBlogs: Number(counts.pending_blogs ?? 0),
    pendingProjects: Number(counts.pending_projects ?? 0),
    pendingEvents: Number(counts.pending_events ?? 0),
    vacantApproverPositions: vacant.map((r) => r.name),
  };
}

// --- Admin: content queues --------------------------------------------------

export async function adminListBlogs(
  status: "draft" | "pending" | "approved" | "rejected" | "archived",
): Promise<BlogPost[]> {
  const { rows } = await readQuery(
    `${BLOG_SELECT} WHERE b.status = $1
      ORDER BY b.created_at DESC`,
    [status],
  );
  return rows.map(mapBlog);
}

export async function adminListProjects(
  status: "draft" | "pending" | "approved" | "rejected" | "archived",
): Promise<Project[]> {
  const { rows } = await readQuery(
    `${PROJECT_SELECT} WHERE p.status = $1 ORDER BY p.created_at DESC`,
    [status],
  );
  return rows.map(mapProject);
}

/** All officer positions, ordered, for the admin officers page. */
export async function listPositions(): Promise<
  Array<{
    id: string;
    name: string;
    order: number;
    isApprover: boolean;
    maxIncumbents: number;
  }>
> {
  const { rows } = await readQuery(
    `SELECT id, name, display_order, is_approver, max_incumbents
       FROM officer_positions ORDER BY display_order`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    order: r.display_order,
    isApprover: r.is_approver,
    maxIncumbents: r.max_incumbents ?? 1,
  }));
}

// --- Admin: write actions ---------------------------------------------------

/** Approves, rejects, or archives a blog (FR-ADM-06). Returns the blog title. */
export async function setBlogStatus(
  blogId: string,
  status: "approved" | "rejected" | "archived",
  reviewerMemberId: string,
): Promise<string | null> {
  if (status === "approved") {
    const { rows } = await pool.query(
      `UPDATE blogs
          SET status = 'approved', approved_by = $2, approved_at = now(),
              published_at = COALESCE(published_at, now())
        WHERE id = $1 RETURNING title`,
      [blogId, reviewerMemberId],
    );
    return rows[0]?.title ?? null;
  }
  // Cast the status text to blog_status so Postgres can resolve the parameter
  // type; reviewerMemberId is included so 'rejected'/'archived' decisions are
  // attributed too.
  const { rows } = await pool.query(
    `UPDATE blogs SET status = $2::blog_status, approved_by = $3
      WHERE id = $1 RETURNING title`,
    [blogId, status, reviewerMemberId],
  );
  return rows[0]?.title ?? null;
}

/** Approves, rejects, or archives a project (FR-ADM-07). */
export async function setProjectStatus(
  projectId: string,
  status: "approved" | "rejected" | "archived",
  reviewerMemberId: string,
): Promise<string | null> {
  if (status === "approved") {
    const { rows } = await pool.query(
      `UPDATE projects
          SET status = 'approved', approved_by = $2, approved_at = now()
        WHERE id = $1 RETURNING title`,
      [projectId, reviewerMemberId],
    );
    return rows[0]?.title ?? null;
  }
  // Reject / archive paths don't write approved_by; cast $2 so Postgres can
  // resolve the project_status enum from a text parameter.
  const { rows } = await pool.query(
    `UPDATE projects SET status = $2::project_status
      WHERE id = $1 RETURNING title`,
    [projectId, status],
  );
  return rows[0]?.title ?? null;
}

/** Force-approves a pending event, bypassing the 3-vote rule (FR-ADM-09). */
export async function forceApproveEvent(
  eventId: string,
): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE events SET status = 'approved', approved_at = now()
      WHERE id = $1 AND status = 'pending' RETURNING title`,
    [eventId],
  );
  return rows[0]?.title ?? null;
}

/** Cancels an event (FR-ADM-08). */
export async function cancelEvent(eventId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE events SET status = 'cancelled' WHERE id = $1 RETURNING title`,
    [eventId],
  );
  return rows[0]?.title ?? null;
}

/** Permanently deletes an event (FR-ADM-08). */
export async function deleteEvent(eventId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `DELETE FROM events WHERE id = $1 RETURNING title`,
    [eventId],
  );
  return rows[0]?.title ?? null;
}

/** Grants or revokes the admin role on a member's account (FR-ADM-03). */
export async function setMemberAdmin(
  memberId: string,
  makeAdmin: boolean,
): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE users u SET role = $2
       FROM members m
      WHERE m.user_id = u.id AND m.id = $1
      RETURNING m.full_name`,
    [memberId, makeAdmin ? "admin" : "member"],
  );
  return rows[0]?.full_name ?? null;
}

/** Registers a new member: a users row + a members row (FR-ADM-01). */
export async function registerMember(input: {
  email: string;
  fullName: string;
  passwordHash: string;
}): Promise<string> {
  return withTransaction(async (client) => {
    const user = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'member') RETURNING id`,
      [input.email, input.passwordHash],
    );
    const member = await client.query(
      `INSERT INTO members (user_id, full_name, contact_email, status_id)
       VALUES ($1, $2, $3,
         (SELECT id FROM member_statuses WHERE name = 'Active'))
       RETURNING id`,
      [user.rows[0].id, input.fullName, input.email],
    );
    return member.rows[0].id as string;
  });
}

/** Flips a position's approver flag (FR-ADM-05). The "exactly 3" trigger
 *  rejects any change that would break the count. */
export async function togglePositionApprover(
  positionId: string,
): Promise<{ name: string; isApprover: boolean } | null> {
  const { rows } = await pool.query(
    `UPDATE officer_positions SET is_approver = NOT is_approver
      WHERE id = $1 RETURNING name, is_approver`,
    [positionId],
  );
  return rows[0]
    ? { name: rows[0].name, isApprover: rows[0].is_approver }
    : null;
}

export class SingletonConflictError extends Error {
  positionName: string;
  currentHolder: string;
  constructor(positionName: string, currentHolder: string) {
    super(
      `${positionName} already has a current officer (${currentHolder}) for this school year.`,
    );
    this.positionName = positionName;
    this.currentHolder = currentHolder;
    this.name = "SingletonConflictError";
  }
}

/**
 * Assigns a member to an officer position for a school year (FR-ADM-04).
 * For non-singleton positions, multiple officers may co-hold; the previously
 * current holder (if any, same member, same position) keeps their record.
 * For singleton positions (President / VP / Secretary), the position must
 * be vacant for the school year — caller ends the existing term first.
 */
export async function assignOfficer(input: {
  memberId: string;
  positionId: string;
  schoolYearId: string;
}): Promise<{ memberName: string; positionName: string } | null> {
  return withTransaction(async (client) => {
    const position = await client.query(
      `SELECT name, display_order, max_incumbents
         FROM officer_positions WHERE id = $1`,
      [input.positionId],
    );
    const member = await client.query(
      `SELECT full_name FROM members WHERE id = $1`,
      [input.memberId],
    );
    const sy = await client.query(
      `SELECT 1 FROM school_years WHERE id = $1`,
      [input.schoolYearId],
    );
    if (
      position.rowCount === 0 ||
      member.rowCount === 0 ||
      sy.rowCount === 0
    ) {
      return null;
    }

    // Check the per-position cap. The DB trigger also enforces this, but
    // pre-checking lets us return a structured error to the caller.
    const cap = (position.rows[0].max_incumbents as number) ?? 1;
    const filled = await client.query(
      `SELECT count(*)::int AS n, array_agg(m.full_name) AS holders
         FROM officers o
         JOIN members m ON m.id = o.member_id
        WHERE o.position_id    = $1
          AND o.school_year_id = $2
          AND o.is_current`,
      [input.positionId, input.schoolYearId],
    );
    const used = (filled.rows[0]?.n as number) ?? 0;
    if (used >= cap) {
      const holders =
        (filled.rows[0]?.holders as string[] | null)?.join(", ") ?? "";
      throw new SingletonConflictError(
        position.rows[0].name as string,
        holders,
      );
    }

    await client.query(
      `INSERT INTO officers
         (member_id, position_id, school_year_id, term_start, display_order,
          is_current)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, TRUE)`,
      [
        input.memberId,
        input.positionId,
        input.schoolYearId,
        position.rows[0].display_order,
      ],
    );
    return {
      memberName: member.rows[0].full_name as string,
      positionName: position.rows[0].name as string,
    };
  });
}

/**
 * Ends a current officer assignment (FR-ADM-04). The row is kept with
 * is_current = FALSE so it still shows in the member's officer history.
 */
export async function endOfficerTerm(
  officerId: string,
): Promise<{ memberName: string; positionName: string } | null> {
  const { rows } = await pool.query(
    `UPDATE officers o
        SET is_current = FALSE, term_end = COALESCE(o.term_end, CURRENT_DATE)
       FROM members m, officer_positions p
      WHERE o.id = $1 AND o.is_current
        AND m.id = o.member_id AND p.id = o.position_id
      RETURNING m.full_name AS member_name, p.name AS position_name`,
    [officerId],
  );
  return rows[0]
    ? { memberName: rows[0].member_name, positionName: rows[0].position_name }
    : null;
}

/** Adds an officer position (FR-ADM-05). New positions start non-approver. */
export async function createPosition(
  name: string,
): Promise<{ id: string } | null> {
  const { rows } = await pool.query(
    `INSERT INTO officer_positions (name, is_approver, display_order)
     VALUES ($1, FALSE,
       (SELECT COALESCE(MAX(display_order), 0) + 1 FROM officer_positions))
     RETURNING id`,
    [name],
  );
  return rows[0] ? { id: rows[0].id as string } : null;
}

/**
 * Deletes an officer position (FR-ADM-05). The database blocks removing an
 * approver position (breaks the "exactly 3" rule) or one with officer history.
 */
export async function deletePosition(id: string): Promise<string | null> {
  const { rows } = await pool.query(
    `DELETE FROM officer_positions WHERE id = $1 RETURNING name`,
    [id],
  );
  return rows[0]?.name ?? null;
}

/** Updates a resource's metadata (FR-ADM-10). Category is matched/created by name. */
export async function updateResource(
  id: string,
  input: {
    title: string;
    description: string | null;
    categoryName: string | null;
    visibility: "public" | "private";
  },
): Promise<string | null> {
  return withTransaction(async (client) => {
    let categoryId: string | null = null;
    if (input.categoryName) {
      const existing = await client.query(
        `SELECT id FROM resource_categories WHERE name = $1`,
        [input.categoryName],
      );
      categoryId =
        existing.rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO resource_categories (name) VALUES ($1) RETURNING id`,
            [input.categoryName],
          )
        ).rows[0].id;
    }
    const { rows } = await client.query(
      `UPDATE resources
          SET title = $2, description = $3, category_id = $4, visibility = $5
        WHERE id = $1 RETURNING title`,
      [id, input.title, input.description, categoryId, input.visibility],
    );
    return rows[0]?.title ?? null;
  });
}

/**
 * Swaps a resource's backing file (FR-ADM-10). Returns the previous S3 key so
 * the caller can remove the superseded object from the bucket.
 */
export async function replaceResourceFile(
  id: string,
  input: {
    s3Key: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<{ title: string; oldS3Key: string } | null> {
  return withTransaction(async (client) => {
    const before = await client.query(
      `SELECT s3_key FROM resources WHERE id = $1`,
      [id],
    );
    if (before.rowCount === 0) return null;
    const { rows } = await client.query(
      `UPDATE resources
          SET s3_key = $2, file_name = $3, mime_type = $4, size_bytes = $5
        WHERE id = $1 RETURNING title`,
      [id, input.s3Key, input.fileName, input.mimeType, input.sizeBytes],
    );
    return {
      title: rows[0].title as string,
      oldS3Key: before.rows[0].s3_key as string,
    };
  });
}

// --- Admin: form links ------------------------------------------------------

/** A form link with its admin-only fields, for the admin forms page. */
export interface AdminForm {
  id: string;
  title: string;
  description: string;
  provider: "google" | "microsoft";
  url: string;
  /** Embed HTML (an <iframe> snippet) or URL — drives the in-page iframe. */
  embedHtml: string | null;
  visibility: "public" | "private";
  isActive: boolean;
}

/** Every form link, active or not, for the admin forms page (FR-ADM-09). */
export async function listAllForms(): Promise<AdminForm[]> {
  const { rows } = await readQuery(
    `SELECT f.id, f.title, f.description, lower(p.name) AS provider,
            f.url, f.embed_url, f.visibility, f.is_active
       FROM form_links f
       LEFT JOIN form_providers p ON p.id = f.provider_id
      ORDER BY f.display_order, f.title`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    provider: r.provider ?? "google",
    url: r.url,
    embedHtml: r.embed_url ?? null,
    visibility: r.visibility,
    isActive: r.is_active,
  }));
}

/** Publishes a new form link (FR-ADM-09). */
export async function createForm(input: {
  title: string;
  description: string | null;
  provider: "google" | "microsoft";
  url: string;
  embedHtml: string | null;
  visibility: "public" | "private";
  createdBy: string;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO form_links
       (title, description, provider_id, url, embed_url, visibility,
        display_order, created_by)
     VALUES ($1, $2,
       (SELECT id FROM form_providers WHERE lower(name) = lower($3)),
       $4, $5, $6,
       (SELECT COALESCE(MAX(display_order), 0) + 1 FROM form_links), $7)
     RETURNING id`,
    [
      input.title,
      input.description,
      input.provider,
      input.url,
      input.embedHtml,
      input.visibility,
      input.createdBy,
    ],
  );
  return rows[0].id as string;
}

/** Updates a form link (FR-ADM-09). */
export async function updateForm(
  id: string,
  input: {
    title: string;
    description: string | null;
    provider: "google" | "microsoft";
    url: string;
    embedHtml: string | null;
    visibility: "public" | "private";
  },
): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE form_links
        SET title = $2, description = $3,
            provider_id = (
              SELECT id FROM form_providers WHERE lower(name) = lower($4)
            ),
            url = $5, embed_url = $6, visibility = $7
      WHERE id = $1 RETURNING title`,
    [
      id,
      input.title,
      input.description,
      input.provider,
      input.url,
      input.embedHtml,
      input.visibility,
    ],
  );
  return rows[0]?.title ?? null;
}

/** Removes a form link (FR-ADM-09). */
export async function deleteForm(id: string): Promise<string | null> {
  const { rows } = await pool.query(
    `DELETE FROM form_links WHERE id = $1 RETURNING title`,
    [id],
  );
  return rows[0]?.title ?? null;
}

// --- Admin: member management -----------------------------------------------

/** Updates a member's directory record, admin-only fields included (FR-ADM-02). */
export async function adminUpdateMember(
  memberId: string,
  fields: {
    name: string;
    studentId: string | null;
    course: string | null;
    year: number | null;
    bio: string | null;
    contactEmail: string | null;
    /** A member_statuses name, e.g. "Active". */
    status: string;
  },
): Promise<string | null> {
  const courseId = await courseIdForName(fields.course);
  const { rows } = await pool.query(
    `UPDATE members
        SET full_name = $2, student_id = $3, course_id = $4,
            year_level_id = (
              SELECT id FROM year_levels WHERE display_order = $5
            ),
            bio = $6, contact_email = $7,
            status_id = (SELECT id FROM member_statuses WHERE name = $8)
      WHERE id = $1 RETURNING full_name`,
    [
      memberId,
      fields.name,
      fields.studentId,
      courseId,
      fields.year,
      fields.bio,
      fields.contactEmail,
      fields.status,
    ],
  );
  return rows[0]?.full_name ?? null;
}

/**
 * Activates or deactivates a member account (FR-ADM-02): the directory status
 * and login access move together, so a deactivated member cannot sign in.
 */
export async function setMemberActive(
  memberId: string,
  active: boolean,
): Promise<string | null> {
  return withTransaction(async (client) => {
    const member = await client.query(
      `UPDATE members
          SET status_id = (SELECT id FROM member_statuses WHERE name = $2)
        WHERE id = $1
        RETURNING full_name, user_id`,
      [memberId, active ? "Active" : "Inactive"],
    );
    if (member.rowCount === 0) return null;
    await client.query(`UPDATE users SET is_active = $2 WHERE id = $1`, [
      member.rows[0].user_id,
      active,
    ]);
    return member.rows[0].full_name as string;
  });
}

/** Sets a new password on a member's account (FR-ADM-02). */
export async function resetMemberPassword(
  memberId: string,
  passwordHash: string,
): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE users u SET password_hash = $2
       FROM members m
      WHERE m.user_id = u.id AND m.id = $1
      RETURNING m.full_name`,
    [memberId, passwordHash],
  );
  return rows[0]?.full_name ?? null;
}

// --- Admin: category / lookup-table management (FR-ADM-11) ------------------
// Lookup-table metadata (keys, labels, validation) lives in lib/lookups.ts so
// client components can import it without pulling in this server-only module.
// It is re-exported here for server callers' convenience.

export { LOOKUP_KEYS, LOOKUP_LABELS, isLookupKey } from "@/lib/lookups";
export type { LookupKey, LookupRow } from "@/lib/lookups";

/** Every row of a lookup table, ordered by name (FR-ADM-11). */
export async function listLookup(key: LookupKey): Promise<LookupRow[]> {
  const { rows } = await readQuery(
    `SELECT id, name FROM ${LOOKUP_TABLES[key]} ORDER BY name`,
  );
  return rows.map((r) => ({ id: r.id as string, name: r.name as string }));
}

/** Adds a value to a lookup table. */
export async function createLookup(
  key: LookupKey,
  name: string,
): Promise<void> {
  await pool.query(`INSERT INTO ${LOOKUP_TABLES[key]} (name) VALUES ($1)`, [
    name,
  ]);
}

/** Renames a lookup value. Returns false when the row does not exist. */
export async function updateLookup(
  key: LookupKey,
  id: string,
  name: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE ${LOOKUP_TABLES[key]} SET name = $2 WHERE id = $1`,
    [id, name],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Removes a lookup value. Every foreign key into these tables is
 * ON DELETE SET NULL, so rows that referenced the value keep their data with
 * the reference cleared. Returns false when the row does not exist.
 */
export async function deleteLookup(
  key: LookupKey,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM ${LOOKUP_TABLES[key]} WHERE id = $1`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

// --- Admin: editable site settings (FR-ADM-08) ------------------------------

/**
 * The organization profile shown across the site. Falls back to defaultOrg
 * when the database is unreachable or the site_settings row is missing.
 */
export async function getOrg(): Promise<OrgInfo> {
  // The school-year label is the source of truth for `term`; the free-text
  // term column was dropped in migration 0003.
  const { rows } = await readQuery(
    `SELECT s.org_name, s.short_name, s.tagline, s.about,
            s.contact_email, s.contact_address, s.contact_hours,
            sy.label AS school_year_label
       FROM site_settings s
       LEFT JOIN school_years sy ON sy.is_current
      WHERE s.id = TRUE`,
  );
  const r = rows[0];
  if (!r) return defaultOrg;
  return {
    name: r.org_name,
    shortName: r.short_name,
    tagline: r.tagline,
    term: (r.school_year_label as string | null) ?? "",
    about: Array.isArray(r.about) ? r.about : [],
    contact: {
      email: r.contact_email,
      address: r.contact_address,
      hours: r.contact_hours,
    },
  };
}

/** Updates the organization profile (FR-ADM-08). `term` is intentionally
 *  read-only — change the current school year under /admin/school-years. */
export async function updateOrg(input: Omit<OrgInfo, "term">): Promise<void> {
  await pool.query(
    `UPDATE site_settings
        SET org_name = $1, short_name = $2, tagline = $3, about = $4,
            contact_email = $5, contact_address = $6, contact_hours = $7
      WHERE id = TRUE`,
    [
      input.name,
      input.shortName,
      input.tagline,
      input.about,
      input.contact.email,
      input.contact.address,
      input.contact.hours,
    ],
  );
}

/**
 * Deletes a resource's metadata row (FR-ADM-10) and returns its title and S3
 * key so the caller can remove the backing file from the bucket too.
 */
export async function deleteResource(
  resourceId: string,
): Promise<{ title: string; s3Key: string } | null> {
  const { rows } = await pool.query(
    `DELETE FROM resources WHERE id = $1 RETURNING title, s3_key`,
    [resourceId],
  );
  return rows[0]
    ? { title: rows[0].title as string, s3Key: rows[0].s3_key as string }
    : null;
}

// --- S3-backed writes -------------------------------------------------------

/**
 * Creates a resource metadata row after its file has been uploaded to S3
 * (FR-ADM-10). The category is matched by name, created if it does not exist.
 */
export async function createResource(input: {
  title: string;
  description: string | null;
  categoryName: string | null;
  s3Key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: "public" | "private";
  uploadedBy: string;
}): Promise<string> {
  return withTransaction(async (client) => {
    let categoryId: string | null = null;
    if (input.categoryName) {
      const existing = await client.query(
        `SELECT id FROM resource_categories WHERE name = $1`,
        [input.categoryName],
      );
      categoryId =
        existing.rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO resource_categories (name) VALUES ($1) RETURNING id`,
            [input.categoryName],
          )
        ).rows[0].id;
    }
    const { rows } = await client.query(
      `INSERT INTO resources
         (category_id, title, description, s3_key, file_name, mime_type,
          size_bytes, visibility, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        categoryId,
        input.title,
        input.description,
        input.s3Key,
        input.fileName,
        input.mimeType,
        input.sizeBytes,
        input.visibility,
        input.uploadedBy,
      ],
    );
    return rows[0].id as string;
  });
}

/** Sets a member's profile photo S3 key (FR-MEM-04). */
export async function updateMemberPhoto(
  memberId: string,
  s3Key: string,
): Promise<void> {
  await pool.query(`UPDATE members SET photo_s3_key = $2 WHERE id = $1`, [
    memberId,
    s3Key,
  ]);
}

/** The S3 key of a member's profile photo, if they have one. */
export async function getMemberPhotoKey(
  memberId: string,
): Promise<string | null> {
  const { rows } = await readQuery(
    `SELECT photo_s3_key FROM members WHERE id = $1`,
    [memberId],
  );
  return rows[0]?.photo_s3_key ?? null;
}

// ---------------------------------------------------------------------------
// V2: school years
// ---------------------------------------------------------------------------

function mapSchoolYear(r: Record<string, unknown>): SchoolYear {
  return {
    id: r.id as string,
    label: r.label as string,
    startYear: r.start_year as number,
    endYear: r.end_year as number,
    startsOn: new Date(r.starts_on as string).toISOString(),
    endsOn: new Date(r.ends_on as string).toISOString(),
    isCurrent: r.is_current as boolean,
  };
}

export async function listSchoolYears(): Promise<SchoolYear[]> {
  const { rows } = await readQuery(
    `SELECT id, label, start_year, end_year, starts_on, ends_on, is_current
       FROM school_years ORDER BY start_year DESC`,
  );
  return rows.map(mapSchoolYear);
}

export async function getCurrentSchoolYear(): Promise<SchoolYear | null> {
  const { rows } = await readQuery(
    `SELECT id, label, start_year, end_year, starts_on, ends_on, is_current
       FROM school_years WHERE is_current LIMIT 1`,
  );
  return rows.length ? mapSchoolYear(rows[0]) : null;
}

export async function createSchoolYear(startYear: number): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO school_years (start_year, end_year, starts_on, ends_on)
     VALUES ($1, $1 + 1, make_date($1, 8, 1), make_date($1 + 1, 7, 31))
     RETURNING id`,
    [startYear],
  );
  return rows[0].id as string;
}

/**
 * Promotes a school year to current, rolling over the previous current SY.
 * Officers in the outgoing SY become history (`is_current = FALSE`) and the
 * outgoing roster is snapshot into `member_school_years` for archive lookups.
 */
export async function promoteSchoolYearToCurrent(
  schoolYearId: string,
): Promise<{ outgoingLabel: string | null; incomingLabel: string } | null> {
  return withTransaction(async (client) => {
    const incoming = await client.query(
      `SELECT label FROM school_years WHERE id = $1`,
      [schoolYearId],
    );
    if (incoming.rowCount === 0) return null;

    const outgoing = await client.query(
      `SELECT id, label FROM school_years WHERE is_current AND id <> $1`,
      [schoolYearId],
    );
    const outgoingId = outgoing.rows[0]?.id as string | undefined;

    // 1. End all current officers (their school_year_id stays — they belong
    //    to the outgoing SY in history).
    await client.query(
      `UPDATE officers SET is_current = FALSE WHERE is_current`,
    );

    // 2. Snapshot the roster into the outgoing SY's member_school_years.
    if (outgoingId) {
      await client.query(
        `INSERT INTO member_school_years
           (member_id, school_year_id, status_id, year_level_id)
         SELECT m.id, $1, m.status_id, m.year_level_id FROM members m
         ON CONFLICT (member_id, school_year_id) DO UPDATE
           SET status_id = EXCLUDED.status_id,
               year_level_id = EXCLUDED.year_level_id,
               recorded_at = now()`,
        [outgoingId],
      );
    }

    // 3. Flip the current flag — unique partial index ensures atomicity.
    await client.query(`UPDATE school_years SET is_current = FALSE WHERE is_current`);
    await client.query(
      `UPDATE school_years SET is_current = TRUE WHERE id = $1`,
      [schoolYearId],
    );

    return {
      outgoingLabel: outgoing.rows[0]?.label ?? null,
      incomingLabel: incoming.rows[0].label as string,
    };
  });
}

export async function deleteSchoolYear(id: string): Promise<string | null> {
  // Refuse to delete the current SY or any SY that still has officers.
  const { rows } = await pool.query(
    `DELETE FROM school_years
      WHERE id = $1
        AND NOT is_current
        AND NOT EXISTS (SELECT 1 FROM officers WHERE school_year_id = $1)
      RETURNING label`,
    [id],
  );
  return rows[0]?.label ?? null;
}

export async function listMembersForSchoolYear(
  schoolYearId: string,
): Promise<Member[]> {
  const { rows } = await readQuery(
    `SELECT m.id, m.full_name, m.student_id, m.contact_email, m.bio, u.role,
            c.name AS course, y.display_order AS year_level,
            COALESCE(s_hist.name, s_live.name) AS status
       FROM member_school_years msy
       JOIN members m ON m.id = msy.member_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN courses c ON c.id = m.course_id
       LEFT JOIN year_levels y ON y.id = COALESCE(msy.year_level_id, m.year_level_id)
       LEFT JOIN member_statuses s_hist ON s_hist.id = msy.status_id
       LEFT JOIN member_statuses s_live ON s_live.id = m.status_id
      WHERE msy.school_year_id = $1
      ORDER BY m.full_name`,
    [schoolYearId],
  );
  return rows.map(mapMember);
}

// ---------------------------------------------------------------------------
// V2: registration requests
// ---------------------------------------------------------------------------

function mapRegistration(r: Record<string, unknown>): RegistrationRequest {
  return {
    id: r.id as string,
    email: r.email as string,
    fullName: r.full_name as string,
    studentId: (r.student_id as string | null) ?? null,
    course: (r.course as string | null) ?? null,
    year: (r.year_level as number | null) ?? null,
    schoolYearLabel: (r.school_year_label as string) ?? "",
    status: r.status as RegistrationRequest["status"],
    rejectionNote: (r.rejection_note as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    reviewedAt: r.reviewed_at
      ? new Date(r.reviewed_at as string).toISOString()
      : null,
  };
}

const REGISTRATION_SELECT = `
  SELECT r.id, r.email, r.full_name, r.student_id, r.status, r.rejection_note,
         r.created_at, r.reviewed_at,
         c.name AS course, y.display_order AS year_level,
         sy.label AS school_year_label
    FROM registration_requests r
    LEFT JOIN courses c ON c.id = r.course_id
    LEFT JOIN year_levels y ON y.id = r.year_level_id
    JOIN school_years sy ON sy.id = r.school_year_id`;

export type RegistrationDuplicate = "email" | "studentId";

export async function createRegistrationRequest(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  studentId: string | null;
  courseId: string | null;
  year: number | null;
}): Promise<
  | { id: string }
  | { duplicate: RegistrationDuplicate }
  | { invalidCourse: true }
> {
  const existingUser = await pool.query(
    `SELECT 1 FROM users WHERE email = $1`,
    [input.email],
  );
  if ((existingUser.rowCount ?? 0) > 0) return { duplicate: "email" };

  const existingPending = await pool.query(
    `SELECT 1 FROM registration_requests
      WHERE lower(email) = lower($1) AND status IN ('pending', 'approved')`,
    [input.email],
  );
  if ((existingPending.rowCount ?? 0) > 0) return { duplicate: "email" };

  if (input.studentId) {
    const existingStudentId = await pool.query(
      `SELECT 1 FROM members WHERE student_id = $1
        UNION ALL
       SELECT 1 FROM registration_requests
        WHERE student_id = $1 AND status <> 'rejected'`,
      [input.studentId],
    );
    if ((existingStudentId.rowCount ?? 0) > 0) {
      return { duplicate: "studentId" };
    }
  }

  if (input.courseId) {
    const course = await pool.query(`SELECT 1 FROM courses WHERE id = $1`, [
      input.courseId,
    ]);
    if ((course.rowCount ?? 0) === 0) return { invalidCourse: true };
  }

  const { rows } = await pool.query(
    `INSERT INTO registration_requests
       (email, password_hash, full_name, student_id, course_id, year_level_id,
        school_year_id)
     VALUES ($1, $2, $3, $4, $5,
       (SELECT id FROM year_levels WHERE display_order = $6),
       (SELECT id FROM school_years WHERE is_current))
     RETURNING id`,
    [
      input.email,
      input.passwordHash,
      input.fullName,
      input.studentId,
      input.courseId,
      input.year,
    ],
  );
  return { id: rows[0].id as string };
}

export async function listRegistrationRequests(
  status?: RegistrationRequest["status"],
): Promise<RegistrationRequest[]> {
  if (status) {
    const { rows } = await readQuery(
      `${REGISTRATION_SELECT} WHERE r.status = $1 ORDER BY r.created_at DESC`,
      [status],
    );
    return rows.map(mapRegistration);
  }
  const { rows } = await readQuery(
    `${REGISTRATION_SELECT} ORDER BY r.created_at DESC`,
  );
  return rows.map(mapRegistration);
}

export async function approveRegistration(
  requestId: string,
  reviewerUserId: string,
): Promise<{ memberId: string; email: string; name: string } | null> {
  return withTransaction(async (client) => {
    const req = await client.query(
      `SELECT email, password_hash, full_name, student_id, course_id,
              year_level_id, school_year_id
         FROM registration_requests
        WHERE id = $1 AND status = 'pending'
        FOR UPDATE`,
      [requestId],
    );
    if (req.rowCount === 0) return null;
    const r = req.rows[0];

    const user = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'member') RETURNING id`,
      [r.email, r.password_hash],
    );
    const member = await client.query(
      `INSERT INTO members
         (user_id, full_name, student_id, course_id, year_level_id,
          school_year_id, contact_email, status_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
         (SELECT id FROM member_statuses WHERE name = 'Active'))
       RETURNING id`,
      [
        user.rows[0].id,
        r.full_name,
        r.student_id,
        r.course_id,
        r.year_level_id,
        r.school_year_id,
        r.email,
      ],
    );

    await client.query(
      `UPDATE registration_requests
          SET status = 'approved', reviewed_by = $2, reviewed_at = now()
        WHERE id = $1`,
      [requestId, reviewerUserId],
    );

    return {
      memberId: member.rows[0].id as string,
      email: r.email as string,
      name: r.full_name as string,
    };
  });
}

export async function rejectRegistration(
  requestId: string,
  reviewerUserId: string,
  note: string,
): Promise<{ email: string; name: string } | null> {
  const { rows } = await pool.query(
    `UPDATE registration_requests
        SET status = 'rejected', rejection_note = $3,
            reviewed_by = $2, reviewed_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING email, full_name`,
    [requestId, reviewerUserId, note],
  );
  return rows[0]
    ? { email: rows[0].email as string, name: rows[0].full_name as string }
    : null;
}

// ---------------------------------------------------------------------------
// V2: password reset
// ---------------------------------------------------------------------------

export async function findUserIdByEmail(
  email: string,
): Promise<string | null> {
  const { rows } = await readQuery(
    `SELECT id FROM users WHERE email = $1 AND is_active = TRUE`,
    [email],
  );
  return (rows[0]?.id as string) ?? null;
}

export async function storePasswordResetToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [input.userId, input.tokenHash, input.expiresAt.toISOString()],
  );
}

export async function consumePasswordResetToken(
  tokenHash: string,
  newPasswordHash: string,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const token = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        FOR UPDATE`,
      [tokenHash],
    );
    if (token.rowCount === 0) return false;
    await client.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [token.rows[0].user_id, newPasswordHash],
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [token.rows[0].id],
    );
    return true;
  });
}

// V2.1 §4: email change with verification ----------------------------------

export class EmailTakenError extends Error {
  constructor() {
    super("email_taken");
  }
}

/** Inserts a pending email-change request. Caller emails the cleartext token. */
export async function storeEmailChangeRequest(input: {
  userId: string;
  newEmail: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  // Block if the address is already in use by another active user.
  const collide = await pool.query(
    `SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2`,
    [input.newEmail, input.userId],
  );
  if ((collide.rowCount ?? 0) > 0) {
    throw new EmailTakenError();
  }
  await pool.query(
    `INSERT INTO email_change_requests (user_id, new_email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [
      input.userId,
      input.newEmail,
      input.tokenHash,
      input.expiresAt.toISOString(),
    ],
  );
}

/** Consumes a not-yet-used + not-expired token and swaps users.email. */
export async function consumeEmailChangeToken(
  tokenHash: string,
): Promise<{ userId: string; newEmail: string } | null> {
  return withTransaction(async (client) => {
    const token = await client.query(
      `SELECT id, user_id, new_email
         FROM email_change_requests
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        FOR UPDATE`,
      [tokenHash],
    );
    if (token.rowCount === 0) return null;
    const row = token.rows[0];
    try {
      await client.query(`UPDATE users SET email = $2 WHERE id = $1`, [
        row.user_id,
        row.new_email,
      ]);
    } catch {
      // Unique CITEXT collision — someone else took the address between
      // initiation and confirmation. Mark the row used to prevent retries.
      await client.query(
        `UPDATE email_change_requests SET used_at = now() WHERE id = $1`,
        [row.id],
      );
      throw new EmailTakenError();
    }
    await client.query(
      `UPDATE email_change_requests SET used_at = now() WHERE id = $1`,
      [row.id],
    );
    return { userId: row.user_id, newEmail: row.new_email };
  });
}

// ---------------------------------------------------------------------------
// V2: announcements
// ---------------------------------------------------------------------------

function mapAnnouncement(r: Record<string, unknown>): Announcement {
  return {
    id: r.id as string,
    title: r.title as string,
    bodyMarkdown: r.body_markdown as string,
    level: r.level as AnnouncementLevel,
    audience: r.audience as AnnouncementAudience,
    publishedAt: new Date(r.published_at as string).toISOString(),
    expiresAt: r.expires_at
      ? new Date(r.expires_at as string).toISOString()
      : null,
    pinnedUntil: r.pinned_until
      ? new Date(r.pinned_until as string).toISOString()
      : null,
    authorId: r.author_id as string,
    authorName: (r.author_name as string) ?? "",
  };
}

const ANNOUNCEMENT_SELECT = `
  SELECT a.*, m.full_name AS author_name
    FROM announcements a
    JOIN members m ON m.id = a.author_id`;

/**
 * Announcements the given role can see and have not yet dismissed, ordered:
 * pinned/critical/elevated first, then by published_at descending.
 */
export async function listAnnouncementsForViewer(
  session: Session,
): Promise<Announcement[]> {
  const role = session.role;
  const audiences: AnnouncementAudience[] =
    role === "guest"
      ? ["public"]
      : role === "officer" || role === "admin"
        ? ["public", "members", "officers"]
        : ["public", "members"];

  const dismissed = session.userId
    ? `AND NOT EXISTS (
         SELECT 1 FROM announcement_dismissals d
          WHERE d.announcement_id = a.id AND d.user_id = $2
       )`
    : "";

  const params: unknown[] = [audiences];
  if (session.userId) params.push(session.userId);

  const { rows } = await readQuery(
    `${ANNOUNCEMENT_SELECT}
      WHERE a.audience = ANY($1::announcement_audience[])
        AND a.published_at <= now()
        AND (a.expires_at IS NULL OR a.expires_at > now())
        ${dismissed}
      ORDER BY
        CASE WHEN a.pinned_until IS NOT NULL AND a.pinned_until > now() THEN 0 ELSE 1 END,
        CASE a.level WHEN 'critical' THEN 0 WHEN 'elevated' THEN 1 ELSE 2 END,
        a.published_at DESC`,
    params,
  );
  return rows.map(mapAnnouncement);
}

export async function listAnnouncementsAdmin(): Promise<Announcement[]> {
  const { rows } = await readQuery(
    `${ANNOUNCEMENT_SELECT} ORDER BY a.created_at DESC`,
  );
  return rows.map(mapAnnouncement);
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const { rows } = await readQuery(
    `${ANNOUNCEMENT_SELECT} WHERE a.id = $1`,
    [id],
  );
  return rows.length ? mapAnnouncement(rows[0]) : null;
}

export async function createAnnouncement(input: {
  authorId: string;
  title: string;
  bodyMarkdown: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  publishedAt: Date | null;
  expiresAt: Date | null;
  pinnedUntil: Date | null;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO announcements
       (author_id, title, body_markdown, level, audience, published_at,
        expires_at, pinned_until)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8)
     RETURNING id`,
    [
      input.authorId,
      input.title,
      input.bodyMarkdown,
      input.level,
      input.audience,
      input.publishedAt?.toISOString() ?? null,
      input.expiresAt?.toISOString() ?? null,
      input.pinnedUntil?.toISOString() ?? null,
    ],
  );
  return rows[0].id as string;
}

export async function updateAnnouncement(
  id: string,
  input: {
    title: string;
    bodyMarkdown: string;
    level: AnnouncementLevel;
    audience: AnnouncementAudience;
    publishedAt: Date | null;
    expiresAt: Date | null;
    pinnedUntil: Date | null;
  },
): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE announcements
        SET title = $2, body_markdown = $3, level = $4, audience = $5,
            published_at = COALESCE($6, published_at),
            expires_at = $7, pinned_until = $8
      WHERE id = $1 RETURNING title`,
    [
      id,
      input.title,
      input.bodyMarkdown,
      input.level,
      input.audience,
      input.publishedAt?.toISOString() ?? null,
      input.expiresAt?.toISOString() ?? null,
      input.pinnedUntil?.toISOString() ?? null,
    ],
  );
  return rows[0]?.title ?? null;
}

export async function deleteAnnouncement(id: string): Promise<string | null> {
  const { rows } = await pool.query(
    `DELETE FROM announcements WHERE id = $1 RETURNING title`,
    [id],
  );
  return rows[0]?.title ?? null;
}

export async function dismissAnnouncement(
  userId: string,
  announcementId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO announcement_dismissals (user_id, announcement_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, announcementId],
  );
}

