"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface HeaderProps {
  lang: "ar" | "en";
  base: string; // "/ar" or "/preview/ar"
  brandMain: string;
  brandSub: string;
  logo?: string;
  logoLight?: string;
  siteName: string;
  /** "hero": transparent over a DARK photograph (white text). "hero-bright": transparent over the BRIGHT video (navy text). "solid": white bar. */
  tone: "hero" | "hero-bright" | "solid";
  /** Custom pages shown in the menu, between Events and Contact. */
  extra?: { path: string; label: string }[];
  labels: { home: string; about: string; travel: string; events: string; contact: string; menu: string; close: string; primary: string; plan: string; switchTo: string; switchShort: string };
}

export function Header({ lang, base, brandMain, brandSub, logo, logoLight, siteName, tone, extra = [], labels }: HeaderProps) {
  const path = usePathname() || base;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Menu: Escape closes, focus stays inside while open, scroll is locked behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      } else if (e.key === "Tab") {
        const f = [toggleRef.current!, ...focusables()].filter(Boolean);
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [path]);

  const rest = path.startsWith(base) ? path.slice(base.length) : "";
  const other = lang === "ar" ? "en" : "ar";
  const otherBase = base.replace(`/${lang}`, `/${other}`);
  const switchHref = `${otherBase}${rest}` || otherBase;

  const items: [string, string][] = [
    ["", labels.home],
    ["/about", labels.about],
    ["/travel", labels.travel],
    ["/events", labels.events],
    ...extra.map((x): [string, string] => [x.path, x.label]),
    ["/contact", labels.contact],
  ];
  const isActive = (p: string) => (p === "" ? rest === "" || rest === "/" : rest === p || rest.startsWith(p + "/"));
  const light = logoLight || logo;
  const dark = logo || logoLight;

  return (
    <header className="site-header" data-tone={tone} data-scrolled={scrolled} data-open={open}>
      <div className="header-row">
        <a className="brand" href={base || "/"} aria-label={siteName}>
          {dark || light ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo brand-logo--dark" src={dark} alt="" height={40} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo brand-logo--light" src={light} alt="" height={40} />
            </>
          ) : (
            <span className="wordmark" aria-hidden="true">
              <span className="wordmark-main">{brandMain}</span>
              <span className="wordmark-sub">{brandSub}</span>
            </span>
          )}
        </a>

        <nav className="nav-desktop" aria-label={labels.primary}>
          <ul>
            {items.map(([p, label]) => (
              <li key={p}>
                <a href={`${base}${p}` || "/"} aria-current={isActive(p) ? "page" : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <a className="lang-switch" href={switchHref} hrefLang={other} lang={other} aria-label={labels.switchTo}>
            {labels.switchShort}
          </a>
          <a className="btn btn--sm header-cta" href={`${base}/contact`}>
            {labels.plan}
          </a>
          <button
            ref={toggleRef}
            className="menu-toggle"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? labels.close : labels.menu}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="menu-bars" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div id="mobile-menu" ref={panelRef} className="mobile-panel" hidden={!open}>
        <nav aria-label={labels.primary}>
          <ul>
            {items.map(([p, label]) => (
              <li key={p}>
                <a href={`${base}${p}` || "/"} aria-current={isActive(p) ? "page" : undefined} onClick={() => setOpen(false)}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="btn mobile-cta" href={`${base}/contact`} onClick={() => setOpen(false)}>
          {labels.plan}
        </a>
      </div>
    </header>
  );
}
