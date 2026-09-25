/**
 * Checks that `npm run audit:content` is read-only and accurate.
 *
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run check:audit
 *
 * It seeds clearly named rows (slugs starting "audit-check-") into an ISOLATED LOCAL test database, runs the audit,
 * checks what it flagged and did not flag, proves no row was changed, and deletes the seeded rows again. It refuses
 * to run against anything that is not localhost, so it can never touch production content.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Set TEST_DATABASE_URL to an isolated LOCAL test database (localhost / 127.0.0.1). Refusing to run otherwise.");
  process.exit(2);
}
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  ${extra}`}`);
};

const bi = (en, ar = "") => ({ en, ar });
const rows = [
  // legitimate wording that must NOT be flagged
  ["offer", "istanbul-weekend", { title: bi("Weekend in Istanbul", "عطلة نهاية أسبوع في إسطنبول"), summary: bi("Book a free sample of local food tours and a demo of the city pass.") }, "owner@alyas.example.net"],
  ["event", "travel-conference", { title: bi("Annual Travel Conference"), venue: bi("The Bar Hall"), summary: bi("Includes a test drive of electric coaches.") }, "owner@alyas.example.net"],
  ["offer", "test-your-english", { title: bi("Test your English in Dubai"), summary: bi("Language stay") }, "owner@alyas.example.net"],
  ["news", "visa-form", { title: bi("New visa request form", "نموذج طلب التأشيرة الجديد"), summary: bi("Use the online form.", "استخدم النموذج الإلكتروني.") }, "owner@alyas.example.net"],
  // wording worth a human look
  ["offer", "sample-offer", { title: bi("Sample offer"), summary: bi("x") }, "owner@alyas.example.net"],
  ["news", "lorem", { title: bi("Lorem ipsum dolor sit amet") }, "owner@alyas.example.net"],
  ["offer", "just-test", { title: bi("Test 2") }, "owner@alyas.example.net"],
  ["offer", "arabic-test", { title: bi("Winter trip", "عرض تجريبي") }, "owner@alyas.example.net"],
  ["event", "by-test-account", { title: bi("Summit"), venue: bi("Hall") }, "qa@example.com"],
  ["page", "with-placeholder", { title: bi("About visas"), slug: "with-placeholder", sections: [{ type: "text", heading: bi("Placeholder heading"), body: bi("Real body text.") }] }, "owner@alyas.example.net"],
];
const slugOf = (s) => `audit-check-${s}`;

const c = new pg.Client({ connectionString: url });
await c.connect();
const snapshot = async () => JSON.stringify((await c.query(`SELECT id, kind, slug, status, draft, published, updated_at FROM content ORDER BY id`)).rows);
try {
  for (const [kind, slug, doc, by] of rows) {
    await c.query(`INSERT INTO content (kind, slug, status, draft, published, published_at, updated_by) VALUES ($1,$2,'published',$3::jsonb,$3::jsonb,now(),$4)`, [kind, slugOf(slug), JSON.stringify(doc), by]);
  }
  const before = await snapshot();
  const run = spawnSync(process.execPath, ["scripts/audit-content.mjs"], { env: { ...process.env, DATABASE_URL: url, PGSSLMODE: "disable" }, encoding: "utf8" });
  const out = run.stdout;
  const review = out.split("---- Review ----")[1] ?? "";
  const after = await snapshot();

  ok("the audit runs and finishes (exit 0)", run.status === 0, run.stderr);
  ok("the audit changed nothing: every row identical before and after", before === after);
  ok("the audit states that matching words is not proof and that it changed nothing", /does NOT mean content is fake/.test(out) && /Nothing was modified/.test(out));
  for (const s of ["istanbul-weekend", "travel-conference", "test-your-english", "visa-form"]) ok(`normal business wording is not flagged: ${s}`, !review.includes(slugOf(s)));
  for (const s of ["sample-offer", "lorem", "just-test", "arabic-test", "by-test-account", "with-placeholder"]) ok(`worth-a-look wording is listed: ${s}`, review.includes(slugOf(s)));
  ok("each hint says which field matched and why", /published and draft “title” reads like/.test(review) && /sections\[1\]\.heading/.test(review) && /last edited by an account on an example\.\* address/.test(review));
  ok("weaker hints are labelled “may be fine”, stronger ones “worth a look”", /\[may be fine\]/.test(review) && /\[worth a look\]/.test(review));
  ok("output never calls anything fake", !/\bfake\b/i.test(out.replace(/does NOT mean content is fake/, "")));

  // Postgres itself must refuse writes in the kind of transaction the audit uses.
  await c.query("BEGIN READ ONLY");
  let refused = false;
  try { await c.query("DELETE FROM content WHERE slug LIKE 'audit-check-%'"); } catch (e) { refused = /read-only/i.test(e.message); }
  await c.query("ROLLBACK");
  ok("a write inside a READ ONLY transaction is refused by the database", refused);
  ok("the audit source starts a READ ONLY transaction, verifies it, and always rolls back", /BEGIN READ ONLY/.test(await (await import("node:fs/promises")).readFile("scripts/audit-content.mjs", "utf8")) && /transaction_read_only/.test(out + (await (await import("node:fs/promises")).readFile("scripts/audit-content.mjs", "utf8"))));
} finally {
  await c.query(`DELETE FROM content WHERE slug LIKE 'audit-check-%'`);
  const left = (await c.query(`SELECT count(*)::int AS n FROM content WHERE slug LIKE 'audit-check-%'`)).rows[0].n;
  ok("seeded test rows are removed again", left === 0);
  await c.end();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
