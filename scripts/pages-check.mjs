/**
 * Black-box checks for the page builder against a running server.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:pages
 *
 * It creates throw-away pages (and one offer and one event), exercises validation, drafts, preview, publishing,
 * address changes, the menu, the sitemap and roles, then deletes everything it created and disables its editor.
 * It never touches existing pages or content.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
  process.exit(2);
}

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
async function login(email, password) {
  const r = await call("/api/auth/login", { method: "POST", body: { email, password } });
  const c = (r.res.headers.getSetCookie?.() ?? []).find((x) => x.startsWith("alyas_session="));
  return c ? c.split(";")[0] : "";
}
const get = async (path, cookie) => {
  const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { status: res.status, text: await res.text(), headers: res.headers };
};

const bi = (en, ar = "") => ({ en, ar });
const stamp = Date.now().toString(36);
const created = { pages: [], entries: [] };

const A = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
ok("administrator signs in", !!A);
if (!A) process.exit(1);

const page = (over = {}) => ({
  title: bi(`QA Visa Guide ${stamp}`, "دليل التأشيرة"),
  slug: `qa-visa-${stamp}`,
  lead: bi("A short introduction.", "مقدمة قصيرة."),
  sections: [],
  nav: { show: false, label: bi("") },
  seo: { title: bi(""), description: bi(""), image: "", noindex: false },
  ...over,
});
const create = async (data, cookie = A) => {
  const r = await call("/api/admin/content/page", { method: "POST", cookie, body: { data } });
  if (r.status === 200) created.pages.push(r.json.entry.id);
  return r;
};

console.log(`Target: ${BASE}\n`);

// 1. Access control
const anonList = await call("/api/admin/content/page");
ok("anonymous cannot list pages (401)", anonList.status === 401, `got ${anonList.status}`);
const anonCreate = await call("/api/admin/content/page", { method: "POST", body: { data: page() } });
ok("anonymous cannot create a page (401)", anonCreate.status === 401, `got ${anonCreate.status}`);
const prevAnon = await fetch(`${BASE}/preview/en/qa-visa-${stamp}`, { redirect: "manual" });
ok("anonymous preview redirects to sign-in", prevAnon.status >= 300 && prevAnon.status < 400 && (prevAnon.headers.get("location") || "").includes("/admin/login"));

// 2. Validation
for (const reserved of ["about", "travel", "events", "contact", "admin", "api", "preview", "media", "ar", "en", "sitemap", "contact-us"]) {
  const r = await create(page({ slug: reserved }));
  ok(`reserved address “${reserved}” is refused`, r.status === 400 && !!r.json?.fields?.slug, `got ${r.status} ${JSON.stringify(r.json)}`);
}
const badLinks = ["javascript:alert(1)", "//evil.example/x", "data:text/html,<b>x</b>", "vbscript:x", "/ok path", "ftp://x.example"];
for (const link of badLinks) {
  const r = await create(page({ slug: `qa-bad-${stamp}`, sections: [{ type: "cta", title: bi("T"), body: bi(""), button: bi("Go"), link, image: "" }] }));
  ok(`unsafe link “${link}” is refused`, r.status === 400, `got ${r.status}`);
}
const unknown = await create(page({ slug: `qa-unk-${stamp}`, sections: [{ type: "script", src: "https://evil.example/x.js" }] }));
ok("unknown section type is refused", unknown.status === 400, `got ${unknown.status}`);
const tooMany = await create(page({ slug: `qa-many-${stamp}`, sections: Array.from({ length: 31 }, () => ({ type: "text", heading: bi("x"), body: bi("y") })) }));
ok("more than 30 sections is refused", tooMany.status === 400, `got ${tooMany.status}`);
const badImg = await create(page({ slug: `qa-img-${stamp}`, sections: [{ type: "image", image: "../../etc/passwd", caption: bi(""), wide: false }] }));
ok("non-library image reference is refused", badImg.status === 400, `got ${badImg.status}`);
const noTitle = await create(page({ slug: `qa-nt-${stamp}`, title: bi("", "") }));
ok("a page without a title is refused", noTitle.status === 400, `got ${noTitle.status}`);
const badSlugChars = await create(page({ slug: "  QA Weird/Slug!! " }));
ok("address is normalised to safe characters", badSlugChars.status === 200 && /^[a-z0-9-]+$/.test(badSlugChars.json.entry.slug), `got ${badSlugChars.status} ${badSlugChars.json?.entry?.slug}`);
const autoSlug = await create(page({ slug: "", title: bi(`Auto Address ${stamp}`, "") }));
ok("empty address is made from the English title", autoSlug.status === 200 && autoSlug.json.entry.slug === `auto-address-${stamp}`, `got ${autoSlug.json?.entry?.slug}`);

// 3. Sample offer and event so the dynamic sections have something to show
const offer = await call("/api/admin/content/offer", { method: "POST", cookie: A, body: { data: { title: bi(`QA Offer ${stamp}`, ""), destination: bi("QA City"), summary: bi("QA summary"), details: bi(""), priceLabel: bi(""), validUntil: "", featured: false, image: "" } } });
if (offer.status === 200) created.entries.push(offer.json.entry.id);
const event = await call("/api/admin/content/event", { method: "POST", cookie: A, body: { data: { title: bi(`QA Event ${stamp}`, ""), startDate: "2099-01-10", endDate: "", venue: bi("QA Hall"), city: bi("Baghdad"), summary: bi("QA event summary"), details: bi(""), link: "", image: "" } } });
if (event.status === 200) created.entries.push(event.json.entry.id);

// 4. A full page: draft, preview, publish
const slug = `qa-visa-${stamp}`;
const full = page({
  slug,
  nav: { show: true, label: bi("QA Guide", "دليل") },
  seo: { title: bi("QA Search Title", "عنوان البحث"), description: bi("QA description for search.", "وصف للبحث."), image: "", noindex: false },
  sections: [
    { type: "hero", headline: bi("QA Headline", "عنوان"), sub: bi("Sub line", "سطر"), image: "", button: bi("Talk to us", "تحدث إلينا"), link: "/contact" },
    { type: "text", heading: bi("About this guide", "عن الدليل"), body: bi("First paragraph.\n\n<script>alert('xss')</script> second paragraph.", "الفقرة الأولى.\n\nالفقرة الثانية.") },
    { type: "image", image: "", caption: bi(""), wide: false },
    { type: "gallery", heading: bi("Gallery"), images: [] },
    { type: "services", heading: bi("Our services", "خدماتنا"), intro: bi(""), limit: "3" },
    { type: "offers", heading: bi("Offers here", "عروض"), intro: bi(""), limit: "3" },
    { type: "events", heading: bi("Events here", "فعاليات"), intro: bi(""), limit: "3" },
    { type: "cta", title: bi("Ready?", "جاهز؟"), body: bi("Reach out."), button: bi("Contact", "تواصل"), link: "https://example.com/x", image: "" },
  ],
});
const c1 = await create(full);
ok("a full page can be created as a draft", c1.status === 200 && c1.json.entry.status === "draft" && c1.json.entry.slug === slug, `got ${c1.status} ${JSON.stringify(c1.json)?.slice(0, 200)}`);
const id = c1.json?.entry?.id;
const dup = await create(page({ slug }));
ok("a duplicate address is refused (409)", dup.status === 409, `got ${dup.status}`);

const pubBefore = await get(`/en/${slug}`);
ok("a draft page is not public (404)", pubBefore.status === 404, `got ${pubBefore.status}`);
const smBefore = await get("/sitemap.xml");
ok("a draft page is not in the sitemap", !smBefore.text.includes(`/${slug}<`));
const navBefore = await get("/en");
ok("a draft page is not in the menu", !navBefore.text.includes(`/en/${slug}"`));

const prev = await get(`/preview/en/${slug}`, A);
ok("signed-in preview shows the draft (200)", prev.status === 200 && prev.text.includes("QA Headline"), `got ${prev.status}`);
ok("preview is noindex", /noindex/i.test(prev.headers.get("x-robots-tag") || "") || /noindex/i.test(prev.text));
ok("preview shows the draft in the menu", prev.text.includes(`/preview/en/${slug}"`));

const pub = await call(`/api/admin/entries/${id}/publish`, { method: "POST", cookie: A });
ok("publish succeeds", pub.status === 200 && pub.json.entry.status === "published", `got ${pub.status} ${JSON.stringify(pub.json)}`);

const en = await get(`/en/${slug}`);
const ar = await get(`/ar/${slug}`);
ok("published page opens in English (200)", en.status === 200, `got ${en.status}`);
ok("published page opens in Arabic (200)", ar.status === 200, `got ${ar.status}`);
ok("English page is LTR with English content", /<html[^>]*lang="en"[^>]*dir="ltr"|<html[^>]*dir="ltr"[^>]*lang="en"/.test(en.text) && en.text.includes("QA Headline"));
ok("Arabic page is RTL with Arabic content", /dir="rtl"/.test(ar.text) && ar.text.includes("عنوان") && ar.text.includes("الفقرة الأولى"));
ok("exactly one h1 (English)", (en.text.match(/<h1[\s>]/g) || []).length === 1, `got ${(en.text.match(/<h1[\s>]/g) || []).length}`);
ok("exactly one h1 (Arabic)", (ar.text.match(/<h1[\s>]/g) || []).length === 1);
ok("script text from the CMS is escaped, never executed", !en.text.includes("<script>alert('xss')") && en.text.includes("&lt;script&gt;"));
ok("hero button links to the page in this language", en.text.includes('href="/en/contact"') && ar.text.includes('href="/ar/contact"'));
ok("call to action renders with its link", en.text.includes("Ready?") && en.text.includes("https://example.com/x"));
ok("empty image and gallery sections render nothing", !en.text.includes("pg-figure") && !en.text.includes("pg-gallery"));
ok("services section shows the published services", /class="tiles"/.test(en.text) || en.text.includes('class="tiles"'));
ok("offers section shows a published offer only after it is published", !en.text.includes(`QA Offer ${stamp}`));
ok("events section stays hidden with no published events", !en.text.includes("Events here"));

// metadata
ok("title uses the search title", /<title>QA Search Title \|/.test(en.text), en.text.match(/<title>[^<]*/)?.[0]);
ok("description uses the search description", en.text.includes('content="QA description for search."'));
ok("canonical points to this language", en.text.includes(`rel="canonical" href="`) && new RegExp(`rel="canonical" href="[^"]*/en/${slug}"`).test(en.text));
ok("hreflang alternates for both languages", new RegExp(`hrefLang="ar" href="[^"]*/ar/${slug}"`, "i").test(en.text) && new RegExp(`hrefLang="en" href="[^"]*/en/${slug}"`, "i").test(en.text));

