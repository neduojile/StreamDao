export const instant = false;

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      username: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/login");

  const [wallet, earnings] = await Promise.all([
    prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
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

  const totalEarnings = Number(earnings._sum.amount ?? 0);
  const initial = user.fullName.trim().charAt(0).toUpperCase();

  const accountOptions = [
    {
      icon: "▣",
      title: "Withdraw",
      description: "Cash out your available earnings",
      href: "/dashboard/withdraw",
      className: "profile-option-withdraw",
    },
    {
      icon: "◷",
      title: "Earnings History",
      description: "View all your transactions and rewards",
      href: "/dashboard/history",
      className: "",
    },
    {
      icon: "↗",
      title: "Sponsored Posts",
      description: "View sponsored sharing opportunities",
      href: "/dashboard/sponsored-posts",
      className: "",
    },
    {
      icon: "▤",
      title: "Airtime & Data",
      description: "Buy airtime and mobile data",
      href: "/dashboard/airtime",
      className: "",
    },
    {
      icon: "⚙",
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
        <nav className="dashboard-nav">
          <Link href="/dashboard" className="dashboard-nav-link"><span className="nav-icon">⌂</span> Overview</Link>
          <Link href="/dashboard/mining" className="dashboard-nav-link"><span className="nav-icon">✧</span> Mining Tasks</Link>
          <Link href="/dashboard/tapping" className="dashboard-nav-link"><span className="nav-icon">●</span> Tapping</Link>
          <Link href="/dashboard/whot" className="dashboard-nav-link"><span className="nav-icon">◈</span> WHOT</Link>
          <Link href="/dashboard/referrals" className="dashboard-nav-link"><span className="nav-icon">♧</span> Referrals</Link>
          <Link href="/dashboard/profile" className="dashboard-nav-link active"><span className="nav-icon">♙</span> Profile</Link>
        </nav>

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
          <button type="submit">↪ Log out</button>
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
                <span className="profile-option-icon">{option.icon}</span>
                <span className="profile-option-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="profile-option-arrow">›</span>
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
            <button type="submit">
              <span>↪</span> Logout
            </button>
          </form>
        </div>
      </section>

      <nav className="dashboard-mobile-nav">
  <a href="/dashboard"><span className="mobile-nav-icon">⌂</span><small>Home</small></a>
  <a href="/dashboard/mining"><span className="mobile-nav-icon">✧</span><small>Mining</small></a>
  <a href="/dashboard/tapping"><span className="mobile-nav-icon">●</span><small>Tapping</small></a>
  <a href="/dashboard/whot"><span className="mobile-nav-icon">◈</span><small>WHOT</small></a>
  <a href="/dashboard/referrals"><span className="mobile-nav-icon">♧</span><small>Referrals</small></a>
  <a href="/dashboard/profile" className="mobile-nav-active"><span className="mobile-nav-icon">♙</span><small>Profile</small></a>
</nav>
    </main>
  );
}