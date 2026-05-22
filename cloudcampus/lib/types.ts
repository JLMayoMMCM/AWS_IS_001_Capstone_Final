// Domain types shared by queries and UI components.
//
// These are the camelCase application shapes. The PostgreSQL schema uses
// snake_case; the query layer (lib/queries.ts) maps rows into these types and
// also fills a few derived display fields (dateLabel, excerpt, coverAlt).

export type Visibility = "public" | "private";
/** A member_statuses lookup value (e.g. "Active") — managed in admin. */
export type MemberStatus = string;
export type Role = "guest" | "member" | "officer" | "admin";
export type BlogStatus = "draft" | "pending" | "approved" | "rejected";
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
  /** Year level 1–4; 5 marks an alumnus. */
  year: number | null;
  status: MemberStatus;
  email: string | null;
  bio: string | null;
  /** users.role — 'member' or 'admin'. */
  role: Role;
}

export interface Position {
  id: string;
  name: string;
  order: number;
  isApprover: boolean;
  description: string | null;
}

/** An officer assignment with its member and position resolved. */
export interface OfficerSummary {
  /** officers.id */
  id: string;
  memberId: string;
  name: string;
  position: string;
  term: string;
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
  /** Short summary for cards. */
  summary: string;
  /** Long-form body split into paragraphs. */
  body: string[];
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
  body: string[];
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
  /** Set when kind === "link" — the external URL. */
  url: string | null;
  label: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  body: string[];
  status: ProjectStatus;
  visibility: Visibility;
  stack: string[];
  contributors: ProjectContributor[];
  repoUrl: string | null;
  liveUrl: string | null;
  startedOn: string;
  completedOn: string;
  coverAlt: string;
  /** Cover image URL, or null when none was uploaded. */
  coverUrl: string | null;
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
