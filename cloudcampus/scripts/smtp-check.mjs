// Quick check that the Gmail SMTP credentials in .env actually authenticate
// and deliver. Defaults to a self-ping; pass a recipient as the first arg to
// send the test message somewhere else (e.g. node smtp-check.mjs you@x.com).
//
//   node --env-file=.env scripts/smtp-check.mjs [recipient]

import nodemailer from "nodemailer";

const user = process.env.smtp_email ?? process.env.SMTP_USER;
const pass = (process.env.smtp_pass ?? process.env.SMTP_PASS ?? "").replace(
  /\s+/g,
  "",
);
if (!user || !pass) {
  console.error("smtp_email / smtp_pass not set");
  process.exit(1);
}

const recipient = process.argv[2] ?? user;

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: Number(process.env.SMTP_PORT ?? 465) === 465,
  auth: { user, pass },
});

console.log("Verifying SMTP credentials…");
await t.verify();
console.log("  PASS  Gmail SMTP authenticated as", user);

console.log(`Sending test message to ${recipient}…`);
const out = await t.sendMail({
  from: user,
  to: recipient,
  subject: "[CloudCampus] SMTP test",
  text: [
    "Hello from CloudCampus,",
    "",
    "This is a delivery test from the CloudCampus dev environment.",
    "If you can read this, Nodemailer + Gmail SMTP are wired up correctly.",
    "",
    "— CloudCampus",
  ].join("\n"),
});
console.log("  PASS  message id:", out.messageId);
console.log(`Check the inbox of ${recipient} (may be in Spam on first send).`);
