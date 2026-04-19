import { createHash } from "node:crypto";
import Redis from "ioredis";
import { env } from "../config/env";

type AuthAction = "login" | "register";

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false
});

let redisReady = false;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeIp(ip: string | undefined): string {
  return (ip ?? "unknown").trim().toLowerCase();
}

async function ensureRedis(): Promise<boolean> {
  if (redisReady && redis.status === "ready") return true;
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    redisReady = true;
    return true;
  } catch {
    return false;
  }
}

async function incrementWindowCounter(key: string, windowSeconds: number): Promise<number | null> {
  const available = await ensureRedis();
  if (!available) return null;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  return count;
}

export async function consumeAuthRateLimit(action: AuthAction, email: string | undefined, ip: string | undefined): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const windowSeconds = env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
  const maxAttempts = action === "register" ? env.AUTH_REGISTER_RATE_LIMIT_MAX_ATTEMPTS : env.AUTH_RATE_LIMIT_MAX_ATTEMPTS;

  const emailKey = `auth:rate:${action}:email:${hashValue((email ?? "unknown").trim().toLowerCase())}`;
  const ipKey = `auth:rate:${action}:ip:${hashValue(normalizeIp(ip))}`;

  const [emailAttempts, ipAttempts] = await Promise.all([
    incrementWindowCounter(emailKey, windowSeconds),
    incrementWindowCounter(ipKey, windowSeconds)
  ]);

  if (emailAttempts === null || ipAttempts === null) {
    // Production should fail closed by default. Can be overridden for emergency availability trade-offs.
    if (env.AUTH_RATE_LIMIT_FAIL_OPEN) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  const allowed = emailAttempts <= maxAttempts && ipAttempts <= maxAttempts;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : windowSeconds
  };
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  return null;
}
