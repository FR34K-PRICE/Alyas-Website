import { route, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/security";
import { z } from "zod";
import { KINDS, isKind } from "@/content/schema";
import { createEntry, getSingleton, listEntries, saveSingleton } from "@/content/store";

async function kindOf(ctx: { params: Promise<Record<string, string>> }) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) throw new HttpError(404, "Unknown content type.");
  return kind;
}

/** Singleton: returns the document. Collection: returns the list. */
export const GET = route(async (_req, ctx) => {
  await requireUser();
  const kind = await kindOf(ctx);
  return KINDS[kind].singleton ? { entry: await getSingleton(kind) } : { entries: await listEntries(kind) };
});

/** Singleton: saves the draft. */
export const PUT = route(async (req, ctx) => {
  await requireUser();
  const kind = await kindOf(ctx);
  const user = await requireUser(...KINDS[kind].editRoles);
  if (!KINDS[kind].singleton) throw new HttpError(405, "Use POST to create.");
  const { data } = await readJson(req, z.object({ data: z.unknown() }));
  return { entry: await saveSingleton(kind, data, user.email) };
});

/** Collection: creates a draft entry. */
export const POST = route(async (req, ctx) => {
  await requireUser();
  const kind = await kindOf(ctx);
  const user = await requireUser(...KINDS[kind].editRoles);
  if (KINDS[kind].singleton) throw new HttpError(405, "This content type has a single document.");
  const { data } = await readJson(req, z.object({ data: z.unknown() }));
  return { entry: await createEntry(kind, data, user.email) };
});
