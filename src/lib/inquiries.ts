import { z } from "zod";
import { getDb } from "./db";
import { turnstile } from "./env";
import { HttpError, hmac, ipHash, rateLimitOrThrow, safeEqual } from "./security";

export const INTERESTS = ["flights", "hotels", "visa", "transport", "tailored", "events", "floral", "other"] as const;
export const STATUSES = ["new", "in_progress", "resolved", "spam"] as const;

export const inquirySchema = z
  .object({
    name: z.string().trim().min(2, "name").max(100),
    email: z.string().trim().max(160).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "email"),
    phone: z.string().trim().max(30).refine((v) => v === "" || /^[+\d][\d\s()\-]{5,28}$/.test(v), "phone"),
    interest: z.enum(INTERESTS),
    message: z.string().trim().min(5, "message").max(2000),
    ref: z.string().trim().max(120).default(""),
    lang: z.enum(["ar", "en"]).default("ar"),
    website: z.string().max(200).optional(), // honeypot: real people never see or fill this
    token: z.string().max(200),
    turnstile: z.string().max(4000).optional(),
  })
  .refine((v) => v.email !== "" || v.phone !== "", { path: ["email"], message: "contact" });

export function issueToken(): string {
  const ts = String(Date.now());
  return `${ts}.${hmac(`inq:${ts}`)}`;
}

function checkToken(token: string) {
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !safeEqual(sig, hmac(`inq:${ts}`))) throw new HttpError(400, "Please reload the page and try again.");
  const age = Date.now() - Number(ts);
  if (!(age > 2500)) throw new HttpError(400, "That was very fast. Please check your details and send again.");
  if (age > 6 * 3600 * 1000) throw new HttpError(400, "This form expired. Please reload the page and try again.");
}

async function verifyTurnstile(response: string | undefined, ip: string) {
  const { secret } = turnstile();
  if (!secret) return;
  if (!response) throw new HttpError(400, "Please complete the spam check.");
  const body = new URLSearchParams({ secret, response, remoteip: ip });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  if (!j.success) throw new HttpError(400, "The spam check did not pass. Please try again.");
}

export async function createInquiry(input: z.infer<typeof inquirySchema>, ip: string) {
  if (input.website) return { saved: false }; // honeypot tripped: acknowledge silently, store nothing
  checkToken(input.token);
  const h = ipHash(ip);
  await rateLimitOrThrow(`inq:${h}`, 5, 3600);
  await verifyTurnstile(input.turnstile, ip);
  const db = await getDb();
  const dup = await db.query(
    `SELECT 1 FROM inquiries WHERE ip_hash = $1 AND message = $2 AND created_at > now() - interval '10 minutes'`,
    [h, input.message],
  );
  if (dup.rows.length) return { saved: true };
  await db.query(
    `INSERT INTO inquiries (name, email, phone, interest, message, ref, lang, ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [input.name, input.email, input.phone, input.interest, input.message, input.ref, input.lang, h],
  );
  return { saved: true };
}

export async function listInquiries(status: string | null, limit = 100, offset = 0) {
  const db = await getDb();
  const useFilter = status && (STATUSES as readonly string[]).includes(status);
  const r = await db.query(
    `SELECT id, name, email, phone, interest, message, ref, lang, status, note, created_at, updated_at
       FROM inquiries ${useFilter ? "WHERE status = $3" : ""} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    useFilter ? [limit, offset, status] : [limit, offset],
  );
  const counts = await db.query(`SELECT status, count(*)::int AS n FROM inquiries GROUP BY status`);
  return {
    items: r.rows.map((x: any) => ({ ...x, created_at: new Date(x.created_at).toISOString(), updated_at: new Date(x.updated_at).toISOString() })),
    counts: Object.fromEntries(counts.rows.map((c: any) => [c.status, c.n])),
  };
}

export async function updateInquiry(id: string, patch: { status?: string; note?: string }) {
  const db = await getDb();
  const r = await db.query(
    `UPDATE inquiries SET status = COALESCE($2, status), note = COALESCE($3, note), updated_at = now() WHERE id = $1 RETURNING id, status, note, updated_at`,
    [id, patch.status ?? null, patch.note ?? null],
  );
  if (!r.rows[0]) throw new HttpError(404, "Inquiry not found.");
  return r.rows[0];
}
