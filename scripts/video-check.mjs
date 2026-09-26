/**
 * Checks the homepage hero video: the file, how it is served, and (in a real browser) that video FRAMES actually
 * advance, not merely that play() resolved.
 *
 *   BASE_URL=http://localhost:3000 npm run check:video
 *   LAN_URL=http://192.168.0.107:3000 ...   (optional: also load the page through another origin, e.g. a phone's view)
 *
 * Read-only: it only loads pages and files, so it is safe against any server. Needs Chrome or Edge (CHROME_PATH);
 * without one the browser part is skipped and the run exits with code 3 (never a silent pass).
 *
 * What is real and what is simulated (a desktop browser cannot reproduce an iPhone's Low Power Mode):
 *  - REAL: the MP4 structure, the HTTP responses (200 / 206 byte ranges), hydration, autoplay in a phone-sized
 *    touch viewport, reduced motion, Data Saver (navigator.connection.saveData), decoded frame counts, canvas pixels,
 *    real touch taps, a failed video request, an unsupported codec, JavaScript disabled.
 *  - SIMULATED, and labelled so: a browser that refuses autoplay (play() rejects NotAllowedError until the visitor
 *    touches the page) and a browser whose play() resolves but never shows a frame.
 * It does NOT replace testing on real iPhones and Androids; see the README.
 */
import fs from "node:fs";
import { startBrowser, sleep } from "./lib-cdp.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const LAN = (process.env.LAN_URL || "").replace(/\/$/, "");
const VIDEO = "public/video/alyas-cloud-flight.mp4";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  ${extra}`}`);
};

/* ---------------- 1. the file ---------------- */
const buf = fs.readFileSync(VIDEO);
const u32 = (o) => buf.readUInt32BE(o);
const cc = (o) => buf.toString("latin1", o, o + 4);
function boxes(start, end) {
  const out = [];
  for (let o = start; o + 8 <= end;) {
    let size = u32(o), hdr = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); hdr = 16; } else if (size === 0) size = end - o;
    if (size < 8) break;
    out.push({ type: cc(o + 4), start: o, body: o + hdr, end: o + size });
    o += size;
  }
  return out;
}
const top = boxes(0, buf.length);
const moov = top.find((b) => b.type === "moov");
const tracks = boxes(moov.body, moov.end).filter((b) => b.type === "trak").map((t) => {
  const mdia = boxes(t.body, t.end).find((b) => b.type === "mdia");
  const mk = boxes(mdia.body, mdia.end);
  const handler = cc(mk.find((b) => b.type === "hdlr").body + 8);
  const minf = mk.find((b) => b.type === "minf");
  const stbl = boxes(minf.body, minf.end).find((b) => b.type === "stbl");
  const stsd = boxes(stbl.body, stbl.end).find((b) => b.type === "stsd");
  const entry = stsd.body + 8;
  let avc = null;
  if (handler === "vide") {
    const avcC = boxes(entry + 86, entry + u32(entry)).find((b) => b.type === "avcC");
    if (avcC) avc = { profile: buf[avcC.body + 1], level: buf[avcC.body + 3] };
  }
  return { handler, codec: cc(entry + 4), avc, w: buf.readUInt16BE(entry + 32), h: buf.readUInt16BE(entry + 34) };
});
console.log(`Target: ${BASE}${LAN ? `  (and ${LAN})` : ""}\nFile: ${VIDEO} (${(buf.length / 1e6).toFixed(2)} MB)\n`);
ok("video is fast-start (moov before mdat), so it can stream with byte ranges", top.findIndex((b) => b.type === "moov") < top.findIndex((b) => b.type === "mdat"));
ok("the website copy has NO audio track (silent background video)", !tracks.some((t) => t.handler === "soun"), JSON.stringify(tracks.map((t) => t.handler)));
ok("exactly one track, and it is H.264 (avc1)", tracks.length === 1 && tracks[0].codec === "avc1", JSON.stringify(tracks));
ok("H.264 profile is Baseline/Main/High and level ≤ 4.2 (decodes in hardware on phones)", [66, 77, 100].includes(tracks[0].avc?.profile) && tracks[0].avc.level <= 42, JSON.stringify(tracks[0].avc));
ok("frame size is 1280×720 or smaller", tracks[0].w <= 1280 && tracks[0].h <= 720, `${tracks[0].w}x${tracks[0].h}`);

