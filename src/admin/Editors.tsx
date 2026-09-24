"use client";

import { useEffect, useState } from "react";
import { KINDS, type KindKey } from "@/content/schema";
import { api, ApiError } from "./api";
import { DocEditor, type EntryDTO } from "./DocEditor";

export function SingletonEditor({ kind, role }: { kind: KindKey; role: "admin" | "editor" }) {
  const def = KINDS[kind];
  const [entry, setEntry] = useState<EntryDTO | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ entry: EntryDTO }>(`/api/admin/content/${kind}`)
      .then((r) => setEntry(r.entry))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load."));
  }, [kind]);
  return (
    <div className="page">
      <header className="page-title">
        <h1>{def.label}</h1>
        <p>{def.description}</p>
      </header>
      {error && <p className="alert alert--error">{error}</p>}
      {!entry && !error && <p>Loading…</p>}
      {entry && <DocEditor kind={kind} entry={entry} role={role} onChanged={setEntry} />}
    </div>
  );
}

const titleOf = (e: EntryDTO, def = KINDS[e.kind]) => {
  const t = e.data?.[def.titleKey ?? "title"];
  return t?.en || t?.ar || "(untitled)";
};

export function CollectionManager({ kind, role }: { kind: KindKey; role: "admin" | "editor" }) {
  const def = KINDS[kind];
  const [list, setList] = useState<EntryDTO[] | null>(null);
  const [sel, setSel] = useState<string>(""); // entry id, "new" or ""
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    setList(null);
    setSel("");
    api<{ entries: EntryDTO[] }>(`/api/admin/content/${kind}`)
      .then((r) => setList(r.entries))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load."));
  }, [kind]);

  async function move(i: number, d: number) {
    if (!list) return;
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setMoving(true);
    try {
      await api(`/api/admin/content/${kind}/reorder`, { method: "POST", body: { ids: next.map((e) => e.id) } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reorder.");
      setList(list);
    }
    setMoving(false);
  }

  const current = list?.find((e) => e.id === sel) ?? null;
  const canCreate = def.editRoles.includes(role);

  return (
    <div className="page">
      <header className="page-title">
        <h1>{def.plural}</h1>
        <p>{def.description}</p>
      </header>
      {error && <p className="alert alert--error" role="alert">{error}</p>}
      <div className="split-admin">
        <section className="list-col" aria-label={def.plural}>
          {canCreate && (
            <button type="button" className="ab ab--primary block" onClick={() => setSel("new")}>
              New {def.label.toLowerCase()}
            </button>
          )}
          {list === null ? (
            <p>Loading…</p>
          ) : list.length === 0 ? (
            <p className="empty">Nothing here yet. {canCreate ? `Create your first ${def.label.toLowerCase()}.` : ""}</p>
          ) : (
            <ul className="entry-list">
              {list.map((e, i) => (
                <li key={e.id} className={sel === e.id ? "is-sel" : ""}>
                  <button type="button" className="entry-btn" onClick={() => { setFlash(""); setSel(e.id); }} aria-current={sel === e.id}>
                    <span className="entry-title">{titleOf(e)}</span>
                    <span className="badge" data-s={e.status === "published" ? (e.hasChanges ? "changes" : "live") : "draft"}>
                      {e.status === "published" ? (e.hasChanges ? "Live, edits pending" : "Live") : "Draft"}
                    </span>
                  </button>
                  {canCreate && list.length > 1 && (
                    <span className="entry-move">
                      <button type="button" className="ab ab--ghost ab--sm" aria-label={`Move ${titleOf(e)} up`} disabled={i === 0 || moving} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" className="ab ab--ghost ab--sm" aria-label={`Move ${titleOf(e)} down`} disabled={i === list.length - 1 || moving} onClick={() => move(i, 1)}>↓</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="editor-col">
          {sel === "new" && (
            <DocEditor
              key="new"
              kind={kind}
              entry={null}
              role={role}
              onChanged={(e) => {
                setList((cur) => ((cur ?? []).some((x) => x.id === e.id) ? (cur ?? []).map((x) => (x.id === e.id ? e : x)) : [...(cur ?? []), e]));
                setFlash(e.status === "published" ? "Published. Visitors now see this version." : "Created as a draft. Visitors do not see it until you publish.");
                setSel(e.id);
              }}
            />
          )}
          {current && (
            <DocEditor
              key={current.id}
              flash={flash}
              kind={kind}
              entry={current}
              role={role}
              onChanged={(e) => setList((cur) => (cur ?? []).map((x) => (x.id === e.id ? e : x)))}
              onDeleted={(id) => {
                setList((cur) => (cur ?? []).filter((x) => x.id !== id));
                setSel("");
              }}
            />
          )}
          {!sel && <p className="empty">Select an item to edit it{canCreate ? ", or create a new one" : ""}.</p>}
        </section>
      </div>
    </div>
  );
}
