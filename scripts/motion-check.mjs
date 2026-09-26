/**
 * Behavioural check of the homepage hero's motion and its fallbacks, in a real browser.
 *
 *   BASE_URL=http://localhost:3000 npm run check:motion
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE_URL=... npm run check:motion     (ISOLATED TEST SITE ONLY: runs both suites)
 *
 * The homepage hero has two modes (see README, "Hero and photography"): the default VIDEO hero, and the PHOTO hero
 * with the flying airplane that appears when a CMS hero photograph is set. This check has one suite for each:
 *
 *  VIDEO HERO (real decoded frames, not source text):
 *   - motion allowed: the video plays, is muted, no airplane/foreground exists, the Play button and native controls
 *     disappear once frames advance, the poster stays as the fallback layer, headline and copy are never hidden;
 *   - reduced motion: no autoplay (paused at 0, no frames), poster and a visible Play button clear of everything,
 *     and the visitor's own tap starts real frames; hover zoom and smooth scrolling are off;
 *   - JavaScript off, a failing inline motion script, all page scripts blocked: poster, native controls and text
 *     stay visible and nothing is left hidden; the video still plays without the inline script;
 *   - the Play button sits on the inline-end side (right in LTR, left in RTL) and never touches the headline, copy,
 *     buttons, header or menu button; English and Arabic at desktop, tablet, phone and narrow-phone widths.
 *
 *  AIRCRAFT / PHOTO HERO:
 *   - the inline script sets js-motion; the plane flies once from behind its parked spot (from the left in English,
 *     from the right in Arabic), finishes, stays visible and perfectly still inside the hero, never touching the
 *     headline, copy, buttons, header or menu button at any moment, with no console errors;
 *   - reduced motion, JavaScript off, a failing inline script, blocked scripts (CSS safety net): the plane is
 *     visible and still; image orientation is right in LTR and RTL.
 *
 * Which suites run: switching the hero between the two modes needs the CMS, so it needs ADMIN_EMAIL and
 * ADMIN_PASSWORD of a LOCAL/ISOLATED TEST site (it saves and publishes test settings, uploads one test image, and
 * restores everything afterwards; never use production). Without them only the suite matching the site's current
 * hero runs, and the other is reported as NOT RUN, never as a pass.
 *
 * No extra npm package: it starts Chrome or Edge headless and drives it through the Chrome DevTools Protocol
 * (Node's built-in WebSocket). Set CHROME_PATH if it cannot find a browser. With no browser it says so and exits
 * with code 3 (MOTION_CHECK_SKIP_OK=1 makes that exit 0), so a missing browser is never mistaken for a pass.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const QUICK = process.env.MOTION_QUICK === "1";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  ${extra}`}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- find and start a browser ---------------- */
function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  const list = [
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
  ];
  return list.find((p) => p && fs.existsSync(p));
}

const exe = findBrowser();
if (typeof WebSocket !== "function" || !exe) {
  console.log(`SKIP  motion check not run: ${typeof WebSocket !== "function" ? "this Node has no built-in WebSocket (needs Node 22+)" : "no Chrome or Edge found (set CHROME_PATH)"}.`);
  console.log("      This is NOT a pass. Manual steps are in the README (Motion and reduced motion).");
  process.exit(process.env.MOTION_CHECK_SKIP_OK === "1" ? 0 : 3);
}

const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alyas-motion-"));
const proc = spawn(exe, [
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--hide-scrollbars", "--mute-audio", "about:blank",
], { stdio: "ignore" });
const cleanup = () => { try { proc.kill(); } catch {} setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 800); };
process.on("exit", cleanup);

for (let i = 0; ; i++) {
  try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { if (i > 60) { console.log("FAIL  the browser did not start"); process.exit(1); } await sleep(250); }
}

/* ---------------- tiny DevTools Protocol client ---------------- */
async function newPage() {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map(), handlers = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    else if (d.method) (handlers.get(d.method) || []).forEach((h) => h(d.params));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (ev, fn) => handlers.set(ev, [...(handlers.get(ev) || []), fn]);
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "evaluate failed");
    return r.result.value;
  };
  const tap = async (x, y, touch) => {
    if (touch) {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    }
  };
  const close = async () => { try { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch {} };
  return { send, on, evaluate, tap, close };
}

