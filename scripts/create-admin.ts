/**
 * Creates the first administrator (or resets a password) from the command line.
 *
 *   npm run create-admin
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD from the environment when set (handy for a
 * one-off run in the Replit Shell), otherwise prompts. The password is never
 * stored anywhere except as a salted scrypt hash in the database.
 * There is deliberately no web route that can create an administrator.
 */
import readline from "node:readline";
import { getDb } from "../src/lib/db";
import { hashPassword, validatePasswordStrength } from "../src/lib/passwords";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const anyRl = rl as any;
      anyRl._writeToOutput = (s: string) => {
        if (s.includes(question)) anyRl.output.write(s);
        else if (s.includes("\n") || s.includes("\r")) anyRl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || (await ask("Administrator email: "))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("That does not look like an email address.");

  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    password = await ask("Password (min 12 characters, letters and numbers): ", true);
    const again = await ask("Repeat password: ", true);
    if (password !== again) throw new Error("Passwords did not match.");
  }
  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(weak);

  const db = await getDb();
  const hash = await hashPassword(password);
  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length) {
    await db.query(`UPDATE users SET password_hash = $2, role = 'admin', disabled = false WHERE email = $1`, [email, hash]);
    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [existing.rows[0].id]);
    console.log(`\nUpdated existing account ${email}: password reset, role set to administrator.`);
  } else {
    await db.query(`INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, 'admin', $3)`, [email, "Administrator", hash]);
    console.log(`\nCreated administrator ${email}. Sign in at /admin.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("\n" + (e instanceof Error ? e.message : e));
  process.exit(1);
});
