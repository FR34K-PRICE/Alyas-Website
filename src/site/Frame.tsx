import { DICT } from "@/i18n/dict";
import { pick, type Lang } from "@/content/schema";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ContactDock } from "@/components/site/ContactDock";
import { quickAction } from "./contact";
import { mediaUrl, type MediaMap } from "@/components/site/Img";
import type { SiteBundle } from "@/content/store";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Applies the brand colours chosen in the CMS. Values are re-validated here, so nothing but a hex colour can reach the CSS. */
export function SiteStyle({ site }: { site: any }) {
  const c = site.colors ?? {};
  const rules = [
    HEX.test(c.primary) && `--navy:${c.primary}`,
    HEX.test(c.accent) && `--gold:${c.accent}`,
    HEX.test(c.paper) && `--paper:${c.paper}`,
  ].filter(Boolean);
  if (!rules.length) return null;
  return <style dangerouslySetInnerHTML={{ __html: `:root{${rules.join(";")}}` }} />;
}

export function Frame({ lang, base, bundle, media, tone, preview, dock = "always", children }: { lang: Lang; base: string; bundle: SiteBundle; media: MediaMap; tone: "hero" | "hero-bright" | "solid"; preview?: boolean; dock?: "always" | "after-hero" | "none"; children: React.ReactNode }) {
  const t = DICT[lang];
  const site = bundle.site;
  void media;
  // Custom pages that are switched on for the menu (the server caps this at four).
  const extra = bundle.pages
    .filter((p) => p.nav?.show)
    .slice(0, 4)
    .map((p) => ({ path: `/${p.slug}`, label: pick(p.nav.label, lang) || pick(p.title, lang) }));
  return (
    <>
      <SiteStyle site={site} />
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <Header
        lang={lang}
        base={base}
        tone={tone}
        extra={extra}
        siteName={pick(site.brand.siteName, lang)}
        brandMain={pick(site.brand.brandMain, lang)}
        brandSub={pick(site.brand.brandSub, lang)}
        logo={site.brand.logo ? mediaUrl(site.brand.logo, 960) : undefined}
        logoLight={site.brand.logoLight ? mediaUrl(site.brand.logoLight, 960) : undefined}
        labels={{ ...t.nav, plan: t.cta.plan, switchTo: t.lang.switchTo, switchShort: t.lang.short }}
      />
      <main id="main" className="site-main" tabIndex={-1}>
        {children}
      </main>
      <Footer lang={lang} base={base} site={site} />
      {dock !== "none" && (
        <ContactDock
          mode={dock}
          label={t.cta.contactActions}
          planHref={`${base}/contact`}
          planLabel={t.cta.plan}
          newTabLabel={t.cta.newTab}
          secondary={(() => {
            const q = quickAction(site, lang, true);
            return q ? { href: q.href, label: q.label, external: q.external } : undefined;
          })()}
        />
      )}
      {preview && (
        <div className="preview-bar" role="status">
          <span>{t.preview.banner}</span>
          <a href="/admin">{t.preview.exit}</a>
        </div>
      )}
    </>
  );
}
