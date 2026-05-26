// Domain types shared by queries and UI components.
//
// These are the camelCase application shapes. The PostgreSQL schema uses
// snake_case; the query layer (lib/queries.ts) maps rows into these types and
// also fills a few derived display fields (dateLabel, excerpt, coverAlt).

export type Visibility = "public" | "private";
/** A member_statuses lookup value (e.g. "Active") — managed in admin. */
export type MemberStatus = string;
export type Role = "guest" | "member" | "officer" | "admin";
export type BlogStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "archived";
export type ProjectStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "archived";
export type EventStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";
export type FormProvider = "google" | "microsoft";
export type ResourceType = "pdf" | "docx" | "xlsx" | "pptx" | "zip" | "image";

export interface Member {
  id: string;
  name: string;
  studentId: string | null;
  course: string | null;
  /** courses.id, when the member is assigned to a known course. */
  courseId: string | null;
  /** Year level 1–4; 5 marks an alumnus. */
  year: number | null;
  status: MemberStatus;
  /** members.contact_email — the publicly-shown contact address. */
  email: string | null;
  /** users.email — the sign-in address. Used by the email-change flow. */
  accountEmail: string;
  bio: string | null;
  /** users.role — 'member' or 'admin'. */
  role: Role;
}

export interface Position {
  id: string;
  name: string;
  order: number;
  isApprover: boolean;
  maxIncumbents: number;
  description: string | null;
}

/** An officer assignment with its member and position resolved. */
export interface OfficerSummary {
  /** officers.id */
  id: string;
  memberId: string;
  name: string;
  position: string;
  /** The school year label, e.g. "2026-2027". */
  term: string;
  schoolYearId: string;
  isApprover: boolean;
  order: number;
}

export interface OrgEvent {
  id: string;
  slug: string;
  title: string;
  /** Pre-formatted date/time for cards. */
  dateLabel: string;
  location: string;
  startsAt: string;
  endsAt: string;
  coverAlt: string;
  /** Cover image URL, or null when none was uploaded. */
  coverUrl: string | null;
  /** Raw S3 key for the cover (needed by the edit form). */
  coverKey: string | null;
  /** Short summary for cards. */
  summary: string;
  /** Long-form body split into paragraphs. */
  body: string[];
  /** Raw markdown source used by the edit form. */
  bodyMarkdown: string;
  locationNote: string;
  locationUrl: string | null;
  visibility: Visibility;
  status: EventStatus;
  /** members.id of the creator. */
  createdBy: string;
  createdByName: string;
  createdByPosition: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  authorId: string;
  author: string;
  date: string;
  dateLabel: string;
  visibility: Visibility;
  status: BlogStatus;
  coverAlt: string;
  /** Cover image URL, or null when none was uploaded. */
  coverUrl: string | null;
  /** Raw S3 key for the cover (needed by the edit form). */
  coverKey: string | null;
  body: string[];
  /** Raw markdown source used by the edit form. */
  bodyMarkdown: string;
  attachments: Attachment[];
}

export interface ProjectContributor {
  id: string;
  name: string;
  course: string | null;
  roleOnProject: string | null;
}

/** An image or external link attached to a blog post or project. */
export interface Attachment {
  id: string;
  kind: "image" | "link";
  /** Set when kind === "image" — a ready-to-use media URL. */
  imageUrl: string | null;
  /** Set when kind === "image" — the raw S3 key (needed by the edit form). */
  key: string | null;
  /** Set when kind === "link" — the external URL. */
  url: string | null;
  label: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  body: string[];
  /** Raw markdown source used by the edit form. */
  bodyMarkdown: string;
  status: ProjectStatus;
  visibility: Visibility;
  stack: string[];
  /** Comma-joined tags string (matches the form input). */
  tags: string[];
  categoryId: string | null;
  contributors: ProjectContributor[];
  submittedBy: string;
  repoUrl: string | null;
  liveUrl: string | null;
  /** Optional published link, V2.1 §0.7. */
  publishedUrl: string | null;
  startedOn: string;
  completedOn: string;
  coverAlt: string;
  /** Cover image URL, or null when none was uploaded. */
  coverUrl: string | null;
  /** Raw S3 key for the cover (needed by the edit form). */
  coverKey: string | null;
  /** project_categories name, or null when uncategorized. */
  category: string | null;
  attachments: Attachment[];
}

export interface ResourceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: ResourceType;
  size: string;
  /** Original uploaded file name. */
  fileName: string;
  /** S3 object key — used server-side to mint a download URL. */
  s3Key: string;
  visibility: Visibility;
  uploadedBy: string;
  date: string;
  dateLabel: string;
}

export interface FormLink {
  id: string;
  title: string;
  description: string;
  provider: FormProvider;
  /** Embed HTML (an <iframe> snippet) or URL — drives the in-page iframe. */
  embedHtml: string;
  /** Shareable form URL — used for "open in a new tab". */
  url: string;
  visibility: Visibility;
}

// ---------------------------------------------------------------------------
// V2: school years, registration, announcements, push notifications.
// ---------------------------------------------------------------------------

export interface SchoolYear {
  id: string;
  /** "2026-2027" — derived from start/end years on the row. */
  label: string;
  startYear: number;
  endYear: number;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface RegistrationRequest {
  id: string;
  email: string;
  fullName: string;
  studentId: string | null;
  course: string | null;
  year: number | null;
  schoolYearLabel: string;
  status: RegistrationStatus;
  rejectionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export type AnnouncementLevel = "normal" | "elevated" | "critical";
export type AnnouncementAudience = "public" | "members" | "officers";

export interface Announcement {
  id: string;
  title: string;
  bodyMarkdown: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  publishedAt: string;
  expiresAt: string | null;
  pinnedUntil: string | null;
  authorId: string;
  authorName: string;
}

