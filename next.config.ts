import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "sharp"],
  poweredByHeader: false,
  // Lets the Replit preview pane talk to the dev server.
  // Development only (ignored by `next build` / `next start`). Next.js blocks the dev server's hot-reload socket and
  // other dev resources for any hostname not listed here; without an entry, a phone that opens the site through the
  // computer's local-network address (for example http://192.168.0.107:3000) never finishes hydrating, so none of
  // the site's JavaScript runs there, including hero video autoplay. The private-network patterns below cover that.
  allowedDevOrigins: ["*.replit.dev", "*.repl.co", "*.riker.replit.dev", "192.168.*.*", "10.*.*.*", "*.local"],
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
