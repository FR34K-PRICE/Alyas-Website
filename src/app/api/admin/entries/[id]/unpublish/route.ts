import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/security";
import { KINDS } from "@/content/schema";
import { getEntry, unpublishEntry } from "@/content/store";

export const POST = route(async (_req, ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  const entry = await getEntry(id);
  if (!entry || KINDS[entry.kind].singleton) throw new HttpError(404, "Not found.");
  const user = await requireUser(...KINDS[entry.kind].editRoles);
  return { entry: await unpublishEntry(id, user.email) };
});
