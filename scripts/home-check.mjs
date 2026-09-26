/**
 * Black-box checks for the public site (homepage focus) against a running server.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:home
 *
 * Read-only by default: hero copy, secondary services, contact actions come only from configured details, SEO on
 * every public page in both languages, `/`, aliases and canonical links, and the health endpoint.
 *
 * HOME_CHECK_MUTATE=1 also proves behaviour that needs test data: that untouched starter wording is upgraded while
 * edited wording is preserved exactly, and that WhatsApp/phone/email are validated and normalised identically in the
 * hero, mobile bar, footer, contact page and structured data. That mode temporarily saves and publishes test values
 * in Home and Site & brand and restores your originals afterwards. Use a local or isolated test database ONLY,
 * never production.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
  process.exit(2);
}
const MUTATE = process.env.HOME_CHECK_MUTATE === "1";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  ${extra}`}`);
};

async function call(path, { method = "GET", body, cookie } = {}) {
  const h = { "x-alyas-csrf": "1" };
  if (cookie) h.cookie = cookie;
  let b;
  if (body !== undefined) {
    h["content-type"] = "application/json";
    b = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: b, redirect: "manual" });
  let json = null;
  try { json = await res.clone().json(); } catch {}
  return { res, status: res.status, json };
}
const get = async (path, headers = {}) => {
  const res = await fetch(BASE + path, { headers, redirect: "manual" });
  return { status: res.status, text: await res.text(), headers: res.headers };
};
async function login(email, password) {
  const r = await call("/api/auth/login", { method: "POST", body: { email, password } });
  const c = (r.res.headers.getSetCookie?.() ?? []).find((x) => x.startsWith("alyas_session="));
  return c ? c.split(";")[0] : "";
}
const heroCopy = (html) => (html.match(/<div class="hero-copy">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/) || [, ""])[1];
const heroText = (html) => heroCopy(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const heroSub = (html) => ((heroCopy(html).match(/<p>([\s\S]*?)<\/p>/) || [, ""])[1]).replace(/<[^>]+>/g, "").trim();
const meta = (html, re) => (html.match(re) || [, ""])[1];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

console.log(`Target: ${BASE}\n`);

/* ---- 0. Pure rules (no server needed) ---- */
try {
  const r = await import("../src/content/contact-rules.ts");
  const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  eq("whatsapp: +964 770 123 4567 → digits", r.normalizeWhatsapp("+964 770 123 4567"), "9647701234567");
  eq("whatsapp: 00964 770 123 4567 → drops 00", r.normalizeWhatsapp("00964 770 123 4567"), "9647701234567");
  eq("whatsapp: (964) 770-123-4567", r.normalizeWhatsapp("(964) 770-123-4567"), "9647701234567");
  eq("whatsapp: local 0770 123 4567 rejected (no country code)", r.normalizeWhatsapp("0770 123 4567"), "");
  eq("whatsapp: too short rejected", r.normalizeWhatsapp("123456"), "");
  eq("whatsapp: too long rejected", r.normalizeWhatsapp("9647701234567890"), "");
  eq("whatsapp: letters rejected", r.normalizeWhatsapp("964 770 CALL ME"), "");
  eq("whatsapp: misplaced + rejected", r.normalizeWhatsapp("964+7701234567"), "");
  eq("whatsapp: double + rejected", r.normalizeWhatsapp("++9647701234567"), "");
  eq("phone: +964-770-123-4567", r.normalizePhone("+964-770-123-4567"), "+9647701234567");
  eq("phone: 00964… becomes +964…", r.normalizePhone("00964 770 000 0000"), "+9647700000000");
  eq("phone: local number keeps its 0", r.normalizePhone("(0770) 123-4567"), "07701234567");
  eq("phone: too short rejected", r.normalizePhone("12345"), "");
  eq("phone: text rejected", r.normalizePhone("n/a"), "");
  eq("phone: tel: injection rejected", r.normalizePhone("123456789;ext=1"), "");
  eq("email: plain address kept", r.normalizeEmail("info@alyas.example"), "info@alyas.example");
  eq("email: query string rejected", r.normalizeEmail("a@b.co?subject=hi"), "");
  eq("email: two addresses rejected", r.normalizeEmail("a@b.co, c@d.co"), "");
  eq("email: display name rejected", r.normalizeEmail("Name <a@b.co>"), "");
  eq("email: no domain rejected", r.normalizeEmail("a@b"), "");
} catch (e) {
  console.log(`SKIP  contact-rule unit checks (this Node cannot import TypeScript directly: ${e.code || e.message})`);
}

