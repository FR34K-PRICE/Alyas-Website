/**
 * Read-only audit of the content in a Postgres database: lists offers, events, news, custom pages, services,
 * media and inquiries, and flags anything that looks like sample or test content.
 *
 *   DATABASE_URL=postgres://... npm run audit:content
 *
 * On Replit, run `npm run audit:content` in the Shell (DATABASE_URL is already set there). It opens a READ ONLY
 * transaction, so it cannot change anything. Remove anything it flags from the admin panel (Admin → Travel
 * offers / Events & conferences / News / Custom pages) after checking it is not real ALYAS content.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the database you want to audit (on Replit it is already set in the Shell).");
  process.exit(2);
}
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local || process.env.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: false } });

const SUSPECT = /\b(test|testing|qa|sample|lorem|ipsum|placeholder|demo|dummy|example|foo|bar|asdf)\b|تجريب|عينة|نموذج/i;
const titleOf = (d) => [d?.title?.en, d?.title?.ar].filter(Boolean).join(" / ") || "(untitled)";

await client.connect();
await client.query("BEGIN READ ONLY");
try {
  const rows = (await client.query(`SELECT kind, slug, status, draft, published, updated_by, updated_at FROM content ORDER BY kind, sort, updated_at`)).rows;
  let flagged = 0;
  const show = (kind, label) => {
    const list = rows.filter((r) => r.kind === kind);
    console.log(`\n${label}: ${list.length}`);
    for (const r of list) {
      const t = titleOf(r.status === "published" ? r.published : r.draft);
      const text = JSON.stringify(r.draft ?? {}) + JSON.stringify(r.published ?? {});
      const bad = SUSPECT.test(text) || /example\.(com|test)$/i.test(r.updated_by || "");
      if (bad) flagged++;
      console.log(`  ${bad ? "⚠ " : "  "}${r.status.padEnd(9)} ${r.slug.padEnd(28)} ${t}${bad ? "   ← looks like sample/test content" : ""}`);
    }
  };
  show("offer", "Offers");
  show("event", "Events");
  show("news", "News");
  show("page", "Custom pages");
  show("service", "Services");
  const singles = rows.filter((r) => r.slug === "main");
  console.log(`\nEdited page documents: ${singles.map((r) => `${r.kind}(${r.status})`).join(", ") || "none"}`);
  const one = async (sql) => (await client.query(sql)).rows[0];
  const m = await one(`SELECT count(*)::int AS n FROM media`);
  const i = await one(`SELECT count(*)::int AS n, count(*) FILTER (WHERE status = 'new')::int AS fresh FROM inquiries`);
  const u = (await client.query(`SELECT email, role, disabled FROM users ORDER BY created_at`)).rows;
  const r2 = await one(`SELECT count(*)::int AS n FROM page_redirects`).catch(() => ({ n: "table not created yet" }));
  console.log(`\nMedia files: ${m.n}   Inquiries: ${i.n} (${i.fresh} new)   Page redirects: ${r2.n}`);
  console.log(`Users: ${u.map((x) => `${x.email} [${x.role}${x.disabled ? ", disabled" : ""}]`).join("; ") || "none"}`);
  const suspectUsers = u.filter((x) => /@example\.(com|test)$/i.test(x.email));
  console.log(`\n${flagged || suspectUsers.length ? `⚠ ${flagged} content item(s) and ${suspectUsers.length} account(s) look like test data. Review them before launch.` : "No sample-looking content found."}`);
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
