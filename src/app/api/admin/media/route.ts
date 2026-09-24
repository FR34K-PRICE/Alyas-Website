import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { HttpError, rateLimitOrThrow } from "@/lib/security";
import { listMedia, saveUpload, MAX_UPLOAD_BYTES } from "@/lib/media";

export const GET = route(async () => {
  await requireUser();
  return { media: await listMedia() };
});

export const POST = route(async (req) => {
  const user = await requireUser("admin", "editor");
  await rateLimitOrThrow(`upload:${user.id}`, 60, 3600);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose an image to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "That file is larger than 8 MB. Please choose a smaller image.");
  const folder = String(form?.get("folder") || "general");
  const media = await saveUpload(Buffer.from(await file.arrayBuffer()), file.name, folder, user.email);
  return { media };
});
