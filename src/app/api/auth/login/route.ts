import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { createSession, dummyVerify, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError, clientIp, ipHash, ratePeek, rateHit, rateReset, sha256 } from "@/lib/security";

const WINDOW = 15 * 60;
const GENERIC = "Incorrect email or password.";

export const POST = route(async (req) => {
  const { email, password } = await readJson(
    req,
    z.object({ email: z.string().trim().toLowerCase().min(3).max(160), password: z.string().min(1).max(200) }),
  );
  const ip = ipHash(clientIp(req));
  const keys = {
    ip: `login-ip:${ip}`, // 20 failures / 15 min per client
    pair: `login-pair:${ip}:${sha256(email)}`, // 5 failures / 15 min per client+account
    acct: `login-acct:${sha256(email)}`, // 12 failures / 15 min per account, from anywhere
  };
  const [a, b, c] = await Promise.all([ratePeek(keys.ip), ratePeek(keys.pair), ratePeek(keys.acct)]);
  if (a.count >= 20 || b.count >= 5 || c.count >= 12) {
    const retryAfter = Math.max(a.retryAfter, b.retryAfter, c.retryAfter, 60);
    throw new HttpError(429, "Too many sign-in attempts. Please wait a few minutes and try again.", { retryAfter });
  }

  const db = await getDb();
  const r = await db.query(`SELECT id, password_hash, disabled FROM users WHERE email = $1`, [email]);
  const user = r.rows[0];
  let ok = false;
  if (user && !user.disabled) ok = await verifyPassword(password, user.password_hash);
  else await dummyVerify(password); // keep timing the same whether or not the account exists

  if (!ok) {
    await Promise.all([rateHit(keys.ip, WINDOW), rateHit(keys.pair, WINDOW), rateHit(keys.acct, WINDOW)]);
    throw new HttpError(401, GENERIC);
  }
  await rateReset(keys.pair);
  await createSession(user.id);
  return { ok: true };
});
