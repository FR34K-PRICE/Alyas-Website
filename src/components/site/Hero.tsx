"use client";

import { useEffect, useRef } from "react";

/**
 * The opening: one large destination photograph, an oversized headline, and a foreground layer
 * (cut out of the same photograph) that overlaps the bottom of the letters for depth.
 * Layer order: photo < shade < aircraft < headline < foreground < copy and button.
 *
 * Motion is a single, quiet detail: a small airliner crosses an open part of the sky once and stays
 * there. No animation library, no scroll hooks, no loading screen. Reduced motion or no scripts:
 * the aircraft is simply parked where it would end. It pauses while offscreen and is shorter and
 * smaller on phones and weaker devices.
 */

export interface HeroImage {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

export interface HeroProps {
  headline: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
  photo: HeroImage;
  photoAlt: string;
  foreground?: HeroImage;
  aircraft: { src: string; width: number; height: number };
  /** WhatsApp or phone, only when configured in the CMS. */
  secondary?: { href: string; label: string; external: boolean };
  actionsLabel?: string;
  /** screen-reader text appended to links that open in a new tab */
  newTabLabel?: string;
}

export function Hero({ headline, sub, ctaLabel, ctaHref, photo, photoAlt, foreground, aircraft, secondary, actionsLabel, newTabLabel }: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const plane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const p = plane.current;
    if (!el || !p) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // stays parked, fully visible
    if (typeof p.animate !== "function") return;

    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const lite =
      window.innerWidth < 768 ||
      (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) ||
      (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4) ||
      !!nav.connection?.saveData;

    const frame = el.querySelector<HTMLElement>(".hero-frame")!;
    const rtl = document.documentElement.dir === "rtl";
    const dir = rtl ? -1 : 1; // the aircraft travels in the reading direction
    const dx = frame.clientWidth * (lite ? 0.1 : 0.19);
    const dy = dx * 0.28; // a gentle climb; the aircraft image points right, and is mirrored in Arabic
    const anim = p.animate(
      [
        { opacity: 0, transform: `translate(${-dir * dx}px, ${dy}px) scale(${lite ? 1.25 : 1.55})` },
        { opacity: 1, offset: 0.22 },
        { opacity: 1, transform: "translate(0px, 0px) scale(1)" },
      ],
      { duration: lite ? 1800 : 3600, delay: 350, easing: "cubic-bezier(0.25, 0.6, 0.25, 1)", fill: "both" },
    );

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (anim.playState === "paused") anim.play();
        } else if (anim.playState === "running") anim.pause();
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      anim.cancel();
    };
  }, []);

  return (
    <section ref={root} className="hero" aria-labelledby="hero-title">
      <div className="hero-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-bg" src={photo.src} srcSet={photo.srcSet} sizes="100vw" width={photo.width} height={photo.height} alt={photoAlt} fetchPriority="high" decoding="async" />
        <div className="hero-shade" aria-hidden="true" />
        <div ref={plane} className="hero-plane" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aircraft.src} width={aircraft.width} height={aircraft.height} alt="" decoding="async" />
        </div>
        <h1 id="hero-title" className="hero-title" data-long={headline.length > 11 ? "true" : undefined}>
          {headline}
        </h1>
        {foreground && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-fg" src={foreground.src} srcSet={foreground.srcSet} sizes="100vw" width={foreground.width} height={foreground.height} alt="" aria-hidden="true" decoding="async" />
        )}
        <div className="hero-copy">
          <p>{sub}</p>
          <div className="hero-actions" role="group" aria-label={actionsLabel}>
            <a className="btn btn--gold" href={ctaHref}>
              {ctaLabel}
            </a>
            {secondary && (
              <a className="btn btn--light" href={secondary.href} {...(secondary.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {secondary.label}
                {secondary.external && newTabLabel && <span className="sr-only"> {newTabLabel}</span>}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
