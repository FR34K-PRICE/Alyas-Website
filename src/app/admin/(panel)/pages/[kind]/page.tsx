import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { KINDS, SINGLETON_KEYS, isKind } from "@/content/schema";
import { SingletonEditor } from "@/admin/Editors";

export const dynamic = "force-dynamic";

export default async function PageEditor({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isKind(kind) || !KINDS[kind].singleton || !SINGLETON_KEYS.includes(kind)) notFound();
  const user = (await getSessionUser())!;
  return <SingletonEditor kind={kind} role={user.role} />;
}
