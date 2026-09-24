import sharp from "sharp";

/**
 * The far shoreline of the hero lake carries a narrow, very bright ribbon of water. Brightening the whole
 * photograph turns it into a hard turquoise line across the landscape. This keeps the shoreline step (dark forest
 * above, lighter water below) and removes only the excess brightness of the ribbon, column by column, so the rest
 * of the image is untouched.
 *
 * Returns { data, width, height } (RGB, 3 channels) of the full-resolution image, orientation applied.
 */
export async function softenShoreGlint(file, { band = [0.53, 0.58], half = 26, strength = 0.85 } = {}) {
  const { data, info } = await sharp(file).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const lum = (i) => data[i * 3 + 1];
  const y0 = Math.floor(h * band[0]);
  const y1 = Math.floor(h * band[1]);

  // Peak row per 16px block of columns, then interpolated across x so the corrected line stays smooth.
  const BLOCK = 16;
  const nb = Math.ceil(w / BLOCK);
  const peaks = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    const xa = b * BLOCK, xb = Math.min(w, xa + BLOCK);
    let best = -1e9, by = y0;
    for (let y = y0; y < y1; y++) {
      let s = 0;
      for (let x = xa; x < xb; x++) s += lum(y * w + x);
      s /= xb - xa;
      let up = 0, dn = 0;
      for (let x = xa; x < xb; x++) { up += lum((y - half) * w + x); dn += lum((y + half) * w + x); }
      const score = s - (up + dn) / (2 * (xb - xa));
      if (score > best) { best = score; by = y; }
    }
    peaks[b] = by;
  }
  // median over neighbouring blocks to reject outliers
  const med = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    const win = [];
    for (let k = -4; k <= 4; k++) win.push(peaks[Math.min(nb - 1, Math.max(0, b + k))]);
    win.sort((p, q) => p - q);
    med[b] = win[4];
  }

  for (let x = 0; x < w; x++) {
    const f = x / BLOCK - 0.5;
    const b0 = Math.max(0, Math.min(nb - 1, Math.floor(f)));
    const b1 = Math.min(nb - 1, b0 + 1);
    const t = Math.min(1, Math.max(0, f - b0));
    const py = Math.round(med[b0] * (1 - t) + med[b1] * t);
    const top = py - half, bot = py + half;
    if (top < 3 || bot >= h - 3) continue;
    const avg = (y) => (lum((y - 1) * w + x) + lum(y * w + x) + lum((y + 1) * w + x)) / 3;
    const aTop = avg(top), aBot = avg(bot);
    for (let y = top; y <= bot; y++) {
      const base = aTop + (aBot - aTop) * ((y - top) / (bot - top));
      const L = lum(y * w + x);
      const excess = L - base;
      if (excess <= 0) continue;
      // fade the correction out towards the ends of the window
      const edge = Math.min(y - top, bot - y) / (half * 0.35);
      const k = strength * Math.min(1, edge);
      const scale = (L - k * excess) / L;
      const i = (y * w + x) * 3;
      data[i] = Math.round(data[i] * scale);
      data[i + 1] = Math.round(data[i + 1] * scale);
      data[i + 2] = Math.round(data[i + 2] * scale);
    }
  }
  return { data, width: w, height: h };
}
