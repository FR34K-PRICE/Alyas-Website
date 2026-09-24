import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { hashPassword, requireUser, validatePasswordStrength } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/security";

export const GET = route(async () => {
  await requireUser("admin");
  const db = await getDb();
  const r = await db.query(`SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at`);
  return { users: r.rows.map((u: any) => ({ ...u, created_at: new Date(u.created_at).toISOString() })) };
});

export const POST = route(async (req) => {
  await requireUser("admin");
  const b = await readJson(
    req,
    z.object({
      email: z.string().trim().toLowerCase().email("Enter a valid email.").max(160),
      name: z.string().trim().max(100).default(""),
      role: z.enum(["admin", "editor"]),
      password: z.string().max(200),
    }),
  );
  const weak = validatePasswordStrength(b.password);
  if (weak) throw new HttpError(400, weak, { fields: { password: weak } });
  const db = await getDb();
  const exists = await db.query(`SELECT 1 FROM users WHERE email = $1`, [b.email]);
  if (exists.rows.length) throw new HttpError(409, "A user with this email already exists.", { fields: { email: "Already in use." } });
  const r = await db.query(
    `INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role, disabled, created_at`,
    [b.email, b.name, b.role, await hashPassword(b.password)],
  );
  return { user: r.rows[0] };
});
