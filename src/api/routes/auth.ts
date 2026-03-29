import { Router } from "express";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import {
  createEmailVerificationToken,
  createUserAccount,
  findAuthUserByEmail,
  findAuthUserById,
  seedDemoUser,
  upsertIntegration,
  verifyEmailWithToken
} from "../../db/queries";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { consumeAuthRateLimit, validatePasswordStrength } from "../../security/authSecurity";
import { hashPassword, verifyPassword } from "../../security/passwords";
import { sendVerificationEmail } from "../../notifications/email";
import { registerSchedulesForUser } from "../../scheduler/registerUserSchedules";

export const authRouter = Router();

const authPayloadSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(128),
  // Optional E.164 phone number for call delivery setup at signup.
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional()
});
const tokenPayloadSchema = z.object({
  token: z.string().min(32).max(200)
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

async function issueEmailVerification(
  userId: string,
  email: string
): Promise<{ debugToken?: string; sent: boolean; reason?: string }> {
  const verification = await createEmailVerificationToken(userId);
  const frontendBase = (env.FRONTEND_URL ?? env.BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
  const link = `${frontendBase}/verify-email?token=${encodeURIComponent(verification.token)}`;
  let sent = false;
  let reason: string | undefined;
  try {
    const result = await sendVerificationEmail({ to: email, verifyLink: link });
    sent = result.sent;
    if (!result.sent) {
      reason = "SMTP is not configured.";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auth] verification email failed for ${email}:`, msg);
    reason = msg;
  }
  if (env.AUTH_DEV_LOG_VERIFICATION_LINK && env.NODE_ENV !== "production") {
    console.log(`[auth] verification link for ${email}: ${link}`);
  }
  if (env.AUTH_DEV_RETURN_VERIFICATION_TOKEN && env.NODE_ENV !== "production") {
    return { debugToken: verification.token, sent, reason };
  }
  return { sent, reason };
}

authRouter.post("/register", async (req, res) => {
  const parsed = authPayloadSchema.safeParse(req.body);
  const emailForLimit = parsed.success ? parsed.data.email : undefined;
  const limit = await consumeAuthRateLimit("register", emailForLimit, req.ip);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).json({ error: "Too many auth attempts. Try again later." });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const passwordError = validatePasswordStrength(parsed.data.password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await findAuthUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const user = await createUserAccount({
    email,
    passwordHash: hashPassword(parsed.data.password),
    phone: parsed.data.phone ?? null
  });
  try {
    await registerSchedulesForUser(user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auth] registerSchedulesForUser failed for ${user.id}:`, msg);
  }

  const token = signSessionToken(user.id);
  const verification = await issueEmailVerification(user.id, user.email);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, emailVerified: false },
    requiresEmailVerification: true,
    verificationEmailSent: verification.sent,
    verificationEmailReason: verification.reason,
    verificationToken: verification.debugToken
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = authPayloadSchema.safeParse(req.body);
  const emailForLimit = parsed.success ? parsed.data.email : undefined;
  const limit = await consumeAuthRateLimit("login", emailForLimit, req.ip);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).json({ error: "Too many auth attempts. Try again later." });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await findAuthUserByEmail(email);
  if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signSessionToken(user.id);
  const emailVerified = Boolean(user.emailVerifiedAt);
  let verificationEmailSent: boolean | undefined;
  let verificationEmailReason: string | undefined;
  if (!emailVerified) {
    const verification = await issueEmailVerification(user.id, user.email);
    verificationEmailSent = verification.sent;
    verificationEmailReason = verification.reason;
  }
  res.json({
    token,
    user: { id: user.id, email: user.email, emailVerified },
    requiresEmailVerification: !emailVerified,
    verificationEmailSent,
    verificationEmailReason
  });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await findAuthUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, emailVerified: Boolean(user.emailVerifiedAt) } });
});

authRouter.post("/verify-email", async (req, res) => {
  const parsed = tokenPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }
  const verified = await verifyEmailWithToken(parsed.data.token);
  if (!verified) {
    res.status(400).json({ error: "Token is invalid or expired" });
    return;
  }
  res.json({ verified: true });
});

authRouter.post("/verification/request", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await findAuthUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.emailVerifiedAt) {
    res.json({ sent: false, alreadyVerified: true });
    return;
  }
  const verification = await issueEmailVerification(user.id, user.email);
  res.json({
    sent: verification.sent,
    alreadyVerified: false,
    reason: verification.reason,
    verificationToken: verification.debugToken
  });
});

authRouter.post("/logout", requireAuth, (_req, res) => {
  res.json({ success: true });
});

