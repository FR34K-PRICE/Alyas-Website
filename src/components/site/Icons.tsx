import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { width: 32, height: 32, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function ServiceIcon({ name, ...p }: { name: string } & P) {
  switch (name) {
    case "flights":
      return (
        <svg {...base} {...p}>
          <path d="M3 19.5 27.5 7.2c1-.5 2.1.6 1.6 1.6L17.5 29l-3-9.5L3 19.5Z" />
          <path d="m14.5 19.5 6-6" />
        </svg>
      );
    case "hotels":
      return (
        <svg {...base} {...p}>
          <path d="M4 26V8M4 20h24v6M4 14h9a4 4 0 0 1 4 4v2M22 12.5h3a3 3 0 0 1 3 3V20" />
          <circle cx="9.5" cy="10.5" r="0" />
        </svg>
      );
    case "visa":
      return (
        <svg {...base} {...p}>
          <rect x="6" y="3.5" width="20" height="25" rx="2" />
          <circle cx="16" cy="13" r="4.5" />
          <path d="M11 22h10M13 25h6" />
        </svg>
      );
    case "transport":
      return (
        <svg {...base} {...p}>
          <path d="M4 20V10a2 2 0 0 1 2-2h13l6 6h1a2 2 0 0 1 2 2v4H4Z" />
          <circle cx="10" cy="22" r="2.6" />
          <circle cx="22" cy="22" r="2.6" />
          <path d="M8.5 8v6h14" />
        </svg>
      );
    case "tailored":
      return (
        <svg {...base} {...p}>
          <path d="M5 26c6-1 3-8 9-9s4-8 13-11" strokeDasharray="1 3.4" />
          <circle cx="5" cy="26" r="2.2" />
          <path d="M27 6.5 24.3 11h5.4L27 6.5Z" />
        </svg>
      );
    default:
      return (
        <svg {...base} {...p}>
          <circle cx="16" cy="16" r="11" />
          <path d="M5 16h22M16 5c3.5 3 5 6.8 5 11s-1.5 8-5 11c-3.5-3-5-6.8-5-11s1.5-8 5-11Z" />
        </svg>
      );
  }
}

export const ArrowIcon = (p: P) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p} className={`flip-rtl ${p.className ?? ""}`}>
    <path d="M3 10h13M11 4.5 16.5 10 11 15.5" />
  </svg>
);

export function SocialIcon({ name, ...p }: { name: string } & P) {
  const s = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, width: 20, height: 20 } as const;
  switch (name) {
    case "facebook":
      return (
        <svg {...s} {...p}>
          <path d="M13.5 21v-8h2.7l.5-3.2h-3.2V7.9c0-.9.4-1.7 1.8-1.7h1.5V3.4S15.5 3.2 14.3 3.2c-2.5 0-4.1 1.5-4.1 4.2v2.4H7.5V13h2.7v8h3.3Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...s} {...p} fill="none" stroke="currentColor" strokeWidth={1.7}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...s} {...p}>
          <path d="M5.2 8.7h3v9.6h-3V8.7Zm1.5-4.7a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm3.4 4.7H13v1.3c.4-.8 1.4-1.6 2.9-1.6 3 0 3.6 2 3.6 4.6v5.3h-3v-4.7c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5v4.8h-3V8.7Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...s} {...p}>
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...s} {...p}>
          <path d="M16.6 3h-2.9v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.9a5.6 5.6 0 1 0 4.7 5.5V9.1a6.6 6.6 0 0 0 3.8 1.2V7.4A3.9 3.9 0 0 1 16.6 3Z" />
        </svg>
      );
    default:
      return null;
  }
}
