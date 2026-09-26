/**
 * Lossless "remove the audio track" for an MP4, without ffmpeg and without re-encoding.
 *
 *   node scripts/strip-mp4-audio.mjs input.mp4 output.mp4
 *
 * Why: a decorative background video that carries an (unused) audio track can be treated differently by phone
 * browsers than a truly silent one. The website copy of the hero video is therefore made silent. The video samples
 * are copied byte for byte, so visual quality is unchanged; the script proves it by comparing a SHA-256 of the
 * video samples before and after, checks the result is still "fast start" (moov before mdat, so it can stream with
 * byte ranges), and refuses to write a file that fails any check.
 *
 * Supports the common layout: ftyp, moov, (free), mdat with 32-bit chunk offsets (stco). Anything else is refused.
 */
import fs from "node:fs";
import crypto from "node:crypto";

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error("usage: node scripts/strip-mp4-audio.mjs input.mp4 output.mp4"); process.exit(2); }

const buf = fs.readFileSync(inFile);
const u32 = (b, o) => b.readUInt32BE(o);
const cc = (b, o) => b.toString("latin1", o, o + 4);

/** List child boxes of [start,end): { type, start, size, body } */
function boxes(b, start, end) {
  const out = [];
  for (let o = start; o + 8 <= end;) {
    let size = u32(b, o), hdr = 8;
    if (size === 1) { size = Number(b.readBigUInt64BE(o + 8)); hdr = 16; } else if (size === 0) size = end - o;
    if (size < 8 || o + size > end) throw new Error(`corrupt box at ${o}`);
    out.push({ type: cc(b, o + 4), start: o, size, body: o + hdr, end: o + size });
    o += size;
  }
  return out;
}
const find = (list, type) => list.find((x) => x.type === type);

function analyse(b) {
  const top = boxes(b, 0, b.length);
  const ftyp = find(top, "ftyp"), moov = find(top, "moov"), mdat = find(top, "mdat");
  if (!ftyp || !moov || !mdat) throw new Error("expected ftyp, moov and mdat");
  const traks = boxes(b, moov.body, moov.end).filter((x) => x.type === "trak").map((t) => {
    const mdia = find(boxes(b, t.body, t.end), "mdia");
    const mk = boxes(b, mdia.body, mdia.end);
    const handler = cc(b, find(mk, "hdlr").body + 8);
    const stbl = find(boxes(b, find(mk, "minf").body, find(mk, "minf").end), "stbl");
    const sb = boxes(b, stbl.body, stbl.end);
    const stco = find(sb, "stco"), stsc = find(sb, "stsc"), stsz = find(sb, "stsz");
    if (!stco) throw new Error("only 32-bit chunk offsets (stco) are supported");
    const nChunks = u32(b, stco.body + 4);
    const offsets = Array.from({ length: nChunks }, (_, i) => u32(b, stco.body + 8 + i * 4));
    const nsc = u32(b, stsc.body + 4);
    const sc = Array.from({ length: nsc }, (_, i) => ({ first: u32(b, stsc.body + 8 + i * 12), per: u32(b, stsc.body + 12 + i * 12) }));
    const defSize = u32(b, stsz.body + 4), nSamples = u32(b, stsz.body + 8);
    const sizes = Array.from({ length: nSamples }, (_, i) => (defSize ? defSize : u32(b, stsz.body + 12 + i * 4)));
    // samples per chunk -> byte size per chunk
    const chunkSizes = []; let s = 0;
    for (let c = 1; c <= nChunks; c++) {
      let per = sc[0].per; for (const e of sc) if (e.first <= c) per = e.per;
      let sum = 0; for (let k = 0; k < per; k++) sum += sizes[s++];
      chunkSizes.push(sum);
    }
    return { t, handler, stco, offsets, chunkSizes, nSamples };
  });
  return { top, ftyp, moov, mdat, traks };
}

