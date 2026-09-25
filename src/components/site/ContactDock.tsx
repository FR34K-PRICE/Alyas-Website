"use client";

import { useEffect, useState } from "react";

export interface ContactDockProps {
  label: string; // accessible name of the bar
  planHref: string;
  planLabel: string;
  secondary?: { href: string; label: string; external: boolean };
  newTabLabel?: string;
  /** "after-hero": appears once the home hero has scrolled away (the hero already has its own button). */
  mode: "always" | "after-hero";
}

/**
 * A slim bar fixed to the bottom of the screen on phones so the main contact action is always one tap away.
 * The secondary button (WhatsApp or phone) exists only when those details are configured in the CMS.
 * Hidden from tablet width up, where the header already carries the button.
 */
export function ContactDock({ label, planHref, planLabel, secondary, newTabLabel, mode }: ContactDockProps) {
  const [visible, setVisible] = useState(mode === "always");

  useEffect(() => {
    if (mode === "always") return;
    const on = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [mode]);

  return (
    <nav className="dock" data-visible={visible} aria-label={label} hidden={!visible}>
      <a className="btn btn--gold" href={planHref}>
        {planLabel}
      </a>
      {secondary && (
        <a className="btn btn--dark" href={secondary.href} {...(secondary.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {secondary.label}
          {secondary.external && newTabLabel && <span className="sr-only"> {newTabLabel}</span>}
        </a>
      )}
    </nav>
  );
}
