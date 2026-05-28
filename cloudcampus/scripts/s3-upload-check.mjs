// Verify the direct-to-S3 upload path: mint a presigned PUT URL the same
// way /api/uploads does, fetch() it from Node like a browser would, then
// confirm the object exists and can be read back via a presigned GET.
//
//   node --env-file=.env scripts/s3-upload-check.mjs

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function log(state, label, hint) {
  const tag = state === "ok" ? "PASS" : state === "warn" ? "WARN" : "FAIL";
  console.log(`  ${tag.padEnd(4)}  ${label}${hint ? ` — ${hint}` : ""}`);
}

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION ?? "ap-southeast-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const endpoint = process.env.S3_ENDPOINT;
if (!bucket) { console.error("S3_BUCKET must be set"); process.exit(1); }
if (!accessKeyId || !secretAccessKey) {
  console.error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set");
  process.exit(1);
}

// Build the client the same way lib/s3.ts does, so this exercises the exact
// credential path the app uses.
const client = new S3Client({
  region,
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  credentials: { accessKeyId, secretAccessKey },
});
const key = `_upload-check/${Date.now()}-${randomUUID()}.png`;
const contentType = "image/png";
const body = Buffer.from([
  // 1x1 transparent PNG (smallest valid image)
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,
  0x89,0x00,0x00,0x00,0x0d,0x49,0x44,0x41,
  0x54,0x78,0x9c,0x63,0x00,0x01,0x00,0x00,
  0x05,0x00,0x01,0x0d,0x0a,0x2d,0xb4,0x00,
  0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,
  0x42,0x60,0x82,
]);

// 1. Mint presigned PUT URL (same way lib/s3.ts does)
const putUrl = await getSignedUrl(
  client,
  new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
  { expiresIn: 900 },
);
log("ok", `presigned PUT URL minted (${putUrl.length} chars)`);

// 2. Browser-style PUT
const putRes = await fetch(putUrl, {
  method: "PUT",
  headers: { "Content-Type": contentType },
  body,
});
if (!putRes.ok) {
  log("fail", `browser-style PUT to S3`, `HTTP ${putRes.status} ${putRes.statusText} — ${await putRes.text()}`);
  process.exit(1);
}
log("ok", `browser-style PUT to S3 (HTTP ${putRes.status})`);

// 3. HeadObject to confirm landed correctly
const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
log("ok", `HeadObject (ContentType=${head.ContentType}, ContentLength=${head.ContentLength})`);

// 4. Presigned GET + fetch back
const getUrl = await getSignedUrl(
  client,
  new GetObjectCommand({ Bucket: bucket, Key: key }),
  { expiresIn: 900 },
);
const getRes = await fetch(getUrl);
if (!getRes.ok) {
  log("fail", "presigned GET fetch", `HTTP ${getRes.status}`);
  process.exit(1);
}
const fetched = Buffer.from(await getRes.arrayBuffer());
if (Buffer.compare(fetched, body) !== 0) {
  log("fail", "GET body matches uploaded bytes");
  process.exit(1);
}
log("ok", "presigned GET fetches the same bytes back");

// 5. Cleanup
await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
log("ok", "DeleteObject (cleanup)");

console.log("\nUpload pipeline OK end-to-end.");
