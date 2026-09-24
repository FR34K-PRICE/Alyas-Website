import { mediaMap } from "@/lib/media";
import { getSiteBundle, type SiteBundle } from "@/content/store";
import type { MediaMap } from "@/components/site/Img";
import { siteUrl } from "@/lib/env";
import { pick, type Lang } from "@/content/schema";

const UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export interface Loaded {
  bundle: SiteBundle;
  media: MediaMap;
}

export async function loadSite(preview: boolean): Promise<Loaded> {
  const bundle = await getSiteBundle(preview);
  const ids = JSON.stringify(bundle).match(UUID_G) ?? [];
  return { bundle, media: (await mediaMap(ids)) as MediaMap };
}

export const PAGE_SLUGS = ["", "about", "travel", "events", "contact"] as const;
export type BuiltInSlug = (typeof PAGE_SLUGS)[number];
export const isBuiltInSlug = (s: string): s is BuiltInSlug => (PAGE_SLUGS as readonly string[]).includes(s);
/** Custom pages live at a single lowercase path segment. */
export const isCustomSlugShape = (s: string) => /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(s);
export const findPage = (b: SiteBundle, slug: string) => b.pages.find((p) => p.slug === slug);

/** Title, description and sharing details of a custom page, with fallbacks to the page and the site defaults. */
export function customMeta(page: any, lang: Lang, b: SiteBundle) {
  const name = pick(b.site.brand.siteName, lang);
  const title = pick(page.seo?.title, lang) || pick(page.title, lang);
  const description = pick(page.seo?.description, lang) || pick(page.lead, lang) || pick(b.site.seo.description, lang);
  return { title, description, name, image: (page.seo?.image as string) || (b.site.seo.ogImage as string) || "", noindex: !!page.seo?.noindex };
}

export function pageMeta(slug: BuiltInSlug, lang: Lang, b: SiteBundle) {
  const site = b.site;
  const name = pick(site.brand.siteName, lang);
  const src = slug === "" ? b.home.hero : (b as any)[slug === "travel" ? "travel" : slug];
  let title = name;
  let description = pick(site.seo.description, lang);
  if (slug === "about") { title = pick(b.about.title, lang); description = pick(b.about.lead, lang) || description; }
  if (slug === "travel") { title = pick(b.travel.title, lang); description = pick(b.travel.lead, lang) || description; }
  if (slug === "events") { title = pick(b.events.title, lang); description = pick(b.events.lead, lang) || description; }
  if (slug === "contact") { title = pick(b.contact.title, lang); description = pick(b.contact.lead, lang) || description; }
  void src;
  return { title, description, home: slug === "", name };
}

export const absolute = (path: string) => `${siteUrl()}${path}`;
