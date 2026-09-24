"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KINDS, emptyData, deepMerge, type KindKey } from "@/content/schema";
import { api, ApiError } from "./api";
import { FieldEditor } from "./FieldEditor";

export interface EntryDTO {
  id: string;
  kind: KindKey;
  slug: string;
  status: "draft" | "published";
  data: any;
  hasChanges: boolean;
  updatedAt: string;
  updatedBy: string | null;
  publishedAt: string | null;
}

const PREVIEW_PATH: Record<KindKey, string> = {
  site: "", home: "", about: "/about", travel: "/travel", events: "/events", contact: "/contact",
  service: "/travel", offer: "", event: "/events", news: "/events", page: "",
};

type Notice = { kind: "ok" | "error" | "info"; text: string } | null;

export function DocEditor({
  kind, entry, role, onChanged, onDeleted, flash,
}: {
  flash?: string;
  kind: KindKey;
  entry: EntryDTO | null; // null = creating
  role: "admin" | "editor";
  onChanged: (e: EntryDTO) => void;
  onDeleted?: (id: string) => void;
}) {
  const def = KINDS[kind];
  const canEdit = def.editRoles.includes(role);
  const initial = useMemo(() => deepMerge(emptyData(kind), entry?.data ?? {}), [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState<any>(initial);
  const [saved, setSaved] = useState<string>(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(flash ? { kind: "ok", text: flash } : null);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "unpublish" | "delete">("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  // A new entry remounts this editor once it exists; carry the confirmation across.
  useEffect(() => {
    if (flash) setNotice({ kind: "ok", text: flash });
  }, [flash]);

  const dirty = JSON.stringify(data) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const status = !entry?.id ? "New (not saved yet)" : entry.status === "draft" ? (def.singleton && !entry.publishedAt ? "Not published yet" : "Draft") : entry.hasChanges ? "Published, with unpublished changes" : "Published";

  async function persist(): Promise<EntryDTO | null> {
    setErrors({});
    try {
      const r =
        def.singleton
          ? await api<{ entry: EntryDTO }>(`/api/admin/content/${kind}`, { method: "PUT", body: { data } })
          : entry?.id
            ? await api<{ entry: EntryDTO }>(`/api/admin/entries/${entry.id}`, { method: "PUT", body: { data } })
            : await api<{ entry: EntryDTO }>(`/api/admin/content/${kind}`, { method: "POST", body: { data } });
      const next = deepMerge(emptyData(kind), r.entry.data);
      setData(next);
      setSaved(JSON.stringify(next));
      onChanged(r.entry);
      return r.entry;
    } catch (e) {
      fail(e);
      return null;
    }
  }

  function fail(e: unknown) {
    if (e instanceof ApiError) {
      setErrors(e.fields);
      const n = Object.keys(e.fields).length;
      setNotice({ kind: "error", text: n ? `${e.message} (${n} ${n === 1 ? "field needs" : "fields need"} attention)` : e.message });
    } else setNotice({ kind: "error", text: "Something went wrong. Please try again." });
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function save() {
    setBusy("save");
    setNotice(null);
    const r = await persist();
    if (r) setNotice({ kind: "ok", text: "Draft saved. Visitors do not see it until you publish." });
    setBusy("");
  }

  async function publish() {
    setBusy("publish");
    setNotice(null);
    const r = await persist();
    if (r) {
      try {
        const p = await api<{ entry: EntryDTO }>(def.singleton ? `/api/admin/content/${kind}/publish` : `/api/admin/entries/${r.id}/publish`, { method: "POST" });
        onChanged(p.entry);
        setNotice({ kind: "ok", text: "Published. Visitors now see this version." });
      } catch (e) {
        fail(e);
      }
    }
    setBusy("");
  }

  async function unpublish() {
    if (!entry?.id) return;
    setBusy("unpublish");
    try {
      const r = await api<{ entry: EntryDTO }>(`/api/admin/entries/${entry.id}/unpublish`, { method: "POST" });
      onChanged(r.entry);
      setNotice({ kind: "ok", text: "Unpublished. It is now hidden from visitors." });
    } catch (e) {
      fail(e);
    }
    setBusy("");
  }

  async function remove() {
    if (!entry?.id) return;
    setBusy("delete");
    try {
      await api(`/api/admin/entries/${entry.id}`, { method: "DELETE" });
      onDeleted?.(entry.id);
    } catch (e) {
      setConfirmDelete(false);
      fail(e);
    }
    setBusy("");
  }

  async function preview(lang: "en" | "ar") {
    // Preview shows the saved draft, so save first when there are edits.
    let latest = entry;
    if (dirty || !entry?.id) {
      setBusy("save");
      const r = await persist();
      setBusy("");
      if (!r) return;
      latest = r;
    }
    // A custom page previews at its own (possibly not yet live) address.
    const path = kind === "page" ? `/${latest?.data?.slug || latest?.slug}` : PREVIEW_PATH[kind];
    window.open(`/preview/${lang}${path}`, "_blank", "noopener");
  }

  const isBusy = busy !== "";
  return (
    <div className="editor" ref={top}>
      <div className="editor-head">
        <div>
          <h2>{entry?.id || def.singleton ? def.label : `New ${def.label.toLowerCase()}`}</h2>
          <p className="status" data-status={status}>
            <span className="dot" aria-hidden="true" /> {status}
            {dirty && <span className="unsaved"> · Unsaved edits</span>}
          </p>
        </div>
      </div>

      {kind === "page" && entry?.id && entry.status === "published" && (
        <p className="live-links">
          Live at{" "}
          <a href={`/en/${entry.slug}`} target="_blank" rel="noopener noreferrer">/en/{entry.slug}</a> and{" "}
          <a href={`/ar/${entry.slug}`} target="_blank" rel="noopener noreferrer">/ar/{entry.slug}</a>
          {entry.data?.slug && entry.data.slug !== entry.slug && <span> · New address <strong>/{entry.data.slug}</strong> goes live when you publish; the current address then redirects to it.</span>}
        </p>
      )}

      {notice && (
        <p className={`alert alert--${notice.kind === "error" ? "error" : "ok"}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
      {!canEdit && <p className="alert alert--error">Only administrators can edit this. You can view it but not change it.</p>}

      <fieldset disabled={!canEdit || isBusy} className="editor-fields">
        <FieldEditor fields={def.fields} value={data} onChange={setData} errors={errors} />
      </fieldset>

      {canEdit && (
        <div className="editor-bar">
          <button type="button" className="ab ab--ghost" onClick={save} disabled={isBusy || !dirty}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" className="ab ab--ghost" onClick={() => preview("en")} disabled={isBusy}>
            Preview (English)
          </button>
          <button type="button" className="ab ab--ghost" onClick={() => preview("ar")} disabled={isBusy}>
            Preview (Arabic)
          </button>
          <span className="spacer" />
          {!def.singleton && entry?.id && entry.status === "published" && (
            <button type="button" className="ab ab--ghost" onClick={unpublish} disabled={isBusy}>
              {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
            </button>
          )}
          {!def.singleton && entry?.id && role === "admin" &&
            (confirmDelete ? (
              <>
                <button type="button" className="ab ab--danger" onClick={remove} disabled={isBusy}>Yes, delete permanently</button>
                <button type="button" className="ab ab--ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
              </>
            ) : (
              <button type="button" className="ab ab--ghost ab--danger" onClick={() => setConfirmDelete(true)} disabled={isBusy}>Delete</button>
            ))}
          <button type="button" className="ab ab--primary" onClick={publish} disabled={isBusy || (!dirty && !!entry?.id && entry.status === "published" && !entry.hasChanges)}>
            {busy === "publish" ? "Publishing…" : "Publish"}
          </button>
        </div>
      )}
    </div>
  );
}
