import type { Lang } from "@/content/schema";
import { DICT } from "@/i18n/dict";

export interface QuickAction {
  href: string;
  label: string;
  kind: "whatsapp" | "phone";
}

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/**
 * The one quick way to reach the business besides the inquiry form, taken ONLY from the contact details saved in
 * the CMS: WhatsApp if configured, otherwise the phone number. Returns null when neither is configured; nothing
 * is ever invented or defaulted.
 */
export function quickAction(site: any, lang: Lang, short = false): QuickAction | null {
  const t = DICT[lang].cta;
  const c = site?.contact ?? {};
  const wa = validWhatsapp(c.whatsapp);
  if (wa) return { href: `https://wa.me/${wa}`, label: short ? t.whatsappShort : t.whatsapp, kind: "whatsapp" };
  const phone = String(c.phone ?? "").replace(/[^\d+]/g, "");
  if (validPhone(phone)) return { href: `tel:${phone}`, label: t.call, kind: "phone" };
  return null;
}

/** WhatsApp number as digits (international format, 7–15 digits), or "" when it is missing or malformed. */
export function validWhatsapp(raw: unknown): string {
  const d = digits(raw);
  return d.length >= 7 && d.length <= 15 ? d : "";
}

/** True when the phone value contains a plausible number (7+ digits). */
export const validPhone = (raw: unknown): boolean => digits(raw).length >= 7;
