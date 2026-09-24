"use client";

import { useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { Uploader, useMedia, type MediaItem } from "./MediaPicker";

export function MediaLibrary({ role }: { role: "admin" | "editor" }) {
  const { items, setItems, error } = useMedia();
  const [folder, setFolder] = useState("all");
  const [uploadFolder, setUploadFolder] = useState("general");
  const [sel, setSel] = useState<MediaItem | null>(null);

  const folders = useMemo(() => Array.from(new Set((items ?? []).map((m) => m.folder))).sort(), [items]);
  const shown = (items ?? []).filter((m) => folder === "all" || m.folder === folder);

  return (
    <div className="page">
      <header className="page-title">
        <h1>Media library</h1>
        <p>Images uploaded here can be used anywhere on the site. They are stored in the database, so they survive redeploys.</p>
      </header>

      <div className="toolbar">
        <div className="fe-field inline">
          <label htmlFor="up-folder" className="fe-label">
            Upload to folder
          </label>
          <input id="up-folder" className="ai" value={uploadFolder} maxLength={40} onChange={(e) => setUploadFolder(e.target.value)} list="folders" />
          <datalist id="folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <Uploader folder={uploadFolder} onDone={(m) => setItems((cur) => [...m, ...(cur ?? [])])} />
      </div>

      <div className="tabs" role="tablist" aria-label="Folders">
        {["all", ...folders].map((f) => (
          <button key={f} role="tab" aria-selected={folder === f} className="tab" onClick={() => setFolder(f)}>
            {f === "all" ? "All images" : f}
          </button>
        ))}
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {items === null ? (
        <p>Loading…</p>
      ) : shown.length === 0 ? (
        <p className="empty">No images here yet. Use “Upload images” to add your first photo.</p>
      ) : (
        <ul className="media-grid">
          {shown.map((m) => (
            <li key={m.id}>
              <button type="button" className={`media-tile ${sel?.id === m.id ? "is-sel" : ""}`} onClick={() => setSel(m)} aria-label={`Edit ${m.filename}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${m.id}?w=480`} alt="" loading="lazy" width={m.width} height={m.height} />
                <span>{m.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {sel && (
        <MediaEditor
          key={sel.id}
          item={sel}
          canDelete={role === "admin"}
          onClose={() => setSel(null)}
          onSaved={(m) => {
            setItems((cur) => (cur ?? []).map((x) => (x.id === m.id ? m : x)));
            setSel(m);
          }}
          onDeleted={(id) => {
            setItems((cur) => (cur ?? []).filter((x) => x.id !== id));
            setSel(null);
          }}
        />
      )}
    </div>
  );
}

function MediaEditor({ item, canDelete, onClose, onSaved, onDeleted }: { item: MediaItem; canDelete: boolean; onClose: () => void; onSaved: (m: MediaItem) => void; onDeleted: (id: string) => void }) {
  const [f, setF] = useState({ filename: item.filename, folder: item.folder, alt_en: item.alt_en, alt_ar: item.alt_ar });
  const [state, setState] = useState<{ kind: "idle" | "saving" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const [confirm, setConfirm] = useState(false);

  async function save() {
    setState({ kind: "saving" });
    try {
      const r = await api<{ media: MediaItem }>(`/api/admin/media/${item.id}`, { method: "PATCH", body: f });
      onSaved(r.media);
      setState({ kind: "ok", text: "Saved" });
    } catch (e) {
      setState({ kind: "error", text: e instanceof ApiError ? e.message : "Could not save." });
    }
  }
  async function remove() {
    setState({ kind: "saving" });
    try {
      await api(`/api/admin/media/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
    } catch (e) {
      setConfirm(false);
      setState({ kind: "error", text: e instanceof ApiError ? e.message : "Could not delete." });
    }
  }

  return (
    <aside className="drawer" aria-label={`Edit ${item.filename}`}>
      <div className="modal-head">
        <h2>Image details</h2>
        <button type="button" className="ab ab--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="drawer-img" src={`/media/${item.id}?w=960`} alt={f.alt_en || ""} />
      <p className="fe-help">
        {item.width} × {item.height}px · {Math.round(item.bytes / 1024)} KB
      </p>
      <div className="fe-field">
        <label className="fe-label" htmlFor="m-name">File name</label>
        <input id="m-name" className="ai" value={f.filename} maxLength={120} onChange={(e) => setF({ ...f, filename: e.target.value })} />
      </div>
      <div className="fe-field">
        <label className="fe-label" htmlFor="m-folder">Folder</label>
        <input id="m-folder" className="ai" value={f.folder} maxLength={40} onChange={(e) => setF({ ...f, folder: e.target.value })} />
      </div>
      <div className="fe-field">
        <label className="fe-label" htmlFor="m-alt-en">Description for screen readers (English)</label>
        <input id="m-alt-en" className="ai" value={f.alt_en} maxLength={200} onChange={(e) => setF({ ...f, alt_en: e.target.value })} />
      </div>
      <div className="fe-field">
        <label className="fe-label" htmlFor="m-alt-ar">Description for screen readers (Arabic)</label>
        <input id="m-alt-ar" className="ai" dir="rtl" lang="ar" value={f.alt_ar} maxLength={200} onChange={(e) => setF({ ...f, alt_ar: e.target.value })} />
      </div>
      {state.kind === "error" && <p className="alert alert--error" role="alert">{state.text}</p>}
      {state.kind === "ok" && <p className="alert alert--ok" role="status">{state.text}</p>}
      <div className="row">
        <button type="button" className="ab ab--primary" onClick={save} disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save details"}
        </button>
        {canDelete &&
          (confirm ? (
            <>
              <button type="button" className="ab ab--danger" onClick={remove}>Yes, delete this image</button>
              <button type="button" className="ab ab--ghost" onClick={() => setConfirm(false)}>Keep it</button>
            </>
          ) : (
            <button type="button" className="ab ab--ghost ab--danger" onClick={() => setConfirm(true)}>Delete</button>
          ))}
      </div>
    </aside>
  );
}
