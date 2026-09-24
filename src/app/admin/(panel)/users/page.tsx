import { getSessionUser } from "@/lib/auth";
import { Users } from "@/admin/Users";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = (await getSessionUser())!;
  if (user.role !== "admin") {
    return (
      <div className="page">
        <h1>Users</h1>
        <p className="alert alert--error">Only administrators can manage users.</p>
      </div>
    );
  }
  return <Users meId={user.id} />;
}