const SAMPLE = `(() => {
  const p = document.querySelector('.hero-plane'); if (!p) return null;
  const r = p.getBoundingClientRect(), cs = getComputedStyle(p), img = p.querySelector('img');
  const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const rg = document.createRange(); rg.selectNodeContents(document.querySelector('.hero-title')); const tb = rg.getBoundingClientRect();
  const anims = document.getAnimations().filter((a) => a.effect && a.effect.target === p);
  const menu = document.querySelector('.menu-toggle');
  const frame = document.querySelector('.hero-frame').getBoundingClientRect();
  return {
    // false while the stylesheet has not applied yet (the un-styled image would sit somewhere else entirely)
    styled: frame.height > 300 && r.width > 40 && r.width < 260 && getComputedStyle(p).position === 'absolute',
    t: performance.now(), cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width, plane: { l: r.left, r: r.right, t: r.top, b: r.bottom },
    op: parseFloat(cs.opacity), tr: cs.transform, imgTr: getComputedStyle(img).transform, cls: document.documentElement.className,
    dir: document.documentElement.dir, lang: document.documentElement.lang,
    frame: box(document.querySelector('.hero-frame')), title: { l: tb.left, r: tb.right, t: tb.top, b: tb.bottom },
    copy: box(document.querySelector('.hero-copy p')), actions: box(document.querySelector('.hero-actions')), header: box(document.querySelector('.site-header .header-row')),
    menu: menu && menu.offsetParent ? box(menu) : null,
    waapi: anims.filter((a) => !a.animationName).map((a) => a.playState), css: anims.filter((a) => a.animationName).map((a) => a.animationName + ':' + a.playState),
  };
})()`;

/**
 * Opens the page under the given conditions and samples the airplane every ~100 ms for `ms` milliseconds.
 * opts: { width, height, reduced, noJs, stripInline, blockScripts, lang }
 */
async function run(opts, ms) {
  const pg = await newPage();
  const errors = [];
  pg.on("Runtime.exceptionThrown", (e) => errors.push(`exception: ${e.exceptionDetails?.exception?.description?.split("\n")[0] || e.exceptionDetails?.text}`));
  pg.on("Runtime.consoleAPICalled", (e) => { if (e.type === "error") errors.push(`console.error: ${(e.args?.[0]?.value ?? e.args?.[0]?.description ?? "").toString().slice(0, 120)}`); });
  pg.on("Log.entryAdded", (e) => { if (e.entry.level === "error") errors.push(`log: ${e.entry.text.slice(0, 120)}`); });
  await pg.send("Runtime.enable");
  await pg.send("Log.enable");
  await pg.send("Page.enable");
  await pg.send("Emulation.setDeviceMetricsOverride", { width: opts.width, height: opts.height, deviceScaleFactor: 1, mobile: opts.width < 768 });
  await pg.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: opts.reduced ? "reduce" : "no-preference" }] });
  if (opts.noJs) await pg.send("Emulation.setScriptExecutionDisabled", { value: true });
  let stripped = 0;
  if (opts.stripInline) {
    // "The inline motion script failed": the browser never applies the only thing that script does, adding the
    // js-motion class. (Rewriting the page's HTML through request interception would also break Next's dev
    // hot-reload socket and stop hydration, which is a different failure from the one under test.)
    await pg.send("Page.addScriptToEvaluateOnNewDocument", { source: "(() => { const add = DOMTokenList.prototype.add; DOMTokenList.prototype.add = function (...a) { return add.apply(this, a.filter((x) => x !== 'js-motion')); }; })();" });
    stripped = 1;
  }
  if (opts.blockScripts) {
    // All page scripts blocked after the inline one ran: the page can never hydrate (that is the point of the test).
    await pg.send("Fetch.enable", { patterns: [{ urlPattern: "*", resourceType: "Script", requestStage: "Request" }] });
    pg.on("Fetch.requestPaused", async (e) => {
      try { await pg.send("Fetch.failRequest", { requestId: e.requestId, errorReason: "BlockedByClient" }); } catch { /* request may already be gone */ }
    });
  }
  await pg.send("Page.navigate", { url: `${BASE}/${opts.lang}?motion-check=${Date.now()}` });
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const s = await pg.evaluate(opts.sampler || SAMPLE); if (s && s.styled) samples.push({ ...s, wall: Date.now() - start }); } catch { /* page still loading */ }
    await sleep(100);
  }
  const extra = {};
  if (opts.extras) Object.assign(extra, await opts.extras(pg));
  await pg.close();
  return { samples, errors, stripped, extra };
}