const A = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
ok("administrator signs in", !!A);
if (!A) process.exit(1);

/* ---- 1. Health and the root address ---- */
const health = await get("/api/health");
let hb = {};
try { hb = JSON.parse(health.text); } catch {}
ok("health endpoint reports ok (200)", health.status === 200 && hb.ok === true, `got ${health.status} ${health.text}`);
ok("health body reveals nothing but ok/problem", Object.keys(hb).every((k) => ["ok", "problem"].includes(k)) && !/postgres|password|secret|@|host|\.replit|:\/\//i.test(health.text), health.text);
ok("health is marked no-store and noindex", /no-store/.test(health.headers.get("cache-control") || "") && /noindex/.test(health.headers.get("x-robots-tag") || ""));
const root = await get("/");
ok('"/" answers 200 directly, not with a redirect', root.status === 200 && /<html[^>]*lang="(ar|en)"/.test(root.text), `got ${root.status}`);
const rootEn = await get("/", { "accept-language": "en-US,en;q=0.9" });
const rootAr = await get("/", { "accept-language": "ar-IQ,ar;q=0.9,en;q=0.5" });
ok('"/" follows the visitor\'s language (English)', /<html[^>]*lang="en"/.test(rootEn.text));
ok('"/" follows the visitor\'s language (Arabic)', /<html[^>]*lang="ar"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="ar"/.test(rootAr.text));
ok('"/" canonical points at the language address, not at "/"', new RegExp('rel="canonical" href="[^"]*/en"').test(rootEn.text) && new RegExp('rel="canonical" href="[^"]*/ar"').test(rootAr.text));
const cookieAr = await get("/", { "accept-language": "en", cookie: "alyas_lang=ar" });
ok('"/" honours the saved language cookie over the browser language', /<html[^>]*lang="ar"/.test(cookieAr.text));
for (const [from, to] of [["/services", "travel"], ["/travel-services", "travel"], ["/conferences", "events"], ["/events-conferences", "events"], ["/contact-us", "contact"], ["/about-us", "about"], ["/about", "about"], ["/contact", "contact"]]) {
  const r = await get(from, { "accept-language": "en" });
  ok(`alias ${from} → /en/${to} (308)`, r.status === 308 && new URL(r.headers.get("location"), BASE).pathname === `/en/${to}`, `got ${r.status} ${r.headers.get("location")}`);
  const ra = await get(from, { "accept-language": "ar" });
  ok(`alias ${from} → /ar/${to} for Arabic visitors`, ra.status === 308 && new URL(ra.headers.get("location"), BASE).pathname === `/ar/${to}`);
}
const slash = await get("/en/about/");
ok("trailing slash is normalised", slash.status === 308 || slash.status === 200, `got ${slash.status}`);
ok("unknown address is 404", (await get("/en/no-such-page-xyz")).status === 404);

/* ---- 2. Hero says what ALYAS Travel does ---- */
const en = await get("/en");
const ar = await get("/ar");
const enHero = heroText(en.text).toLowerCase();
const arHero = heroText(ar.text);
for (const w of ["flights", "hotels", "visa", "transportation", "tailored", "baghdad"]) ok(`English hero mentions “${w}”`, enHero.includes(w), enHero);
for (const w of ["الطيران", "الفنادق", "التأشيرات", "النقل", "المصمَّمة", "بغداد"]) ok(`Arabic hero mentions “${w}”`, arHero.includes(w), arHero);
ok("hero keeps flowers and events out of the main message", !/flower|event|conference/i.test(enHero) && !/زهور|فعاليات|مؤتمرات/.test(arHero));
ok("hero copy is concise (under 150 characters, button included)", heroText(en.text).length < 150 && arHero.length < 150, `${heroText(en.text).length}/${arHero.length}`);
ok("hero copy is not keyword-stuffed (no repeated long words)", (() => { const w = enHero.replace(/[^a-z ]/g, "").split(/\s+/).filter((x) => x.length > 4); return new Set(w).size === w.length; })(), enHero);
ok("one h1 in each language", (en.text.match(/<h1[\s>]/g) || []).length === 1 && (ar.text.match(/<h1[\s>]/g) || []).length === 1);
ok("hero button opens the contact page in this language", heroCopy(en.text).includes('href="/en/contact"') && heroCopy(ar.text).includes('href="/ar/contact"'));
// The hero is either the built-in VIDEO (no CMS hero photograph) or the PHOTO hero with the flying airplane (a CMS
// hero photograph is set). Each mode is asserted on its real markup; the photo mode is also exercised with test data
// in the mutating section below, so neither mode is ever left unchecked.
const heroSection = (html) => (html.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/) || [""])[0];
const videoHero = /class="hero hero--video"/.test(en.text);
console.log(`NOTE  this site currently shows the ${videoHero ? "VIDEO" : "PHOTO (CMS hero photograph)"} hero`);
for (const [lang, html, playLabel] of [["en", en.text, "Play video"], ["ar", ar.text, "تشغيل الفيديو"]]) {
  const hs = heroSection(html);
  if (videoHero) {
    const video = (hs.match(/<video [^>]*>/) || [""])[0];
    ok(`${lang}: video hero — a <video> that is muted, loops, plays inline, downloads nothing until needed, with the poster and the built-in file`, /\bmuted=""/.test(video) && /\bloop=""/.test(video) && /playsinline/i.test(video) && /preload="none"/.test(video) && /poster="\/video\/alyas-cloud-flight-poster\.webp"/.test(video) && /src="\/video\/alyas-cloud-flight\.mp4"/.test(video), video.slice(0, 200));
    ok(`${lang}: video hero — native controls are present in the server HTML (the way to start it if JavaScript never runs)`, /\bcontrols=""/.test(video));
    ok(`${lang}: video hero — the poster is a decorative image (alt="" aria-hidden) that is the loading and reduced-motion fallback`, /<img class="hero-bg"[^>]*src="\/video\/alyas-cloud-flight-poster\.webp"[^>]*alt=""[^>]*aria-hidden="true"/.test(hs) || /<img class="hero-bg"[^>]*alt=""[^>]*aria-hidden="true"[^>]*src="\/video\/alyas-cloud-flight-poster\.webp"/.test(hs), hs.slice(0, 220));
    ok(`${lang}: video hero — a visible “${playLabel}” button is in the server HTML`, new RegExp(`<button class="hero-video-play" type="button">[\\s\\S]*?${playLabel}`).test(hs), hs.match(/hero-video-play[\s\S]{0,120}/)?.[0]);
    ok(`${lang}: video hero — no airplane and no foreground cut-out (the video replaces them)`, !/class="hero-plane"/.test(hs) && !/class="hero-fg"/.test(hs));
    ok(`${lang}: video hero — the header uses the bright-hero tone (navy text and dark logo over the bright video)`, /<header class="site-header" data-tone="hero-bright"/.test(html), (html.match(/<header[^>]*>/) || [""])[0]);
  } else {
    ok(`${lang}: photo hero — the airplane is in the hero`, /class="hero-plane"/.test(hs));
    ok(`${lang}: photo hero — there is no video and no Play button`, !/<video /.test(hs) && !/hero-video-play/.test(hs) && !/hero--video/.test(hs));
    ok(`${lang}: photo hero — the header keeps the white-on-dark-photograph tone`, /<header class="site-header" data-tone="hero"/.test(html), (html.match(/<header[^>]*>/) || [""])[0]);
  }
}
ok("the hero video file is served as video/mp4", !videoHero || (await (async () => { const r = await fetch(`${BASE}/video/alyas-cloud-flight.mp4`, { method: "HEAD" }); return r.status === 200 && /^video\/mp4/.test(r.headers.get("content-type") || ""); })()));
ok("the hero poster image is served", !videoHero || (await fetch(`${BASE}/video/alyas-cloud-flight-poster.webp`, { method: "HEAD" })).status === 200);

