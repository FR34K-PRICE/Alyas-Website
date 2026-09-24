"use client";

import { useState } from "react";
import { api, ApiError } from "./api";

export function Account({ email, role }: { email: string; role: string }) {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [fe, setFe] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ kind: "idle" | "saving" | "ok" | "error"; text?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFe({});
    if (f.next !== f.again) {
      setFe({ again: "The two passwords do not match." });
      setState({ kind: "error", text: "Please check the highlighted fields." });
      return;
    }
    setState({ kind: "saving" });
    try {
      await api("/api/admin/account/password", { method: "POST", body: { current: f.current, next: f.next } });
      setF({ current: "", next: "", again: "" });
      setState({ kind: "ok", text: "Password changed. Other devices have been signed out." });
    } catch (er) {
      if (er instanceof ApiError) setFe(er.fields);
      setState({ kind: "error", text: er instanceof ApiError ? er.message : "Could not change the password." });
    }
  }

  return (
    <div className="page">
      <header className="page-title">
        <h1>My account</h1>
        <p>
          Signed in as <strong>{email}</strong> ({role === "admin" ? "Administrator" : "Content editor"}).
        </p>
      </header>
      <form onSubmit={submit} className="card narrow" noValidate>
        <h2>Change password</h2>
        {state.kind === "error" && <p className="alert alert--error" role="alert">{state.text}</p>}
        {state.kind === "ok" && <p className="alert alert--ok" role="status">{state.text}</p>}
        {(
          [
            ["current", "Current password", "current-password"],
            ["next", "New password (12+ characters, letters and numbers)", "new-password"],
            ["again", "Repeat new password", "new-password"],
          ] as const
        ).map(([k, label, ac]) => (
          <div className="fe-field" key={k}>
            <label className="fe-label" htmlFor={`pw-${k}`}>{label}</label>
            <input id={`pw-${k}`} className="ai" type="password" autoComplete={ac} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-invalid={!!fe[k] || undefined} />
            {fe[k] && <span className="fe-error">{fe[k]}</span>}
          </div>
        ))}
        <button className="ab ab--primary" type="submit" disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
