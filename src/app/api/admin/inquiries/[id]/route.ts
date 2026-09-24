import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/security";
import { STATUSES, updateInquiry } from "@/lib/inquiries";

const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export const PATCH = route(async (req, ctx) => {
  await requireUser("admin", "editor");
  const { id } = await ctx.params;
  if (!isId(id)) throw new HttpError(404, "Inquiry not found.");
  const patch = await readJson(req, z.object({ status: z.enum(STATUSES).optional(), note: z.string().trim().max(2000).optional() }));
  return { inquiry: await updateInquiry(id, patch) };
});

export const DELETE = route(async (_req, ctx) => {
  await requireUser("admin");
  const { id } = await ctx.params;
  if (!isId(id)) throw new HttpError(404, "Inquiry not found.");
  const db = await getDb();
  await db.query(`DELETE FROM inquiries WHERE id = $1`, [id]);
  return { ok: true };
});