/* ---------------- geometry helpers ---------------- */
const hit = (a, b) => a && b && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
const planeBox = (s) => s.plane;
const inside = (p, f) => p.l >= f.l - 0.5 && p.r <= f.r + 0.5 && p.t >= f.t - 0.5 && p.b <= f.b + 0.5;
const matrixA = (tr) => (tr && tr.startsWith("matrix(") ? parseFloat(tr.slice(7)) : 1);
const isIdentity = (tr) => tr === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(tr);
const drift = (list) => { let max = 0, at = 0; for (const s of list) { const d = Math.max(Math.abs(s.cx - list[0].cx), Math.abs(s.cy - list[0].cy)); if (d > max) { max = d; at = s.wall; } } return `max drift ${max.toFixed(1)} px at ${at} ms`; };
const still = (list) => list.length >= 4 && Math.max(...list.map((s) => Math.abs(s.cx - list[0].cx)), ...list.map((s) => Math.abs(s.cy - list[0].cy))) < 0.6;
const overlaps = (s) => [hit(planeBox(s), s.title) && "headline", hit(planeBox(s), s.copy) && "copy", hit(planeBox(s), s.actions) && "buttons", hit(planeBox(s), s.header) && "header", s.menu && hit(planeBox(s), s.menu) && "menu button"].filter(Boolean);

console.log(`Target: ${BASE}\nBrowser: ${path.basename(exe)} (headless)\n`);

