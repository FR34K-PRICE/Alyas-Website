/**
 * Single source of truth for CMS content.
 * The same definitions drive (a) the admin forms and (b) server-side validation,
 * so the two can never drift apart. This file must stay free of server-only imports.
 */
import { z } from "zod";

export type Lang = "ar" | "en";
export type Bi = { ar: string; en: string };

export type Field =
  | { key: string; type: "text" | "textarea" | "url" | "link" | "color" | "date" | "boolean" | "number"; label: string; bilingual?: boolean; max?: number; help?: string; rows?: number }
  | { key: string; type: "image"; label: string; help?: string }
  | { key: string; type: "select"; label: string; options: { value: string; label: string }[]; help?: string }
  | { key: string; type: "group"; label: string; fields: Field[]; help?: string }
  | { key: string; type: "list"; label: string; itemLabel: string; fields: Field[]; max?: number; help?: string }
  | { key: string; type: "blocks"; label: string; blocks: BlockDef[]; max?: number; help?: string };

/** One kind of section a page can contain. */
export interface BlockDef {
  type: string;
  label: string;
  description: string;
  fields: Field[];
}

const t = (key: string, label: string, o: Record<string, unknown> = {}): Field => ({ key, type: "text", label, ...o }) as Field;
const ta = (key: string, label: string, o: Record<string, unknown> = {}): Field => ({ key, type: "textarea", label, ...o }) as Field;
const bt = (key: string, label: string, o: Record<string, unknown> = {}): Field => ({ key, type: "text", label, bilingual: true, ...o }) as Field;
const bta = (key: string, label: string, o: Record<string, unknown> = {}): Field => ({ key, type: "textarea", label, bilingual: true, ...o }) as Field;
const img = (key: string, label: string, help?: string): Field => ({ key, type: "image", label, help });
const url = (key: string, label: string, help?: string): Field => ({ key, type: "url", label, help });
const group = (key: string, label: string, fields: Field[], help?: string): Field => ({ key, type: "group", label, fields, help });
const link = (key: string, label: string, help?: string): Field => ({ key, type: "link", label, help, max: 300 });
const check = (key: string, label: string): Field => ({ key, type: "boolean", label });
const choose = (key: string, label: string, options: string[], help?: string): Field => ({ key, type: "select", label, help, options: options.map((o) => ({ value: o, label: o })) });

export const ICONS = [
  { value: "flights", label: "Flights" },
  { value: "hotels", label: "Hotels" },
  { value: "visa", label: "Visa" },
  { value: "transport", label: "Transport" },
  { value: "tailored", label: "Tailored trip" },
  { value: "generic", label: "General" },
];

export type KindKey = "site" | "home" | "about" | "travel" | "events" | "contact" | "service" | "offer" | "event" | "news" | "page";

export interface KindDef {
  key: KindKey;
  label: string;
  plural: string;
  singleton: boolean;
  fields: Field[];
  /** Roles allowed to edit (everyone signed in can read). */
  editRoles: ("admin" | "editor")[];
  /** Which field supplies the English title used for slugs and list rows. */
  titleKey?: string;
  description: string;
}

