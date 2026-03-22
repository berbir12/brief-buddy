import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { env } from "../config/env";
import { buildIntegrationStatusRows, type IntegrationHealthStatus } from "../integrations/status";

function resolveDatabaseSslMode(): false | { rejectUnauthorized: false } {
  if (env.DATABASE_SSL_MODE === "disable") return false;
  if (env.DATABASE_SSL_MODE === "require") {
    return { rejectUnauthorized: false };
  }
  const isSupabase = /supabase\.(co|in)/i.test(env.DATABASE_URL);
  return isSupabase ? { rejectUnauthorized: false } : false;
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: resolveDatabaseSslMode()
});

export interface BriefingRecordInput {
  userId: string;
  mode: string;
  script: string;
  audioUrl?: string;
  deliveryStatus?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  timezone: string;
  elevenLabsVoiceId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
}

export interface UserSettings {
  morningTime: string;
  eveningTime: string;
  newsKeywords: string[];
  dealValueThreshold: number;
  urgencyKeywords: string[];
}

export interface UserSchedule {
  userId: string;
  timezone: string;
  morningTime: string;
  eveningTime: string;
}

export interface IntegrationUpsertInput {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

export interface IntegrationStatusRow {
  provider: string;
  connected: boolean;
  status: IntegrationHealthStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  requiresReconnect: boolean;
}

const SUPPORTED_INTEGRATION_PROVIDERS = ["google", "slack", "crm"] as const;

export interface BriefingJobEventRow {
  id: string;
  jobId: string;
  mode: string;
  eventType: string;
  detail: string | null;
  createdAt: string;
}

export interface BriefingMetricsRow {
  generated7d: number;
  delivered7d: number;
  undelivered7d: number;
  alerts7d: number;
  lastBriefingAt: string | null;
}

export interface EmailVerificationRequest {
  token: string;
  expiresAt: Date;
}

export async function saveBriefingRecord(input: BriefingRecordInput): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO briefings (id, user_id, mode, script, audio_url, delivery_status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.userId, input.mode, input.script, input.audioUrl ?? null, input.deliveryStatus ?? "pending"]
  );
  return id;
}

export async function markBriefingDelivered(briefingId: string): Promise<void> {
  await pool.query(
    `UPDATE briefings
       SET delivery_status = 'delivered',
           delivered_at = NOW()
     WHERE id = $1`,
    [briefingId]
  );
}

