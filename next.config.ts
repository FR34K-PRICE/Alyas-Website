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
  allowedDevOrigins: ["*.replit.dev", "*.repl.co", "*.riker.replit.dev"],
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
