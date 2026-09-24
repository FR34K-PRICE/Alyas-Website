import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/content/store";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = (await getSessionUser())!;
  await ensureSeeded();
  const db = await getDb();
  const inq = await db.query(`SELECT status, count(*)::int AS n FROM inquiries GROUP BY status`);
  const counts = Object.fromEntries(inq.rows.map((r: any) => [r.status, r.n]));
  const c = await db.query(
    `SELECT kind,
            count(*) FILTER (WHERE status = 'draft')::int AS drafts,
            count(*) FILTER (WHERE status = 'published' AND draft IS DISTINCT FROM published)::int AS pending,
            count(*) FILTER (WHERE status = 'published')::int AS live
       FROM content GROUP BY kind`,
  );
  const by = Object.fromEntries(c.rows.map((r: any) => [r.kind, r]));
  const pendingPages = ["site", "home", "about", "travel", "events", "contact"].reduce((n, k) => n + (by[k]?.pending ?? 0) + (by[k]?.drafts ?? 0), 0);
  const item = (k: string) => by[k] ?? { drafts: 0, pending: 0, live: 0 };

  return (
    <div className="page">
      <header className="page-title">
        <h1>Welcome{user.name ? `, ${user.name}` : ""}</h1>
        <p>Here is where things stand. Nothing you save is public until you publish it.</p>
      </header>
      <ul className="stat-grid">
        <li>
          <a href="/admin/inquiries">
            <span className="stat-n">{counts.new ?? 0}</span>
            <span>New inquiries</span>
          </a>
        </li>
        <li>
          <a href="/admin/collections/offer">
            <span className="stat-n">{item("offer").live}</span>
            <span>Live offers{item("offer").drafts ? ` · ${item("offer").drafts} draft` : ""}</span>
          </a>
        </li>
        <li>
          <a href="/admin/collections/event">
            <span className="stat-n">{item("event").live}</span>
            <span>Live events{item("event").drafts ? ` · ${item("event").drafts} draft` : ""}</span>
          </a>
        </li>
        <li>
          <a href="/admin/collections/news">
            <span className="stat-n">{item("news").live}</span>
            <span>Live news items</span>
          </a>
        </li>
        <li>
          <a href="/admin/collections/page">
            <span className="stat-n">{item("page").live}</span>
            <span>Live custom pages{item("page").drafts ? ` · ${item("page").drafts} draft` : ""}</span>
          </a>
        </li>
        <li>
          <a href="/admin/collections/service">
            <span className="stat-n">{item("service").live}</span>
            <span>Live services</span>
          </a>
        </li>
        <li>
          <a href="/admin/pages/home">
            <span className="stat-n">{pendingPages}</span>
            <span>Pages with unpublished changes</span>
          </a>
        </li>
      </ul>
      <h2 className="h2">Quick start</h2>
      <ol className="steps">
        <li><a href="/admin/pages/site">Site &amp; brand</a>: add your logo, confirm colors, and fill in phone, WhatsApp, email and address. Anything left empty stays hidden on the site.</li>
        <li><a href="/admin/media">Media library</a>: upload your own photography. Every photo slot already has a licensed default, so nothing is empty; your uploads replace the defaults wherever you choose them.</li>
        <li><a href="/admin/collections/offer">Travel offers</a> and <a href="/admin/collections/event">events</a>: these sections stay hidden on the public site until you publish something.</li>
      </ol>
    </div>
  );
}
