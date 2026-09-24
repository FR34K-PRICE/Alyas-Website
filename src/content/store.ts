import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/security";
import { DEFAULTS, DEFAULT_SERVICES } from "./defaults";
import { assertPublishable, assertSlugFree, recordAddressChange, resolveSlug } from "./pages";
import { KINDS, SINGLETON_KEYS, deepMerge, emptyData, schemaFor, slugify, type KindKey } from "./schema";

export interface Entry {
  id: string;
  kind: KindKey;
  slug: string;
  sort: number;
  status: "draft" | "published";
  data: any; // draft
  published: any | null;
  updatedAt: string;
  updatedBy: string | null;
  publishedAt: string | null;
  hasChanges: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function toEntry(r: any): Entry {
  const published = r.published ?? null;
  return {
    id: r.id,
    kind: r.kind,
    slug: r.slug,
    sort: r.sort,
    status: r.status,
    data: r.draft,
    published,
    updatedAt: new Date(r.updated_at).toISOString(),
    updatedBy: r.updated_by,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    hasChanges: r.status === "published" ? !same(r.draft, published) : true,
  };
}

let seeded: Promise<void> | undefined;
/** Seed the five services you described, once, so the Services list is not empty on day one. */
export function ensureSeeded(): Promise<void> {
  seeded ??= (async () => {
    const db = await getDb();
    const flag = await db.query(`SELECT 1 FROM meta WHERE key = 'seeded_services'`);
    if (flag.rows.length) return;
    for (const s of DEFAULT_SERVICES) {
      await db.query(
        `INSERT INTO content (kind, slug, sort, status, draft, published, published_at, updated_by)
         VALUES ('service', $1, $2, 'published', $3::jsonb, $3::jsonb, now(), 'system')
         ON CONFLICT (kind, slug) DO NOTHING`,
        [s.slug, s.sort, JSON.stringify(s.data)],
      );
    }
    await db.query(`INSERT INTO meta (key, value) VALUES ('seeded_services', '1') ON CONFLICT DO NOTHING`);
  })().catch((e) => {
    seeded = undefined;
    throw e;
  });
  return seeded;
}

/* ---------------- Admin-side operations ---------------- */

export async function listEntries(kind: KindKey): Promise<Entry[]> {
  await ensureSeeded();
  const db = await getDb();
  const r = await db.query(`SELECT * FROM content WHERE kind = $1 ORDER BY sort ASC, updated_at DESC`, [kind]);
  return r.rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  const db = await getDb();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await db.query(`SELECT * FROM content WHERE id = $1`, [id]);
  return r.rows[0] ? toEntry(r.rows[0]) : null;
}

/** Singleton documents. Returns the row (or a virtual, unsaved one seeded from the defaults). */
export async function getSingleton(kind: KindKey): Promise<Entry> {
  const db = await getDb();
  const r = await db.query(`SELECT * FROM content WHERE kind = $1 AND slug = 'main'`, [kind]);
  if (r.rows[0]) {
    const e = toEntry(r.rows[0]);
    e.data = deepMerge(deepMerge(emptyData(kind), DEFAULTS[kind] ?? {}), e.data);
    return e;
  }
  return {
    id: "",
    kind,
    slug: "main",
    sort: 0,
    status: "draft",
    data: deepMerge(emptyData(kind), DEFAULTS[kind] ?? {}),
    published: null,
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
    publishedAt: null,
    hasChanges: false,
  };
}

function validate(kind: KindKey, data: unknown) {
  return schemaFor(kind).parse(data) as any;
}

export async function saveSingleton(kind: KindKey, data: unknown, userEmail: string): Promise<Entry> {
  const clean = validate(kind, data);
  const db = await getDb();
  await db.query(
    `INSERT INTO content (kind, slug, draft, updated_by) VALUES ($1, 'main', $2::jsonb, $3)
     ON CONFLICT (kind, slug) DO UPDATE SET draft = EXCLUDED.draft, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [kind, JSON.stringify(clean), userEmail],
  );
  return getSingleton(kind);
}

export async function createEntry(kind: KindKey, data: unknown, userEmail: string): Promise<Entry> {
  const clean = validate(kind, data);
  const def = KINDS[kind];
  const title = clean[def.titleKey ?? "title"] ?? {};
  if (!(title.en?.trim() || title.ar?.trim())) {
    throw new HttpError(400, "Please enter a title in at least one language.", { fields: { [`${def.titleKey}.en`]: "Enter a title." } });
  }
  const db = await getDb();
  if (kind === "page") {
    // Pages carry an editable address; it must be valid, unreserved and unique.
    const pageSlug = resolveSlug(clean.slug, title.en);
    await assertSlugFree(pageSlug);
    clean.slug = pageSlug;
    const pageSort = (await db.query(`SELECT COALESCE(MAX(sort), 0) + 10 AS n FROM content WHERE kind = 'page'`)).rows[0].n;
    const created = await db.query(
      `INSERT INTO content (kind, slug, sort, draft, updated_by) VALUES ('page', $1, $2, $3::jsonb, $4) RETURNING *`,
      [pageSlug, pageSort, JSON.stringify(clean), userEmail],
    );
    return toEntry(created.rows[0]);
  }
  const base = slugify(title.en || "") || kind;
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const exists = await db.query(`SELECT 1 FROM content WHERE kind = $1 AND slug = $2`, [kind, slug]);
    if (!exists.rows.length) break;
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }
  const sort = (await db.query(`SELECT COALESCE(MAX(sort), 0) + 10 AS n FROM content WHERE kind = $1`, [kind])).rows[0].n;
  const r = await db.query(
    `INSERT INTO content (kind, slug, sort, draft, updated_by) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
    [kind, slug, sort, JSON.stringify(clean), userEmail],
  );
  return toEntry(r.rows[0]);
}

export async function saveEntry(id: string, data: unknown, userEmail: string): Promise<Entry> {
  const existing = await getEntry(id);
  if (!existing || KINDS[existing.kind].singleton) throw new HttpError(404, "Not found.");
  const clean = validate(existing.kind, data);
  if (existing.kind === "page") {
    clean.slug = resolveSlug(clean.slug, clean.title?.en, existing.slug);
    await assertSlugFree(clean.slug, id);
  }
  const db = await getDb();
  const r = await db.query(`UPDATE content SET draft = $2::jsonb, updated_at = now(), updated_by = $3 WHERE id = $1 RETURNING *`, [id, JSON.stringify(clean), userEmail]);
  return toEntry(r.rows[0]);
}

export async function publishEntry(idOrKind: { id?: string; kind?: KindKey }, userEmail: string): Promise<Entry> {
  const db = await getDb();
  if (idOrKind.id) {
    const ex = await getEntry(idOrKind.id);
    if (ex?.kind === "page") {
      // The live address moves to the draft's address only now, so saving drafts never breaks a live link.
      const slug = resolveSlug(ex.data.slug, ex.data.title?.en, ex.slug);
      await assertPublishable(ex.id, ex.data, slug);
      const pr = await db.query(
        `UPDATE content SET published = draft, status = 'published', published_at = now(), updated_by = $2, slug = $3 WHERE id = $1 RETURNING *`,
        [ex.id, userEmail, slug],
      );
      // Once a page has been public, its previous live address is kept as a permanent redirect to it.
      await recordAddressChange(ex.id, ex.publishedAt ? ex.slug : "", slug);
      return toEntry(pr.rows[0]);
    }
  }
  const where = idOrKind.id ? `id = $1` : `kind = $1 AND slug = 'main'`;
  const r = await db.query(
    `UPDATE content SET published = draft, status = 'published', published_at = now(), updated_by = $2 WHERE ${where} RETURNING *`,
    [idOrKind.id ?? idOrKind.kind, userEmail],
  );
  if (!r.rows[0]) throw new HttpError(404, idOrKind.kind ? "Save your changes before publishing." : "Not found.");
  return toEntry(r.rows[0]);
}

export async function unpublishEntry(id: string, userEmail: string): Promise<Entry> {
  const db = await getDb();
  const r = await db.query(
    `UPDATE content SET status = 'draft', updated_by = $2 WHERE id = $1 AND kind NOT IN (${SINGLETON_KEYS.map((k) => `'${k}'`).join(",")}) RETURNING *`,
    [id, userEmail],
  );
  if (!r.rows[0]) throw new HttpError(404, "Not found.");
  return toEntry(r.rows[0]);
}

export async function deleteEntry(id: string) {
  const db = await getDb();
  const r = await db.query(
    `DELETE FROM content WHERE id = $1 AND kind NOT IN (${SINGLETON_KEYS.map((k) => `'${k}'`).join(",")})`,
    [id],
  );
  if (!r.rowCount) throw new HttpError(404, "Not found.");
}

export async function reorderEntries(kind: KindKey, ids: string[]) {
  const db = await getDb();
  let n = 10;
  for (const id of ids) {
    await db.query(`UPDATE content SET sort = $3 WHERE id = $1 AND kind = $2`, [id, kind, n]);
    n += 10;
  }
}

/* ---------------- Public-side loaders ---------------- */

const todayBaghdad = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());

