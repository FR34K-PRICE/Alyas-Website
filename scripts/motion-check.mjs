/**
 * Behavioural check of the homepage motion, in a real browser.
 *
 *   BASE_URL=http://localhost:3000 npm run check:motion
 *
 * It needs no admin login, no database access and no extra npm package: it starts Chrome or Edge headless and
 * drives it through the Chrome DevTools Protocol (Node's built-in WebSocket). Set CHROME_PATH if it cannot find a
 * browser. If no browser is available the check says so and exits with code 3 (MOTION_CHECK_SKIP_OK=1 makes that
 * exit 0), so a missing browser is never mistaken for a pass.
 *
 * What it proves, by measuring the page while it runs (not by searching the source for a class name):
 *  1. Motion allowed: the inline script sets `js-motion`, the airplane is hidden only until its one flight starts,
 *     then flies once from behind its parked spot (from the left in English, from the right in Arabic), finishes,
 *     stays visible and perfectly still inside the hero, never touching the headline, copy, buttons, header or
 *     menu button at any moment, and the page logs no errors. Checked at desktop, tablet, phone and narrow phone.
 *  2. Reduced motion: no airplane animation ever runs, the plane is visible from the first sample and does not
 *     move, hover zoom and smooth scrolling are off.
 *  3. JavaScript disabled: the plane is a visible static image (no `js-motion`), and the page's links are there.
 *  4. The inline motion script fails (removed from the page): the plane still ends visible and still.
 *  5. All page scripts blocked after the inline script ran: the plane is revealed by the CSS safety net and is
 *     visible and still afterwards.
 *  6. English is LTR and Arabic RTL with the aircraft image mirrored to face its reading direction.
 * It only reads pages, so it is safe to run against any server, including one backed by a real database.
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
  const close = async () => { try { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch {} };
  return { send, on, evaluate, close };
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
  if (opts.stripInline || opts.blockScripts) {
    const patterns = [];
    if (opts.stripInline) patterns.push({ urlPattern: `${BASE}/*`, resourceType: "Document", requestStage: "Response" });
    if (opts.blockScripts) patterns.push({ urlPattern: "*", resourceType: "Script", requestStage: "Request" });
    await pg.send("Fetch.enable", { patterns });
    pg.on("Fetch.requestPaused", async (e) => {
      try {
        if (opts.blockScripts && e.resourceType === "Script") return await pg.send("Fetch.failRequest", { requestId: e.requestId, errorReason: "BlockedByClient" });
        if (opts.stripInline && e.resourceType === "Document" && e.responseStatusCode) {
          const b = await pg.send("Fetch.getResponseBody", { requestId: e.requestId });
          let html = b.base64Encoded ? Buffer.from(b.body, "base64").toString("utf8") : b.body;
          const before = html.length;
          html = html.replace(/<script>try\{if\(!matchMedia\([^<]*<\/script>/, "");
          if (html.length !== before) stripped++;
          const headers = (e.responseHeaders || []).filter((h) => !/^(content-encoding|content-length|transfer-encoding)$/i.test(h.name));
          return await pg.send("Fetch.fulfillRequest", { requestId: e.requestId, responseCode: e.responseStatusCode, responseHeaders: headers, body: Buffer.from(html, "utf8").toString("base64") });
        }
        await pg.send("Fetch.continueRequest", { requestId: e.requestId });
      } catch { /* request may already be gone */ }
    });
  }
  await pg.send("Page.navigate", { url: `${BASE}/${opts.lang}?motion-check=${Date.now()}` });
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const s = await pg.evaluate(SAMPLE); if (s && s.styled) samples.push({ ...s, wall: Date.now() - start }); } catch { /* page still loading */ }
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

/* ---------------- 1 and 6. motion allowed, both languages, four widths ---------------- */
const WIDTHS = QUICK ? [[1440, 900], [340, 700]] : [[1440, 900], [820, 1180], [390, 844], [340, 700]];
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
const tileProbe = async (pg) => {
  await pg.evaluate(`document.querySelector('.tile')?.scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await sleep(300);
  const c = await pg.evaluate(`(() => { const b = document.querySelector('.tile').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await pg.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y });
  await sleep(1300);
  return pg.evaluate(`({ tileTransform: getComputedStyle(document.querySelector('.tile-photo img')).transform, scroll: getComputedStyle(document.documentElement).scrollBehavior })`);
};
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