/* ---- 3. Contact actions come only from configured details ---- */
const site = (await call("/api/admin/content/site", { cookie: A })).json?.entry;
const cfg = site?.data?.contact ?? {};
const publishedSite = site?.status === "published";
const configured = publishedSite && (String(cfg.whatsapp || "").replace(/\D/g, "").length >= 7 || String(cfg.phone || "").replace(/\D/g, "").length >= 7 || cfg.email);
if (!configured) {
  ok("no WhatsApp, phone or email link appears when none is configured", !/wa\.me|href="tel:|href="mailto:/.test(en.text) && !/wa\.me|href="tel:|href="mailto:/.test(ar.text));
} else {
  console.log("NOTE  contact details are configured on this site; the “nothing configured” assertion was skipped");
}
ok("structured data has no phone or email unless configured", configured || !/"telephone"|"email"/.test(en.text));
const about = await get("/en/about");
const contactPage = await get("/en/contact");
ok("mobile contact bar exists on the home page and starts hidden", /<nav class="dock"[^>]*hidden/.test(en.text));
ok("mobile contact bar is visible on inner pages", /<nav class="dock"/.test(about.text) && !/<nav class="dock"[^>]*hidden/.test(about.text));
ok("no contact bar on the contact page itself", !/class="dock"/.test(contactPage.text));
ok("contact bar has an accessible name and is a landmark", /<nav class="dock"[^>]*aria-label="[^"]+"/.test(about.text));

