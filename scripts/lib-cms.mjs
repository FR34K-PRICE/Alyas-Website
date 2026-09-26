/**
 * Small CMS helper for the project's mutating checks (check:home with HOME_CHECK_MUTATE=1, check:motion with admin
 * credentials). It signs in, uploads throw-away test images, switches the homepage hero between the built-in VIDEO
 * and a CMS PHOTOGRAPH (with the flying airplane), and restores everything afterwards.
 *
 * ONLY use it against a local or isolated test database, never production: it saves and publishes test values and
 * uploads test media. It always tries to restore the original Home settings and to delete the media it uploaded.
 */
import fs from "node:fs";
import path from "node:path";

export async function connect(BASE, email, password) {
  const base = BASE.replace(/\/$/, "");
  const call = async (p, { method = "GET", body, cookie: c, form } = {}) => {
    const h = { "x-alyas-csrf": "1" };
    if (c ?? cookie) h.cookie = c ?? cookie;
    let b;
    if (form) b = form;
    else if (body !== undefined) { h["content-type"] = "application/json"; b = JSON.stringify(body); }
    const res = await fetch(base + p, { method, headers: h, body: b, redirect: "manual" });
    let json = null;
    try { json = await res.clone().json(); } catch {}
    return { res, status: res.status, json };
  };
  let cookie = "";
  const r = await call("/api/auth/login", { method: "POST", body: { email, password }, cookie: "" });
  const sc = (r.res.headers.getSetCookie?.() ?? []).find((x) => x.startsWith("alyas_session="));
  cookie = sc ? sc.split(";")[0] : "";
  if (!cookie) throw new Error("could not sign in to the test site (check ADMIN_EMAIL / ADMIN_PASSWORD)");

  const uploaded = [];
  /** Uploads a file from the repository (for example public/photos/coast-1600.webp) as test media; returns its id. */
  async function uploadImage(relPath, { altEn = "", altAr = "" } = {}) {
    const form = new FormData();
    form.set("file", new Blob([fs.readFileSync(relPath)], { type: "image/webp" }), `check-${path.basename(relPath)}`);
    form.set("folder", "checks");
    const u = await call("/api/admin/media", { method: "POST", form });
    const id = u.json?.media?.id;
    if (!id) throw new Error(`upload failed (${u.status}): ${JSON.stringify(u.json)}`);
    uploaded.push(id);
    if (altEn || altAr) await call(`/api/admin/media/${id}`, { method: "PATCH", body: { alt_en: altEn, alt_ar: altAr } });
    return id;
  }

  const snapshotHome = async () => {
    const e = (await call("/api/admin/content/home")).json?.entry;
    return { data: JSON.parse(JSON.stringify(e?.data ?? {})), published: e?.status === "published" };
  };
  /** Merges `patch` into the ORIGINAL hero settings, saves and publishes. Returns true when both succeeded. */
  async function setHero(snapshot, patch) {
    const data = JSON.parse(JSON.stringify(snapshot.data));
    data.hero = { ...(data.hero ?? {}), backdrop: "", foreground: "", airplane: "", ...patch };
    const s = await call("/api/admin/content/home", { method: "PUT", body: { data } });
    const p = await call("/api/admin/content/home/publish", { method: "POST" });
    return s.status === 200 && p.status === 200;
  }
  async function restore(snapshot) {
    await call("/api/admin/content/home", { method: "PUT", body: { data: snapshot.data } });
    // Always publish the restored settings: a site whose Home page was never published would otherwise keep the
    // test hero live (the test itself published it). For such a site this leaves a published copy equal to the defaults.
    await call("/api/admin/content/home/publish", { method: "POST" });
    for (const id of uploaded.splice(0)) await call(`/api/admin/media/${id}`, { method: "DELETE" });
  }
  return { call, uploadImage, snapshotHome, setHero, restore };
}
