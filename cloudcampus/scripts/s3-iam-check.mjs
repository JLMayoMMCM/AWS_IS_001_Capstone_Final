// Staged diagnostic for the IAM-based S3 path. Walks through:
//   1. Env vars present (S3_BUCKET, S3_REGION)
//   2. AWS credentials resolvable via the default provider chain
//   3. HeadBucket succeeds (s3:ListBucket-equivalent)
//   4. PutObject roundtrip (s3:PutObject) on a temporary key
//   5. Presigned GET URL mints and fetches the object back (s3:GetObject)
//   6. DeleteObject cleanup (s3:DeleteObject)
//
// Same shape as db-iam-check: each step prints PASS / FAIL with a hint.
//
//   node --env-file-if-exists=.env scripts/s3-iam-check.mjs

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

function log(state, label, hint) {
  const tag = state === "ok" ? "PASS" : state === "skip" ? "SKIP" : "FAIL";
  console.log(`  ${tag.padEnd(4)}  ${label}${hint ? ` — ${hint}` : ""}`);
}

async function main() {
  let failed = false;

  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket) {
    log("fail", "S3_BUCKET set", "missing");
    process.exit(1);
  }
  log("ok", `S3_BUCKET set (${bucket})`);
  if (!region) {
    log("fail", "S3_REGION set", "missing");
    process.exit(1);
  }
  log("ok", `S3_REGION set (${region})`);

  // ---- AWS credentials ----
  try {
    const creds = await defaultProvider()();
    const masked = creds.accessKeyId
      ? `${creds.accessKeyId.slice(0, 4)}…${creds.accessKeyId.slice(-4)}`
      : "(none)";
    log("ok", `AWS credentials resolvable (${masked})`);
  } catch (err) {
    log("fail", "AWS credentials resolvable", err.message);
    return;
  }

  // Build the same way lib/s3.ts does: explicit creds only if S3_* keys are set,
  // otherwise let the SDK use the default provider chain.
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const client = new S3Client({
    region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  // ---- HeadBucket ----
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    log("ok", "HeadBucket (bucket reachable, principal has access)");
  } catch (err) {
    failed = true;
    log("fail", "HeadBucket", `${err.name}: ${err.message}`);
  }

  // ---- PutObject ----
  const key = `_iam-check/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const body = `iam-check ${new Date().toISOString()}`;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      }),
    );
    log("ok", `PutObject (${key})`);
  } catch (err) {
    failed = true;
    log("fail", "PutObject", `${err.name}: ${err.message}`);
    return;
  }

  // ---- Presigned GET + fetch back ----
  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 },
    );
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text !== body) throw new Error("body mismatch");
    log("ok", "presigned GET URL fetches the object");
  } catch (err) {
    failed = true;
    log("fail", "presigned GET URL fetches the object", err.message);
  }

  // ---- DeleteObject (cleanup) ----
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    log("ok", "DeleteObject (cleanup)");
  } catch (err) {
    failed = true;
    log("fail", "DeleteObject", `${err.name}: ${err.message}`);
  }

  if (failed) process.exit(1);
  console.log("\nAll S3 IAM checks passed.");
}

main().catch((err) => {
  console.error(`\nUnexpected error: ${err.message ?? err}`);
  process.exit(1);
});