const url = `${BASE}/video/alyas-cloud-flight.mp4`;
const full = await fetch(url, { method: "HEAD" });
ok("server answers the video with 200 and video/mp4", full.status === 200 && /^video\/mp4/.test(full.headers.get("content-type") || ""), `${full.status} ${full.headers.get("content-type")}`);
ok("server advertises byte ranges (Accept-Ranges: bytes)", /bytes/i.test(full.headers.get("accept-ranges") || ""));
const r0 = await fetch(url, { headers: { range: "bytes=0-1" } });
ok("a Range request (as iPhone Safari sends first) gets 206 Partial Content with a correct Content-Range", r0.status === 206 && new RegExp(`^bytes 0-1/${buf.length}$`).test(r0.headers.get("content-range") || ""), `${r0.status} ${r0.headers.get("content-range")}`);
const rm = await fetch(url, { headers: { range: `bytes=${buf.length - 500}-` } });
const rmBody = Buffer.from(await rm.arrayBuffer());
ok("an open-ended range near the end returns exactly those bytes", rm.status === 206 && rmBody.equals(buf.subarray(buf.length - 500)), `${rm.status} ${rmBody.length}`);
const poster = await fetch(`${BASE}/video/alyas-cloud-flight-poster.webp`, { method: "HEAD" });
ok("the poster image is served (fallback picture)", poster.status === 200 && /image\/webp/.test(poster.headers.get("content-type") || ""));

/* ---------------- 2. the browser ---------------- */
const browser = await startBrowser([`--autoplay-policy=document-user-activation-required`]);
if (!browser) {
  console.log("\nSKIP  browser checks not run: no Chrome/Edge found or no WebSocket support (set CHROME_PATH). This is NOT a pass.");
  console.log(`\n${pass} passed, ${fail} failed (browser part skipped)`);
  process.exit(process.env.VIDEO_CHECK_SKIP_OK === "1" ? (fail ? 1 : 0) : 3);
}

const STATE = `(() => {
  const v = document.querySelector('.hero-video');
  const poster = document.querySelector('.hero-bg');
  const btn = document.querySelector('.hero-video-play');
  const r = btn && btn.getBoundingClientRect();
  const f = document.querySelector('.hero-frame').getBoundingClientRect();
  const rect = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const q = v && v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
  let px = null;
  if (v) { try { const c = document.createElement('canvas'); c.width = 48; c.height = 27; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * 3 + d[i + 1] * 5 + d[i + 2]; px = s; } catch (e) { px = null; } }
  const hydrated = Object.keys(document.querySelector('.menu-toggle') || document.querySelector('.hero-actions a') || {}).some((k) => k.startsWith('__react'));
  return {
    hydrated, hasVideo: !!v, paused: v ? v.paused : null, t: v ? v.currentTime : 0, rs: v ? v.readyState : 0, muted: v ? v.muted : null, frames: q.totalVideoFrames || 0,
    controls: v ? v.controls : null, posterAttr: v ? v.getAttribute('poster') : null, posterVisible: !!poster && getComputedStyle(poster).display !== 'none',
    button: btn ? { x: r.left + r.width / 2, y: r.top + r.height / 2, box: { l: r.left, r: r.right, t: r.top, b: r.bottom } } : null,
    label: btn ? btn.textContent.trim() : null, dir: document.documentElement.dir, lang: document.documentElement.lang, frame: { l: f.left, r: f.right, t: f.top, b: f.bottom },
    title: rect(document.querySelector('.hero-title')), copy: rect(document.querySelector('.hero-copy')), pixelSum: px,
    debug: document.querySelector('.hero-video-debug') ? document.querySelector('.hero-video-debug').textContent : null,
  };
})()`;

/** Frames are advancing when the decoded-frame counter grows and the picture changes (loop-safe). */
const playing = (a, b) => !!a && !!b && b.frames > a.frames + 20 && !b.paused && (a.pixelSum === null || b.pixelSum === null || a.pixelSum !== b.pixelSum);

