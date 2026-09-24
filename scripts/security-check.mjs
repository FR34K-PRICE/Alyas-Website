/**
 * Black-box security checks against a running server.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run check:security
 *
 * It signs in as an administrator, creates a throw-away content editor to test role limits,
 * then disables that editor again. It does not modify published content.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD to run the authenticated checks.");
  process.exit(2);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  ${extra}`}`);
};

async function call(path, { method = "GET", body, cookie, csrf = true, headers = {}, form } = {}) {
  const h = { ...headers };
  if (csrf) h["x-alyas-csrf"] = "1";
  if (cookie) h.cookie = cookie;
  let b;
  if (form) b = form;
  else if (body !== undefined) {
    h["content-type"] = "application/json";
    b = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: b, redirect: "manual" });
  let json = null;
  try { json = await res.clone().json(); } catch {}
  return { res, status: res.status, json };
}

async function login(email, password) {
  const r = await call("/api/auth/login", { method: "POST", body: { email, password } });
  const set = r.res.headers.getSetCookie?.() ?? [];
  const c = set.find((x) => x.startsWith("alyas_session="));
  return { status: r.status, cookie: c ? c.split(";")[0] : "", raw: c || "" };
}

const UUID = "00000000-0000-4000-8000-000000000000";

console.log(`Target: ${BASE}\n`);

// 1. Everything administrative refuses anonymous callers.
const anon = [
  ["GET", "/api/admin/content/site"], ["GET", "/api/admin/content/offer"], ["PUT", "/api/admin/content/home", { data: {} }],
  ["POST", "/api/admin/content/offer", { data: {} }], ["POST", "/api/admin/content/home/publish"], ["POST", "/api/admin/content/offer/reorder", { ids: [] }],
  ["GET", `/api/admin/entries/${UUID}`], ["PUT", `/api/admin/entries/${UUID}`, { data: {} }], ["DELETE", `/api/admin/entries/${UUID}`],
  ["POST", `/api/admin/entries/${UUID}/publish`], ["POST", `/api/admin/entries/${UUID}/unpublish`],
  ["GET", "/api/admin/media"], ["POST", "/api/admin/media"], ["PATCH", `/api/admin/media/${UUID}`, {}], ["DELETE", `/api/admin/media/${UUID}`],
  ["GET", "/api/admin/inquiries"], ["PATCH", `/api/admin/inquiries/${UUID}`, {}], ["DELETE", `/api/admin/inquiries/${UUID}`],
  ["GET", "/api/admin/users"], ["POST", "/api/admin/users", {}], ["PATCH", `/api/admin/users/${UUID}`, {}],
  ["POST", "/api/admin/account/password", {}], ["GET", "/api/auth/me"],
];
for (const [method, path, body] of anon) {
  const r = await call(path, { method, body });
  ok(`anonymous ${method} ${path} is refused (401)`, r.status === 401, `got ${r.status}`);
}
const noCsrf = await call("/api/admin/content/home", { method: "PUT", body: { data: {} }, csrf: false });
ok("mutation without CSRF header is refused (403)", noCsrf.status === 403, `got ${noCsrf.status}`);
for (const p of ["/admin", "/admin/pages/home", "/admin/users", "/preview/en", "/preview/ar/about"]) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  const loc = r.headers.get("location") || "";
  ok(`anonymous page ${p} redirects to sign-in`, r.status >= 300 && r.status < 400 && loc.includes("/admin/login"), `got ${r.status} ${loc}`);
}
const login404 = await fetch(BASE + "/admin/login");
ok("sign-in page is reachable and not indexable", login404.status === 200 && (login404.headers.get("x-robots-tag") || "").includes("noindex"));
const reg = await call("/api/auth/register", { method: "POST", body: { email: "x@y.zz", password: "Whatever12345" } });
ok("there is no public registration route", reg.status === 404 || reg.status === 405, `got ${reg.status}`);

// 2. Login rate limiting (uses a made-up address so the real account is not locked).
const bogus = `nobody-${Date.now()}@example.com`;
let limited = 0;
for (let i = 0; i < 7; i++) {
  const r = await call("/api/auth/login", { method: "POST", body: { email: bogus, password: "wrong-password-123" } });
  if (r.status === 429) limited++;
}
ok("repeated failed sign-ins are rate limited (429)", limited >= 1, `limited=${limited}`);

// 3. Administrator session.
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
ok("administrator can sign in", admin.status === 200 && !!admin.cookie, `status ${admin.status}`);
ok("session cookie is HttpOnly and SameSite", /HttpOnly/i.test(admin.raw) && /SameSite=lax/i.test(admin.raw), admin.raw);
if (!admin.cookie) process.exit(1);
const A = admin.cookie;

const forged = await call("/api/admin/content/home", { method: "PUT", body: { data: {} }, cookie: A, headers: { origin: "https://evil.example" } });
ok("cross-origin mutation is refused even with a session (403)", forged.status === 403, `got ${forged.status}`);
const badToken = await call("/api/admin/content/home", { cookie: "alyas_session=not-a-real-token" });
ok("forged session cookie is refused (401)", badToken.status === 401, `got ${badToken.status}`);

// 4. Validation.
const badColor = await call("/api/admin/content/site", { method: "PUT", cookie: A, body: { data: { colors: { primary: "red;}</style><script>alert(1)</script>" } } } });
ok("invalid color is rejected with field errors (400)", badColor.status === 400 && !!badColor.json?.fields, `got ${badColor.status}`);
const badUrl = await call("/api/admin/content/site", { method: "PUT", cookie: A, body: { data: { social: { facebook: "javascript:alert(1)" } } } });
ok("javascript: link is rejected (400)", badUrl.status === 400, `got ${badUrl.status}`);

// 5. Upload restrictions.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script>${" ".repeat(200)}<rect width="200" height="200"/></svg>`;
const fSvg = new FormData(); fSvg.set("file", new Blob([svg], { type: "image/jpeg" }), "evil.jpg"); fSvg.set("folder", "general");
const upSvg = await call("/api/admin/media", { method: "POST", cookie: A, form: fSvg });
ok("SVG disguised as JPG is refused (400)", upSvg.status === 400, `got ${upSvg.status} ${JSON.stringify(upSvg.json)}`);
const fTxt = new FormData(); fTxt.set("file", new Blob(["not an image ".repeat(50)], { type: "image/png" }), "x.png");
const upTxt = await call("/api/admin/media", { method: "POST", cookie: A, form: fTxt });
ok("text file named .png is refused (400)", upTxt.status === 400, `got ${upTxt.status}`);
const fBig = new FormData(); fBig.set("file", new Blob([Buffer.alloc(9 * 1024 * 1024, 1)], { type: "image/jpeg" }), "big.jpg");
const upBig = await call("/api/admin/media", { method: "POST", cookie: A, form: fBig });
ok("file over 8 MB is refused (413)", upBig.status === 413, `got ${upBig.status}`);

// 6. Roles: throw-away editor.
const editorEmail = `editor-check-${Date.now()}@example.com`;
const editorPw = "Editor-Check-Pass-2026";
const mk = await call("/api/admin/users", { method: "POST", cookie: A, body: { email: editorEmail, name: "Check", role: "editor", password: editorPw } });
ok("administrator can create an editor", mk.status === 200, `got ${mk.status} ${JSON.stringify(mk.json)}`);
const ed = await login(editorEmail, editorPw);
ok("editor can sign in", ed.status === 200 && !!ed.cookie);
const E = ed.cookie;
ok("editor cannot list users (403)", (await call("/api/admin/users", { cookie: E })).status === 403);
ok("editor cannot create users (403)", (await call("/api/admin/users", { method: "POST", cookie: E, body: { email: "z@z.zz", role: "admin", password: "Abcdefghij12" } })).status === 403);
ok("editor cannot edit Site & brand (403)", (await call("/api/admin/content/site", { method: "PUT", cookie: E, body: { data: {} } })).status === 403);
ok("editor cannot publish Site & brand (403)", (await call("/api/admin/content/site/publish", { method: "POST", cookie: E })).status === 403);
ok("editor cannot delete content (403)", (await call(`/api/admin/entries/${UUID}`, { method: "DELETE", cookie: E })).status === 403);
ok("editor cannot delete images (403)", (await call(`/api/admin/media/${UUID}`, { method: "DELETE", cookie: E })).status === 403);
ok("editor cannot delete inquiries (403)", (await call(`/api/admin/inquiries/${UUID}`, { method: "DELETE", cookie: E })).status === 403);
ok("editor can read the About page (200)", (await call("/api/admin/content/about", { cookie: E })).status === 200);

// 7. Public inquiry protections.
const tok = await call("/api/inquiries/token");
const baseBody = { name: "Check Bot", email: "bot@example.com", phone: "", interest: "other", message: "Automated check message", ref: "", lang: "en" };
const noTok = await call("/api/inquiries", { method: "POST", body: { ...baseBody, token: "bad.token" } });
ok("inquiry with forged token is refused (400)", noTok.status === 400, `got ${noTok.status}`);
const fast = await call("/api/inquiries", { method: "POST", body: { ...baseBody, token: tok.json.token } });
ok("inquiry submitted instantly is refused (400)", fast.status === 400, `got ${fast.status}`);
const before = (await call("/api/admin/inquiries", { cookie: A })).json.items.length;
await new Promise((r) => setTimeout(r, 3000));
const trap = await call("/api/inquiries", { method: "POST", body: { ...baseBody, website: "http://spam.example", token: tok.json.token } });
const after = (await call("/api/admin/inquiries", { cookie: A })).json.items.length;
ok("honeypot submissions are discarded, not stored", trap.status === 200 && after === before, `status ${trap.status} ${before}->${after}`);
const csrfInq = await call("/api/inquiries", { method: "POST", body: { ...baseBody, token: tok.json.token }, csrf: false });
ok("inquiry without CSRF header is refused (403)", csrfInq.status === 403, `got ${csrfInq.status}`);

// 8. Clean up: disable the throw-away editor.
const list = await call("/api/admin/users", { cookie: A });
const me = list.json.users.find((u) => u.email === editorEmail);
if (me) await call(`/api/admin/users/${me.id}`, { method: "PATCH", cookie: A, body: { disabled: true } });
const afterDisable = await call("/api/auth/me", { cookie: E });
ok("disabling a user ends their session immediately (401)", afterDisable.status === 401, `got ${afterDisable.status}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
