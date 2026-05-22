import type { NextConfig } from "next";

// Security headers applied to every response (NFR-SEC-09).
//
// The CSP allows inline scripts/styles, which Next.js currently requires for
// hydration and streaming; a nonce-based policy is a later hardening step.
// frame-src permits the Google / Microsoft Forms embeds used on /forms.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // amazonaws.com is allowed so the browser can display images served from
  // S3 (img-src) and upload files to S3 via pre-signed URLs (connect-src).
  "img-src 'self' data: blob: https://*.amazonaws.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.amazonaws.com",
  // *.amazonaws.com lets PDF resources preview in an iframe served from S3.
  // Microsoft Forms is served from both forms.office.com and the newer
  // forms.cloud.microsoft host; Google Forms from docs.google.com.
  "frame-src 'self' https://*.amazonaws.com https://docs.google.com https://forms.gle https://forms.office.com https://*.microsoft.com https://*.cloud.microsoft",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
