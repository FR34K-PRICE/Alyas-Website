/**
 * Read-only audit of the content in a Postgres database. It lists offers, events, news, custom pages, services,
 * media and inquiry counts, and points out items a human should LOOK AT because their wording resembles test or
 * sample content. A hint is not proof: real content can contain these words, and this script never decides
 * anything, changes anything or deletes anything.
 *
 *   DATABASE_URL=postgres://... npm run audit:content
 *
 * On Replit, run `npm run audit:content` in the Shell (DATABASE_URL is already set there). It runs inside a READ
 * ONLY transaction that it always rolls back, and refuses to continue if the database does not confirm that the
 * transaction is read-only. Review anything listed in the admin panel (Admin → Travel offers / Events &
 * conferences / News / Custom pages) and decide for yourself.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the database you want to audit (on Replit it is already set in the Shell).");
  process.exit(2);
}
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local || process.env.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: false } });

/** Only these fields are inspected (English and Arabic). Ids, slugs, links and image references are ignored. */
const FIELDS = {
  offer: ["title", "destination", "summary", "details", "priceLabel"],
  event: ["title", "venue", "city", "summary", "details"],
  news: ["title", "summary", "body"],
  service: ["title", "summary", "details"],
};
const PAGE_TEXT_KEYS = ["title", "lead", "heading", "headline", "sub", "body", "intro", "caption", "button"];

// Whole-word matching. Arabic has no \b, so use letter lookarounds.
const A = "\\u0600-\\u06FF";
const word = (w) => new RegExp(`(?<![A-Za-z0-9${A}])(?:${w})(?![A-Za-z0-9${A}])`, "i");
const STRONG = [
  [word("lorem ipsum|dolor sit amet"), "contains Lorem ipsum filler text"],
  [word("placeholder"), "contains the word “placeholder”"],
  [word("dummy"), "contains the word “dummy”"],
  [word("asdf+|qwerty|xxx+"), "contains keyboard-mash text"],
  [word("(test|sample|demo|dummy) (offer|event|news|page|entry|item|trip|package)"), "reads like “test/sample <item>”"],
  [word("لوريم إيبسوم|لوريم"), "contains Lorem ipsum filler text (Arabic)"],
  [word("(عرض|فعالية|خبر|صفحة) (تجريبي|تجريبية|اختباري|اختبارية)"), "reads like a test item (Arabic)"],
];
// A weak hint only when the word is (nearly) the whole title: "Test", "Sample offer 2" are worth a look, "Test your English" is not.
const TITLE_ONLY = /^(test|testing|sample|demo|untitled|new (offer|event|news|page)|تجريبي|اختبار)( ?[0-9]+)?$/i;

const textOf = (v) => (v && typeof v === "object" ? [v.en, v.ar].filter(Boolean).join(" ¦ ") : typeof v === "string" ? v : "");
const isTestAccount = (s) => /@example\.(com|test|org)$/i.test(s || "");

