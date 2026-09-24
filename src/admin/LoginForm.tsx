"use client";

import { useState } from "react";
import { api, ApiError } from "./api";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "error"; text?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      window.location.href = "/admin";
    } catch (er) {
      setState({ kind: "error", text: er instanceof ApiError ? er.message : "Could not sign in." });
      setPassword("");
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <p className="fe-help">ALYAS Travel admin</p>
        {state.kind === "error" && <p className="alert alert--error" role="alert">{state.text}</p>}
        <div className="fe-field">
          <label className="fe-label" htmlFor="li-email">Email</label>
          <input id="li-email" className="ai" type="email" autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="fe-field">
          <label className="fe-label" htmlFor="li-pw">Password</label>
          <input id="li-pw" className="ai" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="ab ab--primary block" type="submit" disabled={state.kind === "busy"}>
          {state.kind === "busy" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
