"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

interface U {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  disabled: boolean;
}

export function Users({ meId }: { meId: string }) {
  const [users, setUsers] = useState<U[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ email: "", name: "", role: "editor", password: "" });
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<{ users: U[] }>("/api/admin/users")
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load users."));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFe({});
    setError("");
    setMsg("");
    try {
      await api("/api/admin/users", { method: "POST", body: form });
      setMsg(`Created ${form.email}. Share the password with them securely; they can change it under “My account”.`);
      setForm({ email: "", name: "", role: "editor", password: "" });
      load();
    } catch (er) {
      if (er instanceof ApiError) {
        setFe(er.fields);
        setError(er.message);
      }
    }
    setBusy(false);
  }

  async function patch(id: string, body: object, ok: string) {
    setError("");
    setMsg("");
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body });
      setMsg(ok);
      load();
    } catch (er) {
      setError(er instanceof ApiError ? er.message : "Could not update the user.");
    }
  }

  return (
    <div className="page">
      <header className="page-title">
        <h1>Users</h1>
        <p>People who can sign in to this admin. There is no public sign-up: accounts are created here or from the command line.</p>
      </header>

      <table className="perm">
        <caption className="sr-only">What each role can do</caption>
        <thead>
          <tr><th scope="col">Can do</th><th scope="col">Administrator</th><th scope="col">Content editor</th></tr>
        </thead>
        <tbody>
          {[
            ["Edit pages, services, offers, events and news", true, true],
            ["Save drafts, preview and publish", true, true],
            ["Upload images and edit their details", true, true],
            ["View inquiries and update their status", true, true],
            ["Change site name, logo, colors, contact details and social links", true, false],
            ["Delete content, images and inquiries", true, false],
            ["Manage users", true, false],
          ].map(([label, a, e]) => (
            <tr key={label as string}>
              <th scope="row">{label as string}</th>
              <td>{a ? "Yes" : "No"}</td>
              <td>{e ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="alert alert--error" role="alert">{error}</p>}
      {msg && <p className="alert alert--ok" role="status">{msg}</p>}

      {users === null ? (
        <p>Loading…</p>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className="user-row">
              <div>
                <strong>{u.name || u.email}</strong> {u.id === meId && <span className="badge" data-s="live">You</span>} {u.disabled && <span className="badge" data-s="spam">Disabled</span>}
                <p className="fe-help">{u.email}</p>
              </div>
              <div className="row">
                <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.email}</label>
                <select id={`role-${u.id}`} className="ai" value={u.role} disabled={u.id === meId} onChange={(e) => patch(u.id, { role: e.target.value }, `Role updated for ${u.email}.`)}>
                  <option value="admin">Administrator</option>
                  <option value="editor">Content editor</option>
                </select>
                <ResetPassword u={u} onReset={(pw) => patch(u.id, { password: pw }, `Password reset for ${u.email}. They have been signed out.`)} />
                {u.id !== meId && (
                  <button type="button" className="ab ab--ghost" onClick={() => patch(u.id, { disabled: !u.disabled }, u.disabled ? `${u.email} can sign in again.` : `${u.email} can no longer sign in.`)}>
                    {u.disabled ? "Enable" : "Disable"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="card" noValidate>
        <h2>Add a user</h2>
        <div className="fe-field">
          <label className="fe-label" htmlFor="nu-email">Email</label>
          <input id="nu-email" className="ai" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          {fe.email && <span className="fe-error">{fe.email}</span>}
        </div>
        <div className="fe-field">
          <label className="fe-label" htmlFor="nu-name">Name</label>
          <input id="nu-name" className="ai" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="fe-field">
          <label className="fe-label" htmlFor="nu-role">Role</label>
          <select id="nu-role" className="ai" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="editor">Content editor</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div className="fe-field">
          <label className="fe-label" htmlFor="nu-pw">Temporary password</label>
          <p className="fe-help">At least 12 characters, with letters and numbers.</p>
          <input id="nu-pw" className="ai" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          {fe.password && <span className="fe-error">{fe.password}</span>}
        </div>
        <button className="ab ab--primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</button>
      </form>
    </div>
  );
}

function ResetPassword({ u, onReset }: { u: U; onReset: (pw: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  if (!open)
    return (
      <button type="button" className="ab ab--ghost" onClick={() => setOpen(true)}>
        Reset password
      </button>
    );
  return (
    <span className="row">
      <label className="sr-only" htmlFor={`rp-${u.id}`}>New password for {u.email}</label>
      <input id={`rp-${u.id}`} className="ai" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button type="button" className="ab ab--primary" onClick={() => { onReset(pw); setPw(""); setOpen(false); }}>Set password</button>
      <button type="button" className="ab ab--ghost" onClick={() => setOpen(false)}>Cancel</button>
    </span>
  );
}
