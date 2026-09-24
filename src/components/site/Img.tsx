import { pick, type Lang } from "@/content/schema";
import { dims, PHOTOS, srcSet, type PhotoKey } from "@/site/photos";

export interface MediaInfo {
  width: number;
  height: number;
  alt_ar: string;
  alt_en: string;
}
export type MediaMap = Record<string, MediaInfo>;

const CMS_WIDTHS = [480, 960, 1600, 2400];

/**
 * A photograph with stable dimensions and a responsive srcset.
 * Prefers an image from the CMS media library (`id`); otherwise shows the licensed default photo
 * for this slot. `decorative` gives an empty alt (use when the surrounding text already says it).
 */
export function Photo({
  id,
  media,
  lang,
  fallback,
  ratio,
  fill = false,
  sizes = "(min-width: 900px) 50vw, 100vw",
  priority = false,
  className = "",
  pos = "50% 50%",
  decorative = false,
}: {
  id?: string;
  media: MediaMap;
  lang: Lang;
  fallback: PhotoKey;
  ratio?: string; // CSS aspect-ratio, e.g. "4 / 5"
  fill?: boolean; // fill the parent instead (parent must be positioned)
  sizes?: string;
  priority?: boolean;
  className?: string;
  pos?: string;
  decorative?: boolean;
}) {
  const info = id ? media[id] : undefined;
  const loading = priority ? "eager" : "lazy";
  if (id && info) {
    const usable = CMS_WIDTHS.filter((w) => w < info.width).concat([Math.min(info.width, 2400)]);
    const alt = decorative ? "" : lang === "ar" ? info.alt_ar || info.alt_en : info.alt_en || info.alt_ar;
    return (
      <div className={`photo ${fill ? "photo--fill" : ""} ${className}`} style={fill ? undefined : { aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/media/${id}?w=1600`}
          srcSet={usable.map((w) => `/media/${id}?w=${w} ${w}w`).join(", ")}
          sizes={sizes}
          width={info.width}
          height={info.height}
          alt={alt || ""}
          loading={loading}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          style={{ objectPosition: pos }}
        />
      </div>
    );
  }
  const d = dims(fallback);
  return (
    <div className={`photo ${fill ? "photo--fill" : ""} ${className}`} style={fill ? undefined : { aspectRatio: ratio }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/photos/${fallback}-${d.widths[1] ?? d.widths[0]}.webp`}
        srcSet={srcSet(fallback, d.widths)}
        sizes={sizes}
        width={d.width}
        height={d.height}
        alt={decorative ? "" : pick(PHOTOS[fallback].alt, lang)}
        loading={loading}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        style={{ objectPosition: pos }}
      />
    </div>
  );
}

export const mediaUrl = (id: string, w = 1600) => `/media/${id}?w=${w}`;
export { pick };
