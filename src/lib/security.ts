import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import { sessionSecret, siteUrl, trustProxy } from "./env";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function clientIp(req: Request): string {
  if (trustProxy()) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim().slice(0, 64);
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return "local";
}

export const hmac = (value: string) => createHmac("sha256", sessionSecret()).update(value).digest("hex");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const ipHash = (ip: string) => hmac(`ip:${ip}`).slice(0, 32);

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * CSRF defence for cookie-authenticated and public POST endpoints:
 * mutating requests must carry a custom header (which browsers only allow
 * same-origin unless CORS permits it) and, when present, an Origin that matches us.
 */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  if (req.headers.get("x-alyas-csrf") !== "1") throw new HttpError(403, "Missing CSRF header.");
  const origin = req.headers.get("origin");
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      throw new HttpError(403, "Bad origin.");
    }
    const allowed = new Set<string>();
    const reqHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (reqHost) allowed.add(reqHost);
    try {
      allowed.add(new URL(siteUrl()).host);
    } catch {}
    if (!allowed.has(host)) throw new HttpError(403, "Cross-origin request blocked.");
  }
}

/* ---------------- Rate limiting (stored in the database, works across instances) ---------------- */

export async function rateHit(key: string, windowSec: number): Promise<{ count: number; retryAfter: number }> {
  const db = await getDb();
  const r = await db.query<{ count: number; reset_at: Date }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now() + ($2 || ' seconds')::interval)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < now() THEN now() + ($2 || ' seconds')::interval ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [key, String(windowSec)],
  );
  const row = r.rows[0];
  return { count: Number(row.count), retryAfter: Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000)) };
}

export async function ratePeek(key: string): Promise<{ count: number; retryAfter: number }> {
  const db = await getDb();
  const r = await db.query<{ count: number; reset_at: Date }>(
    `SELECT count, reset_at FROM rate_limits WHERE key = $1 AND reset_at > now()`,
    [key],
  );
  if (!r.rows[0]) return { count: 0, retryAfter: 0 };
  return { count: Number(r.rows[0].count), retryAfter: Math.max(1, Math.ceil((new Date(r.rows[0].reset_at).getTime() - Date.now()) / 1000)) };
}

export async function rateReset(key: string) {
  const db = await getDb();
  await db.query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
}

export async function rateLimitOrThrow(key: string, limit: number, windowSec: number) {
  const { count, retryAfter } = await rateHit(key, windowSec);
  if (count > limit) throw new HttpError(429, "Too many requests. Please try again later.", { retryAfter });
}
