import nodemailer from "nodemailer";
import { env } from "../config/env";

function hasSmtpConfig(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
}

export async function sendAlertEmail(input: {
  to: string;
  severity: string;
  message: string;
  source: string;
}): Promise<{ sent: boolean }> {
  if (!hasSmtpConfig()) return { sent: false };

  const label = input.severity === "critical" ? "🔴 Critical" : "⚠️ Warning";
  const subject = `[VoiceBrief ${label}] ${input.source}: ${input.message.slice(0, 60)}`;
  const text = [
    `VoiceBrief reliability alert`,
    ``,
    `Severity : ${input.severity.toUpperCase()}`,
    `Source   : ${input.source}`,
    ``,
    input.message,
    ``,
    `Log in to your dashboard to review details and take action.`
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:520px">
      <h2 style="color:${input.severity === "critical" ? "#dc2626" : "#d97706"}">
        ${label} — VoiceBrief
      </h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 8px;font-weight:bold">Source</td><td style="padding:4px 8px">${input.source}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">Severity</td><td style="padding:4px 8px">${input.severity}</td></tr>
      </table>
      <p style="margin-top:16px">${input.message}</p>
      <p><a href="${env.FRONTEND_URL ?? ""}/dashboard">Open dashboard →</a></p>
    </div>`;

  await createTransporter().sendMail({ from: env.EMAIL_FROM, to: input.to, subject, text, html });
  return { sent: true };
}

export async function sendVerificationEmail(input: { to: string; verifyLink: string }): Promise<{ sent: boolean }> {
  if (!hasSmtpConfig()) {
    return { sent: false };
  }

  await createTransporter().sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: "Verify your Brief Buddy email",
    text: `Welcome to Brief Buddy.\n\nVerify your email by opening this link:\n${input.verifyLink}\n\nIf you did not create this account, you can ignore this message.`,
    html: `<p>Welcome to Brief Buddy.</p><p>Verify your email by clicking <a href="${input.verifyLink}">this link</a>.</p><p>If you did not create this account, you can ignore this message.</p>`
  });

  return { sent: true };
}
