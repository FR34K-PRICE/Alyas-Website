import { getSessionUser } from "@/lib/auth";
import { MediaLibrary } from "@/admin/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const user = (await getSessionUser())!;
  return <MediaLibrary role={user.role} />;
}
