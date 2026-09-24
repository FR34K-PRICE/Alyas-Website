import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getSiteBundle } from "@/content/store";

export const dynamic = "force-dynamic";

const PAGES = ["", "/about", "/travel", "/events", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entry = (p: string, extra: { lastModified?: string; priority?: number; changeFrequency?: "weekly" | "monthly" } = {}) =>
    (["ar", "en"] as const).map((lang) => ({
      url: `${base}/${lang}${p}`,
      changeFrequency: extra.changeFrequency ?? (p === "" ? ("weekly" as const) : ("monthly" as const)),
      priority: extra.priority ?? (p === "" ? 1 : 0.7),
      ...(extra.lastModified ? { lastModified: extra.lastModified } : {}),
      alternates: { languages: { ar: `${base}/ar${p}`, en: `${base}/en${p}` } },
    }));

  // Published custom pages only; pages that ask search engines to skip them are left out.
  const bundle = await getSiteBundle(false);
  const custom = bundle.pages
    .filter((p) => !p.seo?.noindex)
    .flatMap((p) => entry(`/${p.slug}`, { lastModified: p._published_at ?? undefined, priority: 0.6 }));

  return [...PAGES.flatMap((p) => entry(p)), ...custom];
}