/** SHA-256 over the video sample bytes in decode order (proof that video is untouched). */
function videoHash(b, a) {
  const v = a.traks.find((t) => t.handler === "vide");
  const h = crypto.createHash("sha256");
  v.offsets.forEach((o, i) => h.update(b.subarray(o, o + v.chunkSizes[i])));
  return { hash: h.digest("hex"), samples: v.nSamples, chunks: v.offsets.length };
}

const A = analyse(buf);
const audio = A.traks.filter((t) => t.handler === "soun");
const video = A.traks.filter((t) => t.handler === "vide");
if (video.length !== 1) throw new Error(`expected exactly one video track, found ${video.length}`);
if (A.top.findIndex((x) => x.type === "moov") > A.top.findIndex((x) => x.type === "mdat")) throw new Error("input is not fast-start; refusing");
const before = videoHash(buf, A);
if (!audio.length) { console.log("no audio track: nothing to remove"); fs.copyFileSync(inFile, outFile); process.exit(0); }

// New moov: copy the old one, skip every audio trak, patch the video stco with new offsets.
const v = video[0];
const pieces = [];
let cursor = A.moov.body;
for (const c of boxes(buf, A.moov.body, A.moov.end)) {
  if (c.type === "trak" && audio.some((a) => a.t.start === c.start)) continue; // dropped
  if (c.type === "trak" && c.start === v.t.start) {
    const trak = Buffer.from(buf.subarray(c.start, c.end));
    v.newStcoPos = v.stco.start - c.start; // remember where stco lives inside the copied trak
    pieces.push({ trak });
  } else pieces.push({ raw: buf.subarray(c.start, c.end) });
  cursor = c.end;
}
const moovSizeFor = () => 8 + pieces.reduce((n, p) => n + (p.trak ? p.trak.length : p.raw.length), 0);
const ftypBytes = buf.subarray(A.ftyp.start, A.ftyp.end);
const newMoovSize = moovSizeFor();
const mdatDataStart = ftypBytes.length + newMoovSize + 8;
let pos = mdatDataStart;
const chunks = [];
v.offsets.forEach((o, i) => { chunks.push(buf.subarray(o, o + v.chunkSizes[i])); v.offsets[i] = pos; pos += v.chunkSizes[i]; });
const trakPiece = pieces.find((p) => p.trak);
v.offsets.forEach((o, i) => trakPiece.trak.writeUInt32BE(o, v.newStcoPos + 16 + i * 4)); // stco: 8 hdr + 4 ver/flags + 4 count, then offsets
const moovHdr = Buffer.alloc(8); moovHdr.writeUInt32BE(newMoovSize, 0); moovHdr.write("moov", 4, "latin1");
const mdatBody = Buffer.concat(chunks);
const mdatHdr = Buffer.alloc(8); mdatHdr.writeUInt32BE(mdatBody.length + 8, 0); mdatHdr.write("mdat", 4, "latin1");
const out = Buffer.concat([ftypBytes, moovHdr, ...pieces.map((p) => p.trak || p.raw), mdatHdr, mdatBody]);

// Verify before writing anything.
const B = analyse(out);
const after = videoHash(out, B);
const problems = [];
if (B.traks.some((t) => t.handler === "soun")) problems.push("an audio track is still present");
if (B.traks.length !== 1 || B.traks[0].handler !== "vide") problems.push("expected exactly one video track");
if (after.hash !== before.hash) problems.push("video samples differ from the original");
if (after.samples !== before.samples) problems.push("sample count changed");
if (B.top.findIndex((x) => x.type === "moov") > B.top.findIndex((x) => x.type === "mdat")) problems.push("result is not fast-start");
if (u32(out, B.moov.start) !== B.moov.size) problems.push("moov size mismatch");
if (problems.length) { console.error("REFUSING to write:", problems.join("; ")); process.exit(1); }

fs.writeFileSync(outFile, out);
console.log(`audio tracks removed: ${audio.length}`);
console.log(`video samples: ${after.samples}, identical (SHA-256 ${after.hash.slice(0, 16)}…)`);
console.log(`fast-start: yes  size: ${buf.length} → ${out.length} bytes (${((1 - out.length / buf.length) * 100).toFixed(1)}% smaller)`);