const WIDTHS = QUICK ? [[1440, 900], [340, 700]] : [[1440, 900], [820, 1180], [390, 844], [340, 700]];
const tileProbe = async (pg) => {
  await pg.evaluate(`document.querySelector('.tile')?.scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await sleep(300);
  const c = await pg.evaluate(`(() => { const b = document.querySelector('.tile').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await pg.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y });
  await sleep(1300);
  return pg.evaluate(`({ tileTransform: getComputedStyle(document.querySelector('.tile-photo img')).transform, scroll: getComputedStyle(document.documentElement).scrollBehavior })`);
};

async function photoSuite() {
  console.log("\n== Aircraft / photo hero (a CMS hero photograph is set) ==");
  {
    const html = await (await fetch(`${BASE}/en`)).text();
    ok("the photo hero serves the airplane and NO video (no hero--video, no <video>, no Play button)", /class="hero"/.test(html) && /class="hero-plane"/.test(html) && !/hero--video/.test(html) && !/<video /.test(html) && !/hero-video-play/.test(html));
  }
/* ---------------- 1 and 6. motion allowed, both languages, four widths ---------------- */
for (const lang of ["en", "ar"]) {
  for (const [w, h] of WIDTHS) {
    const tag = `${lang.toUpperCase()} ${w}px`;
    const { samples: S, errors } = await run({ lang, width: w, height: h, reduced: false }, 6800);
    const last = S.at(-1);
    if (!last) { ok(`${tag}: page loaded and the airplane exists`, false, "no samples"); continue; }
    const vis = S.filter((s) => s.op > 0.05);
    const running = S.filter((s) => s.waapi.includes("running"));
    ok(`${tag}: the inline script ran (js-motion is set)`, S.some((s) => s.cls.includes("js-motion")), last.cls);
    ok(`${tag}: the flight starts (a running Web Animations flight was observed)`, running.length > 0, `none of ${S.length} samples had a running flight`);
    if (!running.length) continue;
    const flightMs = running.at(-1).wall - running[0].wall;
    ok(`${tag}: the flight is a visible motion, not a blink (lasts ${Math.round(flightMs)} ms)`, flightMs >= 1200, `${Math.round(flightMs)} ms`);
    const first = vis[0];
    const moved = Math.max(...vis.map((s) => Math.hypot(s.cx - last.cx, s.cy - last.cy)));
    ok(`${tag}: the plane actually travels (max ${moved.toFixed(0)} px from its parked spot)`, moved >= 12, `${moved.toFixed(1)} px`);
    ok(`${tag}: it flies in from ${lang === "en" ? "the left (reading direction: left → right)" : "the right (reading direction: right → left)"}`, lang === "en" ? first.cx < last.cx - 8 : first.cx > last.cx + 8, `starts ${first.cx.toFixed(0)}, parks ${last.cx.toFixed(0)}`);
    ok(`${tag}: it starts enlarged and settles to normal size`, matrixA(first.tr) > 1.05 && isIdentity(last.tr), `${first.tr} → ${last.tr}`);
    const segments = S.reduce((n, s, i) => n + (s.waapi.includes("running") && !(S[i - 1]?.waapi.includes("running")) ? 1 : 0), 0);
    ok(`${tag}: it flies exactly once`, segments === 1, `${segments} flights`);
    ok(`${tag}: the animation completes (finished, not paused or looping)`, last.waapi.every((x) => x === "finished") && !last.waapi.includes("running"), JSON.stringify(last.waapi));
    ok(`${tag}: it is fully visible at the end (opacity ${last.op})`, last.op === 1);
    ok(`${tag}: it stays perfectly still after landing (last second)`, still(S.filter((s) => s.wall > last.wall - 1000)));
    ok(`${tag}: it is inside the hero at the end, not clipped`, inside(planeBox(last), last.frame), JSON.stringify(planeBox(last)));
    ok(`${tag}: it stays within the hero throughout the flight`, vis.every((s) => s.cx > s.frame.l && s.cx < s.frame.r && s.cy > s.frame.t && s.cy < s.frame.b));
    const bad = vis.map((s) => ({ s, o: overlaps(s) })).filter((x) => x.o.length);
    ok(`${tag}: it never touches the headline, copy, buttons, header or menu button (${vis.length} frames)`, bad.length === 0, bad[0] ? `${bad[0].o.join("+")} at ${Math.round(bad[0].s.wall)} ms` : "");
    ok(`${tag}: html direction and image orientation are right (${last.dir}/${last.lang}, image ${last.imgTr === "none" ? "unflipped" : "mirrored"})`, lang === "en" ? last.dir === "ltr" && last.lang === "en" && last.imgTr === "none" : last.dir === "rtl" && last.lang === "ar" && /^matrix\(-1, 0, 0, 1, /.test(last.imgTr), `${last.dir} ${last.lang} ${last.imgTr}`);
    ok(`${tag}: no console errors or exceptions`, errors.length === 0, errors.slice(0, 2).join(" | "));
  }
}

/* ---------------- 2. reduced motion ---------------- */
for (const lang of ["en", "ar"]) {
  for (const [w, h] of QUICK ? [[1440, 900]] : [[1440, 900], [390, 844]]) {
    const tag = `${lang.toUpperCase()} ${w}px, reduced motion`;
    const { samples: S, errors, extra } = await run({ lang, width: w, height: h, reduced: true, extras: w >= 1000 ? tileProbe : undefined }, 3500);
    const last = S.at(-1);
    if (!last) { ok(`${tag}: page loaded`, false, "no samples"); continue; }
    ok(`${tag}: no airplane animation ever runs`, S.every((s) => s.waapi.length === 0 && s.css.every((c) => !c.endsWith(":running") || c.startsWith("plane-safety") === false)), JSON.stringify(S.find((s) => s.waapi.length)?.waapi));
    ok(`${tag}: the plane is visible from the very first sample (opacity ${S[0].op})`, S.every((s) => s.op === 1));
    ok(`${tag}: it does not move`, still(S));
    ok(`${tag}: it is parked inside the hero`, inside(planeBox(last), last.frame));
    ok(`${tag}: js-motion is not set`, !S.some((s) => s.cls.includes("js-motion")), last.cls);
    ok(`${tag}: it never touches the headline, copy, buttons, header or menu button`, S.every((s) => overlaps(s).length === 0));
    ok(`${tag}: no console errors`, errors.length === 0, errors.join(" | "));
    if (extra.tileTransform !== undefined) {
      ok(`${tag}: card hover zoom is off`, extra.tileTransform === "none", extra.tileTransform);
      ok(`${tag}: smooth scrolling is off`, extra.scroll === "auto", extra.scroll);
    }
  }
}
{
  const { extra } = await run({ lang: "en", width: 1440, height: 900, reduced: false, extras: tileProbe }, 800);
  ok("EN 1440px, motion allowed: card hover zoom works (other site motion is alive)", extra.tileTransform && extra.tileTransform !== "none", extra.tileTransform);
  ok("EN 1440px, motion allowed: smooth scrolling is on", extra.scroll === "smooth", extra.scroll);
}

/* ---------------- 3. JavaScript disabled ---------------- */
for (const lang of ["en", "ar"]) {
  const tag = `${lang.toUpperCase()} JavaScript off`;
  const { samples: S, extra } = await run({ lang, width: 1440, height: 900, reduced: false, noJs: true, extras: async (pg) => pg.evaluate(`({ h1: document.querySelectorAll('h1').length, cta: !!document.querySelector('.hero-actions a[href$="/contact"]'), nav: document.querySelectorAll('.nav-desktop a').length, imgOk: document.querySelector('.hero-plane img').complete && document.querySelector('.hero-plane img').naturalWidth > 0 })`) }, 7000);
  const last = S.at(-1);
  if (!last) { ok(`${tag}: page loaded`, false, "no samples"); continue; }
  ok(`${tag}: the airplane is visible as a static image from the first sample`, S.every((s) => s.op === 1), `opacity ${S.map((s) => s.op).join(",")}`);
  ok(`${tag}: it stays visible and still, also after the 5 s safety-net window`, last.wall > 6000 && still(S), `last sample at ${last.wall} ms; ${drift(S)}`);
  ok(`${tag}: nothing depends on the motion script (no js-motion class)`, !last.cls.includes("js-motion"), last.cls);
  ok(`${tag}: it sits inside the hero and its image loaded`, inside(planeBox(last), last.frame) && extra.imgOk);
  ok(`${tag}: the page is still usable (one h1, contact button, menu links)`, extra.h1 === 1 && extra.cta && extra.nav >= 5, JSON.stringify(extra));
}

/* ---------------- 4. the inline motion script fails ---------------- */
{
  const { samples: S, stripped } = await run({ lang: "en", width: 1440, height: 900, reduced: false, stripInline: true }, 6500);
  const last = S.at(-1);
  ok("inline script removed from the page for this test", stripped >= 1, "the harness could not find the snippet");
  ok("inline script failed: js-motion is absent", !!last && !last.cls.includes("js-motion"), last?.cls);
  ok("inline script failed: the plane still ends visible, parked and still", !!last && last.op === 1 && inside(planeBox(last), last.frame) && still(S.filter((s) => s.wall > last.wall - 1000)));
  ok("inline script failed: the plane is never left hidden for more than the flight's own start delay", (() => { let hidden = 0; for (const s of S) { if (s.op < 0.05) hidden = s.wall; else break; } return hidden < 1500; })());
}

/* ---------------- 5. all scripts blocked after the inline script ran ---------------- */
for (const lang of ["en", "ar"]) {
  const tag = `${lang.toUpperCase()} page scripts blocked`;
  const { samples: S } = await run({ lang, width: 1440, height: 900, reduced: false, blockScripts: true }, 7500);
  const last = S.at(-1);
  if (!last) { ok(`${tag}: page loaded`, false, "no samples"); continue; }
  const shownAt = S.find((s) => s.op > 0.9)?.wall;
  ok(`${tag}: the CSS safety net reveals the plane (visible at ${shownAt ?? "never"} ms)`, shownAt !== undefined && shownAt < 6500, `opacity at end ${last.op}`);
  ok(`${tag}: it is then visible and still, inside the hero, with no flight`, last.op === 1 && S.every((s) => s.waapi.length === 0) && inside(planeBox(last), last.frame) && still(S.filter((s) => s.wall > last.wall - 1000)));
}

}

/* ================================================================================================================
 * VIDEO HERO SUITE: the default homepage (no CMS hero photograph): a muted looping video over its poster.
 * ================================================================================================================ */
const VSAMPLE = `(() => {
  const v = document.querySelector('.hero-video'), poster = document.querySelector('.hero-bg'), btn = document.querySelector('.hero-video-play');
  const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const rg = document.createRange(); rg.selectNodeContents(document.querySelector('.hero-title')); const tb = rg.getBoundingClientRect();
  const frame = document.querySelector('.hero-frame'); const f = frame.getBoundingClientRect();
  const q = v && v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
  const menu = document.querySelector('.menu-toggle');
  const st = (el) => getComputedStyle(el);
  return {
    styled: f.height > 300 && !!poster && poster.getBoundingClientRect().height > 100,
    videoMode: !!document.querySelector('.hero--video'), video: !!v, paused: v ? v.paused : null, ct: v ? v.currentTime : 0, frames: q.totalVideoFrames || 0,
    controls: v ? v.controls : null, muted: v ? v.muted : null, videoDisplay: v ? st(v).display : null,
    plane: document.querySelectorAll('.hero-plane').length, fg: document.querySelectorAll('.hero-fg').length,
    heroAnims: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.hero') && a.playState === 'running').length,
    posterVisible: !!poster && st(poster).display !== 'none' && st(poster).visibility !== 'hidden' && poster.getBoundingClientRect().height > 100,
    btn: btn ? box(btn) : null, frame: { l: f.left, r: f.right, t: f.top, b: f.bottom }, title: { l: tb.left, r: tb.right, t: tb.top, b: tb.bottom },
    copy: box(document.querySelector('.hero-copy p')), actions: box(document.querySelector('.hero-actions')), header: box(document.querySelector('.site-header .header-row')),
    menu: menu && menu.offsetParent ? box(menu) : null,
    titleVisible: st(document.querySelector('.hero-title')).visibility !== 'hidden' && parseFloat(st(document.querySelector('.hero-title')).opacity) > 0.99,
    copyVisible: parseFloat(st(document.querySelector('.hero-copy')).opacity) > 0.99,
    cls: document.documentElement.className, dir: document.documentElement.dir, lang: document.documentElement.lang,
  };
})()`;

const buttonOverlaps = (s) => !s.btn ? [] : [hit(s.btn, s.title) && "headline", hit(s.btn, s.copy) && "copy", hit(s.btn, s.actions) && "buttons", hit(s.btn, s.header) && "header", s.menu && hit(s.btn, s.menu) && "menu button"].filter(Boolean);
const framesGrow = (a, b) => !!a && !!b && b.frames > a.frames + 30 && b.paused === false;

/** Taps the Play button (touch on phones, mouse on desktop) and reports the state before, then twice after. */
const tapPlay = (width) => async (pg) => {
  const before = await pg.evaluate(VSAMPLE);
  if (!before.btn) return { before };
  await pg.tap((before.btn.l + before.btn.r) / 2, (before.btn.t + before.btn.b) / 2, width < 768);
  await sleep(2500);
  const a = await pg.evaluate(VSAMPLE);
  await sleep(1400);
  const b = await pg.evaluate(VSAMPLE);
  return { before, a, b };
};

async function videoSuite() {
  console.log("\n== Video hero (the default homepage) ==");
  const html = await (await fetch(`${BASE}/en`)).text();
  ok("the homepage serves the video hero: hero--video, a <video>, no airplane and no foreground cut-out", /class="hero hero--video"/.test(html) && /<video /.test(html) && !/class="hero-plane"/.test(html) && !/class="hero-fg"/.test(html));

  for (const lang of ["en", "ar"]) {
    for (const [w, h] of WIDTHS) {
      const tag = `${lang.toUpperCase()} ${w}px, motion allowed`;
      const { samples: S, errors } = await run({ lang, width: w, height: h, reduced: false, sampler: VSAMPLE }, 5200);
      const last = S.at(-1);
      if (!last) { ok(`${tag}: page loaded`, false, "no samples"); continue; }
      ok(`${tag}: video hero (a <video> over its poster); no airplane, foreground or hero animation exists`, S.every((s) => s.videoMode && s.video && s.plane === 0 && s.fg === 0) && S.every((s) => s.heroAnims === 0), JSON.stringify({ mode: last.videoMode, plane: last.plane, fg: last.fg, anims: Math.max(...S.map((s) => s.heroAnims)) }));
      ok(`${tag}: the video really plays (decoded frames ${S[0].frames}→${last.frames})`, framesGrow(S[0], last), JSON.stringify({ a: S[0].frames, b: last.frames, paused: last.paused }));
      ok(`${tag}: it is muted`, last.muted === true);
      ok(`${tag}: once frames advance the Play button and native controls are gone`, last.btn === null && last.controls === false, JSON.stringify({ btn: !!last.btn, controls: last.controls }));
      ok(`${tag}: the poster stays in the page as the fallback layer`, last.posterVisible);
      const withBtn = S.filter((s) => s.btn);
      const rtl = lang === "ar";
      ok(`${tag}: while the Play button shows, it is inside the hero on the ${rtl ? "left (inline-end in RTL)" : "right (inline-end in LTR)"} and never touches the headline, copy, buttons, header or menu`, withBtn.every((s) => { const cx = (s.btn.l + s.btn.r) / 2, mid = (s.frame.l + s.frame.r) / 2; return s.btn.l >= s.frame.l && s.btn.r <= s.frame.r && (rtl ? cx < mid : cx > mid) && buttonOverlaps(s).length === 0; }), withBtn.map((s) => buttonOverlaps(s).join("+")).find(Boolean) || "placement");
      ok(`${tag}: html direction and language are right (${last.dir}/${last.lang})`, rtl ? last.dir === "rtl" && last.lang === "ar" : last.dir === "ltr" && last.lang === "en");
      ok(`${tag}: headline and copy are visible (never hidden while the video loads)`, S.every((s) => s.titleVisible && s.copyVisible));
      ok(`${tag}: no console errors or exceptions`, errors.length === 0, errors.slice(0, 2).join(" | "));
    }
  }

  for (const lang of ["en", "ar"]) {
    for (const [w, h] of QUICK ? [[390, 844]] : [[1440, 900], [390, 844]]) {
      const tag = `${lang.toUpperCase()} ${w}px, reduced motion`;
      const { samples: S, errors, extra } = await run({ lang, width: w, height: h, reduced: true, sampler: VSAMPLE, extras: tapPlay(w) }, 3500);
      const last = S.at(-1);
      if (!last) { ok(`${tag}: page loaded`, false, "no samples"); continue; }
      ok(`${tag}: no autoplay: the video stays paused at 0 with no frames decoded, and no hero animation runs`, S.every((s) => s.paused === true && s.ct === 0 && s.frames < 20 && s.heroAnims === 0), JSON.stringify({ paused: last.paused, ct: last.ct, frames: last.frames }));
      ok(`${tag}: the poster and a visible Play button are shown from the first frame`, S.every((s) => s.posterVisible && !!s.btn));
      ok(`${tag}: the Play button is inside the hero and clear of headline, copy, buttons, header and menu`, S.every((s) => s.btn && s.btn.l >= s.frame.l && s.btn.r <= s.frame.r && buttonOverlaps(s).length === 0));
      ok(`${tag}: the visitor's own tap starts real frames (${extra.a?.frames}→${extra.b?.frames}) and hides the button`, framesGrow(extra.a, extra.b) && extra.b.btn === null, JSON.stringify({ a: extra.a?.frames, b: extra.b?.frames, btn: !!extra.b?.btn }));
      ok(`${tag}: no console errors`, errors.length === 0, errors.join(" | "));
    }
  }

  for (const lang of ["en", "ar"]) {
    const tag = `${lang.toUpperCase()} JavaScript off`;
    const { samples: S } = await run({ lang, width: 1440, height: 900, reduced: false, noJs: true, sampler: VSAMPLE }, 3500);
    const last = S.at(-1);
    if (!last) { ok(`${tag}: page loaded`, false, "no samples"); continue; }
    ok(`${tag}: poster shown; the <video> has native controls so it can still be started; nothing is hidden`, last.posterVisible && last.video && last.controls === true && last.videoDisplay !== "none" && last.titleVisible && last.copyVisible && last.plane === 0, JSON.stringify({ controls: last.controls, poster: last.posterVisible }));
  }
  {
    const { samples: S } = await run({ lang: "en", width: 1440, height: 900, reduced: false, stripInline: true, sampler: VSAMPLE }, 5000);
    const last = S.at(-1);
    ok("the inline motion script removed: the video hero still plays (it does not depend on it)", !!last && !last.cls.includes("js-motion") && framesGrow(S[0], last), JSON.stringify({ cls: last?.cls, frames: last?.frames }));
  }
  for (const lang of ["en", "ar"]) {
    const { samples: S } = await run({ lang, width: 390, height: 844, reduced: false, blockScripts: true, sampler: VSAMPLE }, 4000);
    const last = S.at(-1);
    ok(`${lang.toUpperCase()} page scripts blocked: poster, native controls, headline and copy stay visible; nothing is left hidden`, !!last && last.posterVisible && last.controls === true && last.titleVisible && last.copyVisible && last.videoDisplay !== "none" && last.paused === true, JSON.stringify(last && { poster: last.posterVisible, controls: last.controls, title: last.titleVisible }));
  }
  {
    const on = await run({ lang: "en", width: 1440, height: 900, reduced: false, sampler: VSAMPLE, extras: tileProbe }, 800);
    ok("motion allowed: card hover zoom works and smooth scrolling is on (other site motion is alive)", !!on.extra.tileTransform && on.extra.tileTransform !== "none" && on.extra.scroll === "smooth", JSON.stringify(on.extra));
    const off = await run({ lang: "en", width: 1440, height: 900, reduced: true, sampler: VSAMPLE, extras: tileProbe }, 800);
    ok("reduced motion: card hover zoom and smooth scrolling are off", off.extra.tileTransform === "none" && off.extra.scroll === "auto", JSON.stringify(off.extra));
  }
}

/* ================================================================================================================
 * Which suites run. Switching the hero between video and photograph needs the CMS, so it needs ADMIN_EMAIL and
 * ADMIN_PASSWORD of a LOCAL/ISOLATED TEST site. Without them only the suite matching the site's current hero runs,
 * and the other one is reported as not run (never as passed).
 * ================================================================================================================ */
const heroMode = async () => (/class="hero hero--video"/.test(await (await fetch(`${BASE}/en?mode=${Date.now()}`)).text()) ? "video" : "photo");
const useCms = !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
const notRun = [];
let cmsApi = null, snapshot = null;
try {
  if (useCms) {
    const { connect } = await import("./lib-cms.mjs");
    cmsApi = await connect(BASE, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    snapshot = await cmsApi.snapshotHome();
    console.log("Test hero modes: signed in; the hero will be switched between video and photograph and restored afterwards.");
    ok("switched the test site to the VIDEO hero (no CMS photograph)", (await cmsApi.setHero(snapshot, {})) && (await heroMode()) === "video");
    if ((await heroMode()) === "video") await videoSuite();
    const bg = await cmsApi.uploadImage("public/photos/coast-1600.webp", { altEn: "Test photograph", altAr: "صورة اختبار" });
    ok("switched the test site to the PHOTO hero (a CMS hero photograph, which brings back the airplane)", (await cmsApi.setHero(snapshot, { backdrop: bg })) && (await heroMode()) === "photo");
    if ((await heroMode()) === "photo") await photoSuite();
  } else {
    const mode = await heroMode();
    console.log(`The site is currently showing the ${mode.toUpperCase()} hero.`);
    if (mode === "video") { await videoSuite(); notRun.push("aircraft/photo hero (needs a CMS hero photograph; set ADMIN_EMAIL and ADMIN_PASSWORD for an isolated test site)"); }
    else { await photoSuite(); notRun.push("video hero (the site has a CMS hero photograph; set ADMIN_EMAIL and ADMIN_PASSWORD for an isolated test site to switch modes)"); }
  }
} finally {
  if (cmsApi) await cmsApi.restore(snapshot);
}
if (useCms) ok("the test site's original Home settings were restored and the test media removed", (await heroMode()) === (snapshot.data.hero?.backdrop ? "photo" : "video"));

console.log(`\n${pass} passed, ${fail} failed`);
for (const n of notRun) console.log(`NOT RUN  ${n}. This is NOT a pass.`);
process.exit(fail ? 1 : 0);
