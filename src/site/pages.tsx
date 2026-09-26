import { DICT, dateParts, formatDate } from "@/i18n/dict";
import { pick, type Lang } from "@/content/schema";
import type { SiteBundle } from "@/content/store";
import { Hero, type HeroImage, type HeroProps } from "@/components/site/Hero";
import { ArrowIcon, SocialIcon } from "@/components/site/Icons";
import { Photo, mediaUrl, type MediaMap } from "@/components/site/Img";
import { ContactForm } from "@/components/site/ContactForm";
import { OFFER_FALLBACKS, PHOTOS, PHOTO_FOR_ICON, dims, photoSrc, srcSet, type PhotoKey } from "./photos";
import { absolute } from "./data";
import { contactDetails, quickAction } from "./contact";

export interface Ctx {
  lang: Lang;
  base: string;
  b: SiteBundle;
  media: MediaMap;
  search?: { interest?: string; ref?: string };
}

export const paras = (s: string) => s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const INTEREST_BY_ICON: Record<string, string> = { flights: "flights", hotels: "hotels", visa: "visa", transport: "transport", tailored: "tailored" };
/** Where the eye should land when a photograph is cropped into a different shape. */
export const CROP: Record<PhotoKey, string> = { hero: "50% 44%", coast: "50% 36%", hiker: "50% 28%", road: "50% 62%", window: "50% 50%", city: "50% 55%", flowers: "50% 40%" };

export function contactHref(base: string, interest?: string, ref?: string) {
  const q = new URLSearchParams();
  if (interest) q.set("interest", interest);
  if (ref) q.set("ref", ref);
  const s = q.toString();
  return `${base}/contact${s ? `?${s}` : ""}`;
}

export const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

/** Small supporting label above a heading. Sentence case, and only where it names the section. */
export const Label = ({ children }: { children: React.ReactNode }) => <p className="label">{children}</p>;

export function PageHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="ph">
      <div className="wrap ph-inner">
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
    </header>
  );
}