function collect(kind, doc) {
  const out = [];
  if (kind === "page") {
    const walk = (node, path) => {
      if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${path}[${i + 1}]`));
      else if (node && typeof node === "object" && !("en" in node && "ar" in node)) {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      } else if (node && typeof node === "object") {
        const key = path.split(".").pop().replace(/\[\d+\]/g, "");
        if (PAGE_TEXT_KEYS.includes(key)) out.push([path, textOf(node)]);
      }
    };
    walk(doc ?? {}, "");
  } else {
    for (const f of FIELDS[kind] ?? []) out.push([f, textOf(doc?.[f])]);
  }
  return out.filter(([, t]) => t);
}

function hints(kind, row) {
  const found = [];
  for (const [state, doc] of [["published", row.published], ["draft", row.draft]]) {
    if (!doc) continue;
    for (const [field, text] of collect(kind, doc)) {
      for (const [re, why] of STRONG) {
        const m = text.match(re);
        if (m) found.push({ why: `${state} “${field}” ${why} (“${m[0]}”)`, strength: "worth a look" });
      }
      if (/^(title|headline)$/.test(field.split(".").pop().replace(/\[\d+\]/g, "")) && TITLE_ONLY.test(text) && text.length < 40) {
        found.push({ why: `${state} “${field}” is “${text}”, which looks like a working title`, strength: "may be fine" });
      }
    }
  }
  if (isTestAccount(row.updated_by)) found.push({ why: `last edited by an account on an example.* address (${row.updated_by})`, strength: "worth a look" });
  // The same finding in the published and draft copy is reported once.
  const merged = new Map();
  for (const f of found) {
    const key = f.why.replace(/^(published|draft) /, "");
    const cur = merged.get(key);
    if (!cur) merged.set(key, { ...f, states: [f.why.startsWith("draft") ? "draft" : f.why.startsWith("published") ? "published" : ""] });
    else cur.states.push(f.why.startsWith("draft") ? "draft" : "published");
  }
  return [...merged.entries()].map(([key, f]) => {
    const where = f.states.filter(Boolean);
    return { strength: f.strength, why: where.length ? `${where.length === 2 ? "published and draft" : where[0]} ${key}` : key };
  });
}

const titleOf = (row) => {
  const d = row.status === "published" ? row.published : row.draft;
  return textOf(d?.title).replace(" ¦ ", " / ") || "(untitled)";
};

await client.connect();
await client.query("BEGIN READ ONLY");
try {
  const ro = (await client.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only;
  if (ro !== "on") throw new Error("The database did not confirm a read-only transaction; stopping without reading anything.");

  const rows = (await client.query(`SELECT kind, slug, status, draft, published, updated_by FROM content ORDER BY kind, sort, updated_at`)).rows;
  console.log("Content audit (read-only). Items listed under “Review” are hints for a person to check in the CMS.");
  console.log("Matching words does NOT mean content is fake, and nothing here has been changed.\n");

  const review = [];
  const show = (kind, label) => {
    const list = rows.filter((r) => r.kind === kind);
    console.log(`${label}: ${list.length}`);
    for (const r of list) {
      const h = hints(kind, r);
      console.log(`  ${r.status.padEnd(9)} ${r.slug.padEnd(28)} ${titleOf(r)}${h.length ? "   ← review" : ""}`);
      if (h.length) review.push({ kind: label, slug: r.slug, title: titleOf(r), status: r.status, hints: h });
    }
    console.log("");
  };
  show("offer", "Offers");
  show("event", "Events");
  show("news", "News");
  show("page", "Custom pages");
  show("service", "Services");

  const one = async (sql) => (await client.query(sql)).rows[0];
  const singles = rows.filter((r) => r.slug === "main");
  const m = await one(`SELECT count(*)::int AS n FROM media`);
  const i = await one(`SELECT count(*)::int AS n, count(*) FILTER (WHERE status = 'new')::int AS fresh FROM inquiries`);
  const r2 = await one(`SELECT count(*)::int AS n FROM page_redirects`).catch(() => ({ n: "n/a (table not created yet)" }));
  console.log(`Edited page documents: ${singles.map((r) => `${r.kind} (${r.status})`).join(", ") || "none"}`);
  console.log(`Media files: ${m.n}   Inquiries: ${i.n} (${i.fresh} new)   Page redirects: ${r2.n}`);
  const users = (await client.query(`SELECT email, role, disabled FROM users ORDER BY created_at`)).rows;
  console.log(`Accounts: ${users.map((x) => `${x.email} [${x.role}${x.disabled ? ", disabled" : ""}]`).join("; ") || "none"}`);
  const acct = users.filter((x) => isTestAccount(x.email));

  console.log("\n---- Review ----");
  if (!review.length && !acct.length) console.log("Nothing stood out. (This is a wording check only; it cannot know whether content is accurate.)");
  for (const r of review) {
    console.log(`\n${r.kind}: “${r.title}” (${r.slug}, ${r.status})`);
    for (const h of r.hints) console.log(`   • [${h.strength}] ${h.why}`);
  }
  if (acct.length) {
    console.log("\nAccounts on example.* addresses (often created by test scripts; check whether anyone real uses them):");
    for (const a of acct) console.log(`   • ${a.email} [${a.role}${a.disabled ? ", disabled" : ""}]`);
  }
  console.log("\nDone. Nothing was modified.");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
