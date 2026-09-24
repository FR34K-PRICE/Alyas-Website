import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 32768, R = 8, P = 1, KEYLEN = 64;
const scrypt = (pw: string, salt: Buffer, n: number, r: number, p: number, len: number) =>
  new Promise<Buffer>((res, rej) =>
    scryptCb(pw.normalize("NFKC"), salt, len, { N: n, r, p, maxmem: 128 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), +n, +r, +p, expected.length);
  return timingSafeEqual(actual, expected);
}

// A fixed hash so unknown-email logins spend the same time as real ones.
let dummy: Promise<string> | undefined;
export const dummyVerify = async (pw: string) => {
  dummy ??= hashPassword("not-a-real-password");
  await verifyPassword(pw, await dummy);
};

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use a mix of letters and numbers.";
  return null;
}

