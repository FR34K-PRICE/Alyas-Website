import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/security";
import { KINDS, isKind } from "@/content/schema";
import { getSingleton, publishEntry, saveSingleton } from "@/content/store";

/** Publishes a singleton document (home, about, site, ...). */
export const POST = route(async (_req, ctx) => {
  await requireUser();
  const { kind } = await ctx.params;
  if (!isKind(kind) || !KINDS[kind].singleton) throw new HttpError(404, "Unknown content type.");
  const user = await requireUser(...KINDS[kind].editRoles);
  const current = await getSingleton(kind);
  if (!current.id) await saveSingleton(kind, current.data, user.email); // publishing the starter copy as-is
  await publishEntry({ kind }, user.email);
  return { entry: await getSingleton(kind) };
});
