import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteMedia, mediaUsage, updateMedia } from "@/lib/media";

export const GET = route(async (_req, ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  return { usedIn: await mediaUsage(id) };
});

export const PATCH = route(async (req, ctx) => {
  await requireUser("admin", "editor");
  const { id } = await ctx.params;
  const patch = await readJson(
    req,
    z.object({
      alt_ar: z.string().trim().max(200).optional(),
      alt_en: z.string().trim().max(200).optional(),
      folder: z.string().trim().max(40).optional(),
      filename: z.string().trim().min(1).max(120).optional(),
    }),
  );
  return { media: await updateMedia(id, patch) };
});

export const DELETE = route(async (_req, ctx) => {
  await requireUser("admin");
  const { id } = await ctx.params;
  await deleteMedia(id);
  return { ok: true };
});