async function open({ base = BASE, lang, width = 390, height = 844, reduced = false, saveData = false, refuseAutoplay = false, resolveNoFrames = false, blockVideo = false, noJs = false, noCodec = false, debug = false }) {
  const pg = await browser.newPage();
  const errors = [];
  pg.on("Runtime.exceptionThrown", (e) => errors.push((e.exceptionDetails?.exception?.description || e.exceptionDetails?.text || "").split("\n")[0].slice(0, 140)));
  await pg.send("Runtime.enable");
  await pg.send("Page.enable");
  const phone = width < 768;
  await pg.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
  if (phone) await pg.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await pg.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
  let src = "";
  if (saveData) src += `Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g',addEventListener(){},removeEventListener(){}},configurable:true});`;
  if (refuseAutoplay) src += `(() => { Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', { configurable: true, get() { return false; }, set() {} }); const p = HTMLMediaElement.prototype.play; let activated = false; ['touchstart','touchend','pointerdown','mousedown','click','keydown'].forEach((e) => addEventListener(e, () => { activated = true; }, true)); HTMLMediaElement.prototype.play = function () { if (!activated) return Promise.reject(new DOMException('The request is not allowed by the user agent or the platform in the current context (simulated).', 'NotAllowedError')); return p.apply(this, arguments); }; })();`;
  if (resolveNoFrames) src += `Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', { configurable: true, get() { return false; }, set() {} });HTMLMediaElement.prototype.play = function () { setTimeout(() => this.dispatchEvent(new Event('playing')), 60); return Promise.resolve(); };`;
  if (noCodec) src += `HTMLMediaElement.prototype.canPlayType = function () { return ''; };`;
  if (src) await pg.send("Page.addScriptToEvaluateOnNewDocument", { source: src });
  if (noJs) await pg.send("Emulation.setScriptExecutionDisabled", { value: true });
  if (blockVideo) {
    await pg.send("Fetch.enable", { patterns: [{ urlPattern: "*.mp4", requestStage: "Request" }] });
    pg.on("Fetch.requestPaused", (e) => pg.send("Fetch.failRequest", { requestId: e.requestId, errorReason: "Failed" }).catch(() => {}));
  }
  await pg.send("Page.navigate", { url: `${base}/${lang}?video-check=${Date.now()}${debug ? "&videodebug=1" : ""}` });
  return { pg, errors, state: () => pg.evaluate(STATE) };
}
const overlapsHero = (s) => s.button && [s.title, s.copy].some((r) => s.button.box.l < r.r && s.button.box.r > r.l && s.button.box.t < r.b && s.button.box.b > r.t);

for (const [lang, w, h, tag] of [["en", 390, 844, "EN phone"], ["ar", 390, 844, "AR phone"], ["en", 1440, 900, "EN desktop"], ["ar", 1440, 900, "AR desktop"]]) {
  /* normal: autoplay permitted */
  {
    const { pg, errors, state } = await open({ lang, width: w, height: h });
    await sleep(4500);
    const a = await state(); await sleep(1400); const b = await state();
    ok(`${tag}: page hydrated and the video element exists`, a.hydrated && a.hasVideo, JSON.stringify({ h: a.hydrated }));
    ok(`${tag}: autoplay works: real frames are advancing (${a.frames}→${b.frames} decoded, picture changing)`, playing(a, b), JSON.stringify({ a: [a.frames, a.paused], b: [b.frames, b.paused] }));
    ok(`${tag}: the video is muted`, b.muted === true);
    ok(`${tag}: once playing, the Play button and native controls are gone`, !b.button && b.controls === false, JSON.stringify({ button: !!b.button, controls: b.controls }));
    ok(`${tag}: the poster image stays in the page as the fallback layer`, b.posterVisible && !!b.posterAttr);
    ok(`${tag}: no script errors`, errors.length === 0, errors.join(" | "));
    await pg.close();
  }
}

for (const [lang, tag] of [["en", "EN"], ["ar", "AR"]]) {
  for (const [why, opts] of [["reduced motion", { reduced: true }], ["Data Saver", { saveData: true }]]) {
    const { pg, errors, state } = await open({ lang, ...opts });
    await sleep(3500);
    const a = await state();
    ok(`${tag} phone, ${why}: no autoplay (paused at 0, nothing downloaded, 0 frames)`, a.paused === true && a.t === 0 && a.frames === 0 && a.rs === 0, JSON.stringify({ paused: a.paused, t: a.t, frames: a.frames, rs: a.rs }));
    ok(`${tag} phone, ${why}: poster and a visible Play button are shown${lang === "ar" ? " (Arabic label)" : ""}`, a.posterVisible && !!a.button && (lang === "ar" ? /تشغيل/.test(a.label) : /Play video/.test(a.label)), JSON.stringify({ btn: !!a.button, label: a.label }));
    ok(`${tag} phone, ${why}: the Play button sits inside the hero, clear of headline and copy`, !!a.button && !overlapsHero(a) && a.button.box.l >= a.frame.l && a.button.box.r <= a.frame.r);
    if (!a.button) { ok(`${tag} phone, ${why}: the Play button is there to tap`, false, "no Play button"); await pg.close(); continue; }
    await pg.tap(a.button.x, a.button.y, true);
    await sleep(2500);
    const b = await state(); await sleep(1300); const c = await state();
    ok(`${tag} phone, ${why}: a real touch tap on Play starts real frames (${b.frames}→${c.frames})`, playing(b, c), JSON.stringify({ b: [b.frames, b.paused], c: [c.frames, c.paused] }));
    ok(`${tag} phone, ${why}: after playing, the button is gone and the video is muted`, !c.button && c.muted === true);
    ok(`${tag} phone, ${why}: no script errors`, errors.length === 0, errors.join(" | "));
    await pg.close();
  }
}

