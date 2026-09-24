import { route, readJson } from "@/lib/api";
import { clientIp } from "@/lib/security";
import { createInquiry, inquirySchema } from "@/lib/inquiries";

/** Public. Returns ok only after the inquiry is really stored (or was silently discarded as a bot). */
export const POST = route(async (req) => {
  const input = await readJson(req, inquirySchema);
  await createInquiry(input, clientIp(req));
  return { ok: true };
});
