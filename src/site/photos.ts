/**
 * Default photography (Unsplash). Used wherever the CMS has no image set, so every image slot stays
 * replaceable from /admin. Files are produced by `npm run prepare-photos` into public/photos.
 * Sources and reuse terms: docs/IMAGE-CREDITS.md.
 */
import manifest from "./photo-manifest.json";
import type { Bi } from "@/content/schema";

export type PhotoKey = "hero" | "coast" | "hiker" | "road" | "window" | "city" | "flowers";

interface Photo {
  alt: Bi;
  credit: { by: string; url: string };
}

export const PHOTOS: Record<PhotoKey, Photo> = {
  hero: {
    alt: { en: "A turquoise alpine lake at dawn, mountains catching the first light", ar: "بحيرة جبلية فيروزية عند الفجر وقمم تلتقط أول ضوء" },
    credit: { by: "Roberto Nickson", url: "https://unsplash.com/photos/calm-mountain-lake-reflecting-snowy-peaks-vZ1JAXUO3-0" },
  },
  coast: {
    alt: { en: "White-washed buildings and a blue dome above a deep blue sea", ar: "مبانٍ بيضاء وقبة زرقاء فوق بحر أزرق عميق" },
    credit: { by: "Chloé Lefleur", url: "https://unsplash.com/photos/a-view-of-a-blue-domed-building-on-the-edge-of-a-cliff-DbBwe7nGr3k" },
  },
  hiker: {
    alt: { en: "A traveller looking out over a canyon at sunrise", ar: "مسافرة تتأمل واديًا عميقًا عند الشروق" },
    credit: { by: "Rafael Peier", url: "https://unsplash.com/photos/woman-on-rocky-canyon-cliff-VGR5ybvqCpA" },
  },
  road: {
    alt: { en: "A four-wheel-drive vehicle on an empty road towards snowy mountains", ar: "سيارة دفع رباعي على طريق خالٍ باتجاه جبال مكسوة بالثلوج" },
    credit: { by: "paje victoria", url: "https://unsplash.com/photos/brown-vehicle-on-road-under-white-sky-2oYHfuRe4OU" },
  },
  window: {
    alt: { en: "An aircraft window framing blue sky and a wing", ar: "نافذة طائرة تُطلّ على السماء الزرقاء وجناح الطائرة" },
    credit: { by: "Allan Rodrigues", url: "https://unsplash.com/photos/a-view-of-a-mirror-lPuqyUgXFmY" },
  },
  city: {
    alt: { en: "Istanbul skyline with the Maiden's Tower on the Bosphorus", ar: "أفق إسطنبول وبرج الفتاة على البوسفور" },
    credit: { by: "Tarik Sami", url: "https://unsplash.com/photos/maidens-tower-in-istanbul-with-modern-skyline-background-5yVvI23NcqY" },
  },
  flowers: {
    alt: { en: "A bouquet of white and cream roses wrapped in paper", ar: "باقة ورد أبيض وكريمي ملفوفة بورق" },
    credit: { by: "Alina Karpenko", url: "https://unsplash.com/photos/white-and-beige-rose-flower-bouquet-WCkWGoHHNOM" },
  },
};

export const AIRCRAFT_CREDIT = { by: "Hanson Lu", url: "https://unsplash.com/photos/white-airplane-on-air-459juebgWIQ" };

type Entry = { width: number; height: number; widths: number[] };
export const dims = (k: PhotoKey | "aircraft"): Entry => (manifest as Record<string, Entry>)[k];

export const srcSet = (name: string, widths: number[], suffix = "") => widths.map((w) => `/photos/${name}${suffix}-${w}.webp ${w}w`).join(", ");
export const photoSrc = (k: PhotoKey, w?: number) => {
  const d = dims(k);
  const use = w ? d.widths.find((x) => x >= w) ?? d.widths[d.widths.length - 1] : d.widths[1] ?? d.widths[0];
  return `/photos/${k}-${use}.webp`;
};

/** Default photograph for a service icon. */
export const PHOTO_FOR_ICON: Record<string, PhotoKey> = { flights: "window", hotels: "coast", visa: "city", transport: "road", tailored: "hero", generic: "hero" };
/** Rotating fallbacks for offers / events without their own image. */
export const OFFER_FALLBACKS: PhotoKey[] = ["coast", "road", "hiker", "window"];
