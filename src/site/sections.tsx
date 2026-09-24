/**
 * Renders the sections of a custom page. Every section type is a fixed component: page content can only choose
 * which sections appear and fill in their fields, so no HTML or script from the CMS ever reaches the page.
 * Sections with nothing to show render nothing.
 */
import { DICT, dateParts, formatDate } from "@/i18n/dict";
import { isSafeLink, pick } from "@/content/schema";
import { ArrowIcon } from "@/components/site/Icons";
import { Photo } from "@/components/site/Img";
import { OFFER_FALLBACKS } from "./photos";
import { CROP, CtaCard, Label, PageHead, ServiceTiles, contactHref, paras, type Ctx } from "./pages";

const INTERNAL_KEEP = /^\/(ar|en|media|photos)(\/|$)/;

/** Resolves a CMS link for this language: site paths get the language prefix; unsafe values return null. */
export function resolveLink(raw: unknown, base: string): { href: string; external: boolean } | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v || !isSafeLink(v)) return null;
  if (v.startsWith("/")) return { href: INTERNAL_KEEP.test(v) ? v : v === "/" ? base || "/" : `${base}${v}`, external: false };
  if (v.startsWith("#") || /^(mailto|tel):/i.test(v)) return { href: v, external: false };
  return { href: v, external: true };
}

const limitOf = (raw: unknown, allowed: number[], fallback: number) => {
  const n = Number(raw);
  return allowed.includes(n) ? n : fallback;
};

function Heading({ label, title, intro, ctx }: { label: string; title: string; intro: string; ctx: Ctx }) {
  void ctx;
  return (
    <header className="sh-head">
      <div>
        <Label>{label}</Label>
        {title && <h2>{title}</h2>}
      </div>
      {intro && (
        <div className="sh-side">
          <p>{intro}</p>
        </div>
      )}
    </header>
  );
}