// menu
const home = await get("/en");
const homeAr = await get("/ar");
ok("page appears in the English menu with its label", home.text.includes(`href="/en/${slug}"`) && home.text.includes("QA Guide"));
ok("page appears in the Arabic menu with its label", homeAr.text.includes(`href="/ar/${slug}"`) && homeAr.text.includes("دليل"));
const switchLink = en.text.match(/class="lang-switch"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="lang-switch"/);
ok("language switcher maps to the same page", !!switchLink || en.text.includes(`/ar/${slug}`));

// sitemap
const sm = await get("/sitemap.xml");
ok("published page is in the sitemap (both languages)", sm.text.includes(`/en/${slug}<`) && sm.text.includes(`/ar/${slug}<`));

// offers/events appear once published
if (offer.status === 200 && event.status === 200) {
  await call(`/api/admin/entries/${offer.json.entry.id}/publish`, { method: "POST", cookie: A });
  await call(`/api/admin/entries/${event.json.entry.id}/publish`, { method: "POST", cookie: A });
  const en2 = await get(`/en/${slug}`);
  ok("offers and events sections appear when content exists", en2.text.includes(`QA Offer ${stamp}`) && en2.text.includes(`QA Event ${stamp}`) && en2.text.includes("Offers here") && en2.text.includes("Events here"));
}

