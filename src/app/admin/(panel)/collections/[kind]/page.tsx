import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { KINDS, isKind } from "@/content/schema";
import { CollectionManager } from "@/admin/Editors";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isKind(kind) || KINDS[kind].singleton) notFound();
  const user = (await getSessionUser())!;
  return <CollectionManager kind={kind} role={user.role} />;
}
