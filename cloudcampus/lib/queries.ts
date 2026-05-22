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
  Attachment,
  BlogPost,
  FormLink,
  Member,
  OfficerSummary,
  OrgEvent,
  Project,
  ResourceItem,
  ResourceType,
} from "@/lib/types";

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
 * Runs a read query, degrading to an empty result when the database is
 * unreachable so pages can still render their empty states. A real SQL error
 * (e.g. a bad column) still throws so genuine bugs are not hidden.
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
    summary: r.description,
    body: paragraphs(r.body_markdown),
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
    body: paragraphs(r.body_markdown),
    attachments: mapAttachments(r.attachments),
  };
}

function mapProject(r: any): Project {
  return {
    id: r.id,
    title: r.title,
    summary: r.description,
    body: paragraphs(r.body_markdown),
    status: r.status,
    visibility: r.visibility,
    stack: r.tech_stack ?? [],
    contributors: (r.contributors ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      course: c.course ?? null,
      roleOnProject: c.role_on_project ?? null,
    })),
    repoUrl: r.repo_url ?? null,
    liveUrl: r.live_url ?? null,
    startedOn: r.started_on ? formatDate(r.started_on) : "—",
    completedOn: r.completed_on ? formatDate(r.completed_on) : "Ongoing",
    coverAlt: `${r.title} cover image`,
    coverUrl: mediaUrl(r.cover_s3_key),
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
    year: r.year_level ?? null,
    status: (r.status ?? "Active") as Member["status"],
    email: r.contact_email ?? null,
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

/** Events list. Privileged viewers (member+) see private/non-approved too. */
export async function listEvents(privileged: boolean): Promise<OrgEvent[]> {
  const where = privileged
    ? ""
    : `WHERE e.status = 'approved' AND e.visibility = 'public'`;
  const { rows } = await readQuery(
    `${EVENT_SELECT} ${where} ORDER BY e.starts_at`,
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

export async function getBlogsByAuthor(memberId: string): Promise<BlogPost[]> {
  const { rows } = await readQuery(
    `${BLOG_SELECT}
      WHERE b.author_id = $1 AND b.status = 'approved'
      ORDER BY COALESCE(b.published_at, b.created_at) DESC`,
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

/** Projects list. Guests see only approved+public. */
export async function listProjects(privileged: boolean): Promise<Project[]> {
  const where = privileged
    ? ""
    : `WHERE p.status = 'approved' AND p.visibility = 'public'`;
  const { rows } = await readQuery(
    `${PROJECT_SELECT} ${where} ORDER BY p.created_at DESC`,
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
  SELECT m.id, m.full_name, m.student_id, m.contact_email, m.bio, u.role,
         c.name AS course, y.display_order AS year_level, s.name AS status
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

/** Current officers, ordered by position, for the officers roster page. */
export async function listOfficers(): Promise<OfficerSummary[]> {
  const { rows } = await readQuery(
    `SELECT o.id, o.member_id, o.term_label, m.full_name,
            p.name AS position_name, p.is_approver, p.display_order
       FROM officers o
       JOIN members m ON m.id = o.member_id
       JOIN officer_positions p ON p.id = o.position_id
      WHERE o.is_current
      ORDER BY p.display_order`,
  );
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    name: r.full_name,
    position: r.position_name,
    term: r.term_label,
    isApprover: r.is_approver,
    order: r.display_order,
  }));
}

/** All officer roles a member has held, for their profile page. */
export async function getOfficerHistory(
  memberId: string,
): Promise<OfficerSummary[]> {
  const { rows } = await readQuery(
    `SELECT o.id, o.member_id, o.term_label, m.full_name,
            p.name AS position_name, p.is_approver, p.display_order
       FROM officers o
       JOIN members m ON m.id = o.member_id
       JOIN officer_positions p ON p.id = o.position_id
      WHERE o.member_id = $1
      ORDER BY o.term_start DESC, p.display_order`,
    [memberId],
  );
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    name: r.full_name,
    position: r.position_name,
    term: r.term_label,
    isApprover: r.is_approver,
    order: r.display_order,
  }));
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
    course: string | null;
    year: number | null;
    bio: string | null;
    contactEmail: string | null;
  },
): Promise<void> {
  const courseId = await courseIdForName(fields.course);
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
      courseId,
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
  decision: "approved" | "rejected";
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
  status: "draft" | "pending" | "approved" | "rejected",
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
  Array<{ id: string; name: string; order: number; isApprover: boolean }>
> {
  const { rows } = await readQuery(
    `SELECT id, name, display_order, is_approver
       FROM officer_positions ORDER BY display_order`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    order: r.display_order,
    isApprover: r.is_approver,
  }));
}

