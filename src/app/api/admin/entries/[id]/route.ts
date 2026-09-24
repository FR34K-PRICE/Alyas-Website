import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/security";
import { KINDS } from "@/content/schema";
import { deleteEntry, getEntry, saveEntry } from "@/content/store";

async function load(ctx: { params: Promise<Record<string, string>> }) {
  const { id } = await ctx.params;
  const entry = await getEntry(id);
  if (!entry || KINDS[entry.kind].singleton) throw new HttpError(404, "Not found.");
  return entry;
}

export const GET = route(async (_req, ctx) => {
  await requireUser();
  return { entry: await load(ctx) };
});

export const PUT = route(async (req, ctx) => {
  await requireUser();
  const existing = await load(ctx);
  const user = await requireUser(...KINDS[existing.kind].editRoles);
  const { data } = await readJson(req, z.object({ data: z.unknown() }));
  return { entry: await saveEntry(existing.id, data, user.email) };
});

/** Deleting is administrator-only. */
export const DELETE = route(async (_req, ctx) => {
  await requireUser("admin");
  const existing = await load(ctx);
  await deleteEntry(existing.id);
  return { ok: true };
});