/** The safe, fixed set of sections a page can be built from. Nothing here accepts HTML or scripts. */
export const SECTIONS: BlockDef[] = [
  {
    type: "hero", label: "Hero banner", description: "A large photograph with a headline and an optional button.",
    fields: [bt("headline", "Headline", { max: 100, help: "Left empty, the page title is used." }), bta("sub", "Supporting text", { max: 300, rows: 2 }), img("image", "Photograph", "A wide landscape works best."), bt("button", "Button label (optional)", { max: 40 }), link("link", "Button link", "A page on this site such as /contact, or a full https:// link.")],
  },
  {
    type: "text", label: "Text", description: "A heading and paragraphs.",
    fields: [bt("heading", "Heading (optional)", { max: 100 }), bta("body", "Text", { max: 6000, rows: 8, help: "Separate paragraphs with a blank line." })],
  },
  {
    type: "image", label: "Image", description: "A single photograph with a caption.",
    fields: [img("image", "Image", "Add a description in the Media library so screen readers can describe it."), bt("caption", "Caption (optional)", { max: 200 }), check("wide", "Full width")],
  },
  {
    type: "gallery", label: "Gallery", description: "A grid of photographs.",
    fields: [bt("heading", "Heading (optional)", { max: 100 }), { key: "images", type: "list", label: "Images", itemLabel: "Image", max: 12, fields: [img("image", "Image"), bt("caption", "Caption (optional)", { max: 160 })] }],
  },
  {
    type: "services", label: "Services", description: "Your published travel services.",
    fields: [bt("heading", "Heading (optional)", { max: 100 }), bta("intro", "Intro (optional)", { max: 300, rows: 2 }), choose("limit", "How many to show", ["3", "4", "5"], "Shows the first services in the order set under Services. Defaults to 5.")],
  },
  {
    type: "offers", label: "Offers", description: "Your published travel offers. Expired offers hide automatically.",
    fields: [bt("heading", "Heading (optional)", { max: 100 }), bta("intro", "Intro (optional)", { max: 300, rows: 2 }), choose("limit", "How many to show", ["3", "6"], "Defaults to 3.")],
  },
  {
    type: "events", label: "Events", description: "Your upcoming events. Past events hide automatically.",
    fields: [bt("heading", "Heading (optional)", { max: 100 }), bta("intro", "Intro (optional)", { max: 300, rows: 2 }), choose("limit", "How many to show", ["3", "6", "12"], "Defaults to 6.")],
  },
  {
    type: "cta", label: "Call to action", description: "A photograph with a message and a button.",
    fields: [bt("title", "Title", { max: 100 }), bta("body", "Text (optional)", { max: 300, rows: 2 }), bt("button", "Button label", { max: 40 }), link("link", "Button link", "Left empty, the button opens the contact page."), img("image", "Background photograph")],
  },
];

