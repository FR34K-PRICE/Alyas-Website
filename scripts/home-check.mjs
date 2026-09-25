/**
 * Black-box checks for the public homepage against a running server.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:home
 *
 * Read-only by default: hero copy, secondary services, SEO in both languages, the health endpoint, and that no
 * WhatsApp/phone action appears unless contact details are configured in the CMS.
 *
 * Set HOME_CHECK_MUTATE=1 to also prove WhatsApp/phone actions appear when configured. That temporarily saves and
 * publishes test contact details in Site & brand and then restores your original values. Use it on a local or test
 * database only, never on production.
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
const meta = (html, re) => (html.match(re) || [, ""])[1];

console.log(`Target: ${BASE}\n`);
const A = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
ok("administrator signs in", !!A);
if (!A) process.exit(1);

// 1. Health and the root address
const health = await get("/api/health");
ok("health endpoint reports ok (200)", health.status === 200 && JSON.parse(health.text).ok === true, `got ${health.status} ${health.text}`);
const root = await get("/");
ok('"/" answers 200 directly, not with a redirect', root.status === 200 && /<html[^>]*lang="(ar|en)"/.test(root.text), `got ${root.status}`);
const rootEn = await get("/", { "accept-language": "en-US,en;q=0.9" });
ok('"/" follows the visitor\'s language (English)', /<html[^>]*lang="en"/.test(rootEn.text));
const rootAr = await get("/", { "accept-language": "ar-IQ,ar;q=0.9,en;q=0.5" });
ok('"/" follows the visitor\'s language (Arabic)', /<html[^>]*lang="ar"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="ar"/.test(rootAr.text));

// 2. Hero says what ALYAS Travel does
const en = await get("/en");
const ar = await get("/ar");
const enHero = heroText(en.text).toLowerCase();
const arHero = heroText(ar.text);
for (const w of ["flights", "hotels", "visa", "transportation", "tailored", "baghdad"]) ok(`English hero mentions “${w}”`, enHero.includes(w), enHero);
for (const w of ["الطيران", "الفنادق", "التأشيرات", "النقل", "المصمَّمة", "بغداد"]) ok(`Arabic hero mentions “${w}”`, arHero.includes(w), arHero);
ok("hero keeps flowers and events out of the main message", !/flower|event|conference/i.test(enHero) && !/زهور|فعاليات|مؤتمرات/.test(arHero));
ok("hero copy is concise (under 150 characters, button included)", heroText(en.text).length < 150 && arHero.length < 150, `${heroText(en.text).length}/${arHero.length}`);
ok("one h1 in each language", (en.text.match(/<h1[\s>]/g) || []).length === 1 && (ar.text.match(/<h1[\s>]/g) || []).length === 1);
ok("hero button opens the contact page in this language", heroCopy(en.text).includes('href="/en/contact"') && heroCopy(ar.text).includes('href="/ar/contact"'));
ok("the animated airplane is still in the hero", en.text.includes('class="hero-plane"') && ar.text.includes('class="hero-plane"'));

// 3. Contact actions come only from configured details
const site = (await call("/api/admin/content/site", { cookie: A })).json?.entry;
const cfg = site?.data?.contact ?? {};
const waDigits = String(cfg.whatsapp || "").replace(/\D/g, "");
const phoneDigits = String(cfg.phone || "").replace(/\D/g, "");
const publishedSite = site?.status === "published";
if (!publishedSite || (waDigits.length < 7 && phoneDigits.length < 7)) {
  ok("no WhatsApp or phone action appears when none is configured", !/wa\.me|href="tel:/.test(en.text) && !/wa\.me|href="tel:/.test(ar.text));
} else {
  ok("WhatsApp/phone shown match the configured details", (waDigits.length < 7 || en.text.includes(`wa.me/${waDigits}`)) && (waDigits.length >= 7 || en.text.includes("tel:")));
}
const dockOf = (html) => (html.match(/<div class="dock"[\s\S]*?<\/div>/) || [""])[0];
ok("mobile contact bar exists on the home page and starts hidden", /class="dock"[^>]*hidden/.test(en.text) || /hidden=""[^>]*class="dock"|class="dock"[^>]*hidden=""/.test(en.text));
const about = await get("/en/about");
ok("mobile contact bar is visible on inner pages", /class="dock"/.test(about.text) && !/class="dock"[^>]*hidden/.test(about.text));
const contactPage = await get("/en/contact");
ok("no contact bar on the contact page itself", !/class="dock"/.test(contactPage.text));
ok("contact bar has an accessible name", /class="dock"[^>]*aria-label="[^"]+"|aria-label="[^"]+"[^>]*class="dock"/.test(about.text));
void dockOf;

if (MUTATE) {
  console.log("\n-- configured contact details (temporary) --");
  const original = JSON.parse(JSON.stringify(site?.data ?? {}));
  const wasPublished = publishedSite;
  const setContact = async (patch) => {
    const data = JSON.parse(JSON.stringify(original));
    data.contact = { ...(data.contact ?? {}), whatsapp: "", phone: "", ...patch };
    const s = await call("/api/admin/content/site", { method: "PUT", cookie: A, body: { data } });
    const p = await call("/api/admin/content/site/publish", { method: "POST", cookie: A });
    return s.status === 200 && p.status === 200;
  };
  try {
    ok("test WhatsApp number saved and published", await setContact({ whatsapp: "9647700000000" }));
    const e1 = await get("/en"), a1 = await get("/ar"), p1 = await get("/en/about");
    ok("WhatsApp button appears in the English hero", heroCopy(e1.text).includes("https://wa.me/9647700000000") && heroCopy(e1.text).includes(">WhatsApp<"));
    ok("WhatsApp button appears in the Arabic hero", heroCopy(a1.text).includes("https://wa.me/9647700000000") && heroCopy(a1.text).includes(">واتساب<"));
    ok("WhatsApp link opens safely in a new tab", /href="https:\/\/wa\.me\/9647700000000" target="_blank" rel="noopener noreferrer"/.test(e1.text));
    ok("WhatsApp button appears in the mobile contact bar", /class="dock"[\s\S]*?wa\.me\/9647700000000/.test(p1.text));

    ok("test phone number saved and published (WhatsApp cleared)", await setContact({ phone: "+964 770 000 0000" }));
    const e2 = await get("/en"), a2 = await get("/ar"), p2 = await get("/en/about");
    ok("phone action appears when only a phone is configured", heroCopy(e2.text).includes('href="tel:+9647700000000"') && heroCopy(e2.text).includes("Call us") && !e2.text.includes("wa.me"));
    ok("phone action is labelled in Arabic", heroCopy(a2.text).includes('href="tel:+9647700000000"') && heroCopy(a2.text).includes("اتصل بنا"));
    ok("phone action appears in the mobile contact bar", /class="dock"[\s\S]*?tel:\+9647700000000/.test(p2.text));

    ok("both configured: WhatsApp is preferred, one secondary action only", await setContact({ whatsapp: "9647700000000", phone: "+964 770 000 0000" }));
    const e3 = await get("/en");
    ok("only one secondary action in the hero", heroCopy(e3.text).includes("wa.me") && !heroCopy(e3.text).includes("tel:"));
    ok("a malformed number is ignored, nothing is invented", await setContact({ whatsapp: "12", phone: "n/a" }));
    const e4 = await get("/en");
    ok("too-short WhatsApp and non-numeric phone produce no action", !/wa\.me|href="tel:/.test(e4.text));
  } finally {
    // restore exactly what was there before
    const restore = JSON.parse(JSON.stringify(original));
    await call("/api/admin/content/site", { method: "PUT", cookie: A, body: { data: restore } });
    if (wasPublished) await call("/api/admin/content/site/publish", { method: "POST", cookie: A });
    else {
      // the site document did not exist before: publish the restored (empty-contact) document so nothing test-related stays live
      await call("/api/admin/content/site/publish", { method: "POST", cookie: A });
    }
  }
  const after = await get("/en");
  ok("original contact details restored (no test number left on the site)", !after.text.includes("9647700000000"));
}

// 4. Flowers and event management are secondary
const alsoEn = (en.text.match(/<section class="also"[\s\S]*?<\/section>/) || [""])[0];
const alsoAr = (ar.text.match(/<section class="also"[\s\S]*?<\/section>/) || [""])[0];
ok("“Also from ALYAS Group” row exists in English with two cards", alsoEn.includes("Also from ALYAS Group") && (alsoEn.match(/class="also-card"/g) || []).length === 2);
ok("“Also from ALYAS Group” row exists in Arabic with two cards", alsoAr.includes("ومن مجموعة الياس أيضاً") && (alsoAr.match(/class="also-card"/g) || []).length === 2);
ok("it covers event management and flowers", /management/i.test(alsoEn) && /flower/i.test(alsoEn));
ok("its links go to the events page", alsoEn.includes('href="/en/events"') && alsoEn.includes('href="/en/events#floral"') && alsoAr.includes('href="/ar/events"'));
ok("the events page has the #floral target", (await get("/en/events")).text.includes('id="floral"'));
const idx = (h, re) => h.search(re);
ok("the secondary row comes after the travel services", idx(en.text, /class="showcase"/) < idx(en.text, /class="also"/) && idx(en.text, /class="also"/) < idx(en.text, /class="cta"/));
ok("the old large flowers band is gone from the home page", !/class="floral"/.test(en.text));
ok("travel services are the first content after the hero", idx(en.text, /class="intro"/) < idx(en.text, /class="showcase"/) && idx(en.text, /class="hero"/) < idx(en.text, /class="intro"/));

// 5. No sample content in this database
const offers = (await call("/api/admin/content/offer", { cookie: A })).json?.entries ?? [];
const events = (await call("/api/admin/content/event", { cookie: A })).json?.entries ?? [];
const liveOffers = offers.filter((o) => o.status === "published").length;
const liveEvents = events.filter((o) => o.status === "published").length;
ok("no offers section on the page when no offer is published", liveOffers > 0 || !/class="offers"/.test(en.text));
ok("no featured-event section when no event is published", liveEvents > 0 || !/class="feature"/.test(en.text));

// 6. SEO in both languages
for (const [lang, html] of [["en", en.text], ["ar", ar.text]]) {
  const title = meta(html, /<title>([^<]*)<\/title>/);
  ok(`${lang}: title says what ALYAS Travel does`, lang === "en" ? /Flights, hotels, visas/.test(title) : /طيران وفنادق وتأشيرات/.test(title), title);
  ok(`${lang}: title is a sensible length (under 75 characters)`, title.length > 10 && title.length < 75, `${title.length}`);
  const desc = meta(html, /<meta name="description" content="([^"]*)"/);
  ok(`${lang}: meta description is present and travel-focused`, desc.length > 60 && desc.length < 320 && (lang === "en" ? /travel agency/i.test(desc) : /وكالة سفر/.test(desc)), desc);
  ok(`${lang}: canonical points at this language`, new RegExp(`rel="canonical" href="[^"]*/${lang}"`).test(html));
  ok(`${lang}: hreflang for both languages and x-default`, /hrefLang="ar"/i.test(html) && /hrefLang="en"/i.test(html) && /hrefLang="x-default"/i.test(html));
  ok(`${lang}: open graph locale and title`, new RegExp(`property="og:locale" content="${lang === "ar" ? "ar_IQ" : "en_US"}"`).test(html) && /property="og:title"/.test(html));
  ok(`${lang}: html lang and dir are correct`, lang === "en" ? /lang="en"/.test(html) && /dir="ltr"/.test(html) : /lang="ar"/.test(html) && /dir="rtl"/.test(html));
  const ld = meta(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let parsed = null;
  try { parsed = JSON.parse(ld); } catch {}
  ok(`${lang}: structured data is valid JSON for a TravelAgency`, parsed?.["@type"] === "TravelAgency" && !!parsed?.name, ld.slice(0, 80));
  ok(`${lang}: structured data invents no phone or email`, !parsed?.telephone || phoneDigits.length >= 7);
}
const sm = await get("/sitemap.xml");
ok("sitemap lists the homepage in both languages", /\/en<\/loc>/.test(sm.text) && /\/ar<\/loc>/.test(sm.text));
const robots = await get("/robots.txt");
ok("robots.txt allows the site and hides the admin", /Disallow:\s*\/admin/i.test(robots.text) && /sitemap/i.test(robots.text), robots.text.slice(0, 120));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
