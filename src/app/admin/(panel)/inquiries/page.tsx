import { getSessionUser } from "@/lib/auth";
import { Inquiries } from "@/admin/Inquiries";

export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  const user = (await getSessionUser())!;
  return <Inquiries role={user.role} />;
}
