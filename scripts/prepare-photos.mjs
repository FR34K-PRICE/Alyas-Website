/**
 * Turns the original photographs into web-ready assets in public/photos and writes
 * src/site/photo-manifest.json (sizes for stable layout). Run after adding or replacing originals:
 *
 *   PHOTO_SRC=path/to/originals npm run prepare-photos
 *
 * Originals are Unsplash downloads named hero.jpg, coast.jpg, ... (see docs/IMAGE-CREDITS.md).
 * The hero foreground and the aircraft are cut out per pixel here, not with a polygon.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { heroForegroundMask, loadRGB } from "./lib-mask.mjs";
import { cutoutAircraftSky, removeMarks } from "./lib-sky.mjs";
import { softenShoreGlint } from "./lib-glint.mjs";

const SRC = process.env.PHOTO_SRC || path.resolve("assets/source");
const OUT = path.resolve("public/photos");
fs.mkdirSync(OUT, { recursive: true });

const manifest = {};
const webp = (q = 78) => ({ quality: q, effort: 5 });
// A brighter, more open grade for the hero (applied identically to the photo and its foreground cut-out).
const heroGrade = (img) => img.modulate({ brightness: 1.14, saturation: 1.0 }).linear(0.96, 28);

// The hero photograph with the over-bright far-shore ribbon softened (see lib-glint.mjs).
const heroSoft = await softenShoreGlint(path.join(SRC, "hero.jpg"));
const heroSharp = () => sharp(heroSoft.data, { raw: { width: heroSoft.width, height: heroSoft.height, channels: 3 } });

const PLAN = {
  hero: [1280, 1920, 2560],
  coast: [640, 1100, 1600],
  hiker: [640, 1100, 1600],
  road: [800, 1400, 2000],
  window: [640, 1100, 1600],
  city: [800, 1400, 2000],
  flowers: [640, 1100, 1600],
};

for (const [name, widths] of Object.entries(PLAN)) {
  const file = path.join(SRC, `${name}.jpg`);
  const meta = await sharp(file).metadata();
  const source = () => (name === "hero" ? heroSharp() : sharp(file).rotate());
  for (const w of widths) {
    const img = source().resize({ width: Math.min(w, meta.width) });
    await (name === "hero" ? heroGrade(img) : img).webp(webp(name === "hero" ? 80 : 76)).toFile(path.join(OUT, `${name}-${w}.webp`));
  }
  manifest[name] = { width: meta.width, height: meta.height, widths: widths.map((w) => Math.min(w, meta.width)) };
  console.log("photo", name, widths.join(","));
}

// Hero foreground: same framing as the hero photo, transparent above the shore.
{
  const file = path.join(SRC, "hero.jpg");
  const { data, w, h } = await loadRGB(file, 1600);
  const alpha = heroForegroundMask(data, w, h);
  // A flat, pale wedge of lake haze sits above the rocks at the right; it is not shore. Clear it (keep grass blades).
  // The cleared area is feathered on every side so no straight edge is left behind.
  const ramp = (v, a, b) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = Math.floor(h * 0.74); y < Math.floor(h * 0.81); y++) {
    for (let x = Math.floor(w * 0.77); x < Math.floor(w * 0.92); x++) {
      const i = y * w + x;
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      if (g >= b - 8 && g >= r) continue; // grass stays
      const wx = ramp(x / w, 0.77, 0.80) * (1 - ramp(x / w, 0.89, 0.92));
      const wy = 1 - ramp(y / h, 0.765, 0.805);
      alpha[i] = Math.round(alpha[i] * (1 - wx * wy));
    }
  }
  const alphaImg = await sharp(Buffer.from(alpha), { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  for (const width of PLAN.hero) {
    const rgb = await heroGrade(heroSharp().resize({ width })).removeAlpha().png().toBuffer();
    const a = await sharp(alphaImg).resize({ width, kernel: "lanczos3" }).blur(1.0).greyscale().toBuffer();
    await sharp(rgb).joinChannel(a).webp({ quality: 82, alphaQuality: 95, effort: 5 }).toFile(path.join(OUT, `hero-fg-${width}.webp`));
  }
  console.log("hero foreground", PLAN.hero.join(","));
}

// Aircraft: cut out of a clear-sky photograph by modelling the sky and keeping what differs from it; airline
// titling, registrations and the tail logo are painted out; the image is mirrored so the nose points right.
{
  const { rgba, width, height } = await cutoutAircraftSky(path.join(SRC, "aircraft.jpg"), { win: [0.38, 0.38, 0.63, 0.62], excl: [0.405, 0.41, 0.605, 0.59], width: 4900, close: 3 });
  removeMarks(rgba, width, height, [
    { rect: [108, 120, 306, 196], mode: "dark", delta: 22, grow: 3 }, // titling and forward cheat line
    { rect: [440, 214, 648, 320], mode: "dark", delta: 22, grow: 3 }, // rear cheat line and registration
    { rect: [655, 238, 722, 292], mode: "light", delta: 16, grow: 3 }, // tail logo
    { rect: [430, 88, 502, 142], mode: "dark", delta: 14, grow: 2 }, // registration on the wing
  ]);
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await sharp(png).flop().resize({ width: 720 }).webp({ quality: 90, alphaQuality: 95, effort: 6 }).toFile(path.join(OUT, "aircraft.webp"));
  const m = await sharp(path.join(OUT, "aircraft.webp")).metadata();
  manifest.aircraft = { width: m.width, height: m.height, widths: [m.width] };
  console.log("aircraft", m.width, m.height);
}

fs.writeFileSync(path.resolve("src/site/photo-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("manifest written");
