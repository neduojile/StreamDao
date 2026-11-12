export const instant = false;

import { DashboardSidebarNav, DashboardMobileNav } from "@/app/dashboard/dashboard-navigation";
import { CreditCard, History as HistoryIcon, Megaphone, Smartphone, Settings, ChevronRight, LogOut } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

const money = (value: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_session")?.value;

  if (!token) redirect("/login");

  const userId = await verifySession(token);
  if (!userId) redirect("/login");

  const [user, earnings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        username: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: "CREDIT",
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
  ]);

  if (!user) redirect("/login");
  const totalEarnings = Number(earnings._sum.amount ?? 0);
  const initial = user.fullName.trim().charAt(0).toUpperCase();

  const accountOptions = [
    {
      icon: CreditCard,
      title: "Withdraw",
      description: "Cash out your available earnings",
      href: "/dashboard/withdraw",
      className: "profile-option-withdraw",
    },
    {
      icon: HistoryIcon,
      title: "Earnings History",
      description: "View all your transactions and rewards",
      href: "/dashboard/history",
      className: "",
    },
    {
      icon: Megaphone,
      title: "Sponsored Posts",
      description: "View sponsored sharing opportunities",
      href: "/dashboard/mining?category=SPONSORED",
      className: "",
    },
    {
      icon: Smartphone,
      title: "Airtime & Data",
      description: "Buy airtime and mobile data",
      href: "/dashboard/airtime",
      className: "",
    },
    {
      icon: Settings,
      title: "Account Setup",
      description: "Manage your bank or wallet payout details",
      href: "/dashboard/account-setup",
      className: "",
    },
  ];

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <DashboardSidebarNav />

        <div className="sidebar-divider" />
        <div className="sidebar-label">YOUR ACCOUNT</div>
        <div className="sidebar-account">
          <div className="account-avatar">{initial}</div>
          <div className="account-info">
            <strong>{user.fullName}</strong>
            <span>@{user.username}</span>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit"><LogOut size={16} /> Log out</button>
        </form>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">YOUR ACCOUNT / PROFILE</span>
            <h1>My Profile</h1>
          </div>
        </header>

        <div className="dashboard-content profile-content">
          <section className="profile-overview-card">
            <div className="profile-avatar-large">{initial}</div>

            <h2>{user.fullName}</h2>
            <p className="profile-username">@{user.username}</p>
            <p className="profile-email">{user.email}</p>

            <div className="profile-earnings-box">
              <span>Total Earnings</span>
              <strong>{money(totalEarnings)}</strong>
              <small>All completed rewards on StreamDao</small>
            </div>
          </section>

          <section className="profile-account-options">
            {accountOptions.map((option) => (
              <Link
                href={option.href}
                key={option.title}
                className={`profile-option ${option.className}`}
              >
                <span className="profile-option-icon"><option.icon size={19} strokeWidth={2} /></span>
                <span className="profile-option-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="profile-option-arrow"><ChevronRight size={19} /></span>
              </Link>
            ))}
          </section>

          <section className="profile-account-details">
            <span className="section-eyebrow">ACCOUNT INFORMATION</span>
            <h2>Your details</h2>

            <div className="profile-detail-row">
              <span>Full name</span>
              <strong>{user.fullName}</strong>
            </div>
            <div className="profile-detail-row">
              <span>Username</span>
              <strong>@{user.username}</strong>
            </div>
            <div className="profile-detail-row">
              <span>Email address</span>
              <strong>{user.email}</strong>
            </div>
            <div className="profile-detail-row">
              <span>Phone number</span>
              <strong>{user.phone}</strong>
            </div>
            <div className="profile-detail-row">
              <span>Member since</span>
              <strong>{user.createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}</strong>
            </div>
          </section>

          <form action="/api/auth/logout" method="POST" className="profile-logout-form">
            <button type="submit"><LogOut size={18} /> Logout</button>
          </form>
        </div>
      </section>

      <DashboardMobileNav />
    </main>
  );
}
