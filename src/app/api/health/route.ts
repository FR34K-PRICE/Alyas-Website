import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isProd, sessionSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Health check of THIS running server: 200 when it has the settings it needs and can reach its database; 503 with
 * a plain reason otherwise. The body only ever contains { ok: true } or { ok: false, problem: "<fixed sentence>" }:
 * no values, no connection details, no error text from the database. A passing check says nothing about whether
 * the site is published or reachable by visitors at its public address.
 *
 * The answer is remembered for a few seconds so the (public) endpoint cannot be used to hammer the database.
 */
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const TTL_MS = 5000;
let last: { at: number; body: { ok: boolean; problem?: string }; status: number } | null = null;

async function evaluate(): Promise<{ body: { ok: boolean; problem?: string }; status: number }> {
  if (isProd && !process.env.DATABASE_URL) {
    return { status: 503, body: { ok: false, problem: "DATABASE_URL is not set." } };
  }
  try {
    sessionSecret();
  } catch {
    return { status: 503, body: { ok: false, problem: "SESSION_SECRET is not set (32+ characters required)." } };
  }
  try {
    const db = await getDb();
    await db.query("SELECT 1");
  } catch {
    return { status: 503, body: { ok: false, problem: "The database could not be reached." } };
  }
  return { status: 200, body: { ok: true } };
}

export async function GET() {
  if (!last || Date.now() - last.at > TTL_MS) last = { at: Date.now(), ...(await evaluate()) };
  return NextResponse.json(last.body, { status: last.status, headers });
}
