import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SitePage, parseRoute, siteMetadata } from "@/site/render";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ lang: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const { lang, slug } = parseRoute(p.lang, p.slug);
  return siteMetadata(lang, slug, true);
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 120);

export default async function PreviewPage({ params, searchParams }: Props) {
  // Drafts are only ever rendered after a server-side session check.
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  const p = await params;
  const sp = await searchParams;
  const { lang, slug } = parseRoute(p.lang, p.slug);
  return <SitePage lang={lang} slug={slug} preview search={{ interest: one(sp.interest), ref: one(sp.ref) }} />;
}
