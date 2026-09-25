"use client";

import { useId, useState } from "react";
import { emptyBlock, emptyValue, type Field } from "@/content/schema";
import { MediaPicker } from "./MediaPicker";

type Errors = Record<string, string>;
type Props = { fields: Field[]; value: any; onChange: (v: any) => void; errors: Errors; path?: string };

const get = (o: any, k: string) => (o && typeof o === "object" ? o[k] : undefined);

/** Renders any content definition as a form. One component drives every editor in the CMS. */
export function FieldEditor({ fields, value, onChange, errors, path = "" }: Props) {
  return (
    <div className="fe">
      {fields.map((f) => (
        <FieldRow key={f.key} f={f} value={get(value, f.key)} errors={errors} path={path ? `${path}.${f.key}` : f.key} onChange={(v) => onChange({ ...(value ?? {}), [f.key]: v })} />
      ))}
    </div>
  );
}

function FieldRow({ f, value, onChange, errors, path }: { f: Field; value: any; onChange: (v: any) => void; errors: Errors; path: string }) {
  const id = useId();

  if (f.type === "group") {
    return (
      <fieldset className="fe-group">
        <legend>{f.label}</legend>
        {f.help && <p className="fe-help">{f.help}</p>}
        <FieldEditor fields={f.fields} value={value} onChange={onChange} errors={errors} path={path} />
      </fieldset>
    );
  }

  if (f.type === "blocks") {
    const items: any[] = Array.isArray(value) ? value : [];
    const max = f.max ?? 30;
    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= items.length) return;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    return (
      <fieldset className="fe-group fe-blocks">
        <legend>{f.label}</legend>
        {f.help && <p className="fe-help">{f.help}</p>}
        {items.length === 0 && <p className="empty">No sections yet. Add one below.</p>}
        {items.map((it, i) => {
          const def = f.blocks.find((b) => b.type === it?.type);
          if (!def) return null;
          return (
            <div className="fe-item fe-block" key={i}>
              <div className="fe-item-head">
                <strong>
                  {i + 1}. {def.label}
                </strong>
                <span className="fe-item-actions">
                  <button type="button" className="ab ab--ghost ab--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move section ${i + 1} (${def.label}) up`}>
                    ↑
                  </button>
                  <button type="button" className="ab ab--ghost ab--sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move section ${i + 1} (${def.label}) down`}>
                    ↓
                  </button>
                  <button type="button" className="ab ab--ghost ab--sm ab--danger" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Remove section ${i + 1} (${def.label})`}>
                    Remove
                  </button>
                </span>
              </div>
              <FieldEditor fields={def.fields} value={it} errors={errors} path={`${path}.${i}`} onChange={(v) => onChange(items.map((x, k) => (k === i ? { ...v, type: def.type } : x)))} />
            </div>
          );
        })}
        {items.length < max && (
          <div className="fe-add-blocks" role="group" aria-label="Add a section">
            <p className="fe-sub">Add a section</p>
            <div className="fe-add-row">
              {f.blocks.map((b) => (
                <button key={b.type} type="button" className="ab ab--ghost" title={b.description} onClick={() => onChange([...items, emptyBlock(b)])}>
                  + {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {errors[path] && <span className="fe-error">{errors[path]}</span>}
      </fieldset>
    );
  }

  if (f.type === "list") {
    const items: any[] = Array.isArray(value) ? value : [];
    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= items.length) return;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    return (
      <fieldset className="fe-group fe-list">
        <legend>{f.label}</legend>
        {f.help && <p className="fe-help">{f.help}</p>}
        {items.map((it, i) => (
          <div className="fe-item" key={i}>
            <div className="fe-item-head">
              <strong>
                {f.itemLabel} {i + 1}
              </strong>
              <span className="fe-item-actions">
                <button type="button" className="ab ab--ghost ab--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${f.itemLabel} ${i + 1} up`}>
                  ↑
                </button>
                <button type="button" className="ab ab--ghost ab--sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${f.itemLabel} ${i + 1} down`}>
                  ↓
                </button>
                <button type="button" className="ab ab--ghost ab--sm ab--danger" onClick={() => onChange(items.filter((_, k) => k !== i))}>
                  Remove
                </button>
              </span>
            </div>
            <FieldEditor fields={f.fields} value={it} errors={errors} path={`${path}.${i}`} onChange={(v) => onChange(items.map((x, k) => (k === i ? v : x)))} />
          </div>
        ))}
        {items.length < (f.max ?? 30) && (
          <button type="button" className="ab ab--ghost" onClick={() => onChange([...items, emptyValue({ key: "x", type: "group", label: "", fields: f.fields })])}>
            Add {f.itemLabel.toLowerCase()}
          </button>
        )}
      </fieldset>
    );
  }

  if (f.type === "image") {
    return <ImageField id={id} f={f} value={value || ""} onChange={onChange} error={errors[path]} />;
  }

  if (f.type === "boolean") {
    return (
      <div className="fe-field fe-check">
        <label>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      </div>
    );
  }

  const bilingual = "bilingual" in f && f.bilingual;
  if (bilingual) {
    return (
      <div className="fe-field">
        <span className="fe-label">{f.label}</span>
        {"help" in f && f.help && <p className="fe-help">{f.help}</p>}
        <div className="fe-bi">
          {(["en", "ar"] as const).map((l) => (
            <div key={l} className="fe-bi-col">
              <label htmlFor={`${id}-${l}`} className="fe-sub">
                {l === "en" ? "English" : "العربية (Arabic)"}
              </label>
              <Control id={`${id}-${l}`} f={f} value={get(value, l) ?? ""} onChange={(v) => onChange({ ...(value ?? { ar: "", en: "" }), [l]: v })} lang={l} invalid={!!errors[`${path}.${l}`]} />
              {errors[`${path}.${l}`] && <span className="fe-error">{errors[`${path}.${l}`]}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fe-field">
      <label htmlFor={id} className="fe-label">
        {f.label}
      </label>
      {"help" in f && f.help && <p className="fe-help">{f.help}</p>}
      <Control id={id} f={f} value={value ?? ""} onChange={onChange} invalid={!!errors[path]} />
      {errors[path] && <span className="fe-error">{errors[path]}</span>}
    </div>
  );
}

function Control({ id, f, value, onChange, lang, invalid }: { id: string; f: Field; value: any; onChange: (v: any) => void; lang?: "ar" | "en"; invalid?: boolean }) {
  const dir = lang === "ar" ? "rtl" : undefined;
  const common = { id, dir, lang, "aria-invalid": invalid || undefined } as const;
  if (f.type === "textarea") {
    return <textarea className="ai" rows={("rows" in f && f.rows) || 4} value={value} maxLength={("max" in f && f.max) || 5000} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
  if (f.type === "select") {
    return (
      <select className="ai" value={value} onChange={(e) => onChange(e.target.value)} {...common}>
        <option value="">—</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (f.type === "date") return <input className="ai" type="date" value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
  if (f.type === "color") {
    const valid = /^#[0-9a-fA-F]{6}$/.test(value);
    return (
      <div className="fe-color">
        <input type="color" aria-label={`${f.label} picker`} value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
        <input className="ai" type="text" placeholder="Default" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} {...common} />
        {value && (
          <button type="button" className="ab ab--ghost ab--sm" onClick={() => onChange("")}>
            Use default
          </button>
        )}
      </div>
    );
  }
  return (
    <input
      className="ai"
      type={f.type === "url" ? "url" : "text"}
      inputMode={f.type === "url" ? "url" : f.type === "phone" || f.type === "whatsapp" ? "tel" : f.type === "email" ? "email" : undefined}
      autoComplete={f.type === "phone" || f.type === "whatsapp" || f.type === "email" ? "off" : undefined}
      dir={dir ?? (["url", "link", "phone", "whatsapp", "email"].includes(f.type) ? "ltr" : undefined)}
      value={value}
      maxLength={("max" in f && f.max) || 200}
      onChange={(e) => onChange(e.target.value)}
      id={id}
      lang={lang}
      aria-invalid={invalid || undefined}
    />
  );
}

function ImageField({ id, f, value, onChange, error }: { id: string; f: Extract<Field, { type: "image" }>; value: string; onChange: (v: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fe-field">
      <span className="fe-label" id={`${id}-l`}>
        {f.label}
      </span>
      {f.help && <p className="fe-help">{f.help}</p>}
      <div className="fe-image">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${value}?w=480`} alt="" />
        ) : (
          <div className="fe-image-empty">No image</div>
        )}
        <div className="fe-image-actions">
          <button type="button" className="ab ab--ghost" onClick={() => setOpen(true)} aria-describedby={`${id}-l`}>
            {value ? "Change image" : "Choose image"}
          </button>
          {value && (
            <button type="button" className="ab ab--ghost ab--danger" onClick={() => onChange("")}>
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <span className="fe-error">{error}</span>}
      {open && (
        <MediaPicker
          onClose={() => setOpen(false)}
          onPick={(m) => {
            onChange(m);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
