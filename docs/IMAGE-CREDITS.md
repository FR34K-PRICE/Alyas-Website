# Image sources and reuse terms

All photographs are from **Unsplash** and were retrieved on **2026-09-23**. Each was confirmed on its
Unsplash page as "Free to use under the Unsplash License" (none is an Unsplash+ / premium image).

**Unsplash License (summary, https://unsplash.com/license):** free for commercial and non-commercial use,
no permission or attribution required (attribution is appreciated), modification allowed. You may not sell
unmodified copies of the photos, and may not compile Unsplash images to build a competing photo service.
The licence does **not** grant trademark, property or model-release rights. For that reason the set contains
no identifiable faces, and airline branding was removed from the aircraft (see below).

| Slot in the site | File(s) in `public/photos` | Photographer | Unsplash page | Unsplash photo ID |
| --- | --- | --- | --- | --- |
| Home hero, contact page, travel-page “tailored trips” | `hero-*.webp`, `hero-fg-*.webp` | Roberto Nickson | https://unsplash.com/photos/calm-mountain-lake-reflecting-snowy-peaks-vZ1JAXUO3-0 | `photo-1448518340475-e3c680e9b4be` |
| Hero aircraft | `aircraft.webp` | Hanson Lu | https://unsplash.com/photos/white-airplane-on-air-459juebgWIQ | `photo-1553431340-5da1bd9101e9` |
| Hotels | `coast-*.webp` | Chloé Lefleur | https://unsplash.com/photos/a-view-of-a-blue-domed-building-on-the-edge-of-a-cliff-DbBwe7nGr3k | `photo-1678266561093-324802646fb2` |
| Introduction, About page | `hiker-*.webp` | Rafael Peier | https://unsplash.com/photos/woman-on-rocky-canyon-cliff-VGR5ybvqCpA | `photo-1789335327714-07fbeb84f637` |
| Transportation, introduction inset | `road-*.webp` | paje victoria | https://unsplash.com/photos/brown-vehicle-on-road-under-white-sky-2oYHfuRe4OU | `photo-1578158335529-27b8d78cfea5` |
| Flights | `window-*.webp` | Allan Rodrigues | https://unsplash.com/photos/a-view-of-a-mirror-lPuqyUgXFmY | `photo-1662740458576-a6ac7b53611e` |
| Visa assistance, events, closing call to action | `city-*.webp` | Tarik Sami | https://unsplash.com/photos/maidens-tower-in-istanbul-with-modern-skyline-background-5yVvI23NcqY | `photo-1778083402997-4039f7ff1a97` |
| Floral (secondary) | `flowers-*.webp` | Alina Karpenko | https://unsplash.com/photos/white-and-beige-rose-flower-bouquet-WCkWGoHHNOM | `photo-1557925923-6885735abfb1` |

## What was done to the images

- **Resized and converted** to WebP at several widths (see `scripts/prepare-photos.mjs`).
- **Hero foreground (`hero-fg-*.webp`)**: a per-pixel cut-out of the shore (flowers, grass, rocks) from Roberto
  Nickson's photograph, produced by colour classification of the lake plus flood-fill, then feathered. It is
  aligned with the hero photograph and placed in front of the headline. It is a derivative of that one photo.
- **Aircraft (`aircraft.webp`)**: cut out of Hanson Lu's photograph by modelling the smooth sky and keeping what differs from it (no chroma key, so no cyan fringe), with edge colours taken from the aircraft itself. Airline titling, the registration marks and the tail logo were painted out, and the image is mirrored so the nose points right. The aircraft is in flight with its gear retracted. It is a real airliner photograph, used small and decoratively; no airline is named or implied.
- **Hero grade**: the hero photograph and its foreground are brightened identically (`heroGrade` in `scripts/prepare-photos.mjs`) so the two layers stay matched.
- **Far-shore ribbon**: the original has a very bright, narrow ribbon of water along the far shoreline, which the brightening turned into a hard turquoise line. `scripts/lib-glint.mjs` removes only that ribbon's excess brightness (per column, keeping the forest-to-water step) before grading; both hero layers are made from the softened photo. The foreground mask also clears a pale patch of lake haze above the rocks at the right, feathered on every side.
- The pictures show places and vehicles as **general travel imagery only**. They do not claim that ALYAS
  sells trips to those places. Replace them with ALYAS photography when available.

## Replacing images

Every image slot is replaceable in **/admin** (Media library, then choose the image on the page or service).
The built-in photographs are only fallbacks for slots with no CMS image. To change the built-in set, put new
originals in `assets/source/` (`hero.jpg`, `coast.jpg`, …) and run `npm run prepare-photos`; for a new hero
photograph you also need a matching foreground cut-out, or upload both in Home page → Hero.

Suggested credit line if you choose to credit (not required by the licence):
"Photography: Roberto Nickson, Chloé Lefleur, Rafael Peier, paje victoria, Allan Rodrigues, Tarik Sami,
Alina Karpenko and Hanson Lu on Unsplash."