export const KINDS: Record<KindKey, KindDef> = {
  site: {
    key: "site", label: "Site & brand", plural: "Site & brand", singleton: true, editRoles: ["admin"],
    description: "Name, logo, colors, contact details, social links and search-engine defaults.",
    fields: [
      group("brand", "Brand", [
        bt("siteName", "Site name", { max: 80, help: "Used in page titles and search results." }),
        bt("brandMain", "Wordmark (large)", { max: 30, help: "Shown in the header when no logo is uploaded." }),
        bt("brandSub", "Wordmark (small)", { max: 30 }),
        bt("tagline", "Tagline", { max: 140 }),
        img("logo", "Logo (for light backgrounds)", "PNG or WebP with a transparent background works best."),
        img("logoLight", "Logo (for the dark hero)", "Optional light version. Falls back to the main logo."),
      ]),
      group("colors", "Colors", [
        { key: "primary", type: "color", label: "Primary (deep navy)" },
        { key: "accent", type: "color", label: "Accent (gold)" },
        { key: "paper", type: "color", label: "Page background" },
      ], "Leave a color empty to use the default."),
      group("contact", "Contact details", [
        t("phone", "Phone", { max: 40, help: "Shown only when filled in, with the country code (7 or more digits). Used for a “Call us” button in the hero and on the mobile contact bar when no WhatsApp number is set, and in the footer and contact page." }),
        t("whatsapp", "WhatsApp number", { max: 40, help: "Digits with country code, e.g. 9647xxxxxxxxx (7 to 15 digits). Adds a WhatsApp button to the hero and the mobile contact bar, and a link in the footer and contact page. Leave empty to show no WhatsApp button." }),
        t("email", "Email", { max: 120 }),
        bt("address", "Address", { max: 200 }),
        bt("hours", "Opening hours", { max: 200 }),
        url("mapUrl", "Map link", "A Google Maps (or similar) link shown as “Open in maps”."),
        url("mapEmbed", "Map embed URL", "Optional. The iframe src from a map's Share > Embed option."),
      ]),
      group("social", "Social links", [
        url("facebook", "Facebook"),
        url("instagram", "Instagram"),
        url("linkedin", "LinkedIn"),
        url("youtube", "YouTube"),
        url("tiktok", "TikTok"),
      ]),
      group("seo", "Search & sharing", [
        bta("description", "Default description", { max: 300, rows: 3 }),
        img("ogImage", "Sharing image", "Shown when the site is shared. 1200×630 works best."),
      ]),
      bt("footerNote", "Footer note", { max: 200 }),
    ],
  },
  home: {
    key: "home", label: "Home page", plural: "Home page", singleton: true, editRoles: ["admin", "editor"],
    description: "Hero, introduction and the calls to action on the home page.",
    fields: [
      group("hero", "Hero", [
        bt("headline", "Headline", { max: 40, help: "One strong word works best, e.g. “Explore”. Long headlines are set smaller automatically." }),
        bta("sub", "Supporting text", { max: 200, rows: 3 }),
        bt("primaryCta", "Button", { max: 32 }),
        img("backdrop", "Hero photograph (optional)", "A wide landscape, at least 2400 px across. Leave empty to use the built-in mountain-lake photograph."),
        img("foreground", "Foreground cut-out (optional)", "A transparent PNG/WebP of the same photograph's foreground (rocks, plants) so the headline sits behind it. Only used together with your own hero photograph, cropped identically."),
        img("airplane", "Airplane image (optional)", "A transparent PNG/WebP of an aircraft in flight with its nose pointing right (it is mirrored automatically in Arabic). Leave empty to use the built-in airliner."),
      ]),
      group("intro", "Introduction", [
        bt("title", "Title", { max: 100 }),
        bta("body", "Text", { max: 800, rows: 4 }),
        img("image", "Large portrait image"),
        img("image2", "Smaller landscape image"),
      ]),
      group("services", "Services heading", [bt("title", "Title", { max: 100 }), bta("intro", "Intro", { max: 300, rows: 2 })]),
      group("offers", "Offers heading", [bt("title", "Title", { max: 100 }), bta("intro", "Intro", { max: 300, rows: 2 })]),
      group("floral", "Floral strip (shown under “Also from ALYAS Group”)", [bt("title", "Title", { max: 100 }), bta("body", "Text", { max: 400, rows: 3 }), img("image", "Image")]),
      group("cta", "Closing call to action", [bt("title", "Title", { max: 100 }), bta("body", "Text", { max: 300, rows: 2 }), bt("button", "Button", { max: 40 }), img("image", "Background photograph")]),
    ],
  },
  about: {
    key: "about", label: "About page", plural: "About page", singleton: true, editRoles: ["admin", "editor"],
    description: "Company introduction and service approach.",
    fields: [
      bt("title", "Page title", { max: 100 }),
      bta("lead", "Lead paragraph", { max: 500, rows: 3 }),
      bta("body", "Story", { max: 3000, rows: 8, help: "Separate paragraphs with a blank line." }),
      img("image", "Image"),
      bt("approachTitle", "Approach heading", { max: 100 }),
      { key: "approach", type: "list", label: "Approach points", itemLabel: "Point", max: 8, fields: [bt("title", "Title", { max: 80 }), bta("body", "Text", { max: 400, rows: 3 })] },
    ],
  },
  travel: {
    key: "travel", label: "Travel services page", plural: "Travel services page", singleton: true, editRoles: ["admin", "editor"],
    description: "Heading area of the travel services page. The services themselves are managed under Services.",
    fields: [bt("title", "Page title", { max: 100 }), bta("lead", "Lead paragraph", { max: 500, rows: 3 }), img("image", "Image"), bt("ctaTitle", "Closing title", { max: 100 }), bta("ctaBody", "Closing text", { max: 300, rows: 2 })],
  },
  events: {
    key: "events", label: "Events & conferences page", plural: "Events & conferences page", singleton: true, editRoles: ["admin", "editor"],
    description: "Company services for events and conferences, and the floral section. Upcoming events and news are managed separately.",
    fields: [
      bt("title", "Page title", { max: 100 }),
      bta("lead", "Lead paragraph", { max: 500, rows: 3 }),
      img("image", "Image"),
      group("management", "Event & conference management", [bt("title", "Title", { max: 100 }), bta("body", "Text", { max: 800, rows: 4 })]),
      { key: "capabilities", type: "list", label: "What we handle", itemLabel: "Item", max: 8, fields: [bt("title", "Title", { max: 80 }), bta("body", "Text", { max: 300, rows: 2 })] },
      group("floral", "Floral arrangements", [bt("title", "Title", { max: 100 }), bta("body", "Text", { max: 800, rows: 4 }), img("image", "Image")]),
      bt("upcomingTitle", "Upcoming events heading", { max: 80 }),
      bt("newsTitle", "News heading", { max: 80 }),
    ],
  },
  contact: {
    key: "contact", label: "Contact page", plural: "Contact page", singleton: true, editRoles: ["admin", "editor"],
    description: "Text around the inquiry form. Contact details live under Site & brand.",
    fields: [bt("title", "Page title", { max: 100 }), bta("lead", "Lead paragraph", { max: 400, rows: 3 }), img("image", "Image"), bta("formIntro", "Text above the form", { max: 300, rows: 2 }), bta("success", "Message after sending", { max: 300, rows: 2 })],
  },
  service: {
    key: "service", label: "Service", plural: "Services", singleton: false, editRoles: ["admin", "editor"], titleKey: "title",
    description: "Travel services shown on the home and travel pages.",
    fields: [
      bt("title", "Title", { max: 80 }),
      bta("summary", "Short description", { max: 260, rows: 3 }),
      bta("details", "Details (optional)", { max: 1500, rows: 5 }),
      { key: "icon", type: "select", label: "Icon", options: ICONS },
      img("image", "Image"),
    ],
  },
  offer: {
    key: "offer", label: "Offer", plural: "Travel offers", singleton: false, editRoles: ["admin", "editor"], titleKey: "title",
    description: "Published offers appear on the home page. Expired offers hide automatically.",
    fields: [
      bt("title", "Title", { max: 100 }),
      bt("destination", "Destination", { max: 80 }),
      bta("summary", "Short description", { max: 300, rows: 3 }),
      bta("details", "Details (optional)", { max: 2000, rows: 5 }),
      bt("priceLabel", "Price label (optional)", { max: 60, help: "Type exactly what should be shown, e.g. “From $450”. Left empty, no price is shown." }),
      { key: "validUntil", type: "date", label: "Valid until (optional)" },
      { key: "featured", type: "boolean", label: "Feature on the home page" },
      img("image", "Image"),
    ],
  },
  event: {
    key: "event", label: "Event", plural: "Events & conferences", singleton: false, editRoles: ["admin", "editor"], titleKey: "title",
    description: "Upcoming conferences and events. Past events hide from the public page automatically.",
    fields: [
      bt("title", "Title", { max: 120 }),
      { key: "startDate", type: "date", label: "Start date" },
      { key: "endDate", type: "date", label: "End date (optional)" },
      bt("venue", "Venue", { max: 120 }),
      bt("city", "City", { max: 80 }),
      bta("summary", "Short description", { max: 300, rows: 3 }),
      bta("details", "Details (optional)", { max: 3000, rows: 6 }),
      url("link", "Registration or info link (optional)"),
      img("image", "Image"),
    ],
  },
  news: {
    key: "news", label: "News item", plural: "News", singleton: false, editRoles: ["admin", "editor"], titleKey: "title",
    description: "Announcements shown on the events page.",
    fields: [
      bt("title", "Title", { max: 140 }),
      { key: "date", type: "date", label: "Date" },
      bta("summary", "Short description", { max: 300, rows: 3 }),
      bta("body", "Full text (optional)", { max: 6000, rows: 8 }),
      img("image", "Image"),
    ],
  },
  page: {
    key: "page", label: "Page", plural: "Custom pages", singleton: false, editRoles: ["admin", "editor"], titleKey: "title",
    description: "Build new pages from ready-made sections. Each page has its own address and works in Arabic and English.",
    fields: [
      bt("title", "Page title", { max: 100, help: "Shown as the main heading and in the browser tab." }),
      t("slug", "Web address", { max: 60, help: "Lowercase letters, numbers and hyphens, e.g. visa-guide. The page opens at /en/visa-guide and /ar/visa-guide. Left empty, it is made from the English title. A live page's address changes only when you publish; the old address then keeps working and redirects to the new one." }),
      bta("lead", "Introduction (optional)", { max: 400, rows: 2, help: "A short line under the title. Not shown when the first section is a hero banner." }),
      { key: "sections", type: "blocks", label: "Sections", max: 30, help: "Add sections and use the arrows to reorder them. Sections with nothing to show (for example offers when none are published) stay hidden.", blocks: SECTIONS },
      group("nav", "Menu", [check("show", "Show this page in the site menu"), bt("label", "Menu label (optional)", { max: 24, help: "A shorter name for the menu. Left empty, the page title is used. Up to four pages can appear in the menu." })]),
      group("seo", "Search & sharing", [
        bt("title", "Search title (optional)", { max: 70, help: "Left empty, the page title is used." }),
        bta("description", "Search description (optional)", { max: 300, rows: 3, help: "About 150 characters works best." }),
        img("image", "Sharing image (optional)", "Shown when the page is shared. 1200×630 works best."),
        check("noindex", "Ask search engines not to list this page"),
      ]),
    ],
  },
};

