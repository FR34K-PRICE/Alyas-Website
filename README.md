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
3. Add Secrets: `SESSION_SECRET`, `SITE_URL` (`DATABASE_URL` if not already set). **The deployment reads its own secrets**: make sure all three are present for the *deployment* (Deployments → Secrets / Publishing settings), not only in the workspace. Without `DATABASE_URL` the server starts but every page returns a 500 error.
4. Create the first admin in the **Shell**:
   ```bash
   npm run create-admin
   ```
5. **Deploy → Autoscale** (build: `npm run build`, run: `npm run start`). Tables are created automatically on first start.
6. Open `/api/health` on the running server (for example `https://YOUR-DEPLOYMENT/api/health`); see [Health check](#health-check) for how to read it. Then review the site itself in a browser. Point the domain at it only when you are happy.
7. Before launch, run `npm run audit:content` in the Shell (see [Content audit](#content-audit)) and review anything it lists in the admin panel.

### Health check

`GET /api/health` reports on the server that answers it:

| Response | Meaning |
| --- | --- |
| **200** `{"ok":true}` | This running server has the settings it needs and can reach its database. |
| **503** `{"ok":false,"problem":"DATABASE_URL is not set."}` | Add `DATABASE_URL` for this server, then restart it. |
| **503** `…"SESSION_SECRET is not set (32+ characters required)."` | Add a `SESSION_SECRET` of 32 or more characters. |
| **503** `…"The database could not be reached."` | The database is down or `DATABASE_URL` is wrong. The exact error is not exposed; look in the server log. |

A passing check **does not prove the site is published or reachable by visitors** at its public address: it only says the server you asked is healthy. Always load the public URL in a browser too. The body contains only `ok` and a fixed sentence: never a secret value, connection string, host name or database error text. The answer is cached for about five seconds, so it cannot be used to hammer the database, and it is marked `noindex`.

### Other deployment notes

`/` answers with the visitor's language directly (status 200) instead of redirecting, and its canonical link points at `/en` or `/ar`. The older short addresses (`/services`, `/contact-us`, `/about-us`, …) and any address typed without a language still redirect (308 or 307) to the visitor's language. If `SITE_URL` is not set, canonical links and the sitemap use the deployment's own domain (`REPLIT_DOMAINS`) when running as a Replit deployment; set `SITE_URL` to the final public address (for example your custom domain) so they always match it.

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
BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:home
```

`check:security` signs in, creates a throw-away editor to test role limits, then disables it. It does not change published content.

`check:home` checks the public site: the hero copy in both languages, that contact actions come only from the details saved in the CMS, the secondary "Also from ALYAS Group" row, `/`, the old aliases and canonical links, SEO metadata, images and structured data on every public page in both languages, and the health endpoint's contents. It is read-only unless you set `HOME_CHECK_MUTATE=1`, which also proves that untouched starter wording is upgraded while edited wording is preserved exactly, and that WhatsApp/phone/email validation and normalisation agree in the hero, mobile bar, footer, contact page and structured data. That mode temporarily saves and publishes test values in Home and Site & brand and restores your originals: **use a local or isolated test database only, never production.**

`check:audit` (`TEST_DATABASE_URL=… npm run check:audit`) checks the content audit against clearly named seeded rows in an isolated local database and removes them afterwards; it refuses to run against anything but localhost.

`check:pages` exercises the page builder end to end (address rules, unsafe links, drafts, preview, publish/unpublish, address changes, menu limit, sitemap, `hreflang`, roles, and that the built-in pages still open). It creates throw-away pages, one offer and one event, and deletes them afterwards. Both scripts leave a disabled throw-away editor account behind.

## Homepage

- **Message.** The hero says that ALYAS Travel is based in Baghdad and arranges flights, hotels, visa assistance, transportation and tailored trips (English and Arabic wording of similar length). Edit it under **Home page → Hero → Supporting text**. Earlier built-in wording that was never edited is upgraded automatically to the current wording; text an editor has changed is never touched.
- **Contact actions.** The main action is "Plan Your Trip" (the inquiry form), in the hero and header. A second action, **WhatsApp or Call**, appears only if a usable number is saved under **Site & brand → Contact details** (WhatsApp is preferred). Nothing is defaulted or invented: with no details saved, only the inquiry action shows. On phones a slim contact bar stays at the bottom (on the homepage it appears once the hero has scrolled away; it is hidden on the contact page). It is a labelled navigation landmark, its buttons are 48 px tall, focus scrolls clear of it, and a WhatsApp link opens in a new tab (`noopener noreferrer`) with "(opens in a new tab)" announced to screen readers.
- **How contact details are checked.** One set of rules ([`src/content/contact-rules.ts`](src/content/contact-rules.ts)) is used both when saving in the CMS and when rendering the hero, mobile bar, footer, contact page and structured data, so they cannot disagree:
  - *WhatsApp*: international format, 7–15 digits, country code first. `+964 770 123 4567` and `00964 770 123 4567` both become `wa.me/9647701234567`. A local number starting with a single `0` is refused (WhatsApp cannot open it), as are letters, a misplaced `+`, or too few/many digits.
  - *Phone*: 7–15 digits with an optional leading `+`; `00…` becomes `+…`; a local number such as `0770 123 4567` is fine for calling. Anything else is refused.
  - *Email*: one plain address; lists, display names and `?subject=` style additions are refused.
  - The CMS shows a message under the field and will not save a value that fails these rules. **If a site already has an older value that fails (for example a WhatsApp number written as `0770…`), saving Site & brand is blocked until an administrator corrects or clears that field**; the message says which field and why. Until then, failing values are ignored when rendering, so no broken `tel:`, `wa.me` or `mailto:` link is ever produced.
  - *Structured data* (search-engine markup) includes an email only if it passes the rules, and a phone number only if it is written in international form (`+…` or `00…`). A local number still works for the "Call us" link, but is left out of structured data because guessing its country code would be inventing a detail.
- **Secondary services.** Event management and floral arrangements are shown as a quiet "Also from ALYAS Group" row after the travel content, not in the hero. Their text comes from **Events & conferences page** (management) and **Home page → Floral strip**.
- **Empty sections stay hidden.** No offers, upcoming-event or news content appears until real items are published.
- **Known limitation.** A missing page returns a real 404 status with a `noindex` tag and, in a browser, a correctly localised 404 page (right `lang`/`dir`, one H1). Next.js delivers that page's markup after scripts run, so the raw HTML a non-JavaScript client receives is an empty shell.

### Content audit

`npm run audit:content` (run it in the Replit Shell; it uses the database that is already configured there) lists offers, events, news, custom pages, services, media and inquiry counts, and accounts. It **only reads**: it runs in a `READ ONLY` transaction, confirms the database says so before reading anything, and always rolls back. It then lists items under "Review" whose wording resembles test or sample content, each with the field and the reason. These are hints for a person, not verdicts: real content can contain such words, so nothing is deleted or hidden, and you decide in the admin panel. It looks only at the relevant text fields (titles, summaries, destinations, venues, page headings and text), matches whole words, and ignores everyday wording such as "free sample", "test drive" or "Bar Hall". It never reads inquiry names, emails, phone numbers or messages (only a count), and it works on an older database that does not have the `page_redirects` table yet. `npm run check:audit` (isolated local test database only) proves all of this, including that the audit stops without reading anything when the database does not confirm a read-only transaction.

## Page builder (custom pages)

**Admin → Pages → Custom pages** lets administrators and content editors create new bilingual pages without code.

- **A page** has a title, an introduction, a **web address**, reorderable **sections**, a **menu** option and **search & sharing** fields (search title and description, sharing image, "ask search engines not to list this page").
- **Sections** come from a fixed, safe set: hero banner, text, image, gallery, services, offers, events and call to action. Choose which appear and in what order (↑ ↓); no HTML, scripts or embeds are accepted. Services, offers and events pull the live content you already manage; a section with nothing to show (say, offers when none are published) is hidden.
- **Addresses.** Lowercase letters, numbers and hyphens, e.g. `visa-guide`, opening at `/en/visa-guide` and `/ar/visa-guide`. Left empty, the address is made from the English title. The built-in pages (`about`, `travel`, `events`, `contact`), `admin`, `api`, `media` and similar are reserved. Changing the address of a live page changes its live link only when you **Publish**. The old address then keeps working as a **permanent (308) redirect** to the new one, in the same language (`/ar/old` → `/ar/new`, `/en/old` → `/en/new`). Several renames collapse into one hop (old and older addresses all go straight to the current one); moving a page back to an earlier address removes that redirect, so loops cannot form; redirects never point at reserved routes; and unpublishing or deleting the page ends its redirects (the old and new addresses then return 404). An address that redirects to a page cannot be given to a different page. Renames made while a page is unpublished and never yet live create no redirect.
- **Draft, preview, publish.** Save draft keeps changes private; **Preview (English / Arabic)** shows the saved draft to signed-in users; **Publish** makes it live; **Unpublish** hides it again. Deleting is administrator-only.
- **Menu.** Tick "Show this page in the site menu" (optional short label). Up to four custom pages fit in the menu, in the order of the list under Custom pages (use ↑ ↓ there). They sit between Events and Contact.
- **Search.** Published pages are added to `sitemap.xml` in both languages with `hreflang` alternates; canonical links, titles, descriptions and Open Graph tags come from the SEO fields with fallbacks to the page title and the site defaults.
- **Links inside sections** accept a site path (`/contact`, prefixed with the visitor's language automatically), `https://` links, `#anchors`, `mailto:` and `tel:`. Anything else (`javascript:`, `data:`, `//host`) is rejected on save and again when rendering.
- **Technical notes.** Pages are rows of kind `page` in the existing `content` table, so existing tables and rows are not altered. The address-change redirects add **one new table, `page_redirects`** (`from_slug text PRIMARY KEY`, `page_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE`, `created_at timestamptz`, plus an index on `page_id`). It is created automatically at startup with `CREATE TABLE IF NOT EXISTS`, so an existing database gets it on its next start without any manual step or change to its data. Deleting a page removes its redirects through the foreign key; section lists are validated as a typed union built from `src/content/schema.ts`; rendering is in `src/site/sections.tsx`; slug rules are in `src/content/pages.ts`.
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