// --- Admin: write actions ---------------------------------------------------

/** Approves or rejects a blog (FR-ADM-06). Returns the blog title. */
export async function setBlogStatus(
  blogId: string,
  status: "approved" | "rejected",
  reviewerMemberId: string,
): Promise<string | null> {
  const sql =
    status === "approved"
      ? `UPDATE blogs
            SET status = 'approved', approved_by = $2, approved_at = now(),
                published_at = COALESCE(published_at, now())
          WHERE id = $1 RETURNING title`
      : `UPDATE blogs SET status = 'rejected', approved_by = $2
          WHERE id = $1 RETURNING title`;
  const { rows } = await pool.query(sql, [blogId, reviewerMemberId]);
  return rows[0]?.title ?? null;
}

/** Approves, rejects, or archives a project (FR-ADM-07). */
export async function setProjectStatus(
  projectId: string,
  status: "approved" | "rejected" | "archived",
  reviewerMemberId: string,
): Promise<string | null> {
  const sql =
    status === "approved"
      ? `UPDATE projects
            SET status = 'approved', approved_by = $2, approved_at = now()
          WHERE id = $1 RETURNING title`
      : `UPDATE projects SET status = $3 WHERE id = $1 RETURNING title`;
  const params =
    status === "approved"
      ? [projectId, reviewerMemberId]
      : [projectId, reviewerMemberId, status];
  const { rows } = await pool.query(sql, params);
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

/**
 * Assigns a member to an officer position for a school year (FR-ADM-04).
 * A position holds one current officer at a time, so any sitting holder's
 * term is ended first; their assignment stays as officer history.
 */
export async function assignOfficer(input: {
  memberId: string;
  positionId: string;
  termLabel: string;
}): Promise<{ memberName: string; positionName: string } | null> {
  return withTransaction(async (client) => {
    const position = await client.query(
      `SELECT name, display_order FROM officer_positions WHERE id = $1`,
      [input.positionId],
    );
    const member = await client.query(
      `SELECT full_name FROM members WHERE id = $1`,
      [input.memberId],
    );
    if (position.rowCount === 0 || member.rowCount === 0) return null;

    // End the position's current holder, if any — keeps their term as history.
    await client.query(
      `UPDATE officers
          SET is_current = FALSE, term_end = COALESCE(term_end, CURRENT_DATE)
        WHERE position_id = $1 AND is_current`,
      [input.positionId],
    );
    await client.query(
      `INSERT INTO officers
         (member_id, position_id, term_label, term_start, display_order,
          is_current)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, TRUE)`,
      [
        input.memberId,
        input.positionId,
        input.termLabel,
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
  const { rows } = await readQuery(
    `SELECT org_name, short_name, tagline, about, term,
            contact_email, contact_address, contact_hours
       FROM site_settings WHERE id = TRUE`,
  );
  const r = rows[0];
  if (!r) return defaultOrg;
  return {
    name: r.org_name,
    shortName: r.short_name,
    tagline: r.tagline,
    term: r.term,
    about: Array.isArray(r.about) ? r.about : [],
    contact: {
      email: r.contact_email,
      address: r.contact_address,
      hours: r.contact_hours,
    },
  };
}

/** Updates the organization profile (FR-ADM-08). */
export async function updateOrg(input: OrgInfo): Promise<void> {
  await pool.query(
    `UPDATE site_settings
        SET org_name = $1, short_name = $2, tagline = $3, about = $4,
            term = $5, contact_email = $6, contact_address = $7,
            contact_hours = $8
      WHERE id = TRUE`,
    [
      input.name,
      input.shortName,
      input.tagline,
      input.about,
      input.term,
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