export const SINGLETON_KEYS = (Object.keys(KINDS) as KindKey[]).filter((k) => KINDS[k].singleton);
export const COLLECTION_KEYS = (Object.keys(KINDS) as KindKey[]).filter((k) => !KINDS[k].singleton);
export const isKind = (k: string): k is KindKey => k in KINDS;

/* ---------------- Validation built from the field definitions ---------------- */

/** Internal path, anchor, https/http, mailto or tel. Anything else (javascript:, data:, //host) is refused. */
export function isSafeLink(v: string): boolean {
  if (v === "") return true;
  if (/[\s<>"'`\\]/.test(v)) return false;
  if (/^\/(?!\/)\S*$/.test(v) || /^#[A-Za-z0-9_-]+$/.test(v)) return true;
  if (/^https?:\/\/[^\s/]+/i.test(v)) return true;
  return /^(mailto:[^\s@]+@[^\s@]+|tel:[+0-9() -]{3,30})$/i.test(v);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function scalar(f: Field & { type: string }): z.ZodType {
  const max = ("max" in f && f.max) || (f.type === "textarea" ? 5000 : 200);
  switch (f.type) {
    case "text":
    case "textarea":
      return z.string().trim().max(max, `Keep this under ${max} characters.`);
    case "url":
      return z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v) || /^http:\/\/[^\s]+$/i.test(v), "Enter a full link starting with https://");
    case "link":
      return z.string().trim().max(300).refine(isSafeLink, "Use a page like /contact, a full https:// link, an anchor like #offers, or mailto:/tel:.");
    case "color":
      return z.string().trim().refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Use a hex color like #0B2545.");
    case "date":
      return z.string().trim().refine((v) => v === "" || (DATE_RE.test(v) && !Number.isNaN(Date.parse(v))), "Use the date picker (YYYY-MM-DD).");
    case "image":
      return z.string().trim().refine((v) => v === "" || UUID_RE.test(v), "Pick an image from the library.");
    case "boolean":
      return z.boolean();
    case "number":
      return z.number();
    case "select": {
      const opts = ((f as any).options as { value: string }[]).map((o) => o.value);
      return z.string().refine((v) => v === "" || opts.includes(v), "Choose one of the options.");
    }
    default:
      return z.unknown();
  }
}

function fieldSchema(f: Field): z.ZodType {
  if (f.type === "group") return objectSchema(f.fields);
  if (f.type === "list") return z.array(objectSchema(f.fields)).max(f.max ?? 30);
  if (f.type === "blocks") {
    const variants = f.blocks.map((b) => objectSchema(b.fields).extend({ type: z.literal(b.type) }));
    return z.array(z.discriminatedUnion("type", variants as any)).max(f.max ?? 30);
  }
  const s = scalar(f as any);
  if ("bilingual" in f && f.bilingual) return z.object({ ar: s, en: s });
  return s;
}

function objectSchema(fields: Field[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) shape[f.key] = fieldSchema(f).optional();
  return z.object(shape);
}

const cache = new Map<string, z.ZodObject<any>>();
export function schemaFor(kind: KindKey) {
  let s = cache.get(kind);
  if (!s) cache.set(kind, (s = objectSchema(KINDS[kind].fields)));
  return s;
}

/* ---------------- Helpers shared by site and admin ---------------- */

export function emptyValue(f: Field): unknown {
  if (f.type === "group") return Object.fromEntries(f.fields.map((c) => [c.key, emptyValue(c)]));
  if (f.type === "list" || f.type === "blocks") return [];
  if (f.type === "boolean") return false;
  if (f.type === "number") return 0;
  if ("bilingual" in f && f.bilingual) return { ar: "", en: "" };
  return "";
}
/** A new, empty section of the given type. */
export function emptyBlock(def: BlockDef): Record<string, unknown> {
  return { type: def.type, ...Object.fromEntries(def.fields.map((c) => [c.key, emptyValue(c)])) };
}
export const emptyData = (kind: KindKey) => Object.fromEntries(KINDS[kind].fields.map((f) => [f.key, emptyValue(f)]));

/** Fill gaps in `data` from `base`; empty strings fall back to the default. */
export function deepMerge<T>(base: T, data: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(data) ? data : base) as T;
  if (base && typeof base === "object") {
    const out: any = { ...(base as any) };
    const d = (data && typeof data === "object" ? data : {}) as any;
    for (const k of Object.keys(out)) out[k] = deepMerge(out[k], d[k]);
    return out;
  }
  if (typeof base === "string") return (typeof data === "string" && data.trim() !== "" ? data : base) as T;
  return (data === undefined || data === null ? base : data) as T;
}

export const pick = (v: Bi | string | undefined | null, lang: Lang): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang]?.trim() ? v[lang] : v[lang === "ar" ? "en" : "ar"] || "";
};

export function slugify(input: string): string {
  const s = input.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s;
}
