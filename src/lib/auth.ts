import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { isProd } from "./env";
import { HttpError, hmac } from "./security";

export type Role = "admin" | "editor";
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE = "alyas_session";
const IDLE_HOURS = 8;
const ABSOLUTE_DAYS = 7;

export { hashPassword, verifyPassword, dummyVerify, validatePasswordStrength } from "./passwords";

/* ---------------- Sessions ---------------- */

const tokenHash = (t: string) => hmac(`session:${t}`);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [tokenHash(token), userId, String(ABSOLUTE_DAYS)],
  );
  await db.query(`DELETE FROM sessions WHERE expires_at < now()`);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash(token)]);
  }
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function destroyOtherSessions(userId: string, keepToken?: string) {
  const db = await getDb();
  if (keepToken) await db.query(`DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`, [userId, tokenHash(keepToken)]);
  else await db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

export async function currentToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await currentToken();
  if (!token || token.length > 200) return null;
  const db = await getDb();
  const r = await db.query<SessionUser & { last_seen: Date }>(
    `SELECT u.id, u.email, u.name, u.role, s.last_seen
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
        AND s.last_seen > now() - ($2 || ' hours')::interval AND u.disabled = false`,
    [tokenHash(token), String(IDLE_HOURS)],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen).getTime() > 5 * 60 * 1000) {
    await db.query(`UPDATE sessions SET last_seen = now() WHERE token_hash = $1`, [tokenHash(token)]);
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/** Every administrative endpoint calls this first. */
export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in required.");
  if (roles.length && !roles.includes(user.role)) throw new HttpError(403, "You do not have permission to do this.");
  return user;
}
