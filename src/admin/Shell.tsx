"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

interface Props {
  user: { email: string; name: string; role: "admin" | "editor" };
  children: React.ReactNode;
}

const NAV: { group: string; items: { href: string; label: string; adminOnly?: boolean }[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
  {
    group: "Pages",
    items: [
      { href: "/admin/pages/home", label: "Home" },
      { href: "/admin/pages/about", label: "About" },
      { href: "/admin/pages/travel", label: "Travel services page" },
      { href: "/admin/pages/events", label: "Events & conferences page" },
      { href: "/admin/pages/contact", label: "Contact page" },
      { href: "/admin/collections/page", label: "Custom pages" },
    ],
  },
  {
    group: "Content",
    items: [
      { href: "/admin/collections/service", label: "Services" },
      { href: "/admin/collections/offer", label: "Travel offers" },
      { href: "/admin/collections/event", label: "Events & conferences" },
      { href: "/admin/collections/news", label: "News" },
      { href: "/admin/media", label: "Media library" },
    ],
  },
  { group: "Inbox", items: [{ href: "/admin/inquiries", label: "Inquiries" }] },
  {
    group: "Settings",
    items: [
      { href: "/admin/pages/site", label: "Site & brand", adminOnly: true },
      { href: "/admin/users", label: "Users", adminOnly: true },
      { href: "/admin/account", label: "My account" },
    ],
  },
];

export function Shell({ user, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">Skip to content</a>
      <header className="admin-top">
        <button type="button" className="ab ab--ghost menu-btn" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close menu" : "Menu"}
        </button>
        <strong className="admin-brand">ALYAS admin</strong>
      </header>
      <div className="admin-body">
        <nav id="admin-nav" className="admin-nav" data-open={open} aria-label="Admin">
          <p className="admin-brand desktop-only">ALYAS admin</p>
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.adminOnly || user.role === "admin");
            if (!items.length) return null;
            return (
              <div key={g.group} className="nav-group">
                <p className="nav-h">{g.group}</p>
                <ul>
                  {items.map((i) => (
                    <li key={i.href}>
                      <a href={i.href} aria-current={path === i.href || (i.href !== "/admin" && path.startsWith(i.href)) ? "page" : undefined} onClick={() => setOpen(false)}>
                        {i.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="nav-group nav-foot">
            <a href="/en" target="_blank" rel="noopener noreferrer">View public site</a>
            <p className="who">{user.name || user.email}<br /><span>{user.role === "admin" ? "Administrator" : "Content editor"}</span></p>
            <button type="button" className="ab ab--ghost block" onClick={signOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </nav>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
