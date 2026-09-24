"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  interest: string;
  message: string;
  ref: string;
  lang: string;
  status: "new" | "in_progress" | "resolved" | "spam";
  note: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", resolved: "Resolved", spam: "Spam" };
const INTEREST_LABEL: Record<string, string> = {
  flights: "Flights", hotels: "Hotels", visa: "Visa assistance", transport: "Transportation", tailored: "Tailored trip", events: "Events & conferences", floral: "Floral", other: "Other",
};

export function Inquiries({ role }: { role: "admin" | "editor" }) {
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Inquiry[]; counts: Record<string, number> }>(`/api/admin/inquiries${status ? `?status=${status}` : ""}`);
      setItems(r.items);
      setCounts(r.counts);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load inquiries.");
    }
  }, [status]);
  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="page">
      <header className="page-title">
        <h1>Inquiries</h1>
        <p>Messages sent from the website contact form. Update the status as your team works through them.</p>
      </header>
      <div className="tabs" role="tablist" aria-label="Filter by status">
        {[["", `All (${total})`], ...Object.entries(STATUS_LABEL).map(([k, v]) => [k, `${v} (${counts[k] ?? 0})`])].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={status === k} className="tab" onClick={() => setStatus(k)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="alert alert--error" role="alert">{error}</p>}
      {items === null ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty">No inquiries {status ? `marked “${STATUS_LABEL[status]}”` : "yet"}. New messages from the contact form will appear here.</p>
      ) : (
        <ul className="inq-list">
          {items.map((i) => (
            <InquiryCard key={i.id} i={i} canDelete={role === "admin"} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InquiryCard({ i, canDelete, onChanged }: { i: Inquiry; canDelete: boolean; onChanged: () => void }) {
  const [status, setStatus] = useState(i.status);
  const [note, setNote] = useState(i.note);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const [confirm, setConfirm] = useState(false);
  const dirty = status !== i.status || note !== i.note;

  async function save() {
    setState({ kind: "saving" });
    try {
      await api(`/api/admin/inquiries/${i.id}`, { method: "PATCH", body: { status, note } });
      setState({ kind: "ok", text: "Saved" });
      onChanged();
    } catch (e) {
      setState({ kind: "error", text: e instanceof ApiError ? e.message : "Could not save." });
    }
  }
  async function del() {
    try {
      await api(`/api/admin/inquiries/${i.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setConfirm(false);
      setState({ kind: "error", text: e instanceof ApiError ? e.message : "Could not delete." });
    }
  }

  return (
    <li className="inq" data-status={i.status}>
      <div className="inq-head">
        <div>
          <h2>{i.name}</h2>
          <p className="inq-meta">
            {new Date(i.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {INTEREST_LABEL[i.interest] ?? i.interest} · site language: {i.lang === "ar" ? "Arabic" : "English"}
          </p>
        </div>
        <span className="badge" data-s={i.status}>{STATUS_LABEL[i.status]}</span>
      </div>
      <p className="inq-contact">
        {i.email && <a href={`mailto:${i.email}`}>{i.email}</a>}
        {i.phone && <a href={`tel:${i.phone.replace(/[^\d+]/g, "")}`} dir="ltr">{i.phone}</a>}
      </p>
      {i.ref && <p className="inq-ref">About: {i.ref}</p>}
      <p className="inq-msg" dir="auto">{i.message}</p>
      <div className="inq-edit">
        <div className="fe-field">
          <label className="fe-label" htmlFor={`st-${i.id}`}>Status</label>
          <select id={`st-${i.id}`} className="ai" value={status} onChange={(e) => setStatus(e.target.value as Inquiry["status"])}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="fe-field grow">
          <label className="fe-label" htmlFor={`nt-${i.id}`}>Internal note (never shown to the visitor)</label>
          <textarea id={`nt-${i.id}`} className="ai" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {state.kind === "error" && <p className="alert alert--error" role="alert">{state.text}</p>}
      {state.kind === "ok" && !dirty && <p className="alert alert--ok" role="status">{state.text}</p>}
      <div className="row">
        <button type="button" className="ab ab--primary" onClick={save} disabled={!dirty || state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save"}
        </button>
        {canDelete &&
          (confirm ? (
            <>
              <button type="button" className="ab ab--danger" onClick={del}>Yes, delete permanently</button>
              <button type="button" className="ab ab--ghost" onClick={() => setConfirm(false)}>Keep it</button>
            </>
          ) : (
            <button type="button" className="ab ab--ghost ab--danger" onClick={() => setConfirm(true)}>Delete</button>
          ))}
      </div>
    </li>
  );
}
