import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { redirectTarget } from "@/content/pages";
import type { Metadata } from "next";
import { isLang } from "@/i18n/dict";
import { pick, type Lang } from "@/content/schema";
import { mediaUrl } from "@/components/site/Img";
import { Frame } from "./Frame";
import { AboutPage, ContactPage, EventsPage, HomePage, TravelPage } from "./pages";
import { CustomPage } from "./sections";
import { absolute, customMeta, findPage, isBuiltInSlug, isCustomSlugShape, loadSite, pageMeta, type BuiltInSlug } from "./data";

/**
 * No page has this address. If it is the old address of a published page, send visitors to the new one in the same
 * language with a permanent redirect; otherwise 404. Previews never redirect.
 */
async function pageNotFound(lang: Lang, slug: string, preview: boolean): Promise<never> {
  if (!preview) {
    const to = await redirectTarget(slug);
    if (to) permanentRedirect(`/${lang}/${to}`);
  }
  notFound();
}

const load = cache((preview: boolean) => loadSite(preview));

/** A built-in page, or a single path segment that may be a custom page (checked against the CMS when rendering). */
export function parseRoute(langParam: string, slugParam?: string[]): { lang: Lang; slug: string } {
  if (!isLang(langParam)) notFound();
  const parts = slugParam ?? [];
  if (parts.length > 1) notFound();
  const slug = parts[0] ?? "";
  if (!isBuiltInSlug(slug) && !isCustomSlugShape(slug)) notFound();
  return { lang: langParam, slug };
}

export async function siteMetadata(lang: Lang, slug: string, preview: boolean): Promise<Metadata> {
  const { bundle } = await load(preview);
  if (!isBuiltInSlug(slug)) return customMetadata(lang, slug, preview, bundle);
  const m = pageMeta(slug, lang, bundle);
  const path = slug ? `/${slug}` : "";
  const og = bundle.site.seo.ogImage;
  const title = slug === "" ? pick(bundle.site.brand.siteName, lang) + (pick(bundle.site.brand.tagline, lang) ? ` | ${pick(bundle.site.brand.tagline, lang)}` : "") : `${m.title} | ${m.name}`;
  if (preview) return { title: `Preview: ${m.title}`, robots: { index: false, follow: false } };
  return {
    title: { absolute: title },
    description: m.description,
    alternates: {
      canonical: absolute(`/${lang}${path}`),
      languages: { ar: absolute(`/ar${path}`), en: absolute(`/en${path}`), "x-default": absolute(`/ar${path}`) },
    },
    openGraph: {
      type: "website",
      title,
      description: m.description,
      url: absolute(`/${lang}${path}`),
      siteName: m.name,
      locale: lang === "ar" ? "ar_IQ" : "en_US",
      ...(og ? { images: [{ url: absolute(mediaUrl(og, 1600)) }] } : {}),
    },
    twitter: { card: og ? "summary_large_image" : "summary", title, description: m.description },
  };
}

async function customMetadata(lang: Lang, slug: string, preview: boolean, bundle: Awaited<ReturnType<typeof load>>["bundle"]): Promise<Metadata> {
  const page = findPage(bundle, slug);
  if (!page) return pageNotFound(lang, slug, preview);
  const m = customMeta(page, lang, bundle);
  if (preview) return { title: `Preview: ${m.title}`, robots: { index: false, follow: false } };
  const title = `${m.title} | ${m.name}`;
  const path = `/${slug}`;
  return {
    title: { absolute: title },
    description: m.description,
    ...(m.noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: absolute(`/${lang}${path}`),
      languages: { ar: absolute(`/ar${path}`), en: absolute(`/en${path}`), "x-default": absolute(`/ar${path}`) },
    },
    openGraph: {
      type: "website",
      title,
      description: m.description,
      url: absolute(`/${lang}${path}`),
      siteName: m.name,
      locale: lang === "ar" ? "ar_IQ" : "en_US",
      ...(m.image ? { images: [{ url: absolute(mediaUrl(m.image, 1600)) }] } : {}),
    },
    twitter: { card: m.image ? "summary_large_image" : "summary", title, description: m.description },
  };
}

export async function SitePage({ lang, slug, preview, search }: { lang: Lang; slug: string; preview: boolean; search?: { interest?: string; ref?: string } }) {
  const { bundle, media } = await load(preview);
  const base = preview ? `/preview/${lang}` : `/${lang}`;
  const ctx = { lang, base, b: bundle, media, search };
  let body: React.ReactNode;
  if (isBuiltInSlug(slug)) {
    const s: BuiltInSlug = slug;
    body = s === "" ? <HomePage {...ctx} /> : s === "about" ? <AboutPage {...ctx} /> : s === "travel" ? <TravelPage {...ctx} /> : s === "events" ? <EventsPage {...ctx} /> : <ContactPage {...ctx} />;
  } else {
    const page = findPage(bundle, slug);
    if (!page) return pageNotFound(lang, slug, preview);
    body = <CustomPage ctx={ctx} page={page} />;
  }
  return (
    <Frame lang={lang} base={base} bundle={bundle} media={media} tone={slug === "" ? "hero" : "solid"} preview={preview} dock={slug === "" ? "after-hero" : slug === "contact" ? "none" : "always"}>
      {body}
    </Frame>
  );
}
