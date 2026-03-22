import nodemailer from "nodemailer";
import { env } from "../config/env";

function hasSmtpConfig(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

export async function sendVerificationEmail(input: { to: string; verifyLink: string }): Promise<{ sent: boolean }> {
  if (!hasSmtpConfig()) {
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: "Verify your Brief Buddy email",
    text: `Welcome to Brief Buddy.\n\nVerify your email by opening this link:\n${input.verifyLink}\n\nIf you did not create this account, you can ignore this message.`,
    html: `<p>Welcome to Brief Buddy.</p><p>Verify your email by clicking <a href="${input.verifyLink}">this link</a>.</p><p>If you did not create this account, you can ignore this message.</p>`
  });

  return { sent: true };
}