// 5. Changing the address: the live link moves only on publish
const cur = (await call(`/api/admin/entries/${id}`, { cookie: A })).json.entry;
const moved = await call(`/api/admin/entries/${id}`, { method: "PUT", cookie: A, body: { data: { ...cur.data, slug: `${slug}-2` } } });
ok("saving a new address keeps the live address", moved.status === 200 && moved.json.entry.slug === slug && moved.json.entry.data.slug === `${slug}-2`, JSON.stringify(moved.json)?.slice(0, 200));
ok("live page still opens at the old address", (await get(`/en/${slug}`)).status === 200);
ok("new address is not live before publishing", (await get(`/en/${slug}-2`)).status === 404);
ok("new address previews before publishing", (await get(`/preview/en/${slug}-2`, A)).status === 200);
const taken = await call(`/api/admin/entries/${id}`, { method: "PUT", cookie: A, body: { data: { ...cur.data, slug: "about" } } });
ok("cannot rename to a reserved address", taken.status === 400, `got ${taken.status}`);
const pub2 = await call(`/api/admin/entries/${id}/publish`, { method: "POST", cookie: A });
ok("publishing moves the live address", pub2.status === 200 && pub2.json.entry.slug === `${slug}-2`, `got ${pub2.status} ${JSON.stringify(pub2.json)?.slice(0, 200)}`);
ok("new address is live", (await get(`/en/${slug}-2`)).status === 200);
const oldEn = await get(`/en/${slug}`);
const oldAr = await get(`/ar/${slug}`);
ok("old English address redirects permanently (308) to the new English address", oldEn.status === 308 && new URL(oldEn.headers.get("location"), BASE).pathname === `/en/${slug}-2`, `got ${oldEn.status} ${oldEn.headers.get("location")}`);
ok("old Arabic address redirects permanently (308) to the new Arabic address", oldAr.status === 308 && new URL(oldAr.headers.get("location"), BASE).pathname === `/ar/${slug}-2`, `got ${oldAr.status} ${oldAr.headers.get("location")}`);
ok("the redirect target opens (no loop)", (await get(new URL(oldEn.headers.get("location"), BASE).pathname)).status === 200);
const sm2 = await get("/sitemap.xml");
ok("sitemap follows the address change", sm2.text.includes(`/en/${slug}-2<`) && !sm2.text.includes(`/en/${slug}<`));

