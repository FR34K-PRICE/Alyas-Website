/**
 * The single set of rules for phone, WhatsApp and email values. Pure functions with no server-only imports, so the
 * CMS form validation (schema.ts) and every place that renders a link (hero, mobile bar, footer, contact page,
 * structured data) agree exactly on what counts as a usable contact detail.
 */

const PHONE_CHARS = /^[+\d\s().-]+$/;

/** Digits of a phone-like value, or null when it has letters/odd symbols or a "+" anywhere but the start. */
function digitsOf(raw: unknown): { digits: string; plus: boolean } | null {
  const s = String(raw ?? "").trim();
  if (!s || !PHONE_CHARS.test(s)) return null;
  if ((s.match(/\+/g) || []).length > 1 || (s.includes("+") && !s.startsWith("+"))) return null;
  return { digits: s.replace(/\D/g, ""), plus: s.startsWith("+") };
}

/**
 * WhatsApp number in the international format wa.me needs: digits only, country code first, 7-15 digits.
 * "+964 770 123 4567" and "00964 770 123 4567" both give "9647701234567". A local number that starts with a single
 * 0 (no country code) is rejected, because wa.me/0770… does not open a chat. Returns "" when unusable.
 */
export function normalizeWhatsapp(raw: unknown): string {
  const d = digitsOf(raw);
  if (!d) return "";
  let n = d.digits;
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) return "";
  return n.length >= 7 && n.length <= 15 ? n : "";
}

/**
 * Phone number ready for a tel: link: an optional leading "+", then digits, 7-15 of them. "00…" becomes "+…".
 * Local numbers ("0770 123 4567") are fine for calling. Returns "" when unusable.
 */
export function normalizePhone(raw: unknown): string {
  const d = digitsOf(raw);
  if (!d) return "";
  let n = d.digits;
  let plus = d.plus;
  if (!plus && n.startsWith("00")) {
    n = n.slice(2);
    plus = true;
  }
  if (n.length < 7 || n.length > 15) return "";
  return `${plus ? "+" : ""}${n}`;
}

/** A single plain email address, or "". No display names, lists, query strings or control characters. */
export function normalizeEmail(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 120) return "";
  return /^[^\s@<>"'`,;:\\()[\]?&=]+@[^\s@<>"'`,;:\\()[\]?&=]+\.[^\s@<>"'`,;:\\()[\]?&=]{2,}$/.test(s) ? s : "";
}

export const CONTACT_MESSAGES = {
  phone: "Enter a phone number with 7 to 15 digits, e.g. +964 770 123 4567. Only digits, spaces, + ( ) - . are allowed.",
  whatsapp: "Enter the WhatsApp number in international format, starting with the country code, e.g. 964 770 123 4567 (7 to 15 digits, no leading 0).",
  email: "Enter one email address, e.g. name@example.com.",
} as const;