authRouter.get("/demo-token", async (_req, res) => {
  if (env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const userId = await seedDemoUser();
  const token = signSessionToken(userId);
  res.json({ token, userId });
});

authRouter.get("/google/start", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const user = await findAuthUserById(userId);
  if (!user?.emailVerifiedAt) {
    res.status(403).json({ error: "Verify your email before connecting integrations." });
    return;
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(400).json({ error: "Google OAuth env vars not configured" });
    return;
  }

  const redirectUri = env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";
  const oauth2Client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  const state = jwt.sign({ sub: userId, provider: "google" }, env.JWT_SECRET, { expiresIn: "10m" });
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.readonly"
    ],
    state
  });
  res.json({ url });
});

authRouter.get("/google/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const stateToken = String(req.query.state ?? "");
  if (!code || !stateToken) {
    res.status(400).json({ error: "Missing code/state in callback" });
    return;
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(400).json({ error: "Google OAuth env vars not configured" });
    return;
  }

  let userId = "";
  try {
    const payload = jwt.verify(stateToken, env.JWT_SECRET) as { sub: string; provider: string };
    if (payload.provider !== "google" || !payload.sub) {
      res.status(400).json({ error: "Invalid OAuth state" });
      return;
    }
    userId = payload.sub;
  } catch {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }

  const redirectUri = env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";
  const oauth2Client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  const tokenResponse = await oauth2Client.getToken(code);
  const credentials = tokenResponse.tokens;
  if (!credentials.access_token) {
    res.status(400).json({ error: "Google token exchange failed" });
    return;
  }

  await upsertIntegration({
    userId,
    provider: "google",
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? null,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null
  });

  const frontendBase = (env.FRONTEND_URL ?? env.BASE_URL ?? "").replace(/\/$/, "");
  if (frontendBase) {
    res.redirect(`${frontendBase}/dashboard/settings?provider=google&connected=1`);
    return;
  }
  res.json({ connected: true, provider: "google" });
});

authRouter.get("/slack/start", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const user = await findAuthUserById(userId);
  if (!user?.emailVerifiedAt) {
    res.status(403).json({ error: "Verify your email before connecting integrations." });
    return;
  }
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    res.status(400).json({ error: "Slack OAuth env vars not configured" });
    return;
  }

  const redirectUri = env.SLACK_REDIRECT_URI ?? "http://localhost:3000/api/auth/slack/callback";
  const userScope = [
    "channels:history",
    "groups:history",
    "im:history",
    "users:read",
    "channels:read",
    "groups:read",
    "im:read"
  ].join(",");

  const state = jwt.sign({ sub: userId, provider: "slack" }, env.JWT_SECRET, { expiresIn: "10m" });
  // Use user scopes so install works without requiring a bot user.
  const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(env.SLACK_CLIENT_ID)}&user_scope=${encodeURIComponent(userScope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  res.json({ url });
});

authRouter.get("/slack/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const stateToken = String(req.query.state ?? "");
  if (!code || !stateToken) {
    res.status(400).json({ error: "Missing code/state in callback" });
    return;
  }
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    res.status(400).json({ error: "Slack OAuth env vars not configured" });
    return;
  }

  let userId = "";
  try {
    const payload = jwt.verify(stateToken, env.JWT_SECRET) as { sub: string; provider: string };
    if (payload.provider !== "slack" || !payload.sub) {
      res.status(400).json({ error: "Invalid OAuth state" });
      return;
    }
    userId = payload.sub;
  } catch {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }

  const redirectUri = env.SLACK_REDIRECT_URI ?? "http://localhost:3000/api/auth/slack/callback";
  const params = new URLSearchParams({
    code,
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    redirect_uri: redirectUri
  });
  const response = await axios.post("https://slack.com/api/oauth.v2.access", params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const accessToken =
    (response.data?.authed_user?.access_token as string | undefined) ??
    (response.data?.access_token as string | undefined);
  if (!response.data?.ok || !accessToken) {
    res.status(400).json({ error: "Slack token exchange failed", detail: response.data });
    return;
  }

  const expiresAt =
    typeof response.data.authed_user?.expires_in === "number"
      ? new Date(Date.now() + response.data.authed_user.expires_in * 1000)
      : typeof response.data.expires_in === "number"
        ? new Date(Date.now() + response.data.expires_in * 1000)
      : null;
  const refreshToken =
    (response.data?.authed_user?.refresh_token as string | undefined) ??
    (response.data?.refresh_token as string | undefined);

  await upsertIntegration({
    userId,
    provider: "slack",
    accessToken,
    refreshToken: refreshToken ?? null,
    expiresAt
  });

  const frontendBase = (env.FRONTEND_URL ?? env.BASE_URL ?? "").replace(/\/$/, "");
  if (frontendBase) {
    res.redirect(`${frontendBase}/dashboard/settings?provider=slack&connected=1`);
    return;
  }
  res.json({ connected: true, provider: "slack" });
});
