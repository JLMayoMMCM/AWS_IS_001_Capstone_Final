// Email delivery via SMTP (Nodemailer). Wired up to Gmail SMTP in dev/prod
// per V2.1 §Phase 4. Credentials come from environment:
//
//   smtp_email   the Google account address (also the From header)
//   smtp_pass    a 16-character Google App Password (NOT the account password)
//   SMTP_HOST    optional override (default: smtp.gmail.com)
//   SMTP_PORT    optional override (default: 465)
//
// The lowercase env var names match what's in .env. When unset the module
// falls back to stdout so the auth flows are observable in dev without forcing
// SMTP creds.

import nodemailer, { type Transporter } from "nodemailer";

import { getOrg } from "@/lib/queries";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const SMTP_USER = process.env.smtp_email ?? process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.smtp_pass ?? process.env.SMTP_PASS ?? "";
const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;

/** True when SMTP is configured and emails can be sent for real. */
export const emailConfigured: boolean = Boolean(SMTP_USER && SMTP_PASS);

let cachedTransport: Transporter | null | undefined;

function transport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;
  if (!emailConfigured) {
    cachedTransport = null;
    return null;
  }
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      // Strip spaces in Gmail App Passwords — Google's UI shows them with
      // spaces but the SMTP server doesn't accept that form.
      pass: SMTP_PASS.replace(/\s+/g, ""),
    },
  });
  return cachedTransport;
}

async function logToStdout(msg: EmailMessage): Promise<void> {
  console.log("==== Email (stdout fallback) ================================");
  console.log(`To:      ${msg.to}`);
  console.log(`Subject: ${msg.subject}`);
  console.log("");
  console.log(msg.text);
  console.log("=============================================================");
}

async function send(msg: EmailMessage): Promise<boolean> {
  const t = transport();
  if (!t) {
    await logToStdout(msg);
    return false;
  }
  try {
    await t.sendMail({
      from: SMTP_FROM,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return true;
  } catch (err) {
    console.error("[email] sendMail failed:", err);
    await logToStdout(msg);
    return false;
  }
}

function appOrigin(): string {
  return (
    process.env.APP_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    "http://localhost:3000"
  );
}

export async function sendPasswordResetEmail(input: {
  to: string;
  token: string;
}): Promise<boolean> {
  const org = await getOrg().catch(() => null);
  const orgName = org?.name ?? "CloudCampus";
  const link = `${appOrigin()}/reset-password?token=${encodeURIComponent(
    input.token,
  )}`;
  return send({
    to: input.to,
    subject: `${orgName} — Password reset`,
    text: [
      `Hello,`,
      ``,
      `Someone (hopefully you) requested a password reset for your ${orgName} account.`,
      `Click the link below to choose a new password. The link is valid for 60 minutes.`,
      ``,
      link,
      ``,
      `If you did not request this, you can safely ignore this email.`,
    ].join("\n"),
  });
}

export async function sendRegistrationDecisionEmail(input: {
  to: string;
  name: string;
  approved: boolean;
  note: string | null;
}): Promise<boolean> {
  const org = await getOrg().catch(() => null);
  const orgName = org?.name ?? "CloudCampus";
  const subject = input.approved
    ? `${orgName} — Registration approved`
    : `${orgName} — Registration update`;
  const lines = input.approved
    ? [
        `Hi ${input.name},`,
        ``,
        `Your registration has been approved. You can now sign in at:`,
        `${appOrigin()}/login`,
        ``,
        `Welcome aboard!`,
      ]
    : [
        `Hi ${input.name},`,
        ``,
        `Thank you for your interest in ${orgName}.`,
        `Your registration was not approved at this time.`,
        input.note ? `\nReason: ${input.note}` : ``,
      ];
  return send({ to: input.to, subject, text: lines.join("\n") });
}

export async function sendEmailChangeConfirmation(input: {
  to: string;
  token: string;
}): Promise<boolean> {
  const org = await getOrg().catch(() => null);
  const orgName = org?.name ?? "CloudCampus";
  const link = `${appOrigin()}/profile/change-email/confirm?token=${encodeURIComponent(
    input.token,
  )}`;
  return send({
    to: input.to,
    subject: `${orgName} — Confirm your new email`,
    text: [
      `Hello,`,
      ``,
      `Someone (hopefully you) asked to use this address as the sign-in email`,
      `for a ${orgName} account.`,
      ``,
      `Click the link below to confirm the change. The link is valid for 60 minutes:`,
      ``,
      link,
      ``,
      `If you did not request this, you can safely ignore the email — your`,
      `account stays on its current address.`,
    ].join("\n"),
  });
}
