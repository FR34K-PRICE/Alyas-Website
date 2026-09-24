import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/security";
import { KINDS, isKind } from "@/content/schema";
import { reorderEntries } from "@/content/store";

export const POST = route(async (req, ctx) => {
  const { kind } = await ctx.params;
  if (!isKind(kind) || KINDS[kind].singleton) throw new HttpError(404, "Unknown content type.");
  await requireUser(...KINDS[kind].editRoles);
  const { ids } = await readJson(req, z.object({ ids: z.array(z.string().uuid()).max(200) }));
  await reorderEntries(kind, ids);
  return { ok: true };
});
