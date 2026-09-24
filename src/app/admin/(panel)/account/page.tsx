import { getSessionUser } from "@/lib/auth";
import { Account } from "@/admin/Account";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = (await getSessionUser())!;
  return <Account email={user.email} role={user.role} />;
}
