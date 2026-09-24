const isProd = process.env.NODE_ENV === "production";

/** Development-only fallback so `npm run dev` works with zero setup. Never used in production. */
const DEV_SECRET = "dev-only-secret-do-not-use-in-production-0123456789";

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd) throw new Error("SESSION_SECRET must be set (32+ characters) in production.");
  return DEV_SECRET;
}

export function siteUrl(): string {
  const raw = process.env.SITE_URL?.replace(/\/+$/, "");
  if (raw) return raw;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:3000";
}

export const trustProxy = () => process.env.TRUST_PROXY !== "false";
export const turnstile = () => ({
  siteKey: process.env.TURNSTILE_SITE_KEY || "",
  secret: process.env.TURNSTILE_SECRET_KEY || "",
});
export { isProd };
