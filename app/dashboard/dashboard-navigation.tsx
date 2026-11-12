"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Pickaxe,
  Hand,
  Spade,
  Users,
  UserRound,
} from "lucide-react";

const items = [
  { label: "Overview", shortLabel: "Home", href: "/dashboard", icon: House },
  { label: "Mining Tasks", shortLabel: "Mining", href: "/dashboard/mining", icon: Pickaxe },
  { label: "Tapping", shortLabel: "Tapping", href: "/dashboard/tapping", icon: Hand },
  { label: "WHOT", shortLabel: "WHOT", href: "/dashboard/whot", icon: Spade },
  { label: "Referrals", shortLabel: "Referrals", href: "/dashboard/referrals", icon: Users },
  { label: "Profile", shortLabel: "Profile", href: "/dashboard/profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="dashboard-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`dashboard-nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="dashboard-mobile-nav" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "mobile-nav-active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-nav-icon">
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <small>{item.shortLabel}</small>
          </Link>
        );
      })}
    </nav>
  );
}