export async function seedDemoUser(): Promise<string> {
  const email = "demo@voicebrief.local";
  const existing = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const userId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, phone, timezone, eleven_labs_voice_id, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, email, "+15555550100", "America/New_York", env.ELEVENLABS_VOICE_ID ?? null]
  );

  await pool.query(
    `INSERT INTO settings (user_id, news_keywords, deal_value_threshold, urgency_keywords)
     VALUES ($1, $2, $3, $4)`,
    [userId, ["small business", "B2B sales", "local market"], 10000, ["urgent", "asap", "invoice", "contract"]]
  );

  await pool.query(
    `INSERT INTO tasks (id, user_id, text, source, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $8, $9, $10, $11)`,
    [
      randomUUID(),
      userId,
      "Follow up with Acme Corp on signed contract.",
      "manual",
      "HIGH",
      "open",
      randomUUID(),
      "Prepare tomorrow's kickoff deck.",
      "manual",
      "NORMAL",
      "open"
    ]
  );

  return userId;
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const result = await pool.query<AuthUser>(
    `SELECT
       id,
       email,
       password_hash AS "passwordHash",
       email_verified_at AS "emailVerifiedAt"
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const result = await pool.query<AuthUser>(
    `SELECT
       id,
       email,
       password_hash AS "passwordHash",
       email_verified_at AS "emailVerifiedAt"
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createUserAccount(input: {
  email: string;
  passwordHash: string;
  timezone?: string;
}): Promise<{ id: string; email: string }> {
  const userId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, timezone)
     VALUES ($1, $2, $3, $4)`,
    [userId, input.email, input.passwordHash, input.timezone ?? "UTC"]
  );

  await pool.query("INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);

  return { id: userId, email: input.email };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const result = await pool.query<UserProfile>(
    `SELECT
       id,
       email,
       email_verified_at AS "emailVerifiedAt",
       phone,
       timezone,
       eleven_labs_voice_id AS "elevenLabsVoiceId"
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(userId: string, ttlMinutes = 30): Promise<EmailVerificationRequest> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await pool.query(
    `DELETE FROM email_verification_tokens
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  await pool.query(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
}

export async function verifyEmailWithToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashVerificationToken(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tokenRes = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM email_verification_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );

    const row = tokenRes.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = $1`,
      [row.user_id]
    );
    await client.query("COMMIT");
    return { userId: row.user_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listUserIds(): Promise<string[]> {
  const result = await pool.query<{ id: string }>("SELECT id FROM users");
  return result.rows.map((r) => r.id);
}

export async function listUserSchedules(): Promise<UserSchedule[]> {
  const result = await pool.query<UserSchedule>(
    `SELECT
       u.id AS "userId",
       u.timezone AS "timezone",
       s.morning_time AS "morningTime",
       s.evening_time AS "eveningTime"
     FROM users u
     JOIN settings s ON s.user_id = u.id`
  );
  return result.rows;
}

export async function getUserSchedule(userId: string): Promise<UserSchedule | null> {
  const result = await pool.query<UserSchedule>(
    `SELECT
       u.id AS "userId",
       u.timezone AS "timezone",
       s.morning_time AS "morningTime",
       s.evening_time AS "eveningTime"
     FROM users u
     JOIN settings s ON s.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const result = await pool.query<UserSettings>(
    `SELECT
       morning_time AS "morningTime",
       evening_time AS "eveningTime",
       news_keywords AS "newsKeywords",
       deal_value_threshold::float AS "dealValueThreshold",
       urgency_keywords AS "urgencyKeywords"
     FROM settings
     WHERE user_id = $1`,
    [userId]
  );

  return (
    result.rows[0] ?? {
      morningTime: "07:00",
      eveningTime: "18:00",
      newsKeywords: ["small business", "sales", "operations"],
      dealValueThreshold: 10000,
      urgencyKeywords: ["urgent", "asap", "invoice", "contract"]
    }
  );
}

export async function getIntegrationsStatus(userId: string): Promise<IntegrationStatusRow[]> {
  const result = await pool.query<{
    provider: string;
    status: IntegrationHealthStatus;
    expires_at: Date | null;
    last_error: string | null;
    last_synced_at: Date | null;
  }>(
    `SELECT provider, status, expires_at, last_error, last_synced_at
     FROM integrations
     WHERE user_id = $1`,
    [userId]
  );
  return buildIntegrationStatusRows(
    result.rows.map((row) => ({
      provider: row.provider,
      status: row.status,
      expiresAt: row.expires_at,
      lastError: row.last_error,
      lastSyncedAt: row.last_synced_at
    })),
    SUPPORTED_INTEGRATION_PROVIDERS
  );
}

export async function disconnectIntegration(userId: string, provider: (typeof SUPPORTED_INTEGRATION_PROVIDERS)[number]): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM integrations
     WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function canSendAlertNow(userId: string): Promise<boolean> {
  const result = await pool.query<{ can_send: boolean }>(
    `SELECT NOT EXISTS (
       SELECT 1
       FROM briefings
       WHERE user_id = $1
         AND mode = 'alert'
         AND created_at > NOW() - INTERVAL '1 hour'
     ) AS can_send`,
    [userId]
  );
  return result.rows[0]?.can_send ?? true;
}

export async function upsertIntegration(input: IntegrationUpsertInput): Promise<void> {
  await pool.query(
    `INSERT INTO integrations (id, user_id, provider, access_token, refresh_token, expires_at, status, last_error, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'connected', NULL, NOW())
     ON CONFLICT (user_id, provider)
     DO UPDATE
        SET access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
            expires_at = EXCLUDED.expires_at,
            status = 'connected',
            last_error = NULL,
            updated_at = NOW()`,
    [
      randomUUID(),
      input.userId,
      input.provider,
      input.accessToken,
      input.refreshToken ?? null,
      input.expiresAt ?? null
    ]
  );
}

export async function markIntegrationSyncSuccess(userId: string, provider: string): Promise<void> {
  await pool.query(
    `UPDATE integrations
        SET status = 'connected',
            last_error = NULL,
            last_synced_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
}

export async function markIntegrationSyncFailure(input: {
  userId: string;
  provider: string;
  error: string;
  requiresReconnect?: boolean;
}): Promise<void> {
  const status: IntegrationHealthStatus = input.requiresReconnect ? "reconnect_required" : "error";
  await pool.query(
    `UPDATE integrations
        SET status = $3,
            last_error = $4,
            updated_at = NOW()
      WHERE user_id = $1 AND provider = $2`,
    [input.userId, input.provider, status, input.error.slice(0, 600)]
  );
}

export async function recordBriefingJobEvent(input: {
  userId: string;
  jobId: string;
  mode: string;
  eventType: string;
  detail?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO briefing_job_events (id, user_id, job_id, mode, event_type, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), input.userId, input.jobId, input.mode, input.eventType, input.detail ?? null]
  );
}

export async function listBriefingJobEvents(userId: string, limit = 50): Promise<BriefingJobEventRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await pool.query<BriefingJobEventRow>(
    `SELECT
       id,
       job_id AS "jobId",
       mode,
       event_type AS "eventType",
       detail,
       created_at AS "createdAt"
     FROM briefing_job_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );
  return result.rows;
}

export async function getBriefingMetrics(userId: string): Promise<BriefingMetricsRow> {
  const result = await pool.query<BriefingMetricsRow>(
    `SELECT
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS "generated7d",
       COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND created_at > NOW() - INTERVAL '7 days')::int AS "delivered7d",
       COUNT(*) FILTER (WHERE delivery_status <> 'delivered' AND created_at > NOW() - INTERVAL '7 days')::int AS "undelivered7d",
       COUNT(*) FILTER (WHERE mode = 'alert' AND created_at > NOW() - INTERVAL '7 days')::int AS "alerts7d",
       MAX(created_at)::text AS "lastBriefingAt"
     FROM briefings
     WHERE user_id = $1`,
    [userId]
  );

  return (
    result.rows[0] ?? {
      generated7d: 0,
      delivered7d: 0,
      undelivered7d: 0,
      alerts7d: 0,
      lastBriefingAt: null
    }
  );
}
