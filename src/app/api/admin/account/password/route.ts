import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { currentToken, destroyOtherSessions, hashPassword, requireUser, validatePasswordStrength, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError, rateLimitOrThrow } from "@/lib/security";

export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimitOrThrow(`pw:${user.id}`, 8, 900);
  const { current, next } = await readJson(req, z.object({ current: z.string().max(200), next: z.string().max(200) }));
  const weak = validatePasswordStrength(next);
  if (weak) throw new HttpError(400, weak, { fields: { next: weak } });
  const db = await getDb();
  const r = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
  if (!r.rows[0] || !(await verifyPassword(current, r.rows[0].password_hash))) {
    throw new HttpError(400, "Your current password is not correct.", { fields: { current: "Not correct." } });
  }
  await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [user.id, await hashPassword(next)]);
  await destroyOtherSessions(user.id, await currentToken());
  return { ok: true };
});
