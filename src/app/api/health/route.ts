import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isProd, sessionSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Deployment health check: 200 when the server, the database and the required settings are all in place;
 * 503 with a plain reason otherwise. It reveals no values, only which setting is missing.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (isProd && !process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, problem: "DATABASE_URL is not set for this deployment." }, { status: 503, headers });
  }
  try {
    sessionSecret();
  } catch {
    return NextResponse.json({ ok: false, problem: "SESSION_SECRET is not set (32+ characters) for this deployment." }, { status: 503, headers });
  }
  try {
    const db = await getDb();
    await db.query("SELECT 1");
  } catch {
    return NextResponse.json({ ok: false, problem: "The database could not be reached." }, { status: 503, headers });
  }
  return NextResponse.json({ ok: true, siteUrlConfigured: !!process.env.SITE_URL }, { headers });
}
