// Helpers for preparing photographic layers (used by scripts/prepare-photos.mjs).
import sharp from "sharp";

export function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

/** Separable box blur on a Float32Array plane. */
export function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

export async function loadRGB(file, width) {
  const { data, info } = await sharp(file).resize({ width }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/**
 * Foreground of the hero photo (shore flowers, grass, rocks, gravel) as a soft alpha mask.
 * Works per pixel: turquoise water and its reflections are recognised by hue + saturation,
 * everything else connected to the bottom edge below the horizon is foreground.
 */
export function heroForegroundMask(data, w, h, { horizon = 0.545, seedRow = 0.585, hueMin = 187, hueMax = 208, satMin = 0.42 } = {}) {
  const n = w * h;
  const water = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [H, S, V] = rgb2hsv(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    water[i] = V >= 0.14 && ((H >= hueMin && H <= hueMax && S >= satMin) || (H >= hueMin && H <= 211 && S >= 0.5)) ? 1 : 0;
  }
  const smooth = (src, r) => {
    const b = boxBlur(Float32Array.from(src), w, h, r); const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = b[i] > 0.5 ? 1 : 0; return out;
  };
  const cleanWater = smooth(smooth(water, 1), 2);
  const y0 = Math.floor(h * horizon);
  const flood = (seeds, allow) => {
    const seen = new Uint8Array(n); const stack = [];
    for (const i of seeds) if (allow(i) && !seen[i]) { seen[i] = 1; stack.push(i); }
    while (stack.length) {
      const i = stack.pop(); const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > y0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || seen[j] || !allow(j)) continue; seen[j] = 1; stack.push(j);
      }
    }
    return seen;
  };
  // 1) The lake: water pixels connected to a row just below the horizon.
  const seeds = []; const sy = Math.floor(h * seedRow);
  for (let x = 0; x < w; x++) seeds.push(sy * w + x);
  const lake = flood(seeds, (i) => cleanWater[i] === 1);
  // 2) Foreground = everything below the horizon that is not the lake AND touches the bottom edge (fills pin-holes, drops specks).
  const bottom = []; for (let x = 0; x < w; x++) bottom.push((h - 1) * w + x);
  const fg = flood(bottom, (i) => (((i / w) | 0) > y0) && !lake[i]);
  const soft = boxBlur(boxBlur(Float32Array.from(fg), w, h, 2), w, h, 2);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const t = Math.min(1, Math.max(0, (soft[i] - 0.3) / 0.4)); alpha[i] = Math.round(t * t * (3 - 2 * t) * 255); }
  return alpha;
}

/**
 * Cut an aircraft out of a clear-sky photograph by chroma: the sky is strongly saturated teal,
 * the aircraft is nearly neutral. Keeps only the largest connected shape and feathers the edge.
 * Returns { rgba, width, height } cropped to the aircraft.
 */