/* autoplay refused by the browser (SIMULATED) */
for (const [lang, tag] of [["en", "EN"], ["ar", "AR"]]) {
  const { pg, errors, state } = await open({ lang, refuseAutoplay: true, debug: true });
  await sleep(4000);
  const a = await state();
  ok(`${tag} phone, autoplay refused (simulated NotAllowedError): video stays paused, poster and a visible Play button remain`, a.paused === true && a.frames < 20 && a.posterVisible && !!a.button, JSON.stringify({ paused: a.paused, frames: a.frames, btn: !!a.button }));
  ok(`${tag} phone, autoplay refused: the refusal is reported in the diagnostics overlay (?videodebug=1)`, /REJECTED NotAllowedError/.test(a.debug || ""), (a.debug || "").slice(-200));
  if (!a.button) { ok(`${tag} phone, autoplay refused: the Play button is there to tap`, false, "no Play button"); await pg.close(); continue; }
  await pg.tap(a.button.x, a.button.y, true);
  await sleep(2500);
  const b = await state(); await sleep(1300); const c = await state();
  ok(`${tag} phone, autoplay refused: tapping Play (a user action) starts real frames (${b.frames}→${c.frames})`, playing(b, c), JSON.stringify({ b: [b.frames, b.paused], c: [c.frames, c.paused] }));
  ok(`${tag} phone, autoplay refused: no script errors`, errors.length === 0, errors.join(" | "));
  await pg.close();
}

/* play() resolves but no frame is ever shown (SIMULATED) */
{
  const { pg, state } = await open({ lang: "en", resolveNoFrames: true });
  await sleep(5500);
  const a = await state();
  ok("play() resolves and the playing event fires but no frame ever advances (simulated): the Play button and poster stay and native controls appear", !!a.button && a.posterVisible && a.controls === true && a.frames < 20 && a.paused === true, JSON.stringify({ btn: !!a.button, controls: a.controls, frames: a.frames }));
  await pg.close();
}

/* the video request fails */
{
  const { pg, errors, state } = await open({ lang: "en", blockVideo: true, reduced: true });
  await sleep(2500);
  const a = await state();
  if (a.button) { await pg.tap(a.button.x, a.button.y, true); await sleep(2500); }
  const b = await state();
  ok("video request fails: the poster stays, a Play button remains and the page does not crash", b.posterVisible && !!b.button && errors.length === 0, JSON.stringify({ btn: !!b.button, errors }));
  await pg.close();
}

/* the codec cannot be played */
{
  const { pg, errors, state } = await open({ lang: "en", noCodec: true });
  await sleep(3500);
  const a = await state();
  ok("browser cannot play the codec (simulated): poster only, no dead Play button, no video element, no errors", !a.hasVideo && !a.button && a.posterVisible && errors.length === 0, JSON.stringify({ video: a.hasVideo, btn: !!a.button }));
  await pg.close();
}

/* JavaScript disabled */
{
  const { pg, state } = await open({ lang: "en", noJs: true });
  await sleep(3000);
  const a = await state();
  ok("JavaScript disabled: the poster shows and the video has native controls so it can still be started", a.hasVideo && a.controls === true && !!a.posterAttr && a.posterVisible, JSON.stringify({ controls: a.controls }));
  await pg.close();
}

/* another origin (e.g. a phone loading the dev server through the computer's LAN address) */
if (LAN) {
  const { pg, errors, state } = await open({ base: LAN, lang: "en" });
  await sleep(5000);
  const a = await state(); await sleep(1400); const b = await state();
  ok(`loaded through ${LAN}: the page hydrates (a blocked dev origin would leave it un-hydrated and autoplay dead)`, a.hydrated, "not hydrated; in development add the address to allowedDevOrigins in next.config.ts");
  ok(`loaded through ${LAN}: autoplay works with real frames (${a.frames}→${b.frames})`, playing(a, b));
  ok(`loaded through ${LAN}: no script errors`, errors.length === 0, errors.join(" | "));
  await pg.close();
}

browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
