// Aircraft cut-out for a smooth, low-saturation sky (used by scripts/prepare-photos.mjs).
import { boxBlur, loadRGB } from "./lib-mask.mjs";

/** Solve A x = b (small dense system) by Gaussian elimination with partial pivoting. */
function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

/**
 * Cut an aircraft out of a smooth sky. The sky is modelled as a quadratic surface fitted to pixels well
 * outside the aircraft; the aircraft is whatever differs from that model. Edge colours are re-derived from
 * the aircraft itself, so no sky tint (cyan or grey halo) survives.
 * `win` = window to cut in, `excl` = area kept out of the sky fit; both as fractions [x0, y0, x1, y1].
 * Returns { rgba, width, height } cropped to the aircraft.
 */
export async function cutoutAircraftSky(file, { win, excl, width = 3000, lo = 5, hi = 13, erode = 1, close = 3 }) {
  const { data, w, h } = await loadRGB(file, width);
  const X0 = Math.floor(win[0] * w), Y0 = Math.floor(win[1] * h), X1 = Math.ceil(win[2] * w), Y1 = Math.ceil(win[3] * h);
  const ex = [excl[0] * w, excl[1] * h, excl[2] * w, excl[3] * h];
  const feat = (x, y) => {
    const u = x / w - 0.5, v = y / h - 0.5;
    return [1, u, v, u * u, u * v, v * v];
  };
  const AtA = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const Atb = [0, 1, 2].map(() => new Array(6).fill(0));
  for (let y = 0; y < h; y += 7)
    for (let x = 0; x < w; x += 7) {
      if (x > ex[0] && x < ex[2] && y > ex[1] && y < ex[3]) continue;
      const f = feat(x, y), i = (y * w + x) * 3;
      for (let a = 0; a < 6; a++) {
        for (let b = 0; b < 6; b++) AtA[a][b] += f[a] * f[b];
        for (let c = 0; c < 3; c++) Atb[c][a] += f[a] * data[i + c];
      }
    }
  const coef = [0, 1, 2].map((c) => solve(AtA.map((r) => r.slice()), Atb[c].slice()));
  const cw = X1 - X0, ch = Y1 - Y0, n = cw * ch;

  const diff = new Float32Array(n);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const f = feat(x + X0, y + Y0), i = ((y + Y0) * w + (x + X0)) * 3;
      let d = 0;
      for (let c = 0; c < 3; c++) {
        let m = 0;
        for (let a = 0; a < 6; a++) m += coef[c][a] * f[a];
        const e = data[i + c] - m;
        d += e * e;
      }
      diff[y * cw + x] = Math.sqrt(d);
    }
  const blurred = boxBlur(diff, cw, ch, 1);
  const a0 = new Float32Array(n);
  for (let i = 0; i < n; i++) a0[i] = Math.min(1, Math.max(0, (blurred[i] - lo) / (hi - lo)));

  // largest connected shape
  const label = new Int32Array(n);
  let best = 0, bestId = 0, id = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] || a0[s] <= 0.5) continue;
    id++;
    let count = 0;
    const st = [s];
    label[s] = id;
    while (st.length) {
      const i = st.pop();
      count++;
      const x = i % cw;
      for (const j of [x > 0 ? i - 1 : -1, x < cw - 1 ? i + 1 : -1, i >= cw ? i - cw : -1, i < n - cw ? i + cw : -1]) {
        if (j < 0 || label[j] || a0[j] <= 0.5) continue;
        label[j] = id;
        st.push(j);
      }
    }
    if (count > best) { best = count; bestId = id; }
  }
  const shape = new Float32Array(n);
  for (let i = 0; i < n; i++) shape[i] = label[i] === bestId ? 1 : 0;

  // closing seals thin gaps (pylons, flaps); then fill anything enclosed
  const dil = boxBlur(shape, cw, ch, close);
  const dilB = new Float32Array(n);
  for (let i = 0; i < n; i++) dilB[i] = dil[i] > 0.02 ? 1 : 0;
  const ero = boxBlur(dilB, cw, ch, close);
  const closed = new Uint8Array(n);
  for (let i = 0; i < n; i++) closed[i] = ero[i] > 0.98 || shape[i] ? 1 : 0;
  const ext = new Uint8Array(n);
  {
    const st = [];
    const push = (i) => { if (!ext[i] && !closed[i]) { ext[i] = 1; st.push(i); } };
    for (let x = 0; x < cw; x++) { push(x); push((ch - 1) * cw + x); }
    for (let y = 0; y < ch; y++) { push(y * cw); push(y * cw + cw - 1); }
    while (st.length) {
      const i = st.pop(), x = i % cw;
      if (x > 0) push(i - 1);
      if (x < cw - 1) push(i + 1);
      if (i >= cw) push(i - cw);
      if (i < n - cw) push(i + cw);
    }
  }
  let alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = ext[i] ? 0 : 1;
  for (let k = 0; k < erode; k++) {
    const b = boxBlur(alpha, cw, ch, 1);
    alpha = b.map((v) => (v > 0.99 ? 1 : 0));
  }
  const soft = boxBlur(boxBlur(alpha, cw, ch, 1), cw, ch, 1);
  const A = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (soft[i] - 0.15) / 0.7));
    A[i] = t * t * (3 - 2 * t);
  }

  // colours: real pixels well inside the shape; the rim and holes take the aircraft's own colour by peeling inwards
  const core = boxBlur(alpha, cw, ch, 2);
  const known = new Uint8Array(n), col = new Float32Array(n * 3);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (core[i] > 0.995 && a0[i] > 0.5) { // only genuine aircraft pixels seed the colours; gap-filled sky never does
        known[i] = 1;
        const s = ((y + Y0) * w + (x + X0)) * 3;
        col[i * 3] = data[s]; col[i * 3 + 1] = data[s + 1]; col[i * 3 + 2] = data[s + 2];
      }
    }
  let pending = [];
  for (let i = 0; i < n; i++) if (!known[i] && A[i] > 0.001) pending.push(i);
  for (let pass = 0; pass < 14 && pending.length; pass++) {
    const filled = [], rest = [];
    for (const i of pending) {
      const x = i % cw, y = (i / cw) | 0;
      let r = 0, g = 0, b = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) continue;
          const j = yy * cw + xx;
          if (known[j]) { r += col[j * 3]; g += col[j * 3 + 1]; b += col[j * 3 + 2]; c++; }
        }
      if (c) filled.push([i, r / c, g / c, b / c]); else rest.push(i);
    }
    for (const [i, r, g, b] of filled) { known[i] = 1; col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; }
    pending = rest;
  }

  let bx0 = cw, by0 = ch, bx1 = 0, by1 = 0;
  for (let i = 0; i < n; i++) if (A[i] > 0.5) {
    const x = i % cw, y = (i / cw) | 0;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const pad = 10;
  bx0 = Math.max(0, bx0 - pad); by0 = Math.max(0, by0 - pad); bx1 = Math.min(cw - 1, bx1 + pad); by1 = Math.min(ch - 1, by1 + pad);
  const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
  const rgba = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const i = (y + by0) * cw + (x + bx0), o = (y * ow + x) * 4;
      rgba[o] = col[i * 3]; rgba[o + 1] = col[i * 3 + 1]; rgba[o + 2] = col[i * 3 + 2]; rgba[o + 3] = Math.round(A[i] * 255);
    }
  return { rgba, width: ow, height: oh };
}

