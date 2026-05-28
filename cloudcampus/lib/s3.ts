import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Server-only S3 access (FEAS §3.2). Binary assets live in S3; the database
// stores only the object key. The browser never talks to S3 directly except
// through short-lived pre-signed URLs minted here.

/** Max validity of a pre-signed URL, in seconds (FR-RES-03: ≤ 15 minutes). */
const URL_TTL_SECONDS = 900;

/** What an upload is for — decides which key prefix it lands under. */
export type UploadPurpose = "resource" | "photo" | "cover" | "attachment";

/**
 * Standardized S3 object-key layout. Defined in one place so every caller —
 * the upload route, the delete routes, the ownership checks — agrees:
 *
 *   resources/<uuid>.<ext>                  downloadable resources
 *   members/<memberId>/avatar-<uuid>.<ext>  member profile photos
 *   covers/<uuid>.<ext>                     blog/event/project cover images
 *   attachments/<uuid>.<ext>                blog/project attachment images
 *
 * Keys are immutable, lower-cased and globally unique. The human-readable file
 * name is kept in the database, never in the key — so a key never needs
 * sanitising and two uploads of the same file name never collide. The original
 * extension is preserved so an object's type is obvious when browsing the
 * bucket.
 */
function extensionOf(fileName: string): string {
  const match = /\.[a-zA-Z0-9]+$/.exec(fileName.trim());
  return match ? match[0].toLowerCase() : "";
}

/** Builds a standardized, collision-free S3 object key for a new upload. */
export function buildObjectKey(
  purpose: UploadPurpose,
  fileName: string,
  memberId: string,
): string {
  const suffix = `${randomUUID()}${extensionOf(fileName)}`;
  switch (purpose) {
    case "photo":
      return `members/${memberId}/avatar-${suffix}`;
    case "cover":
      return `covers/${suffix}`;
    case "attachment":
      return `attachments/${suffix}`;
    default:
      return `resources/${suffix}`;
  }
}

/**
 * True when `key` is a well-formed key that `purpose` (uploaded by `memberId`)
 * is allowed to act on — guards the delete route so a caller cannot remove an
 * object outside its own namespace.
 */
export function isOwnedKey(
  purpose: UploadPurpose,
  key: string,
  memberId: string,
): boolean {
  switch (purpose) {
    case "photo":
      return key.startsWith(`members/${memberId}/`);
    case "cover":
      return key.startsWith("covers/");
    case "attachment":
      return key.startsWith("attachments/");
    default:
      return key.startsWith("resources/");
  }
}

const bucket = process.env.S3_BUCKET ?? "";
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";

/** True when S3 is configured — lets callers degrade gracefully without it. */
export const s3Configured = Boolean(
  bucket && process.env.S3_REGION && accessKeyId && secretAccessKey,
);

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (!cachedClient) {
    // Static credentials from S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY — an IAM
    // user with scoped Get/Put/Delete/List access on the bucket (or the
    // MinIO root user locally).
    //
    // S3_ENDPOINT lets local dev point at MinIO (http://localhost:9000) or any
    // S3-compatible store. When set, force path-style addressing because MinIO
    // and most non-AWS endpoints don't serve virtual-hosted-style bucket DNS.
    const endpoint = process.env.S3_ENDPOINT;
    cachedClient = new S3Client({
      region: process.env.S3_REGION,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return cachedClient;
}

/**
 * A time-limited URL the browser can use to fetch an object (FR-RES-03).
 * Pass `downloadFileName` to force an attachment download; omit it for an
 * inline preview (PDFs and images render in the page).
 */
export async function presignedDownloadUrl(
  key: string,
  downloadFileName?: string,
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(downloadFileName
        ? {
            ResponseContentDisposition: `attachment; filename="${downloadFileName.replace(
              /["\\]/g,
              "",
            )}"`,
          }
        : {}),
    }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** A time-limited URL the browser can use to upload an object directly. */
export async function presignedUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** Permanently removes an object (used when a resource is deleted). */
export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
}