export function CtaCard({ ctx, title, body, label, href, image }: { ctx: Ctx; title: string; body?: string; label: string; href: string; image?: string }) {
  return (
    <section className="cta">
      <div className="wrap">
        <div className="cta-card">
          <Photo id={image} media={ctx.media} lang={ctx.lang} fallback="city" fill decorative pos="50% 62%" sizes="100vw" className="cta-photo" />
          <div className="cta-shade" aria-hidden="true" />
          <div className="cta-copy">
            <h2>{title}</h2>
            {body && <p>{body}</p>}
            <a className="btn btn--light" href={href}>
              {label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Event management and floral arrangements: real ALYAS Group services, shown as a quiet secondary row so they
 * support, rather than compete with, the travel agency's message. Copy comes from the CMS (Events page and Home →
 * Floral strip), never invented here.
 */
function AlsoFrom({ ctx }: { ctx: Ctx }) {
  const { lang, base, b, media } = ctx;
  const t = DICT[lang];
  const mgmt = b.events.management;
  const floral = b.home.floral;
  const first = (s: string) => paras(s)[0] ?? "";
  const cards = [
    { key: "events", title: pick(mgmt.title, lang), body: first(pick(mgmt.body, lang)), href: `${base}/events`, image: b.events.image, fb: "city" as PhotoKey, pos: "42% 50%" },
    { key: "floral", title: pick(floral.title, lang), body: first(pick(floral.body, lang)), href: `${base}/events#floral`, image: floral.image, fb: "flowers" as PhotoKey, pos: CROP.flowers },
  ].filter((c) => c.title);
  if (!cards.length) return null;
  return (
    <section className="also" aria-labelledby="also-title">
      <div className="wrap">
        <p className="label" id="also-title">{t.home.alsoFrom}</p>
        <ul className="also-grid">
          {cards.map((c) => (
            <li key={c.key} className="also-card">
              <Photo id={c.image} media={media} lang={lang} fallback={c.fb} ratio="1 / 1" pos={c.pos} sizes="120px" className="also-photo" decorative />
              <div className="also-copy">
                <h3>{c.title}</h3>
                {c.body && <p>{c.body}</p>}
                <a className="link-arrow" href={c.href}>
                  {t.cta.learnMore} <ArrowIcon />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FloralBand({ title, body, image, ctx }: { title: string; body: string; image?: string; ctx: Ctx }) {
  const t = DICT[ctx.lang];
  return (
    <section className="floral" id="floral">
      <div className="wrap floral-inner">
        <Photo id={image} media={ctx.media} lang={ctx.lang} fallback="flowers" ratio="4 / 5" pos={CROP.flowers} sizes="(min-width: 900px) 22vw, 60vw" className="floral-photo" />
        <div className="floral-copy">
          <Label>{t.sections.floral}</Label>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Hero props */

function heroProps(ctx: Ctx, sub: string): HeroProps {
  const { lang, base, b, media } = ctx;
  const h = b.home.hero;
  const cms = (id: string): HeroImage | undefined => {
    const m = id ? media[id] : undefined;
    if (!m) return undefined;
    const widths = [1280, 1920, 2400].filter((w) => w < m.width).concat([Math.min(m.width, 2400)]);
    return { src: mediaUrl(id, 1920), srcSet: widths.map((w) => `/media/${id}?w=${w} ${w}w`).join(", "), width: m.width, height: m.height };
  };
  const custom = cms(h.backdrop);
  const hd = dims("hero");
  const photo: HeroImage = custom ?? { src: `/photos/hero-1920.webp`, srcSet: srcSet("hero", hd.widths), width: hd.width, height: hd.height };
  // The built-in foreground only matches the built-in photograph; a custom photo needs its own cut-out.
  const foreground = custom ? cms(h.foreground) : { src: `/photos/hero-fg-1920.webp`, srcSet: srcSet("hero", hd.widths, "-fg").replace(/hero-(\d+)/g, "hero-fg-$1"), width: hd.width, height: hd.height };
  const ad = dims("aircraft");
  const planeInfo = h.airplane ? media[h.airplane] : undefined;
  const info = h.backdrop ? media[h.backdrop] : undefined;
  return {
    headline: pick(h.headline, lang),
    sub,
    ctaLabel: pick(h.primaryCta, lang),
    ctaHref: `${base}/contact`,
    secondary: (() => {
      const q = quickAction(b.site, lang, true);
      return q ? { href: q.href, label: q.label, external: q.external } : undefined;
    })(),
    actionsLabel: DICT[lang].cta.contactActions,
    newTabLabel: DICT[lang].cta.newTab,
    photo,
    videoSrc: custom ? undefined : "/video/alyas-cloud-flight.mp4",
    videoPlayLabel: lang === "ar" ? "تشغيل الفيديو" : "Play video",
    photoAlt: custom ? (lang === "ar" ? info?.alt_ar || info?.alt_en : info?.alt_en || info?.alt_ar) || "" : pick(PHOTOS.hero.alt, lang),
    foreground,
    // An airplane from the media library replaces the built-in one; the built-in is the fallback.
    aircraft: planeInfo ? { src: mediaUrl(h.airplane, 960), width: planeInfo.width, height: planeInfo.height } : { src: "/photos/aircraft.webp", width: ad.width, height: ad.height },
  };
}

/* ------------------------------------------------------------------ Service tiles */

export function ServiceTiles({ ctx, items }: { ctx: Ctx; items: any[] }) {
  const { lang, base, media } = ctx;
  const t = DICT[lang];
  return (
    <ul className="tiles" data-count={items.length}>
      {items.map((s, i) => {
        const fb = PHOTO_FOR_ICON[s.icon] ?? "hero";
        return (
          <li key={s.id} className={`tile tile--${i}`}>
            <Photo id={s.image} media={media} lang={lang} fallback={fb} fill decorative pos={CROP[fb]} sizes="(min-width: 1000px) 40vw, 100vw" className="tile-photo" />
            <div className="tile-shade" aria-hidden="true" />
            <div className="tile-body">
              <h3>
                <a href={contactHref(base, INTEREST_BY_ICON[s.icon] || "other", `service:${s.slug}`)}>
                  {pick(s.title, lang)}
                  <span className="sr-only"> — {t.cta.details}</span>
                </a>
              </h3>
              <p>{pick(s.summary, lang)}</p>
              <span className="tile-cta" aria-hidden="true">
                {t.cta.details} <ArrowIcon />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ Home */

export function HomePage(ctx: Ctx) {
  const { lang, base, b, media } = ctx;
  const t = DICT[lang];
  const h = b.home;
  const site = b.site;
  const offers = b.offers.slice(0, 3);
  const [next, ...more] = b.upcoming;
  const shown = b.services.slice(0, 5);
  const socials = Object.values(site.social).filter(Boolean);
  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: pick(site.brand.siteName, lang),
    url: absolute(`/${lang}`),
    description: pick(site.seo.description, lang),
    address: { "@type": "PostalAddress", addressLocality: "Baghdad", addressCountry: "IQ" },
    ...(socials.length ? { sameAs: socials } : {}),
    ...(contactDetails(site).telephone ? { telephone: contactDetails(site).telephone } : {}),
    ...(contactDetails(site).email ? { email: contactDetails(site).email } : {}),
    ...(site.brand.logo ? { logo: absolute(mediaUrl(site.brand.logo, 960)) } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(org) }} />
      <Hero {...heroProps(ctx, pick(h.hero.sub, lang))} />

      <section className="intro">
        <div className="wrap intro-grid">
          <div className="intro-copy">
            <Label>{t.sections.about}</Label>
            <h2>{pick(h.intro.title, lang)}</h2>
            {paras(pick(h.intro.body, lang)).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <a className="link-arrow" href={`${base}/about`}>
              {t.cta.aboutMore} <ArrowIcon />
            </a>
          </div>
          <div className="intro-photos">
            <Photo id={h.intro.image} media={media} lang={lang} fallback="hiker" ratio="4 / 5" pos={CROP.hiker} sizes="(min-width: 900px) 30vw, 70vw" className="ip-main" />
            <Photo id={h.intro.image2} media={media} lang={lang} fallback="road" ratio="4 / 3" pos={CROP.road} sizes="(min-width: 900px) 22vw, 50vw" className="ip-sub" />
          </div>
        </div>
      </section>

      {shown.length > 0 && (
        <section className="showcase" id="services">
          <div className="wrap">
            <header className="sh-head">
              <div>
                <Label>{t.sections.services}</Label>
                <h2>{pick(h.services.title, lang)}</h2>
              </div>
              <div className="sh-side">
                <p>{pick(h.services.intro, lang)}</p>
                <a className="link-arrow" href={`${base}/travel`}>
                  {t.cta.viewAll} <ArrowIcon />
                </a>
              </div>
            </header>
            <ServiceTiles ctx={ctx} items={shown} />
          </div>
        </section>
      )}

      {offers.length > 0 && (
        <section className="offers" id="offers">
          <div className="wrap">
            <header className="sh-head">
              <div>
                <Label>{t.sections.offers}</Label>
                <h2>{pick(h.offers.title, lang)}</h2>
              </div>
              <div className="sh-side">
                <p>{pick(h.offers.intro, lang)}</p>
              </div>
            </header>
            <ul className="offer-grid">
              {offers.map((o, i) => (
                <li key={o.id} className="offer">
                  <Photo id={o.image} media={media} lang={lang} fallback={OFFER_FALLBACKS[i % OFFER_FALLBACKS.length]} ratio="5 / 4" pos={CROP[OFFER_FALLBACKS[i % OFFER_FALLBACKS.length]]} sizes="(min-width: 900px) 30vw, 100vw" className="offer-photo" decorative={!o.image} />
                  <div className="offer-body">
                    {pick(o.destination, lang) && <p className="chip">{pick(o.destination, lang)}</p>}
                    <h3>{pick(o.title, lang)}</h3>
                    <p>{pick(o.summary, lang)}</p>
                    <div className="offer-foot">
                      <div>
                        {pick(o.priceLabel, lang) && <p className="offer-price">{pick(o.priceLabel, lang)}</p>}
                        {o.validUntil && (
                          <p className="offer-valid">
                            {t.home.validUntil} {formatDate(o.validUntil, lang)}
                          </p>
                        )}
                      </div>
                      <a className="btn btn--dark btn--sm" href={contactHref(base, "tailored", `offer:${o.slug}`)}>
                        {t.cta.details}
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {next && (
        <section className="feature">
          <div className="wrap feature-grid">
            <div className="feature-photo">
              <Photo id={next.image} media={media} lang={lang} fallback="city" fill decorative={!next.image} pos={CROP.city} sizes="(min-width: 900px) 55vw, 100vw" />
              {next.startDate && (
                <div className="feature-date" aria-hidden="true">
                  <span>{dateParts(next.startDate, lang).day}</span>
                  <small>{dateParts(next.startDate, lang).month}</small>
                </div>
              )}
            </div>
            <div className="feature-copy">
              <Label>{t.sections.events}</Label>
              <h2>{pick(next.title, lang)}</h2>
              <p className="feature-meta">
                {next.startDate && (
                  <span>
                    {formatDate(next.startDate, lang)}
                    {next.endDate && next.endDate !== next.startDate ? ` – ${formatDate(next.endDate, lang)}` : ""}
                  </span>
                )}
                {[pick(next.venue, lang), pick(next.city, lang)].filter(Boolean).length > 0 && (
                  <span>{[pick(next.venue, lang), pick(next.city, lang)].filter(Boolean).join(lang === "ar" ? "، " : ", ")}</span>
                )}
              </p>
              <p>{pick(next.summary, lang)}</p>
              <div className="feature-actions">
                <a className="btn btn--dark" href={contactHref(base, "events", `event:${next.slug}`)}>
                  {t.cta.details}
                </a>
                <a className="link-arrow" href={`${base}/events`}>
                  {more.length ? t.cta.allEvents : t.nav.events} <ArrowIcon />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <AlsoFrom ctx={ctx} />
      <CtaCard ctx={ctx} title={pick(h.cta.title, lang)} body={pick(h.cta.body, lang)} label={pick(h.cta.button, lang)} href={`${base}/contact`} image={h.cta.image} />
    </>
  );
}

/* ------------------------------------------------------------------ About */

export function AboutPage(ctx: Ctx) {
  const { lang, base, b, media } = ctx;
  const a = b.about;
  const t = DICT[lang];
  return (
    <>
      <PageHead title={pick(a.title, lang)} lead={pick(a.lead, lang)} />
      <section className="block">
        <div className="wrap split">
          <Photo id={a.image} media={media} lang={lang} fallback="hiker" ratio="4 / 5" pos={CROP.hiker} priority sizes="(min-width: 900px) 40vw, 100vw" className="split-photo" />
          <div className="prose">
            {paras(pick(a.body, lang)).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>
      {a.approach.length > 0 && (
        <section className="block block--tint">
          <div className="wrap">
            <h2 className="block-title">{pick(a.approachTitle, lang)}</h2>
            <ul className="approach-list">
              {a.approach.map((p: any, i: number) => (
                <li key={i}>
                  <h3>{pick(p.title, lang)}</h3>
                  <p>{pick(p.body, lang)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CtaCard ctx={ctx} title={pick(b.home.cta.title, lang)} body={pick(b.home.cta.body, lang)} label={t.cta.plan} href={`${base}/contact`} image={b.home.cta.image} />
    </>
  );
}

/* ------------------------------------------------------------------ Travel */

export function TravelPage(ctx: Ctx) {
  const { lang, base, b, media } = ctx;
  const t = DICT[lang];
  const p = b.travel;
  return (
    <>
      <PageHead title={pick(p.title, lang)} lead={pick(p.lead, lang)} />
      {p.image && (
        <div className="wrap band">
          <Photo id={p.image} media={media} lang={lang} fallback="hero" ratio="21 / 9" priority sizes="100vw" className="band-photo" />
        </div>
      )}
      <section className="block">
        <div className="wrap">
          <ul className="rows">
            {b.services.map((s, i) => {
              const fb = PHOTO_FOR_ICON[s.icon] ?? "hero";
              const details = paras(pick(s.details, lang));
              return (
                <li key={s.id} className="row-item">
                  <Photo id={s.image} media={media} lang={lang} fallback={fb} ratio={i % 2 ? "4 / 5" : "5 / 4"} pos={CROP[fb]} sizes="(min-width: 900px) 46vw, 100vw" className="row-photo" />
                  <div className="row-copy">
                    <h2>{pick(s.title, lang)}</h2>
                    <p className="row-lead">{pick(s.summary, lang)}</p>
                    {details.map((d, k) => (
                      <p key={k}>{d}</p>
                    ))}
                    <a className="btn btn--dark" href={contactHref(base, INTEREST_BY_ICON[s.icon] || "other", `service:${s.slug}`)}>
                      {t.cta.details}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <CtaCard ctx={ctx} title={pick(p.ctaTitle, lang)} body={pick(p.ctaBody, lang)} label={t.cta.plan} href={`${base}/contact`} image={b.home.cta.image} />
    </>
  );
}

/* ------------------------------------------------------------------ Events */

export function EventsPage(ctx: Ctx) {
  const { lang, base, b, media } = ctx;
  const t = DICT[lang];
  const e = b.events;
  const events = b.upcoming;
  const news = b.news;
  const ld = events.map((ev) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: pick(ev.title, lang),
    startDate: ev.startDate,
    ...(ev.endDate ? { endDate: ev.endDate } : {}),
    ...(pick(ev.venue, lang) || pick(ev.city, lang)
      ? { location: { "@type": "Place", name: pick(ev.venue, lang) || pick(ev.city, lang), address: pick(ev.city, lang) || "Baghdad" } }
      : {}),
    description: pick(ev.summary, lang),
  }));
  return (
    <>
      {ld.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />}
      <PageHead title={pick(e.title, lang)} lead={pick(e.lead, lang)} />

      <section className="block">
        <div className="wrap split split--flip">
          <div className="prose">
            <h2>{pick(e.management.title, lang)}</h2>
            {paras(pick(e.management.body, lang)).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {e.capabilities.length > 0 && (
              <ul className="capabilities">
                {e.capabilities.map((c: any, i: number) => (
                  <li key={i}>
                    <h3>{pick(c.title, lang)}</h3>
                    <p>{pick(c.body, lang)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Photo id={e.image} media={media} lang={lang} fallback="city" ratio="4 / 5" pos="42% 50%" priority sizes="(min-width: 900px) 40vw, 100vw" className="split-photo" />
        </div>
      </section>

      {events.length > 0 && (
        <section className="block block--tint" id="upcoming">
          <div className="wrap">
            <Label>{t.sections.events}</Label>
            <h2 className="block-title">{pick(e.upcomingTitle, lang)}</h2>
            <ul className="agenda">
              {events.map((ev) => {
                const d = ev.startDate ? dateParts(ev.startDate, lang) : null;
                const place = [pick(ev.venue, lang), pick(ev.city, lang)].filter(Boolean).join(lang === "ar" ? "، " : ", ");
                return (
                  <li key={ev.id} className="agenda-row">
                    <div className="agenda-date" aria-hidden={!d}>
                      {d && (
                        <>
                          <span className="d-day">{d.day}</span>
                          <span className="d-month">
                            {d.month} {d.year}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="agenda-main">
                      <h3>{pick(ev.title, lang)}</h3>
                      <p className="agenda-meta">
                        {ev.startDate && (
                          <span>
                            {formatDate(ev.startDate, lang)}
                            {ev.endDate && ev.endDate !== ev.startDate ? ` – ${formatDate(ev.endDate, lang)}` : ""}
                          </span>
                        )}
                        {place && <span>{place}</span>}
                      </p>
                      <p>{pick(ev.summary, lang)}</p>
                      {paras(pick(ev.details, lang)).map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                    <div className="agenda-actions">
                      <a className="btn btn--dark btn--sm" href={contactHref(base, "events", `event:${ev.slug}`)}>
                        {t.cta.details}
                      </a>
                      {ev.link && (
                        <a className="link-arrow" href={ev.link} target="_blank" rel="noopener noreferrer">
                          {t.cta.register} <ArrowIcon />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section className="block">
          <div className="wrap">
            <h2 className="block-title">{pick(e.newsTitle, lang)}</h2>
            <ul className="news-list">
              {news.map((n) => (
                <li key={n.id} className="news-item">
                  {n.date && <time dateTime={n.date}>{formatDate(n.date, lang)}</time>}
                  <div>
                    <h3>{pick(n.title, lang)}</h3>
                    <p>{pick(n.summary, lang)}</p>
                    {pick(n.body, lang) && (
                      <details>
                        <summary>{t.cta.readMore}</summary>
                        {paras(pick(n.body, lang)).map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </details>
                    )}
                  </div>
                  {n.image && <Photo id={n.image} media={media} lang={lang} fallback="city" ratio="4 / 3" sizes="240px" className="news-photo" />}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <FloralBand title={pick(e.floral.title, lang)} body={pick(e.floral.body, lang)} image={e.floral.image} ctx={ctx} />
      <CtaCard ctx={ctx} title={pick(b.home.cta.title, lang)} body={pick(b.home.cta.body, lang)} label={t.cta.contactUs} href={contactHref(base, "events")} image={b.home.cta.image} />
    </>
  );
}

/* ------------------------------------------------------------------ Contact */

export function ContactPage(ctx: Ctx) {
  const { lang, b, media, search } = ctx;
  const t = DICT[lang];
  const c = b.contact;
  const s = b.site.contact;
  const socials = (["facebook", "instagram", "linkedin", "youtube", "tiktok"] as const).filter((k) => b.site.social[k]);
  const address = pick(s.address, lang);
  const hours = pick(s.hours, lang);
  const d = contactDetails(b.site);
  const embed: string = /^https:\/\//.test(s.mapEmbed || "") ? s.mapEmbed : "";

  // Resolve "service:flights" / "offer:slug" / "event:slug" into a readable title.
  let refLabel = "";
  const ref = search?.ref || "";
  if (ref) {
    const [kind, slug] = ref.split(":");
    const pool: any[] = kind === "service" ? b.services : kind === "offer" ? b.offers : kind === "event" ? b.upcoming : [];
    const hit = pool.find((x) => x.slug === slug);
    if (hit) refLabel = pick(hit.title, lang);
  }

  return (
    <>
      <PageHead title={pick(c.title, lang)} lead={pick(c.lead, lang)} />
      <section className="block contact">
        <div className="wrap contact-grid">
          <div className="contact-form-col">
            <p className="form-intro">{pick(c.formIntro, lang)}</p>
            <ContactForm lang={lang} initialInterest={search?.interest} initialRef={refLabel ? ref : ""} refLabel={refLabel} successText={pick(c.success, lang)} />
          </div>
          <aside className="contact-info" aria-label={t.footer.reach}>
            <Photo id={c.image} media={media} lang={lang} fallback="hero" ratio="4 / 3" pos="34% 50%" sizes="(min-width: 900px) 36vw, 100vw" className="contact-photo" />
            <ul className="contact-list">
              {d.phoneHref && (
                <li>
                  <a href={d.phoneHref} dir="ltr">{d.phone}</a>
                </li>
              )}
              {d.whatsappHref && (
                <li>
                  <a href={d.whatsappHref} target="_blank" rel="noopener noreferrer">
                    {t.cta.whatsapp}
                    <span className="sr-only"> {t.cta.newTab}</span>
                  </a>
                </li>
              )}
              {d.emailHref && (
                <li>
                  <a href={d.emailHref} dir="ltr">{d.email}</a>
                </li>
              )}
              {address && <li>{address}</li>}
              {hours && <li>{hours}</li>}
            </ul>
            {s.mapUrl && (
              <a className="link-arrow" href={s.mapUrl} target="_blank" rel="noopener noreferrer">
                {t.cta.openMaps} <ArrowIcon />
              </a>
            )}
            {embed && <iframe className="map" src={embed} title={address || "Map"} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups" />}
            {socials.length > 0 && (
              <>
                <h2 className="aside-h">{t.footer.follow}</h2>
                <ul className="social-list social-list--dark">
                  {socials.map((k) => (
                    <li key={k}>
                      <a href={b.site.social[k]} target="_blank" rel="noopener noreferrer" aria-label={k}>
                        <SocialIcon name={k} />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

void photoSrc;
