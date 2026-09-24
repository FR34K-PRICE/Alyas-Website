import { isProd } from "./env";

type Row = Record<string, any>;
export interface Db {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

const g = globalThis as unknown as { __alyasDb?: Promise<Db> };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','editor')),
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  slug text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  published_at timestamptz,
  UNIQUE (kind, slug)
);
CREATE INDEX IF NOT EXISTS content_kind_idx ON content(kind, status);
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  alt_ar text NOT NULL DEFAULT '',
  alt_en text NOT NULL DEFAULT '',
  folder text NOT NULL DEFAULT 'general',
  width integer NOT NULL,
  height integer NOT NULL,
  mime text NOT NULL,
  bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
CREATE TABLE IF NOT EXISTS media_files (
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  width integer NOT NULL,
  data bytea NOT NULL,
  PRIMARY KEY (media_id, width)
);
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  interest text NOT NULL DEFAULT 'other',
  message text NOT NULL,
  ref text NOT NULL DEFAULT '',
  lang text NOT NULL DEFAULT 'ar',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved','spam')),
  note text NOT NULL DEFAULT '',
  ip_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status, created_at DESC);
-- Old addresses of custom pages whose live address changed. They point at the PAGE (not at an address), so they
-- always resolve to its current live address in one hop, and vanish with the page.
CREATE TABLE IF NOT EXISTS page_redirects (
  from_slug text PRIMARY KEY,
  page_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_redirects_page_idx ON page_redirects(page_id);
CREATE TABLE IF NOT EXISTS meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
`;

async function open(): Promise<Db> {
  let db: Db;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX) || 10,
      ssl: local || process.env.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: false },
    });
    pool.on("error", (e) => console.error("[db] idle client error:", e.message));
    db = {
      async query(text, params) {
        const r = await pool.query(text, params as any[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
    };
  } else {
    if (isProd) throw new Error("DATABASE_URL must be set in production. See README.md.");
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite("./.data/pglite");
    await pg.waitReady;
    db = {
      async query(text, params) {
        const r = await pg.query(text, params as any[]);
        return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length };
      },
    };
  }
  // Run the schema one statement at a time (works on both drivers).
  for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    await db.query(stmt);
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__alyasDb) {
    g.__alyasDb = open().catch((e) => {
      g.__alyasDb = undefined;
      throw e;
    });
  }
  return g.__alyasDb;
}

export const toBuffer = (v: unknown): Buffer => (Buffer.isBuffer(v) ? v : Buffer.from(v as Uint8Array));