function HeroBanner({ s, ctx, first, title }: { s: any; ctx: Ctx; first: boolean; title: string }) {
  const { lang } = ctx;
  const headline = pick(s.headline, lang) || (first ? title : "");
  const sub = pick(s.sub, lang);
  const link = resolveLink(s.link, ctx.base);
  const label = pick(s.button, lang);
  if (!headline && !s.image) return null;
  const H = first ? "h1" : "h2";
  return (
    <section className="pg-banner" data-first={first || undefined}>
      <div className="wrap">
        <div className="pg-banner-card">
          <Photo id={s.image} media={ctx.media} lang={lang} fallback="hero" fill decorative pos="50% 44%" priority={first} sizes="100vw" className="pg-banner-photo" />
          <div className="pg-banner-shade" aria-hidden="true" />
          <div className="pg-banner-copy">
            {headline && <H>{headline}</H>}
            {sub && <p>{sub}</p>}
            {link && label && (
              <a className="btn btn--light" href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {label}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TextSection({ s, ctx }: { s: any; ctx: Ctx }) {
  const heading = pick(s.heading, ctx.lang);
  const body = paras(pick(s.body, ctx.lang));
  if (!heading && !body.length) return null;
  return (
    <section className="block pg-text">
      <div className="wrap">
        <div className="pg-text-col">
          {heading && <h2>{heading}</h2>}
          {body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImageSection({ s, ctx }: { s: any; ctx: Ctx }) {
  const info = s.image ? ctx.media[s.image] : undefined;
  if (!info) return null;
  const caption = pick(s.caption, ctx.lang);
  return (
    <section className="block pg-figure-block">
      <div className="wrap">
        <figure className="pg-figure" data-wide={s.wide ? "true" : undefined}>
          <Photo id={s.image} media={ctx.media} lang={ctx.lang} fallback="hero" ratio={s.wide ? "16 / 9" : `${info.width} / ${info.height}`} sizes={s.wide ? "100vw" : "(min-width: 900px) 60vw, 100vw"} className="pg-figure-photo" />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      </div>
    </section>
  );
}

function GallerySection({ s, ctx }: { s: any; ctx: Ctx }) {
  const items = ((s.images as any[]) ?? []).filter((it) => it.image && ctx.media[it.image]);
  if (!items.length) return null;
  const heading = pick(s.heading, ctx.lang);
  return (
    <section className="block">
      <div className="wrap">
        {heading && <h2 className="block-title">{heading}</h2>}
        <ul className="pg-gallery" data-count={Math.min(items.length, 4)}>
          {items.map((it, i) => {
            const cap = pick(it.caption, ctx.lang);
            return (
              <li key={i}>
                <figure>
                  <Photo id={it.image} media={ctx.media} lang={ctx.lang} fallback="hero" ratio="4 / 3" sizes="(min-width: 900px) 30vw, 50vw" className="pg-gallery-photo" />
                  {cap && <figcaption>{cap}</figcaption>}
                </figure>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ServicesSection({ s, ctx }: { s: any; ctx: Ctx }) {
  const items = ctx.b.services.slice(0, limitOf(s.limit, [3, 4, 5], 5));
  if (!items.length) return null;
  const t = DICT[ctx.lang];
  return (
    <section className="showcase">
      <div className="wrap">
        <Heading ctx={ctx} label={t.sections.services} title={pick(s.heading, ctx.lang)} intro={pick(s.intro, ctx.lang)} />
        <ServiceTiles ctx={ctx} items={items} />
      </div>
    </section>
  );
}

function OffersSection({ s, ctx }: { s: any; ctx: Ctx }) {
  const { lang, base, media } = ctx;
  const t = DICT[lang];
  const offers = ctx.b.offers.slice(0, limitOf(s.limit, [3, 6], 3));
  if (!offers.length) return null;
  return (
    <section className="offers">
      <div className="wrap">
        <Heading ctx={ctx} label={t.sections.offers} title={pick(s.heading, lang)} intro={pick(s.intro, lang)} />
        <ul className="offer-grid">
          {offers.map((o, i) => {
            const fb = OFFER_FALLBACKS[i % OFFER_FALLBACKS.length];
            return (
              <li key={o.id} className="offer">
                <Photo id={o.image} media={media} lang={lang} fallback={fb} ratio="5 / 4" pos={CROP[fb]} sizes="(min-width: 900px) 30vw, 100vw" className="offer-photo" decorative={!o.image} />
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
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function EventsSection({ s, ctx }: { s: any; ctx: Ctx }) {
  const { lang, base } = ctx;
  const t = DICT[lang];
  const events = ctx.b.upcoming.slice(0, limitOf(s.limit, [3, 6, 12], 6));
  if (!events.length) return null;
  return (
    <section className="block block--tint">
      <div className="wrap">
        <Heading ctx={ctx} label={t.sections.events} title={pick(s.heading, lang)} intro={pick(s.intro, lang)} />
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
  );
}

function CtaSection({ s, ctx }: { s: any; ctx: Ctx }) {
  const { lang, base } = ctx;
  const title = pick(s.title, lang);
  const label = pick(s.button, lang);
  if (!title) return null;
  const link = resolveLink(s.link, base) ?? { href: `${base}/contact`, external: false };
  return <CtaCard ctx={ctx} title={title} body={pick(s.body, lang)} label={label || DICT[lang].cta.contactUs} href={link.href} image={s.image} />;
}

/** A published (or, in preview, draft) custom page. */
export function CustomPage({ ctx, page }: { ctx: Ctx; page: any }) {
  const { lang } = ctx;
  const title = pick(page.title, lang);
  const sections: any[] = Array.isArray(page.sections) ? page.sections : [];
  const first = sections[0]?.type === "hero";
  return (
    <>
      {!first && <PageHead title={title} lead={pick(page.lead, lang)} />}
      {sections.map((s, i) => {
        switch (s?.type) {
          case "hero":
            return <HeroBanner key={i} s={s} ctx={ctx} first={i === 0} title={title} />;
          case "text":
            return <TextSection key={i} s={s} ctx={ctx} />;
          case "image":
            return <ImageSection key={i} s={s} ctx={ctx} />;
          case "gallery":
            return <GallerySection key={i} s={s} ctx={ctx} />;
          case "services":
            return <ServicesSection key={i} s={s} ctx={ctx} />;
          case "offers":
            return <OffersSection key={i} s={s} ctx={ctx} />;
          case "events":
            return <EventsSection key={i} s={s} ctx={ctx} />;
          case "cta":
            return <CtaSection key={i} s={s} ctx={ctx} />;
          default:
            return null;
        }
      })}
    </>
  );
}
