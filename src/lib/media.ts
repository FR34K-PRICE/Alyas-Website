import sharp from "sharp";
import { getDb, toBuffer } from "./db";
import { HttpError } from "./security";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp", "avif"]); // SVG and GIF are refused on purpose
const VARIANTS = [480, 960, 1600, 2400];

export interface MediaRow {
  id: string;
  filename: string;
  alt_ar: string;
  alt_en: string;
  folder: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  created_at: string;
  created_by: string | null;
}

export const cleanFolder = (s: string) => (s || "general").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "general";

export async function saveUpload(input: Buffer, filename: string, folder: string, userEmail: string): Promise<MediaRow> {
  if (input.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "That file is larger than 8 MB. Please choose a smaller image.");
  if (input.length < 100) throw new HttpError(400, "That file looks empty.");
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: 80_000_000, failOn: "error" }).metadata();
  } catch {
    throw new HttpError(400, "That file is not a readable image. Use JPG, PNG, WebP or AVIF.");
  }
  // The real format comes from the file's bytes, never from the file name or the browser's claim.
  if (!meta.format || !ALLOWED.has(meta.format)) throw new HttpError(400, "Only JPG, PNG, WebP and AVIF images are allowed.");
  if (!meta.width || !meta.height) throw new HttpError(400, "Could not read the image size.");

  const base = sharp(input, { limitInputPixels: 80_000_000 }).rotate(); // applies EXIF orientation, strips metadata on output
  const oriented = await base.clone().toBuffer({ resolveWithObject: true });
  const W = oriented.info.width;
  const H = oriented.info.height;
  const lossless = meta.hasAlpha && W <= 900;

  const widths = Array.from(new Set(VARIANTS.filter((v) => v < W).concat([Math.min(W, 2400)]))).sort((a, b) => a - b);
  const files: { width: number; data: Buffer }[] = [];
  for (const w of widths) {
    const data = await sharp(oriented.data)
      .resize({ width: w, withoutEnlargement: true })
      .webp(lossless ? { lossless: true } : { quality: meta.hasAlpha ? 88 : 80, effort: 4 })
      .toBuffer();
    files.push({ width: w, data });
  }
  const largest = files[files.length - 1];
  const outW = Math.min(W, 2400);
  const outH = Math.round((H * outW) / W);

  const db = await getDb();
  const name = filename.replace(/[^\w.\- ؀-ۿ]+/g, "_").slice(0, 120) || "image";
  const r = await db.query<MediaRow>(
    `INSERT INTO media (filename, folder, width, height, mime, bytes, created_by)
     VALUES ($1, $2, $3, $4, 'image/webp', $5, $6) RETURNING *`,
    [name, cleanFolder(folder), outW, outH, largest.data.length, userEmail],
  );
  const row = r.rows[0];
  for (const f of files) {
    await db.query(`INSERT INTO media_files (media_id, width, data) VALUES ($1, $2, $3)`, [row.id, f.width, f.data]);
  }
  return normalize(row);
}

const normalize = (r: any): MediaRow => ({ ...r, created_at: new Date(r.created_at).toISOString() });

export async function listMedia(): Promise<MediaRow[]> {
  const db = await getDb();
  const r = await db.query(`SELECT * FROM media ORDER BY created_at DESC LIMIT 500`);
  return r.rows.map(normalize);
}

export async function updateMedia(id: string, patch: { alt_ar?: string; alt_en?: string; folder?: string; filename?: string }) {
  const db = await getDb();
  const r = await db.query(
    `UPDATE media SET alt_ar = COALESCE($2, alt_ar), alt_en = COALESCE($3, alt_en), folder = COALESCE($4, folder), filename = COALESCE($5, filename)
      WHERE id = $1 RETURNING *`,
    [id, patch.alt_ar ?? null, patch.alt_en ?? null, patch.folder ? cleanFolder(patch.folder) : null, patch.filename ?? null],
  );
  if (!r.rows[0]) throw new HttpError(404, "Image not found.");
  return normalize(r.rows[0]);
}

export async function mediaUsage(id: string): Promise<number> {
  const db = await getDb();
  const r = await db.query(`SELECT count(*)::int AS n FROM content WHERE draft::text LIKE $1 OR published::text LIKE $1`, [`%${id}%`]);
  return r.rows[0].n;
}

export async function deleteMedia(id: string) {
  if ((await mediaUsage(id)) > 0) throw new HttpError(409, "This image is used on the site. Replace it there first, then delete it.");
  const db = await getDb();
  const r = await db.query(`DELETE FROM media WHERE id = $1`, [id]);
  if (!r.rowCount) throw new HttpError(404, "Image not found.");
}

export async function getMediaBytes(id: string, want: number): Promise<{ data: Buffer; width: number } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const widths = (await db.query<{ width: number }>(`SELECT width FROM media_files WHERE media_id = $1 ORDER BY width`, [id])).rows.map((x) => x.width);
  if (!widths.length) return null;
  const width = widths.find((w) => w >= want) ?? widths[widths.length - 1];
  const r = await db.query(`SELECT data FROM media_files WHERE media_id = $1 AND width = $2`, [id, width]);
  return r.rows[0] ? { data: toBuffer(r.rows[0].data), width } : null;
}

export async function mediaMap(ids: string[]): Promise<Record<string, { width: number; height: number; alt_ar: string; alt_en: string }>> {
  const clean = Array.from(new Set(ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i))));
  if (!clean.length) return {};
  const db = await getDb();
  const r = await db.query(`SELECT id, width, height, alt_ar, alt_en FROM media WHERE id = ANY($1::uuid[])`, [clean]);
  return Object.fromEntries(r.rows.map((x: any) => [x.id, x]));
}