/**
 * Remove printed marks (titling, registrations, logos) without touching anything else.
 * Inside each rect, pixels that are darker (mode "dark") or lighter (mode "light") than the rect's
 * median tone by `delta` are treated as marks, grown a little, and repainted from the surrounding surface.
 */
export function removeMarks(rgba, w, h, jobs) {
  const px = (x, y) => (y * w + x) * 4;
  const lum = (o) => 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  for (const { rect, mode, delta = 18, grow = 3 } of jobs) {
    const [x0, y0, x1, y1] = rect.map(Math.round);
    const vals = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = px(x, y); if (rgba[o + 3] > 240) vals.push(lum(o)); }
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    const med = vals[vals.length >> 1];
    const mask = new Uint8Array(w * h);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = px(x, y); if (rgba[o + 3] < 200) continue;
      const l = lum(o);
      if (mode === "dark" ? l < med - delta : l > med + delta) mask[y * w + x] = 1;
    }
    // grow the mask so anti-aliased edges of the marks go too, and close small gaps between letters
    const gm = new Float32Array(w * h); for (let i = 0; i < gm.length; i++) gm[i] = mask[i];
    const d = boxBlur(gm, w, h, grow);
    const closedM = new Uint8Array(w * h);
    for (let y = y0 - grow; y <= y1 + grow; y++) for (let x = x0 - grow; x <= x1 + grow; x++) if (d[y * w + x] > 0.05) closedM[y * w + x] = 1;
    const known = new Uint8Array(w * h);
    for (let y = Math.max(0, y0 - 14); y <= Math.min(h - 1, y1 + 14); y++) for (let x = Math.max(0, x0 - 14); x <= Math.min(w - 1, x1 + 14); x++) {
      const i = y * w + x; if (!closedM[i] && rgba[px(x, y) + 3] >= 250) known[i] = 1;
    }
    let pending = [];
    for (let y = y0 - grow; y <= y1 + grow; y++) for (let x = x0 - grow; x <= x1 + grow; x++) if (closedM[y * w + x] && rgba[px(x, y) + 3] > 8) pending.push([x, y]);
    for (let pass = 0; pass < 60 && pending.length; pass++) {
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
