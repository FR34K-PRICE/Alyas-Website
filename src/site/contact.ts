import type { Lang } from "@/content/schema";
import { DICT } from "@/i18n/dict";
import { normalizeEmail, normalizePhone, normalizeWhatsapp } from "@/content/contact-rules";

export interface QuickAction {
  href: string;
  label: string;
  kind: "whatsapp" | "phone";
  /** true when the link opens another site/app in a new tab (screen readers are told). */
  external: boolean;
}

/**
 * Contact links built ONLY from details saved in the CMS and only when they pass the shared rules
 * (src/content/contact-rules.ts). Every consumer (hero, mobile bar, footer, contact page, structured data) goes
 * through these, so they can never disagree. Nothing is defaulted or invented; unusable values give null/"".
 */
export const whatsappHref = (raw: unknown): string | null => {
  const n = normalizeWhatsapp(raw);
  return n ? `https://wa.me/${n}` : null;
};
export const telHref = (raw: unknown): string | null => {
  const n = normalizePhone(raw);
  return n ? `tel:${n}` : null;
};
export const mailHref = (raw: unknown): string | null => {
  const n = normalizeEmail(raw);
  return n ? `mailto:${n}` : null;
};

/** The one quick action beside the inquiry form: WhatsApp if usable, otherwise a phone call, otherwise none. */
export function quickAction(site: any, lang: Lang, short = false): QuickAction | null {
  const t = DICT[lang].cta;
  const c = site?.contact ?? {};
  const wa = whatsappHref(c.whatsapp);
  if (wa) return { href: wa, label: short ? t.whatsappShort : t.whatsapp, kind: "whatsapp", external: true };
  const tel = telHref(c.phone);
  if (tel) return { href: tel, label: t.call, kind: "phone", external: false };
  return null;
}

/** Everything the footer, contact page and structured data may show, already validated. */
export function contactDetails(site: any) {
  const c = site?.contact ?? {};
  const phone = normalizePhone(c.phone) ? String(c.phone).trim() : "";
  return {
    phone,
    phoneHref: telHref(c.phone),
    whatsappHref: whatsappHref(c.whatsapp),
    email: normalizeEmail(c.email),
    emailHref: mailHref(c.email),
    /** E.164-style value for schema.org, e.g. +9647701234567 (only when a phone is usable). */
    telephone: normalizePhone(c.phone),
  };
}
