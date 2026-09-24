import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Shell } from "@/admin/Shell";

export const dynamic = "force-dynamic";

/** Server-side gate: nothing under /admin renders for a visitor without a valid session. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <Shell user={user}>{children}</Shell>;
}