// noindex
const cur2 = (await call(`/api/admin/entries/${id}`, { cookie: A })).json.entry;
await call(`/api/admin/entries/${id}`, { method: "PUT", cookie: A, body: { data: { ...cur2.data, seo: { ...cur2.data.seo, noindex: true } } } });
await call(`/api/admin/entries/${id}/publish`, { method: "POST", cookie: A });
const ni = await get(`/en/${slug}-2`);
ok("noindex page carries a robots noindex tag", /name="robots" content="noindex/i.test(ni.text));
ok("noindex page is left out of the sitemap", !(await get("/sitemap.xml")).text.includes(`/en/${slug}-2<`));

// unpublish
const un = await call(`/api/admin/entries/${id}/unpublish`, { method: "POST", cookie: A });
ok("unpublish succeeds", un.status === 200 && un.json.entry.status === "draft");
ok("unpublished page is hidden (404)", (await get(`/en/${slug}-2`)).status === 404 && (await get(`/ar/${slug}-2`)).status === 404);
ok("an unpublished page leaves no redirect to a missing page (old address is 404, not 308)", (await get(`/en/${slug}`)).status === 404 && (await get(`/ar/${slug}`)).status === 404);
ok("unpublished page leaves the menu", !(await get("/en")).text.includes(`/en/${slug}-2"`));
ok("unpublished page still previews for editors", (await get(`/preview/en/${slug}-2`, A)).status === 200);

// 5b. Redirects from old addresses
const follow = async (path, max = 5) => {
  let p = path, hops = 0;
  for (;;) {
    const r = await get(p);
    if (r.status === 308) {
      if (++hops > max) return { status: "loop", hops };
      p = new URL(r.headers.get("location"), BASE).pathname;
      continue;
    }
    return { status: r.status, hops, path: p };
  }
};
const R = { a: `qa-r1-${stamp}`, b: `qa-r2-${stamp}`, c: `qa-r3-${stamp}` };
const rp = await create(page({ slug: R.a, title: bi(`QA Redirect ${stamp}`, "اختبار") , sections: [{ type: "text", heading: bi("Redirect test"), body: bi("Body") }] }));
const rid = rp.json?.entry?.id;
const rename = async (to) => {
  const cur = (await call(`/api/admin/entries/${rid}`, { cookie: A })).json.entry;
  const s = await call(`/api/admin/entries/${rid}`, { method: "PUT", cookie: A, body: { data: { ...cur.data, slug: to } } });
  const p = await call(`/api/admin/entries/${rid}/publish`, { method: "POST", cookie: A });
  return { save: s.status, publish: p.status, slug: p.json?.entry?.slug };
};
ok("redirect test page is created and published", rp.status === 200 && (await call(`/api/admin/entries/${rid}/publish`, { method: "POST", cookie: A })).status === 200);
ok("a page's first publish creates no redirect for its draft address", (await get(`/en/${R.a}`)).status === 200);

const r2 = await rename(R.b);
ok("renaming a published page works", r2.publish === 200 && r2.slug === R.b, JSON.stringify(r2));
for (const lang of ["en", "ar"]) {
  const r = await get(`/${lang}/${R.a}`);
  ok(`/${lang}: old address → new address, 308, same language`, r.status === 308 && new URL(r.headers.get("location"), BASE).pathname === `/${lang}/${R.b}`, `got ${r.status} ${r.headers.get("location")}`);
}
const r3 = await rename(R.c);
ok("renaming again works", r3.publish === 200 && r3.slug === R.c, JSON.stringify(r3));
for (const lang of ["en", "ar"]) {
  for (const old of [R.a, R.b]) {
    const f = await follow(`/${lang}/${old}`);
    ok(`/${lang}/${old.slice(0, 8)}…: older addresses go straight to the current one in one hop`, f.status === 200 && f.hops === 1 && f.path === `/${lang}/${R.c}`, JSON.stringify(f));
  }
}
const inMap = (await get("/sitemap.xml")).text;
ok("sitemap lists only the current address, not the redirects", inMap.includes(`/en/${R.c}<`) && !inMap.includes(`/en/${R.a}<`) && !inMap.includes(`/en/${R.b}<`));

// loops: move the page back to an earlier address
const back = await rename(R.a);
ok("a page can move back to an earlier address", back.publish === 200 && back.slug === R.a, JSON.stringify(back));
ok("the address in use serves the page (200), it does not redirect", (await get(`/en/${R.a}`)).status === 200 && (await get(`/ar/${R.a}`)).status === 200);
for (const lang of ["en", "ar"]) {
  for (const old of [R.b, R.c]) {
    const f = await follow(`/${lang}/${old}`);
    ok(`/${lang}/${old.slice(0, 8)}…: after moving back, still ends on the page with no loop`, f.status === 200 && f.hops === 1 && f.path === `/${lang}/${R.a}`, JSON.stringify(f));
  }
}

// reserved routes are never redirect sources or targets
const toReserved = await rename("about");
ok("a page cannot be moved to a reserved address", toReserved.save === 400, JSON.stringify(toReserved));
for (const p of ["/en/about", "/ar/about", "/en/contact", "/en"]) ok(`reserved route ${p} is unaffected (200, no redirect)`, (await get(p)).status === 200);

// another page cannot take an address that redirects
const steal = await create(page({ slug: R.b, title: bi("QA Steal", "") }));
ok("an address that redirects to a page cannot be reused by another page (409)", steal.status === 409, `got ${steal.status}`);

// unpublish: no redirect is left pointing at a missing page
await call(`/api/admin/entries/${rid}/unpublish`, { method: "POST", cookie: A });
for (const s of [R.a, R.b, R.c]) {
  const en = await get(`/en/${s}`);
  const ar = await get(`/ar/${s}`);
  ok(`unpublished: /${s.slice(0, 8)}… is 404 in both languages (no redirect)`, en.status === 404 && ar.status === 404, `got ${en.status}/${ar.status}`);
}
await call(`/api/admin/entries/${rid}/publish`, { method: "POST", cookie: A });
ok("republishing brings the redirects back", (await follow(`/en/${R.b}`)).status === 200 && (await follow(`/ar/${R.c}`)).status === 200);

// delete: redirects are removed with the page
await call(`/api/admin/entries/${rid}`, { method: "DELETE", cookie: A });
created.pages = created.pages.filter((x) => x !== rid);
for (const s of [R.a, R.b, R.c]) {
  const en = await get(`/en/${s}`);
  ok(`deleted: /${s.slice(0, 8)}… is 404 (no redirect to a missing page)`, en.status === 404, `got ${en.status}`);
}
const reuse = await create(page({ slug: R.b, title: bi("QA Reuse", "") }));
ok("after deleting the page its old addresses are free again", reuse.status === 200, `got ${reuse.status}`);

// a rename made before the page was ever live leaves no redirect
const pre = await create(page({ slug: `qa-p1-${stamp}`, title: bi("QA Pre", "") }));
const preCur = pre.json.entry;
await call(`/api/admin/entries/${preCur.id}`, { method: "PUT", cookie: A, body: { data: { ...preCur.data, slug: `qa-p2-${stamp}` } } });
await call(`/api/admin/entries/${preCur.id}/publish`, { method: "POST", cookie: A });
ok("renaming before first publish creates no redirect", (await get(`/en/qa-p1-${stamp}`)).status === 404 && (await get(`/en/qa-p2-${stamp}`)).status === 200);

// 6. Menu limit (counts pages that already use a menu slot, so the check works on a site with real pages)
const existingInMenu = ((await call("/api/admin/content/page", { cookie: A })).json?.entries ?? []).filter((e) => e.status === "published" && e.published?.nav?.show && !created.pages.includes(e.id)).length;
const room = Math.max(0, 4 - existingInMenu);
const navPages = [];
for (let i = 0; i < room + 1; i++) {
  const r = await create(page({ slug: `qa-nav-${i}-${stamp}`, title: bi(`QA Nav ${i}`, ""), nav: { show: true, label: bi("") } }));
  navPages.push(r.json?.entry?.id);
}
const results = [];
for (const nid of navPages) results.push((await call(`/api/admin/entries/${nid}/publish`, { method: "POST", cookie: A })).status);
ok(`the menu takes four pages in total (${room} free here); one more is refused`, results.slice(0, room).every((s) => s === 200) && results[room] === 400, `got ${results.join(",")}`);
const menuHtml = (await get("/en")).text;
ok("the header shows at most four custom pages", (menuHtml.match(/href="\/en\/qa-nav-/g) || []).length <= 8 && !menuHtml.includes(`/en/qa-nav-${room}-${stamp}`));

// 7. Existing pages and routing are untouched
for (const p of ["", "/about", "/travel", "/events", "/contact"]) {
  ok(`built-in page /en${p} still opens`, (await get(`/en${p}`)).status === 200);
  ok(`built-in page /ar${p} still opens`, (await get(`/ar${p}`)).status === 200);
}
ok("unknown address is 404", (await get("/en/does-not-exist-" + stamp)).status === 404);
ok("nested address is 404", (await get("/en/a/b")).status === 404);
ok("uppercase address is 404", (await get("/en/QA-Visa")).status === 404);
const bare = await fetch(`${BASE}/${slug}-2`, { redirect: "manual" });
ok("address without a language redirects to a language", bare.status === 307 && /\/(en|ar)\/qa-visa-/.test(bare.headers.get("location") || ""), `got ${bare.status} ${bare.headers.get("location")}`);
ok("old alias URLs still redirect", (await fetch(`${BASE}/services`, { redirect: "manual" })).status === 308);

// 8. Editor role: can build and publish, cannot delete
const editorEmail = `pages-check-${stamp}@example.com`;
const editorPw = "Pages-Check-Pass-2026";
const mk = await call("/api/admin/users", { method: "POST", cookie: A, body: { email: editorEmail, name: "Check", role: "editor", password: editorPw } });
const E = await login(editorEmail, editorPw);
if (E) {
  const er = await create(page({ slug: `qa-ed-${stamp}`, title: bi("QA Editor page", "") }), E);
  ok("an editor can create a page", er.status === 200, `got ${er.status}`);
  const ep = await call(`/api/admin/entries/${er.json?.entry?.id}/publish`, { method: "POST", cookie: E });
  ok("an editor can publish a page", ep.status === 200, `got ${ep.status}`);
  const ed = await call(`/api/admin/entries/${er.json?.entry?.id}`, { method: "DELETE", cookie: E });
  ok("an editor cannot delete a page (403)", ed.status === 403, `got ${ed.status}`);
} else ok("editor account signs in", false);

// 9. Cleanup
for (const pid of created.pages) await call(`/api/admin/entries/${pid}`, { method: "DELETE", cookie: A });
for (const eid of created.entries) await call(`/api/admin/entries/${eid}`, { method: "DELETE", cookie: A });
if (mk.status === 200) await call(`/api/admin/users/${mk.json.user?.id ?? mk.json.id}`, { method: "PATCH", cookie: A, body: { disabled: true } });
const left = (await call("/api/admin/content/page", { cookie: A })).json?.entries?.filter((e) => JSON.stringify(e.data).includes(stamp) || (e.slug || "").includes(stamp)) ?? [];
ok("test pages are cleaned up", left.length === 0, `left ${left.map((l) => l.slug).join(",")}`);
ok("test sitemap entries are gone", !(await get("/sitemap.xml")).text.includes(stamp));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
