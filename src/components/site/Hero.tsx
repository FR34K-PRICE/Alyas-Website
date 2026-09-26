"use client";

import { useEffect, useRef, useState } from "react";

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
  /** Optional cinematic backdrop; the still photo remains the fallback. */
  videoSrc?: string;
  videoPlayLabel?: string;
  foreground?: HeroImage;
  aircraft: { src: string; width: number; height: number };
  /** WhatsApp or phone, only when configured in the CMS. */
  secondary?: { href: string; label: string; external: boolean };
  actionsLabel?: string;
  /** screen-reader text appended to links that open in a new tab */
  newTabLabel?: string;
}

export function Hero({ headline, sub, ctaLabel, ctaHref, photo, photoAlt, videoSrc, videoPlayLabel = "Play video", foreground, aircraft, secondary, actionsLabel, newTabLabel }: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const userStartedVideo = useRef(false);
  const startFromTap = useRef<() => void>(() => {});
  // The manual Play button (and the poster) stay until real frames are advancing, not merely until play() resolves.
  const [showPlayButton, setShowPlayButton] = useState(true);
  // Before JavaScript runs (or if it never does), the browser's own controls are the only way to start the video.
  // Once the page has hydrated, the custom Play button takes over; the native controls come back if it fails.
  const [hydrated, setHydrated] = useState(false);
  const [nativeControls, setNativeControls] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  // Opt-in diagnostics for testing on a phone: open the page with ?videodebug=1.
  const [debug, setDebug] = useState<string[] | null>(null);

  useEffect(() => {
    const v = video.current;
    const el = root.current;
    if (!videoSrc || !v || !el) return;
    setHydrated(true);

    const debugOn = new URLSearchParams(window.location.search).has("videodebug");
    const t0 = performance.now();
    const log = (m: string) => {
      if (debugOn) setDebug((d) => [...(d ?? []).slice(-13), `${Math.round(performance.now() - t0)} ms  ${m}`]);
    };

    // 1. Muted BEFORE any playback attempt. React only writes the attribute at render time, so set the property too.
    v.defaultMuted = true;
    v.muted = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");

    // 2. Codec support (H.264 High, level 3.2). If the browser cannot play it, keep the poster and offer no dead button.
    const codec = v.canPlayType('video/mp4; codecs="avc1.640020"');
    if (!codec) {
      log("this browser cannot play the video codec; keeping the poster");
      setUnsupported(true);
      return;
    }

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } };
    let visible = false;
    let autoAllowed = false;
    let everPlayed = false;
    let disposed = false;

    /** Resolves true only when frames are really advancing (first presented frame or clock progress), false after 3.5 s. */
    const framesAdvance = () =>
      new Promise<boolean>((resolve) => {
        const from = v.currentTime;
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          v.removeEventListener("timeupdate", onTime);
          resolve(ok);
        };
        const onTime = () => {
          if (Math.abs(v.currentTime - from) > 0.12) finish(true);
        };
        const timer = window.setTimeout(() => finish(false), 3500);
        v.addEventListener("timeupdate", onTime);
        const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
        if (typeof rvfc === "function") rvfc.call(v, () => window.setTimeout(() => finish(!v.paused), 120));
      });

    const verify = async () => {
      log("playing event: waiting for real frames");
      const ok = await framesAdvance();
      if (disposed) return;
      log(ok ? "frames are advancing: hiding the Play button" : "no frames advanced within 3.5 s: keeping the Play button");
      if (ok) everPlayed = true;
      setShowPlayButton(!ok);
      if (!ok) setNativeControls(true);
    };

    const attempt = async (manual: boolean) => {
      if (!manual && (!visible || !autoAllowed)) return;
      // Autoplay is permitted here (no reduced motion, no Data Saver) or the visitor asked: allow loading and starting.
      if (v.preload !== "auto") v.preload = "auto";
      if (!manual) v.autoplay = true;
      log(`play() attempt (${manual ? "visitor tap" : "autoplay"}): muted=${v.muted} readyState=${v.readyState}`);
      try {
        await v.play();
        log("play() resolved");
      } catch (e) {
        const err = e as DOMException;
        log(`play() REJECTED ${err.name}: ${err.message}`);
        if (manual) userStartedVideo.current = false;
        setShowPlayButton(true);
        if (manual) setNativeControls(true);
      }
    };

    const update = () => {
      autoAllowed = !motion.matches && !nav.connection?.saveData;
      log(`environment: reducedMotion=${motion.matches} saveData=${String(nav.connection?.saveData)} autoplayAllowed=${autoAllowed}`);
      if (autoAllowed) void attempt(false);
      else if (!userStartedVideo.current) {
        v.pause();
        setShowPlayButton(true);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void attempt(userStartedVideo.current);
      else v.pause();
    }, { threshold: 0.01 });
    const onPlaying = () => {
      if (everPlayed) setShowPlayButton(false);
      else void verify();
    };
    const onError = () => {
      log(`media error code=${v.error?.code} ${v.error?.message ?? ""}`);
      setShowPlayButton(true);
      setNativeControls(true);
    };
    const onEvent = (e: Event) => log(`event ${e.type}`);
    const events = ["loadstart", "loadedmetadata", "canplay", "waiting", "stalled", "suspend", "emptied"];
    if (debugOn) events.forEach((n) => v.addEventListener(n, onEvent));
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onError);
    log(`codec support for H.264 High 3.2: "${codec}"; ${navigator.userAgent.slice(0, 90)}`);
    io.observe(el);
    update();
    motion.addEventListener("change", update);
    nav.connection?.addEventListener?.("change", update);
    startFromTap.current = () => {
      userStartedVideo.current = true;
      void attempt(true);
    };
    return () => {
      disposed = true;
      io.disconnect();
      motion.removeEventListener("change", update);
      nav.connection?.removeEventListener?.("change", update);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onError);
      startFromTap.current = () => {};
      if (debugOn) events.forEach((n) => v.removeEventListener(n, onEvent));
      v.pause();
    };
  }, [videoSrc]);

  const playOnTap = () => {
    const v = video.current;
    if (!v) return;
    // A real tap: this counts as the user's own request, so it is allowed to start playback even where autoplay is not.
    v.muted = true;
    startFromTap.current();
  };

  useEffect(() => {
    const el = root.current;
    const p = plane.current;
    if (!el || !p || videoSrc) return;
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
  }, [videoSrc]);

  return (
    <section ref={root} className={`hero${videoSrc ? " hero--video" : ""}`} aria-labelledby="hero-title">
      <div className="hero-frame">
        {videoSrc ? (
          <>
            {/* The poster is the stable reduced-motion and loading fallback. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero-bg" src="/video/alyas-cloud-flight-poster.webp" width={1280} height={720} alt="" aria-hidden="true" fetchPriority="high" />
            {!unsupported && (
              <video ref={video} className="hero-video" src={videoSrc} muted loop playsInline disableRemotePlayback preload="none" poster="/video/alyas-cloud-flight-poster.webp" controls={(showPlayButton && !hydrated) || nativeControls} aria-hidden={showPlayButton || nativeControls ? undefined : true} tabIndex={showPlayButton || nativeControls ? 0 : -1} />
            )}
            {debug && <pre className="hero-video-debug" aria-hidden="true">{debug.join(String.fromCharCode(10))}</pre>}
            {showPlayButton && !unsupported && <button className="hero-video-play" type="button" onClick={playOnTap}>
              <span aria-hidden="true">▶</span> {videoPlayLabel}
            </button>}
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="hero-bg" src={photo.src} srcSet={photo.srcSet} sizes="100vw" width={photo.width} height={photo.height} alt={photoAlt} fetchPriority="high" decoding="async" />
        )}
        <div className="hero-shade" aria-hidden="true" />
        {!videoSrc && <div ref={plane} className="hero-plane" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aircraft.src} width={aircraft.width} height={aircraft.height} alt="" decoding="async" />
        </div>}
        <h1 id="hero-title" className="hero-title" data-long={headline.length > 11 ? "true" : undefined}>
          {headline}
        </h1>
        {!videoSrc && foreground && (
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
