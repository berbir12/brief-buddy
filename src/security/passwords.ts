import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  const [salt, hash] = storedValue.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const saved = Buffer.from(hash, "hex");
  if (saved.length !== computed.length) return false;
  return timingSafeEqual(saved, computed);
}
