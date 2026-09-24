"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

export interface MediaItem {
  id: string;
  filename: string;
  alt_ar: string;
  alt_en: string;
  folder: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

export function useMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setItems((await api<{ media: MediaItem[] }>("/api/admin/media")).media);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load images.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { items, setItems, error, reload: load };
}

export function Uploader({ folder, onDone }: { folder: string; onDone: (m: MediaItem[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<{ name: string; ok: boolean; text: string }[]>([]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsgs([]);
    const done: MediaItem[] = [];
    const out: { name: string; ok: boolean; text: string }[] = [];
    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("folder", folder);
        const r = await api<{ media: MediaItem }>("/api/admin/media", { method: "POST", form });
        done.push(r.media);
        out.push({ name: file.name, ok: true, text: "Uploaded" });
      } catch (e) {
        out.push({ name: file.name, ok: false, text: e instanceof ApiError ? e.message : "Upload failed" });
      }
    }
    setMsgs(out);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (done.length) onDone(done);
  }

  return (
    <div className="uploader">
      <input ref={input} id="media-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
      <label htmlFor="media-file" className={`ab ab--primary ${busy ? "is-busy" : ""}`} aria-disabled={busy}>
        {busy ? "Uploading…" : "Upload images"}
      </label>
      <span className="fe-help">JPG, PNG, WebP or AVIF, up to 8 MB each.</span>
      <ul className="upload-msgs" aria-live="polite">
        {msgs.map((m, i) => (
          <li key={i} className={m.ok ? "ok" : "bad"}>
            {m.name}: {m.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MediaPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const { items, setItems, error } = useMedia();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Choose an image" tabIndex={-1} ref={dialog}>
        <div className="modal-head">
          <h2>Choose an image</h2>
          <button type="button" className="ab ab--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <Uploader folder="general" onDone={(m) => setItems((cur) => [...m, ...(cur ?? [])])} />
        {error && <p className="fe-error">{error}</p>}
        {items === null ? (
          <p>Loading…</p>
        ) : items.length === 0 ? (
          <p className="empty">No images yet. Upload one to get started.</p>
        ) : (
          <ul className="media-grid">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" className="media-tile" onClick={() => onPick(m.id)} aria-label={`Use ${m.filename}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/media/${m.id}?w=480`} alt="" loading="lazy" />
                  <span>{m.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
