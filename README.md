# ALYAS Travel: website and CMS

Bilingual (Arabic RTL / English) marketing site for ALYAS Travel, part of ALYAS Group in Baghdad, with a built-in admin panel at `/admin`.

- **Public site**: home (animated hero), about, travel services, events & conferences, contact. Floral services appear as a secondary ALYAS Group offer.
- **Page builder**: create new bilingual pages from safe, reorderable sections, with their own address, SEO fields, draft preview, publish/unpublish and an optional menu entry. See [Page builder](#page-builder-custom-pages).
- **CMS**: edit all Arabic/English copy, brand (name, logo, colors), services, offers, events, news, contact details and social links; upload images; save drafts, preview, publish; triage inquiries.
- **Stack**: Next.js 16 (App Router, TypeScript), PostgreSQL, `sharp` for images, `zod` for validation. No animation library and no CSS framework: hand-written CSS with logical properties so RTL is native.
- **Design**: a travel-editorial look: a full-bleed destination photograph with an oversized headline sitting behind a real foreground cut-out, white pages, photographic service tiles, alternating photo compositions, Bricolage Grotesque (Latin) and Readex Pro (Arabic) headlines. Photo sources and reuse terms: [docs/IMAGE-CREDITS.md](docs/IMAGE-CREDITS.md).

There is **no** flight search, booking, ticketing, payment or airline integration. Actions are inquiries ("Plan Your Trip", "Request Details").

---

## Run it locally

Requires Node 20.9+ (22 recommended).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. With no `DATABASE_URL`, development uses an embedded Postgres (PGlite) stored in `.data/`, so no database setup is needed. This fallback is disabled in production.

Create the first administrator (stop the dev server first when using the embedded database, because it allows only one process at a time):

```bash
npm run create-admin
```

You are prompted for an email and a password (12+ characters, letters and numbers). The password is stored only as a salted scrypt hash. Then sign in at <http://localhost:3000/admin>.

> There is deliberately **no** sign-up page or public endpoint that creates users. Administrators create editors under **Admin → Users**, or run `npm run create-admin` again (running it for an existing email resets that password and sets the role to administrator).

## Environment variables

Copy `.env.example` to `.env.local` for local use. On Replit, use **Secrets**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | production | PostgreSQL connection string. Content, users, sessions, inquiries **and uploaded images** live here. |
| `SESSION_SECRET` | production | 32+ random characters. Signs inquiry tokens and peppers the session-token hash. Rotating it signs everyone out. |
| `SITE_URL` | production | Public origin without trailing slash, e.g. `https://alyas-travel.com`. Used for canonical URLs, sitemap, Open Graph and CSRF origin checks. |
| `TRUST_PROXY` | optional | `true` (default) trusts `X-Forwarded-For` for rate limits. Keep `true` on Replit. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional | Cloudflare Turnstile for the inquiry form. Leave empty to rely on honeypot + timing + rate limits. |
| `PG_POOL_MAX` | optional | Max Postgres connections (default 10). |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Deploy on Replit

1. Import the project into a Repl. `.replit` is already configured.
2. Open the **Database** tool, create a PostgreSQL database (this sets `DATABASE_URL`), or paste an external Postgres URL into Secrets.
3. Add Secrets: `SESSION_SECRET`, `SITE_URL` (`DATABASE_URL` if not already set).
4. Create the first admin in the **Shell**:
   ```bash
   npm run create-admin
   ```
5. **Deploy → Autoscale** (build: `npm run build`, run: `npm run start`). Tables are created automatically on first start.
6. Review the deployment URL. Point the domain at it only when you are happy.

The filesystem on Replit deployments is temporary, so nothing is written to disk in production: images are processed with `sharp` and stored in Postgres (`media_files`), served with long-lived cache headers.

## Using the CMS

Sign in at `/admin`.

- **Save draft** stores changes privately. **Preview (English / Arabic)** opens the draft in a new tab, visible only to signed-in users. **Publish** makes it live. Entries (services, offers, events, news) can also be **Unpublished**.
- Empty fields stay hidden on the site: no phone/email/WhatsApp until you enter them, no offers section until an offer is published, no events/news until you add them. Expired offers and past events hide automatically.
- A text field left empty falls back to the built-in starter copy for that field.
- **Media library**: upload JPG/PNG/WebP/AVIF (max 8 MB). Images are re-encoded to WebP at several widths and EXIF is stripped. Add Arabic/English descriptions for screen readers.
- **Inquiries**: statuses New / In progress / Resolved / Spam, plus an internal note.
- **Site & brand** (administrators only): names, wordmark, logos, colors, contact details, social links, sharing image.

| | Administrator | Content editor |
| --- | :-: | :-: |
| Edit pages, services, offers, events, news; save, preview, publish | ✓ | ✓ |
| Upload/edit images; work inquiries | ✓ | ✓ |
| Site & brand (logo, colors, contact, social) | ✓ | – |
| Delete content, images, inquiries | ✓ | – |
| Manage users | ✓ | – |

## Security summary

- Server-side session check on every `/admin` page, preview page and `/api/admin/*` endpoint; role checks per action. Verified by `npm run check:security`.
- Sessions: random 256-bit token, only its keyed hash is stored; HttpOnly, SameSite=Lax, Secure in production; 8 h idle / 7 d absolute; revocable (disabling a user or changing a password ends sessions).
- Passwords: scrypt (N=32768), salted, constant-time verification, 12-character minimum.
- Login limits: 5 failures / 15 min per client+account, 12 per account, 20 per client. Stored in the database, so limits hold across instances.
- CSRF: mutating requests need a custom header plus a same-origin `Origin`.
- Inputs validated with zod (schemas derived from the same definitions that build the admin forms). Colors and URLs are strictly validated; colors are re-checked when injected into CSS.
- Uploads: type detected from file bytes, SVG/GIF refused, 8 MB cap, pixel limit, re-encoded (no original bytes are stored or served).
- Inquiry form: honeypot, signed timing token, per-IP rate limit, optional Turnstile, duplicate suppression.
- No secrets in the repository; there are no default credentials.

## Checks

```bash
npm run typecheck
npm run build
BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:security
BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:pages
```

`check:security` signs in, creates a throw-away editor to test role limits, then disables it. It does not change published content.

`check:pages` exercises the page builder end to end (address rules, unsafe links, drafts, preview, publish/unpublish, address changes, menu limit, sitemap, `hreflang`, roles, and that the built-in pages still open). It creates throw-away pages, one offer and one event, and deletes them afterwards. Both scripts leave a disabled throw-away editor account behind.

## Page builder (custom pages)

**Admin → Pages → Custom pages** lets administrators and content editors create new bilingual pages without code.

- **A page** has a title, an introduction, a **web address**, reorderable **sections**, a **menu** option and **search & sharing** fields (search title and description, sharing image, "ask search engines not to list this page").
- **Sections** come from a fixed, safe set: hero banner, text, image, gallery, services, offers, events and call to action. Choose which appear and in what order (↑ ↓); no HTML, scripts or embeds are accepted. Services, offers and events pull the live content you already manage; a section with nothing to show (say, offers when none are published) is hidden.
- **Addresses.** Lowercase letters, numbers and hyphens, e.g. `visa-guide`, opening at `/en/visa-guide` and `/ar/visa-guide`. Left empty, the address is made from the English title. The built-in pages (`about`, `travel`, `events`, `contact`), `admin`, `api`, `media` and similar are reserved. Changing the address of a live page changes its live link only when you **Publish**. The old address then keeps working as a **permanent (308) redirect** to the new one, in the same language (`/ar/old` → `/ar/new`, `/en/old` → `/en/new`). Several renames collapse into one hop (old and older addresses all go straight to the current one); moving a page back to an earlier address removes that redirect, so loops cannot form; redirects never point at reserved routes; and unpublishing or deleting the page ends its redirects (the old and new addresses then return 404). An address that redirects to a page cannot be given to a different page. Renames made while a page is unpublished and never yet live create no redirect.
- **Draft, preview, publish.** Save draft keeps changes private; **Preview (English / Arabic)** shows the saved draft to signed-in users; **Publish** makes it live; **Unpublish** hides it again. Deleting is administrator-only.
- **Menu.** Tick "Show this page in the site menu" (optional short label). Up to four custom pages fit in the menu, in the order of the list under Custom pages (use ↑ ↓ there). They sit between Events and Contact.
- **Search.** Published pages are added to `sitemap.xml` in both languages with `hreflang` alternates; canonical links, titles, descriptions and Open Graph tags come from the SEO fields with fallbacks to the page title and the site defaults.
- **Links inside sections** accept a site path (`/contact`, prefixed with the visitor's language automatically), `https://` links, `#anchors`, `mailto:` and `tel:`. Anything else (`javascript:`, `data:`, `//host`) is rejected on save and again when rendering.
- **Technical notes.** Pages are rows of kind `page` in the existing `content` table (no schema change, so existing content is untouched); section lists are validated as a typed union built from `src/content/schema.ts`; rendering is in `src/site/sections.tsx`; slug rules are in `src/content/pages.ts`.
- **Limits.** Old addresses are kept as redirects for as long as the page exists (they cannot be removed one by one). Each page is one document shown in both languages (a language left empty falls back to the other), there is no per-language publishing, and the menu holds four custom pages.

## Hero and photography

`src/components/site/Hero.tsx` and `public/photos/`.

- **Layers** (back to front): hero photograph, shade, aircraft, headline, **foreground cut-out**, copy and button. The cut-out is the shore (flowers, grass, rocks) separated from the same photograph per pixel, so it overlaps the bottom of the headline for depth. A soft shade behind the headline keeps it readable: measured on the rendered page, its contrast against the photo is about 5:1 median on desktop and about 3.6:1 on phones (large text; the supporting copy is above 7:1). Replacing the hero photograph means re-checking this.
- **Aircraft**: a real airliner photograph (gear retracted), cut out by modelling the sky, with airline marks painted out. Home page → Hero has an optional "Airplane image" (transparent PNG/WebP, nose pointing right, mirrored automatically in Arabic); the built-in one is the fallback. It crosses an open part of the sky once (Web Animations API, no library), then stays put. Reduced motion or no scripts: it is simply parked. It pauses offscreen; phones and weaker devices get a shorter, smaller version. No scroll hijacking, no intro screen, no sound.
- **Text layout follows the photograph**: the headline sits on the right and the copy on the left in both languages; Arabic has its own headline scale, leading and line lengths.
- **CMS**: every image slot is replaceable (Media library). Home page → Hero has "Hero photograph" and "Foreground cut-out". A custom hero photograph is used *without* the built-in cut-out unless you also upload a matching cut-out, because the two must be cropped identically.
- **Regenerating assets**: put originals in `assets/source/` (`hero.jpg`, `coast.jpg`, `hiker.jpg`, `road.jpg`, `window.jpg`, `city.jpg`, `flowers.jpg`, `aircraft.jpg`; the aircraft mark positions in `prepare-photos.mjs` are specific to the supplied photo) and run `npm run prepare-photos`. It writes WebP sizes, the hero foreground, the aircraft cut-out and `src/site/photo-manifest.json`.

## Project layout

```
src/app/                 routes: [lang]/, preview/, admin/, api/, media/, sitemap, robots
src/site/                page composers, section renderers (sections.tsx), data loading, metadata
src/components/site/     Header, Hero, Photo (Img), Footer, ContactForm, ...
src/admin/               CMS client components (form engine, editors, media, inquiries, users)
src/content/             schema.ts (single source of truth), defaults.ts, store.ts
src/lib/                 db, auth, passwords, security, media, inquiries
src/i18n/dict.ts         interface strings (Arabic and English)
scripts/                 create-admin.ts, security-check.mjs, prepare-photos.mjs, start.mjs
docs/IMAGE-CREDITS.md    photo sources, licences, processing
```

Interface labels (buttons, form labels, navigation, error messages) live in `src/i18n/dict.ts`; all page content is editable in the CMS.
