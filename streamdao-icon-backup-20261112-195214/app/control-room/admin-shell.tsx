"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Overview", href: "/control-room/dashboard", icon: "▦" },
  { label: "Users", href: "/control-room/users", icon: "♙" },
  { label: "Tasks", href: "/control-room/tasks", icon: "✧" },
  { label: "Submissions", href: "/control-room/submissions", icon: "▤" },
  { label: "Sponsored Posts", href: "/control-room/sponsored-posts", icon: "◎" },
  { label: "Games Control", href: "/control-room/games", icon: "◈" },
  { label: "Withdrawals", href: "/control-room/withdrawals", icon: "↗" },
  { label: "Coupons", href: "/control-room/coupons", icon: "◇" },
  { label: "Announcements", href: "/control-room/announcements", icon: "◉" },
  { label: "Analytics", href: "/control-room/analytics", icon: "▥" },
  { label: "Settings", href: "/control-room/settings", icon: "⚙" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="admin-shell">
      {open && (
        <button
          className="admin-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${open ? "admin-sidebar-open" : ""}`}>
        <Link href="/control-room/dashboard" className="admin-brand">
          <span>Stream</span>Dao<span className="admin-brand-dot">.</span>
          <small>CONTROL ROOM</small>
        </Link>

        <div className="admin-nav-label">WORKSPACE</div>

        <nav className="admin-navigation">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`admin-nav-link ${active ? "admin-nav-active" : ""}`}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {active && <span className="admin-nav-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-secure-label">
            <span />
            Secure administrator session
          </div>
          <form action="/api/admin/logout" method="POST">
            <button className="admin-sidebar-logout" type="submit">
              <span>↪</span> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-mobile-header">
          <button
            className="admin-menu-button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span>StreamDao <b>Control Room</b></span>
        </div>
        {children}
      </div>
    </div>
  );
}