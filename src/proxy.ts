import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG, LANG_COOKIE, isLang } from "@/i18n/dict";

const PAGES = new Set(["about", "travel", "events", "contact"]);
const SYSTEM = new Set(["admin", "api", "preview", "media", "photos", "sitemap", "robots", "icon", "favicon"]);
// Old or hand-typed URLs without a language prefix are sent to the visitor's language.
const ALIASES: Record<string, string> = { services: "travel", "travel-services": "travel", conferences: "events", "events-conferences": "events", "contact-us": "contact", "about-us": "about" };

function preferred(req: NextRequest) {
  const saved = req.cookies.get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  const accept = (req.headers.get("accept-language") || "").toLowerCase();
  const first = accept.split(",")[0] ?? "";
  if (first.startsWith("en")) return "en";
  return DEFAULT_LANG;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split("/").filter(Boolean);
  const head = seg[0];

  if (head === "admin") {
    const h = new Headers(req.headers);
    h.set("x-alyas-lang", "en");
    const res = NextResponse.next({ request: { headers: h } });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (head === "preview" && isLang(seg[1])) {
    const h = new Headers(req.headers);
    h.set("x-alyas-lang", seg[1]);
    const res = NextResponse.next({ request: { headers: h } });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (isLang(head)) {
    const h = new Headers(req.headers);
    h.set("x-alyas-lang", head);
    const res = NextResponse.next({ request: { headers: h } });
    // Remember the visitor's language so `/` and unprefixed links open in it next time.
    res.cookies.set(LANG_COOKIE, head, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  const lang = preferred(req);
  const url = req.nextUrl.clone();
  if (seg.length === 0) {
    // Serve the visitor's language at "/" directly (status 200) rather than redirecting, so a deployment health
    // check on "/" succeeds. The page's canonical link points at /ar or /en.
    const h = new Headers(req.headers);
    h.set("x-alyas-lang", lang);
    url.pathname = `/${lang}`;
    const res = NextResponse.rewrite(url, { request: { headers: h } });
    res.headers.set("Vary", "Accept-Language, Cookie");
    res.headers.set("Cache-Control", "private, no-cache");
    return res;
  }
  const alias = ALIASES[head] ?? head;
  if (PAGES.has(alias)) {
    url.pathname = `/${lang}/${alias}`;
    return NextResponse.redirect(url, 308);
  }
  // A hand-typed address without a language, such as /visa-guide, goes to the visitor's language; the page
  // itself returns 404 when no such custom page exists.
  if (seg.length === 1 && /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]?$/.test(head) && !SYSTEM.has(head)) {
    url.pathname = `/${lang}/${head}`;
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|media|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