export async function cutoutAircraft(file, { width = 3200, lo = 0.3, hi = 0.56, pad = 12 } = {}) {
  const { data, w, h } = await loadRGB(file, width);
  const n = w * h;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [, S] = rgb2hsv(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    a[i] = Math.min(1, Math.max(0, (hi - S) / (hi - lo)));
  }
  // largest connected component of a > 0.5
  const label = new Int32Array(n); let best = 0, bestId = 0, id = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] || a[s] <= 0.5) continue;
    id++; let count = 0; const st = [s]; label[s] = id;
    while (st.length) {
      const i = st.pop(); count++; const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1]) {
        if (j < 0 || label[j] || a[j] <= 0.5) continue; label[j] = id; st.push(j);
      }
    }
    if (count > best) { best = count; bestId = id; }
  }
  // grow the chosen shape by a couple of pixels so anti-aliased edge pixels are kept
  const keep = new Float32Array(n); for (let i = 0; i < n; i++) keep[i] = label[i] === bestId ? 1 : 0;
  const grown = boxBlur(keep, w, h, 3);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (grown[i] > 0.02) {
      out[i] = a[i];
      const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  // Fill every hole that is enclosed by the aircraft (registration letters, tail logo, dark gaps) and
  // paint it from its neighbours, so no airline marking survives and the shape is solid.
  const ext = new Uint8Array(n); { const st = [];
    const push = (i) => { if (!ext[i] && out[i] < 0.5) { ext[i] = 1; st.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (st.length) { const i = st.pop(); const x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < n - w) push(i + w); } }
  // Morphological closing seals thin channels so gaps between gear, flaps and pylons are filled too.
  const dil = boxBlur(keep, w, h, 9); const dilB = new Float32Array(n); for (let i = 0; i < n; i++) dilB[i] = dil[i] > 0.02 ? 1 : 0;
  const ero = boxBlur(dilB, w, h, 9); const closed = new Uint8Array(n); for (let i = 0; i < n; i++) closed[i] = ero[i] > 0.98 ? 1 : 0;
  const known = new Uint8Array(n); const col = new Float32Array(n * 3); const holes = [];
  for (let i = 0; i < n; i++) {
    if (out[i] >= 0.5) { known[i] = 1; col[i*3] = data[i*3]; col[i*3+1] = data[i*3+1]; col[i*3+2] = data[i*3+2]; }
    else if ((!ext[i] && grown[i] > 0.02) || closed[i]) holes.push(i);
  }
  let pending = holes;
  for (let pass = 0; pass < 80 && pending.length; pass++) {
    const filled = [], rest = [];
    for (const i of pending) {
      const x = i % w, y = (i / w) | 0; let r = 0, g = 0, b = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (known[j]) { r += col[j*3]; g += col[j*3+1]; b += col[j*3+2]; c++; }
      }
      if (c) { col[i*3] = r / c; col[i*3+1] = g / c; col[i*3+2] = b / c; filled.push(i); } else rest.push(i);
    }
    for (const i of filled) { known[i] = 1; out[i] = 1; }
    pending = rest;
  }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const rgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y + y0) * w + (x + x0), o = (y * cw + x) * 4;
    // de-spill: pull the teal fringe toward neutral where the edge is partially transparent
    const al = out[i]; const wasHole = known[i] && a[i] < 0.5; const r = wasHole ? col[i * 3] : data[i * 3], g = wasHole ? col[i * 3 + 1] : data[i * 3 + 1], b = wasHole ? col[i * 3 + 2] : data[i * 3 + 2];
    const gray = (r + g + b) / 3; const k = al < 1 ? (1 - al) * 0.85 : 0;
    rgba[o] = r + (gray - r) * k; rgba[o + 1] = g + (gray - g) * k; rgba[o + 2] = b + (gray - b) * k; rgba[o + 3] = Math.round(al * 255);
  }
  return { rgba, width: cw, height: ch };
}

/** Paint over rectangles (registration marks, small logos) using colours from their surroundings; alpha is kept. */
export function inpaintRects(rgba, w, h, rects) {
  for (const [rx0, ry0, rx1, ry1] of rects) {
    const inRect = (x, y) => x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1;
    const known = new Uint8Array(w * h);
    const px = (x, y) => (y * w + x) * 4;
    const target = [];
    for (let y = Math.max(0, ry0 - 6); y <= Math.min(h - 1, ry1 + 6); y++) for (let x = Math.max(0, rx0 - 6); x <= Math.min(w - 1, rx1 + 6); x++) {
      const o = px(x, y);
      if (inRect(x, y)) { if (rgba[o + 3] > 8) target.push([x, y]); }
      else if (rgba[o + 3] >= 250) known[y * w + x] = 1;
    }
    let pending = target;
    for (let pass = 0; pass < 200 && pending.length; pass++) {
      const filled = [], rest = [];
      for (const [x, y] of pending) {
        let r = 0, g = 0, b = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h || !known[yy * w + xx]) continue;
          const o = px(xx, yy); r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; c++;
        }
        if (c) filled.push([x, y, r / c, g / c, b / c]); else rest.push([x, y]);
      }
      for (const [x, y, r, g, b] of filled) { const o = px(x, y); rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; known[y * w + x] = 1; }
      pending = rest;
    }
  }
}
