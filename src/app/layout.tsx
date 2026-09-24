import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/readex-pro/index.css";
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/latin-400.css";
import "@fontsource/ibm-plex-sans-arabic/latin-600.css";
import "@/styles/globals.css";
import "@/styles/site.css";
import { LANG_COOKIE, dirOf, isLang } from "@/i18n/dict";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = { metadataBase: new URL(siteUrl()) };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b2545" };

// Runs before first paint: only sets a class when motion is allowed, so the static hero is the default.
const MOTION_SNIPPET = "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js-motion')}catch(e){}";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const fromHeader = h.get("x-alyas-lang");
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(fromHeader) ? fromHeader : isLang(saved) ? saved : "ar";
  return (
    <html lang={lang} dir={dirOf(lang)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_SNIPPET }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
