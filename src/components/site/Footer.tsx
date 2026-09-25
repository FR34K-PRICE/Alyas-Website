import { DICT } from "@/i18n/dict";
import { pick, type Lang } from "@/content/schema";
import { SocialIcon } from "./Icons";
import { validPhone, validWhatsapp } from "@/site/contact";

const SOCIAL = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
] as const;

export function Footer({ lang, base, site }: { lang: Lang; base: string; site: any }) {
  const t = DICT[lang];
  const c = site.contact;
  const phone: string = validPhone(c.phone) ? c.phone : "";
  const wa: string = validWhatsapp(c.whatsapp);
  const address = pick(c.address, lang);
  const hours = pick(c.hours, lang);
  const socials = SOCIAL.filter(([k]) => site.social[k]);
  const hasContact = !!(phone || wa || c.email || address || hours);

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <p className="footer-wordmark">
            <span>{pick(site.brand.brandMain, lang)}</span> <small>{pick(site.brand.brandSub, lang)}</small>
          </p>
          <p className="footer-tag">{pick(site.brand.tagline, lang)}</p>
        </div>

        <nav aria-label={t.footer.explore}>
          <h2 className="footer-h">{t.footer.explore}</h2>
          <ul>
            <li><a href={base || "/"}>{t.nav.home}</a></li>
            <li><a href={`${base}/about`}>{t.nav.about}</a></li>
            <li><a href={`${base}/travel`}>{t.nav.travel}</a></li>
            <li><a href={`${base}/events`}>{t.nav.events}</a></li>
            <li><a href={`${base}/contact`}>{t.nav.contact}</a></li>
          </ul>
        </nav>

        <div>
          <h2 className="footer-h">{t.footer.reach}</h2>
          {hasContact ? (
            <ul className="footer-contact">
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} dir="ltr">{phone}</a>
                </li>
              )}
              {wa && (
                <li>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">{t.cta.whatsapp}</a>
                </li>
              )}
              {c.email && (
                <li>
                  <a href={`mailto:${c.email}`} dir="ltr">{c.email}</a>
                </li>
              )}
              {address && <li>{address}</li>}
              {hours && <li>{hours}</li>}
            </ul>
          ) : (
            <p className="footer-muted">{t.footer.contactSoon}</p>
          )}
          {socials.length > 0 && (
            <div className="footer-social">
              <h2 className="footer-h">{t.footer.follow}</h2>
              <ul className="social-list">
                {socials.map(([k, label]) => (
                  <li key={k}>
                    <a href={site.social[k]} target="_blank" rel="noopener noreferrer" aria-label={label}>
                      <SocialIcon name={k} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="wrap footer-base">
        <span>{pick(site.footerNote, lang)}</span>
        <span>© {new Date().getFullYear()} {pick(site.brand.siteName, lang)}. {t.footer.rights}</span>
      </div>
    </footer>
  );
}
