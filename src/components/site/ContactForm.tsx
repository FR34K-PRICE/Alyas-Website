"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DICT } from "@/i18n/dict";
import type { Lang } from "@/content/schema";

const INTERESTS = ["flights", "hotels", "visa", "transport", "tailored", "events", "floral", "other"];
type Status = "idle" | "sending" | "ok" | "error";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

export function ContactForm({ lang, initialInterest, initialRef, refLabel, successText }: { lang: Lang; initialInterest?: string; initialRef?: string; refLabel?: string; successText: string }) {
  const t = DICT[lang].form;
  const uid = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [token, setToken] = useState("");
  const [tsKey, setTsKey] = useState("");
  const [tsToken, setTsToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const tsBox = useRef<HTMLDivElement>(null);
  const tsId = useRef<string | undefined>(undefined);
  const interest = INTERESTS.includes(initialInterest || "") ? (initialInterest as string) : "other";

  useEffect(() => {
    let alive = true;
    fetch("/api/inquiries/token", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setToken(j.token);
        setTsKey(j.turnstileSiteKey || "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!tsKey || !tsBox.current) return;
    const mount = () => {
      if (window.turnstile && tsBox.current && !tsId.current) {
        tsId.current = window.turnstile.render(tsBox.current, { sitekey: tsKey, callback: (v: string) => setTsToken(v), "expired-callback": () => setTsToken("") });
      }
    };
    if (window.turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
  }, [tsKey]);

  function validate(f: FormData) {
    const e: Record<string, string> = {};
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim();
    const phone = String(f.get("phone") || "").trim();
    const message = String(f.get("message") || "").trim();
    if (name.length < 2) e.name = "name";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "email";
    if (phone && !/^[+\d][\d\s()\-]{5,28}$/.test(phone)) e.phone = "phone";
    if (!email && !phone) e.email = "contact";
    if (message.length < 5) e.message = "message";
    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return;
    const f = new FormData(ev.currentTarget);
    const local = validate(f);
    setBanner("");
    if (Object.keys(local).length) {
      setErrors(local);
      setStatus("idle");
      const first = ["name", "email", "phone", "message"].find((k) => local[k]);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-alyas-csrf": "1" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          interest: f.get("interest"),
          message: f.get("message"),
          ref: f.get("ref") || "",
          lang,
          website: f.get("website") || "",
          token,
          turnstile: tsToken || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setStatus("ok");
        return;
      }
      setStatus("error");
      if (j.fields) setErrors(j.fields);
      setBanner(res.status === 429 ? j.error || t.network : res.status === 400 && !j.fields ? j.error || t.network : t.network);
      if (window.turnstile && tsId.current) window.turnstile.reset(tsId.current);
      // A fresh timing token for the retry.
      fetch("/api/inquiries/token", { cache: "no-store" }).then((r) => r.json()).then((x) => setToken(x.token)).catch(() => {});
    } catch {
      setStatus("error");
      setBanner(t.network);
    }
  }

  if (status === "ok") {
    return (
      <div className="form-done" role="status">
        <h3>{t.sentTitle}</h3>
        <p>{successText}</p>
        <button className="btn btn--navy" type="button" onClick={() => { setStatus("idle"); formRef.current?.reset(); }}>
          {t.another}
        </button>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? t.errors[errors[k]] || t.errors.generic : "");
  const field = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${uid}-${k}-e` : undefined });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="inquiry-form">
      {banner && (
        <div className="alert alert--error" role="alert">
          {banner}
        </div>
      )}
      <div className="field" data-invalid={!!errors.name}>
        <label htmlFor={`${uid}-name`}>{t.name}<span className="req">{t.required}</span></label>
        <input className="input" id={`${uid}-name`} name="name" autoComplete="name" maxLength={100} {...field("name")} />
        {errors.name && <span className="field-error" id={`${uid}-name-e`}>{err("name")}</span>}
      </div>
      <div className="field-row">
        <div className="field" data-invalid={!!errors.email}>
          <label htmlFor={`${uid}-email`}>{t.email}</label>
          <input className="input" id={`${uid}-email`} name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={160} {...field("email")} />
          {errors.email && <span className="field-error" id={`${uid}-email-e`}>{err("email")}</span>}
        </div>
        <div className="field" data-invalid={!!errors.phone}>
          <label htmlFor={`${uid}-phone`}>{t.phone}</label>
          <input className="input" id={`${uid}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={30} {...field("phone")} />
          {errors.phone && <span className="field-error" id={`${uid}-phone-e`}>{err("phone")}</span>}
        </div>
      </div>
      <p className="field-hint form-hint">{t.contactHint}</p>
      <div className="field">
        <label htmlFor={`${uid}-interest`}>{t.interest}</label>
        <select className="select" id={`${uid}-interest`} name="interest" defaultValue={interest}>
          {INTERESTS.map((k) => (
            <option key={k} value={k}>{t.interests[k]}</option>
          ))}
        </select>
      </div>
      {initialRef && (
        <div className="field">
          <span className="label">{t.ref}</span>
          <p className="ref-chip">{refLabel || initialRef}</p>
          <input type="hidden" name="ref" value={initialRef} />
        </div>
      )}
      <div className="field" data-invalid={!!errors.message}>
        <label htmlFor={`${uid}-message`}>{t.message}<span className="req">{t.required}</span></label>
        <textarea className="textarea" id={`${uid}-message`} name="message" maxLength={2000} {...field("message")} />
        {errors.message && <span className="field-error" id={`${uid}-message-e`}>{err("message")}</span>}
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {tsKey && <div ref={tsBox} className="turnstile" />}
      <button className="btn btn--navy" type="submit" disabled={status === "sending"}>
        {status === "sending" ? t.sending : t.send}
      </button>
      <p className="field-hint privacy">{t.privacy}</p>
    </form>
  );
}
