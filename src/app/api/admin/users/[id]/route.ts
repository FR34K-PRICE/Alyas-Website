import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { destroyOtherSessions, hashPassword, requireUser, validatePasswordStrength } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/security";

export const PATCH = route(async (req, ctx) => {
  const me = await requireUser("admin");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "User not found.");
  const b = await readJson(
    req,
    z.object({
      name: z.string().trim().max(100).optional(),
      role: z.enum(["admin", "editor"]).optional(),
      disabled: z.boolean().optional(),
      password: z.string().max(200).optional(),
    }),
  );
  const db = await getDb();
  const found = await db.query(`SELECT id, role, disabled FROM users WHERE id = $1`, [id]);
  const target = found.rows[0];
  if (!target) throw new HttpError(404, "User not found.");

  const losesAdmin = (b.role && b.role !== "admin" && target.role === "admin") || (b.disabled === true && target.role === "admin");
  if (id === me.id && (b.disabled === true || (b.role && b.role !== "admin"))) {
    throw new HttpError(400, "You cannot disable or demote your own account.");
  }
  if (losesAdmin) {
    const n = await db.query(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND disabled = false AND id <> $1`, [id]);
    if (n.rows[0].n < 1) throw new HttpError(400, "There must be at least one active administrator.");
  }
  if (b.password !== undefined) {
    const weak = validatePasswordStrength(b.password);
    if (weak) throw new HttpError(400, weak, { fields: { password: weak } });
    await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, await hashPassword(b.password)]);
    await destroyOtherSessions(id);
  }
  await db.query(
    `UPDATE users SET name = COALESCE($2, name), role = COALESCE($3, role), disabled = COALESCE($4, disabled) WHERE id = $1`,
    [id, b.name ?? null, b.role ?? null, b.disabled ?? null],
  );
  if (b.disabled) await destroyOtherSessions(id);
  const r = await db.query(`SELECT id, email, name, role, disabled, created_at FROM users WHERE id = $1`, [id]);
  return { user: r.rows[0] };
});