export interface SiteBundle {
  site: any;
  home: any;
  about: any;
  travel: any;
  events: any;
  contact: any;
  services: (any & { id: string; slug: string })[];
  offers: (any & { id: string; slug: string })[];
  upcoming: (any & { id: string; slug: string })[];
  news: (any & { id: string; slug: string })[];
  /** Custom pages: published ones for visitors, every page (draft data) in preview. */
  pages: (any & { id: string; slug: string })[];
  preview: boolean;
}

/** `preview` = admin previewing drafts; only ever set after a server-side session check. */
export async function getSiteBundle(preview = false): Promise<SiteBundle> {
  await ensureSeeded();
  const db = await getDb();
  const rows = (await db.query(`SELECT * FROM content ORDER BY sort ASC, updated_at DESC`)).rows;
  const pickData = (r: any) => (preview ? r.draft : r.status === "published" ? r.published : null);

  const singles: Record<string, any> = {};
  for (const k of SINGLETON_KEYS) {
    const row = rows.find((r) => r.kind === k && r.slug === "main");
    const stored = row ? pickData(row) : null;
    singles[k] = deepMerge(deepMerge(emptyData(k), DEFAULTS[k] ?? {}), stored ?? {});
  }
  const coll = (kind: KindKey): any[] =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ r, d: pickData(r) }))
      .filter((x) => x.d)
      .map((x) => ({ ...deepMerge(emptyData(kind), x.d), id: x.r.id as string, slug: x.r.slug as string, slug_draft: (x.r.draft?.slug as string) || "", _sort: x.r.sort as number, _published_at: x.r.published_at ? new Date(x.r.published_at).toISOString() : null }));

  const today = todayBaghdad();
  const offers = coll("offer")
    .filter((o) => preview || !o.validUntil || o.validUntil >= today)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a._sort - b._sort);
  const upcoming = coll("event")
    .filter((e) => preview || (e.endDate || e.startDate || "9999") >= today)
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
  const news = coll("news").sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const pages = coll("page").map((p) => ({ ...p, slug: preview ? p.slug_draft || p.slug : p.slug }));

  return {
    site: singles.site,
    home: singles.home,
    about: singles.about,
    travel: singles.travel,
    events: singles.events,
    contact: singles.contact,
    services: coll("service"),
    offers,
    upcoming,
    news,
    pages,
    preview,
  } as SiteBundle;
}
