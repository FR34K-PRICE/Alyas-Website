/**
 * Custom pages (page builder): address rules and the checks that run when a page is created, saved and published.
 *
 * `content.slug` holds the LIVE address of a page; the address being edited lives in the draft (`draft.slug`) and
 * moves to the column only on publish. Saving a draft therefore never breaks a live link.
 */
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/security";
import { slugify } from "./schema";

/** Built-in routes and system paths that a custom page must never shadow. */
export const RESERVED_SLUGS = new Set([
  "", "home", "index", "about", "travel", "events", "contact",
  "services", "travel-services", "conferences", "events-conferences", "contact-us", "about-us",
  "admin", "api", "preview", "media", "photos", "sitemap", "robots", "ar", "en", "login", "logout", "icon", "favicon",
]);
export const MAX_NAV_PAGES = 4;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export const isValidSlugShape = (s: string) => SLUG_RE.test(s);

/** Normalises what the editor typed (or the English title) into an address, and checks it is allowed. */
export function resolveSlug(raw: unknown, titleEn: unknown, fallback?: string): string {
  const typed = slugify(typeof raw === "string" ? raw : "");
  const slug = typed || slugify(typeof titleEn === "string" ? titleEn : "") || fallback || "";
  if (!slug || !SLUG_RE.test(slug)) {
    throw new HttpError(400, "Enter a web address using letters and numbers.", { fields: { slug: "Use letters, numbers and hyphens, e.g. visa-guide." } });
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new HttpError(400, "That web address is already used by the site.", { fields: { slug: `“${slug}” is reserved. Choose another address.` } });
  }
  return slug;
}

/** Throws when another page already uses the address, live or as a pending draft address. */
export async function assertSlugFree(slug: string, exceptId?: string) {
  const db = await getDb();
  const r = await db.query(
    `SELECT id FROM content WHERE kind = 'page' AND ($2::text IS NULL OR id::text <> $2) AND (slug = $1 OR draft->>'slug' = $1) LIMIT 1`,
    [slug, exceptId ?? null],
  );
  if (r.rows.length) throw new HttpError(409, "Another page already uses that web address.", { fields: { slug: "Another page already uses this address. Choose a different one." } });
  // An address that redirects to another page is kept for that page's old links; it cannot be reused by a different page.
  const kept = await db.query(`SELECT 1 FROM page_redirects WHERE from_slug = $1 AND ($2::text IS NULL OR page_id::text <> $2) LIMIT 1`, [slug, exceptId ?? null]);
  if (kept.rows.length) throw new HttpError(409, "That web address redirects to another page.", { fields: { slug: "This was the old address of another page and now redirects to it. Choose a different address." } });
}

const hasTitle = (d: any) => !!(d?.title?.en?.trim() || d?.title?.ar?.trim());

export function assertTitle(d: any) {
  if (!hasTitle(d)) throw new HttpError(400, "Please enter a page title in at least one language.", { fields: { "title.en": "Enter a title." } });
}

/** Extra checks that must hold before a page goes live. */
export async function assertPublishable(id: string, draft: any, slug: string) {
  assertTitle(draft);
  await assertSlugFree(slug, id);
  if (draft?.nav?.show) {
    const db = await getDb();
    const r = await db.query(
      `SELECT count(*)::int AS n FROM content WHERE kind = 'page' AND status = 'published' AND id::text <> $1 AND published->'nav'->>'show' = 'true'`,
      [id],
    );
    if (r.rows[0].n >= MAX_NAV_PAGES) {
      throw new HttpError(400, `Only ${MAX_NAV_PAGES} pages can appear in the menu. Remove another page from the menu first.`, { fields: { "nav.show": `The menu already has ${MAX_NAV_PAGES} pages.` } });
    }
  }
}

/* ---------------- Redirects from old addresses ---------------- */

/**
 * Called when a page goes live under a different address than its current live one. The old address is kept as a
 * permanent redirect to the page. Redirects reference the page itself, so:
 *  - chains collapse (A→B→C: both A and B lead straight to C),
 *  - unpublishing or deleting the page removes the destination (see redirectTarget / ON DELETE CASCADE),
 *  - moving a page back to an old address deletes that redirect, so an address can never redirect to itself.
 */
export async function recordAddressChange(pageId: string, oldSlug: string, newSlug: string) {
  const db = await getDb();
  await db.query(`DELETE FROM page_redirects WHERE from_slug = $1`, [newSlug]);
  if (!oldSlug || oldSlug === newSlug || RESERVED_SLUGS.has(oldSlug) || !SLUG_RE.test(oldSlug)) return;
  await db.query(
    `INSERT INTO page_redirects (from_slug, page_id) VALUES ($1, $2)
     ON CONFLICT (from_slug) DO UPDATE SET page_id = EXCLUDED.page_id, created_at = now()`,
    [oldSlug, pageId],
  );
}

/**
 * The live address an old address should redirect to, or null. Only PUBLISHED pages count, and a live page always
 * wins over a redirect of the same name. Reserved routes, loops and malformed values are never returned.
 */
export async function redirectTarget(fromSlug: string): Promise<string | null> {
  if (!SLUG_RE.test(fromSlug) || RESERVED_SLUGS.has(fromSlug)) return null;
  const db = await getDb();
  const live = await db.query(`SELECT 1 FROM content WHERE kind = 'page' AND status = 'published' AND slug = $1`, [fromSlug]);
  if (live.rows.length) return null;
  const r = await db.query(
    `SELECT c.slug FROM page_redirects p JOIN content c ON c.id = p.page_id
      WHERE p.from_slug = $1 AND c.kind = 'page' AND c.status = 'published'`,
    [fromSlug],
  );
  const to: string | undefined = r.rows[0]?.slug;
  if (!to || to === fromSlug || RESERVED_SLUGS.has(to) || !SLUG_RE.test(to)) return null;
  return to;
}