/* ---- 4. Flowers and event management are secondary ---- */
const alsoEn = (en.text.match(/<section class="also"[\s\S]*?<\/section>/) || [""])[0];
const alsoAr = (ar.text.match(/<section class="also"[\s\S]*?<\/section>/) || [""])[0];
ok("“Also from ALYAS Group” row exists in English with two cards", alsoEn.includes("Also from ALYAS Group") && (alsoEn.match(/class="also-card"/g) || []).length === 2);
ok("“Also from ALYAS Group” row exists in Arabic with two cards", alsoAr.includes("ومن مجموعة الياس أيضاً") && (alsoAr.match(/class="also-card"/g) || []).length === 2);
ok("it covers event management and flowers", /management/i.test(alsoEn) && /flower/i.test(alsoEn));
ok("its links go to the events page", alsoEn.includes('href="/en/events"') && alsoEn.includes('href="/en/events#floral"') && alsoAr.includes('href="/ar/events"'));
ok("the events page has the #floral target", (await get("/en/events")).text.includes('id="floral"'));
const idx = (h, re) => h.search(re);
ok("the secondary row comes after the travel services and before the closing call to action", idx(en.text, /class="showcase"/) < idx(en.text, /class="also"/) && idx(en.text, /class="also"/) < idx(en.text, /class="cta"/));
ok("the old large flowers band is gone from the home page", !/class="floral"/.test(en.text));
ok("travel services come first after the hero", idx(en.text, /class="hero"/) < idx(en.text, /class="intro"/) && idx(en.text, /class="intro"/) < idx(en.text, /class="showcase"/));
ok("the secondary row has no full-bleed service tiles", !/class="tile /.test(alsoEn));

/* ---- 5. No sample content on the page ---- */
const offers = (await call("/api/admin/content/offer", { cookie: A })).json?.entries ?? [];
const events = (await call("/api/admin/content/event", { cookie: A })).json?.entries ?? [];
const news = (await call("/api/admin/content/news", { cookie: A })).json?.entries ?? [];
ok("no offers section on the page when no offer is published", offers.some((o) => o.status === "published") || !/class="offers"/.test(en.text));
ok("no featured-event section when no event is published", events.some((o) => o.status === "published") || !/class="feature"/.test(en.text));
const evPage = await get("/en/events");
ok("no news or upcoming-events blocks on the events page when none are published", (news.some((o) => o.status === "published") || !/class="news-list"/.test(evPage.text)) && (events.some((o) => o.status === "published") || !/class="agenda"/.test(evPage.text)));

/* ---- 6. SEO and structure on every public page, both languages ---- */
for (const lang of ["en", "ar"]) {
  for (const p of ["", "/about", "/travel", "/events", "/contact"]) {
    const r = await get(`/${lang}${p}`);
    const label = `${lang}${p || "/"}`;
    ok(`${label}: 200 with one h1`, r.status === 200 && (r.text.match(/<h1[\s>]/g) || []).length === 1, `status ${r.status}, h1 ${(r.text.match(/<h1[\s>]/g) || []).length}`);
    ok(`${label}: html lang and dir`, lang === "en" ? /<html[^>]*lang="en"/.test(r.text) && /dir="ltr"/.test(r.text) : /<html[^>]*lang="ar"/.test(r.text) && /dir="rtl"/.test(r.text));
    ok(`${label}: canonical is itself`, new RegExp(`rel="canonical" href="[^"]*/${lang}${p}"`).test(r.text));
    ok(`${label}: hreflang ar, en and x-default`, /hrefLang="ar"/i.test(r.text) && /hrefLang="en"/i.test(r.text) && /hrefLang="x-default"/i.test(r.text));
    ok(`${label}: open graph title, description and locale`, /property="og:title"/.test(r.text) && /property="og:description"/.test(r.text) && new RegExp(`property="og:locale" content="${lang === "ar" ? "ar_IQ" : "en_US"}"`).test(r.text));
    const title = meta(r.text, /<title>([^<]*)<\/title>/);
    ok(`${label}: title present and under 75 characters`, title.length > 3 && title.length < 75, title);
    const imgs = r.text.match(/<img\b[^>]*>/g) || [];
    ok(`${label}: every image has an alt attribute (empty for decorative)`, imgs.every((i) => /\balt="/.test(i)), imgs.filter((i) => !/\balt="/.test(i)).join(" ").slice(0, 120));
    ok(`${label}: every image declares width and height (no layout shift)`, imgs.every((i) => /\bwidth="\d+"/.test(i) && /\bheight="\d+"/.test(i)), imgs.filter((i) => !/\bwidth="\d+"/.test(i)).join(" ").slice(0, 120));
    const lds = [...r.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    ok(`${label}: structured data (if any) is valid JSON`, lds.every((l) => { try { JSON.parse(decode(l)); return true; } catch { return false; } }));
  }
  const home = lang === "en" ? en.text : ar.text;
  const title = meta(home, /<title>([^<]*)<\/title>/);
  ok(`${lang}: home title says what ALYAS Travel does`, lang === "en" ? /Flights, hotels, visas/.test(title) : /طيران وفنادق وتأشيرات/.test(title), title);
  const desc = meta(home, /<meta name="description" content="([^"]*)"/);
  ok(`${lang}: home description is present and travel-focused`, desc.length > 60 && desc.length < 320 && (lang === "en" ? /travel agency/i.test(desc) : /وكالة سفر/.test(desc)), desc);
  const ld = JSON.parse(decode(meta(home, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)) || "{}");
  ok(`${lang}: structured data is a TravelAgency with a name`, ld["@type"] === "TravelAgency" && !!ld.name);
  ok(`${lang}: structured data states only Baghdad, Iraq as the address`, ld.address?.addressLocality === "Baghdad" && ld.address?.addressCountry === "IQ" && !ld.address?.streetAddress);
  ok(`${lang}: structured data has no rating, review, price or award fields`, !/aggregateRating|"review"|priceRange|"award"|"offers"/.test(JSON.stringify(ld)));
}
const sm = await get("/sitemap.xml");
ok("sitemap lists the homepage and inner pages in both languages", ["/en", "/ar", "/en/about", "/ar/about", "/en/contact", "/ar/contact"].every((p) => sm.text.includes(`${p}</loc>`)));
ok("sitemap does not list the admin, previews or the API", !/\/admin|\/preview|\/api/.test(sm.text));
const robots = await get("/robots.txt");
ok("robots.txt hides admin, api and preview and names the sitemap", /Disallow:\s*\/admin/i.test(robots.text) && /Disallow:\s*\/api\//i.test(robots.text) && /Disallow:\s*\/preview\//i.test(robots.text) && /sitemap/i.test(robots.text));
const nf = await get("/en/no-such-page-xyz");
ok("a missing page answers 404 and asks search engines not to index it", nf.status === 404 && /name="robots" content="noindex/.test(nf.text), `status ${nf.status}`);

/* ---- 7. Behaviour that needs test data (isolated database only) ---- */
if (MUTATE) {
  console.log("\n-- mutating checks: temporary test values, restored afterwards --");
  const homeEntry = (await call("/api/admin/content/home", { cookie: A })).json?.entry;
  const originalHome = JSON.parse(JSON.stringify(homeEntry?.data ?? {}));
  const homeWasPublished = homeEntry?.status === "published";
  const originalSite = JSON.parse(JSON.stringify(site?.data ?? {}));
  const siteWasPublished = publishedSite;

  const setHomeSub = async (sub) => {
    const data = JSON.parse(JSON.stringify(originalHome));
    data.hero = { ...(data.hero ?? {}), sub };
    const s = await call("/api/admin/content/home", { method: "PUT", cookie: A, body: { data } });
    const p = await call("/api/admin/content/home/publish", { method: "POST", cookie: A });
    return s.status === 200 && p.status === 200;
  };
  const setContact = async (patch) => {
    const data = JSON.parse(JSON.stringify(originalSite));
    data.contact = { ...(data.contact ?? {}), whatsapp: "", phone: "", email: "", ...patch };
    const s = await call("/api/admin/content/site", { method: "PUT", cookie: A, body: { data } });
    if (s.status !== 200) return { saved: false, status: s.status, fields: s.json?.fields };
    const p = await call("/api/admin/content/site/publish", { method: "POST", cookie: A });
    return { saved: p.status === 200, status: s.status };
  };
  const OLD = {
    en: "Flights, hotels, visa assistance and transport, arranged by our team in Baghdad.",
    ar: "تذاكر الطيران والفنادق والمساعدة في التأشيرات والنقل، ينظّمها فريقنا في بغداد.",
  };
  try {
    // A. starter wording is upgraded; edited wording is preserved exactly
    ok("an untouched older starter sentence is stored, as an older site would have it", await setHomeSub(OLD));
    const u = await get("/en"), ua = await get("/ar");
    ok("…visitors see the NEW default wording (English)", heroSub(u.text).startsWith("ALYAS Travel, based in Baghdad, arranges flights, hotels, visa assistance"), heroSub(u.text));
    ok("…visitors see the NEW default wording (Arabic)", heroSub(ua.text).startsWith("الياس للسفر، ومقرّها بغداد"), heroSub(ua.text));
    const PREV = {
      en: "ALYAS Travel arranges flights, hotels, visa assistance, transportation and tailored trips from Baghdad.",
      ar: "الياس للسفر من بغداد: نرتّب لك تذاكر الطيران والفنادق والمساعدة في التأشيرات والنقل والرحلات المصمَّمة لك.",
    };
    ok("the immediately previous shipped sentence is upgraded as well", (await setHomeSub(PREV)) && heroSub((await get("/en")).text).startsWith("ALYAS Travel, based in Baghdad") && heroSub((await get("/ar")).text).startsWith("الياس للسفر، ومقرّها"));
    const custom = { en: "Your trip, handled by people who know Baghdad.", ar: "رحلتك بيد أناس يعرفون بغداد." };
    ok("an administrator edits the hero sentence", await setHomeSub(custom));
    const c = await get("/en"), ca = await get("/ar");
    ok("the edited English sentence is shown exactly as written", decode(heroSub(c.text)) === custom.en, heroSub(c.text));
    ok("the edited Arabic sentence is shown exactly as written", decode(heroSub(ca.text)) === custom.ar, heroSub(ca.text));
    ok("only one language edited: the other is kept exactly as stored (not upgraded)", await setHomeSub({ en: custom.en, ar: OLD.ar }));
    ok("…the Arabic older text is preserved when only English was edited", heroSub((await get("/ar")).text) === OLD.ar);
    ok("empty stored wording falls back to the current default", (await setHomeSub({ en: "", ar: "" })) && heroSub((await get("/en")).text).startsWith("ALYAS Travel, based in Baghdad"));

    // B. contact validation and consistency
    const bad = [
      ["whatsapp", "0770 123 4567", "local number without country code"],
      ["whatsapp", "12", "too short"],
      ["whatsapp", "call me", "letters"],
      ["phone", "n/a", "text"],
      ["phone", "++964770", "double plus"],
      ["phone", "123456789;ext=1", "tel: parameter injection"],
      ["email", "bad email", "spaces"],
      ["email", "a@b.co?subject=hi", "query string"],
    ];
    for (const [field, value, why] of bad) {
      const r = await setContact({ [field]: value });
      ok(`the CMS refuses ${field} “${value}” (${why}) with a field message`, !r.saved && r.status === 400 && !!r.fields?.[`contact.${field}`], JSON.stringify(r));
    }
    ok("after refused values, nothing test-related is public", !/wa\.me|href="tel:|href="mailto:/.test((await get("/en")).text));

    const good = await setContact({ whatsapp: "+964 770 123 4567", phone: "(0770) 123-4567", email: "info@alyas-check.example" });
    ok("valid WhatsApp, phone and email are accepted and published", good.saved);
    const e = await get("/en"), a = await get("/ar"), pgs = await get("/en/about"), cp = await get("/en/contact"), cpa = await get("/ar/contact");
    const WA = "https://wa.me/9647701234567";
    ok("hero: WhatsApp link uses the normalised number (English)", heroCopy(e.text).includes(`href="${WA}"`) && heroCopy(e.text).includes(">WhatsApp"));
    ok("hero: WhatsApp link uses the normalised number (Arabic)", heroCopy(a.text).includes(`href="${WA}"`) && heroCopy(a.text).includes(">واتساب"));
    ok("hero: only one secondary action (WhatsApp wins over phone)", !heroCopy(e.text).includes("tel:"));
    ok("mobile bar: WhatsApp link, same number", new RegExp(`<nav class="dock"[\\s\\S]*?href="${WA}"`).test(pgs.text));
    ok("footer: WhatsApp, phone and email links are normalised", e.text.includes(`href="${WA}"`) && e.text.includes('href="tel:07701234567"') && e.text.includes('href="mailto:info@alyas-check.example"'));
    ok("contact page: WhatsApp, phone and email links are normalised", cp.text.includes(`href="${WA}"`) && cp.text.includes('href="tel:07701234567"') && cp.text.includes('href="mailto:info@alyas-check.example"'));
    ok("contact page (Arabic): same links", cpa.text.includes(`href="${WA}"`) && cpa.text.includes('href="tel:07701234567"'));
    ok("external WhatsApp links open safely (noopener noreferrer) and announce the new tab", new RegExp(`href="${WA}" target="_blank" rel="noopener noreferrer"`).test(e.text) && e.text.includes("(opens in a new tab)") && a.text.includes("(يفتح في نافذة جديدة)"));
    ok("tel: and mailto: links do not open a new tab", !/href="tel:[^"]*" target=/.test(e.text) && !/href="mailto:[^"]*" target=/.test(e.text));
    const ld = JSON.parse(decode(meta(e.text, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)));
    ok("structured data: a LOCAL phone number is left out (ambiguous), the valid email is included", ld.telephone === undefined && ld.email === "info@alyas-check.example", JSON.stringify({ t: ld.telephone, e: ld.email }));
    ok("no other phone, email or WhatsApp value appears anywhere", (e.text.match(/wa\.me\/\d+/g) || []).every((m) => m === "wa.me/9647701234567") && (e.text.match(/href="tel:[^"]+"/g) || []).every((m) => m === 'href="tel:07701234567"'));

    const r00 = await setContact({ whatsapp: "00964 770 000 0000", phone: "+964-770-000-0000" });
    ok("00-prefixed WhatsApp and +-prefixed phone are accepted", r00.saved);
    const e2 = await get("/en");
    ok("00964… becomes wa.me/964… and +964… stays as a tel: link", e2.text.includes("https://wa.me/9647700000000") && e2.text.includes('href="tel:+9647700000000"'));
    const ld2 = JSON.parse(decode(meta(e2.text, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)));
    ok("structured data: an international phone number is included exactly as normalised", ld2.telephone === "+9647700000000", JSON.stringify(ld2.telephone));

    const onlyPhone = await setContact({ phone: "+964 770 000 0000" });
    ok("phone only: hero shows Call us (English and Arabic)", onlyPhone.saved && heroCopy((await get("/en")).text).includes('href="tel:+9647700000000"') && heroCopy((await get("/ar")).text).includes("اتصل بنا"));
    ok("phone only: the call link does not open a new tab", !/href="tel:[^"]*"[^>]*target=/.test((await get("/en")).text));
    ok("clearing everything removes every contact link again", (await setContact({})).saved && !/wa\.me|href="tel:|href="mailto:/.test((await get("/en")).text));
  } finally {
    await call("/api/admin/content/site", { method: "PUT", cookie: A, body: { data: originalSite } });
    await call("/api/admin/content/site/publish", { method: "POST", cookie: A });
    await call("/api/admin/content/home", { method: "PUT", cookie: A, body: { data: originalHome } });
    if (homeWasPublished) await call("/api/admin/content/home/publish", { method: "POST", cookie: A });
    void siteWasPublished;
  }
  const after = await get("/en");
  ok("originals restored: no test contact details or test wording remain", !/alyas-check\.example|9647701234567|9647700000000/.test(after.text) && !heroSub(after.text).includes("people who know Baghdad"));
}

/* ---- 8. Hero modes with test data: video (default) vs CMS hero photograph + airplane (isolated database only) ---- */
if (MUTATE) {
  console.log("\n-- hero modes (video ↔ CMS photograph), restored afterwards --");
  const { connect } = await import("./lib-cms.mjs");
  const cmsApi = await connect(BASE, ADMIN_EMAIL, ADMIN_PASSWORD);
  const snap = await cmsApi.snapshotHome();
  const hero = async (lang) => heroSection((await get(`/${lang}?hero=${Date.now()}`)).text);
  try {
    ok("no CMS hero photograph: the VIDEO hero is shown", (await cmsApi.setHero(snap, {})) && /hero--video/.test(await hero("en")) && /<video /.test(await hero("ar")));
    const bg = await cmsApi.uploadImage("public/photos/coast-1600.webp", { altEn: "Test coast photograph", altAr: "صورة ساحل للاختبار" });
    const fg = await cmsApi.uploadImage("public/photos/hero-fg-1280.webp");
    const plane = await cmsApi.uploadImage("public/photos/aircraft.webp");

    ok("a CMS hero photograph is set (published)", await cmsApi.setHero(snap, { backdrop: bg }));
    for (const [lang, alt] of [["en", "Test coast photograph"], ["ar", "صورة ساحل للاختبار"]]) {
      const h = await hero(lang);
      ok(`${lang}: photo hero — the video is replaced by the CMS photograph, with its ${lang === "en" ? "English" : "Arabic"} alt text`, !/hero--video/.test(h) && !/<video /.test(h) && !/hero-video-play/.test(h) && (new RegExp(`<img class="hero-bg"[^>]*src="/media/${bg}\\?w=1920"[^>]*alt="${alt}"`).test(h) || new RegExp(`<img class="hero-bg"[^>]*alt="${alt}"[^>]*src="/media/${bg}`).test(h)), h.slice(0, 260));
      ok(`${lang}: photo hero — the header switches to the white tone for the dark photograph`, /<header class="site-header" data-tone="hero"/.test((await get(`/${lang}?tone=${Date.now()}`)).text));
      ok(`${lang}: photo hero — the built-in airplane flies (the CSS/animation hooks are present)`, /class="hero-plane"[^>]*aria-hidden="true"/.test(h) && /src="\/photos\/aircraft\.webp"/.test(h));
      ok(`${lang}: photo hero — no foreground cut-out unless one is uploaded (the built-in one only fits the built-in photograph)`, !/class="hero-fg"/.test(h));
    }
    ok("photo hero: still exactly one h1 and the same hero copy and buttons", (((await get("/en")).text.match(/<h1[\s>]/g) || []).length === 1) && /hero-copy/.test(await hero("en")) && /href="\/en\/contact"/.test(await hero("en")));

    ok("a CMS foreground cut-out is set as well", await cmsApi.setHero(snap, { backdrop: bg, foreground: fg }));
    ok("photo hero: the CMS foreground cut-out is layered over the headline", new RegExp(`class="hero-fg"[^>]*src="/media/${fg}`).test(await hero("en")));
    ok("a CMS airplane image is set as well", await cmsApi.setHero(snap, { backdrop: bg, foreground: fg, airplane: plane }));
    ok("photo hero: the CMS airplane replaces the built-in one", new RegExp(`class="hero-plane"[\\s\\S]*?src="/media/${plane}\\?w=960"`).test(await hero("en")) && !/\/photos\/aircraft\.webp/.test(await hero("en")));

    ok("a foreground or airplane WITHOUT a hero photograph changes nothing: the video stays", (await cmsApi.setHero(snap, { foreground: fg, airplane: plane })) && /hero--video/.test(await hero("en")) && !/class="hero-fg"/.test(await hero("en")) && !/class="hero-plane"/.test(await hero("en")));
    ok("clearing the CMS hero photograph brings the video back", (await cmsApi.setHero(snap, {})) && /hero--video/.test(await hero("ar")) && /<video /.test(await hero("ar")));
  } finally {
    await cmsApi.restore(snap);
  }
  ok("hero test data removed: the site is back to its original hero", /hero--video/.test(await hero("en")) === !snap.data.hero?.backdrop);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
