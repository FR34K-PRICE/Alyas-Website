import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listInquiries } from "@/lib/inquiries";

export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  return listInquiries(url.searchParams.get("status"), 100, offset);
});
