export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const iconPaths: Record<string, string> = {
  users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6",
  wallet: "M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6 M20 12h-4a2 2 0 0 0 0 4h4z",
  transactions: "M8 7h13 M8 12h13 M8 17h13 M3 7h.01 M3 12h.01 M3 17h.01",
  clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  chart: "M3 3v18h18 M8 16v-5 M13 16V6 M18 16v-8",
  tasks: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  game: "M6 12h4 M8 10v4 M16 11h.01 M19 13h.01 M7 6h10a5 5 0 0 1 4.8 6.4l-1 3.5a2 2 0 0 1-3.3 1l-2.5-2.2h-6l-2.5 2.2a2 2 0 0 1-3.3-1l-1-3.5A5 5 0 0 1 7 6z",
  megaphone: "M3 11v2a2 2 0 0 0 2 2h2l4 4V5l-4 4H5a2 2 0 0 0-2 2z M11 9l9-4v14l-9-4 M7 15l2 6",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.5 2.6-.2-.1a1.7 1.7 0 0 0-1.9.3l-.1.1h-3l-.1-.2a1.7 1.7 0 0 0-1.5-1l-.2.1-2.6-1.5.1-.2a1.7 1.7 0 0 0-.3-1.9l-.1-.1v-3l.2-.1a1.7 1.7 0 0 0 1-1.5l-.1-.2 1.5-2.6.2.1a1.7 1.7 0 0 0 1.9-.3l.1-.1h3l.1.2a1.7 1.7 0 0 0 1.5 1l.2-.1 2.6 1.5-.1.2a1.7 1.7 0 0 0 .3 1.9l.1.1v3z",
  arrow: "M7 17 17 7 M7 7h10v10",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z M9 12l2 2 4-4",
  gift: "M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5V7 M12 7h4.5A2.5 2.5 0 1 0 14 4.5V7",
};

function Icon({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name] || iconPaths.chart} />
    </svg>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

const modules = [
  { title: "Users", description: "Accounts, profiles and referrals", href: "/control-room/users", icon: "users", tag: "ACCOUNTS" },
  { title: "Mining Tasks", description: "Create tasks and set rewards", href: "/control-room/tasks", icon: "tasks", tag: "EARNINGS" },
  { title: "Sponsored Posts", description: "Manage campaigns and payouts", href: "/control-room/sponsored-posts", icon: "megaphone", tag: "CAMPAIGNS" },
  { title: "Withdrawals", description: "Review and process payout requests", href: "/control-room/withdrawals", icon: "wallet", tag: "PAYMENTS" },
  { title: "Coupons", description: "Create and manage coupon codes", href: "/control-room/coupons", icon: "gift", tag: "REWARDS" },
  { title: "Announcements", description: "Publish updates to your users", href: "/control-room/announcements", icon: "megaphone", tag: "COMMUNICATION" },
  { title: "Analytics", description: "Understand platform performance", href: "/control-room/analytics", icon: "chart", tag: "INSIGHTS" },
  { title: "Settings", description: "Configure platform operations", href: "/control-room/settings", icon: "settings", tag: "CONFIGURATION" },
];

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();

  if (!admin) redirect("/control-room");

  const [
    totalUsers,
    totalTransactions,
    pendingTransactions,
    completedRewards,
    recentTransactions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { status: "PENDING" } }),
    prisma.transaction.aggregate({
      where: { type: "CREDIT", status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true, username: true } },
      },
    }),
  ]);

  const rewardTotal = Number(completedRewards._sum.amount ?? 0);
  const firstName = admin.fullName.split(" ")[0];

  const stats = [
    { label: "Total users", value: totalUsers.toLocaleString(), icon: "users", note: "Registered accounts", color: "lime" },
    { label: "Completed rewards", value: money(rewardTotal), icon: "wallet", note: "Completed credit transactions", color: "green" },
    { label: "Total transactions", value: totalTransactions.toLocaleString(), icon: "transactions", note: "All recorded transactions", color: "blue" },
    { label: "Pending transactions", value: pendingTransactions.toLocaleString(), icon: "clock", note: "Awaiting processing", color: "orange" },
  ];

  return (
    <main className="admin-dashboard admin-dashboard-premium">
      <header className="admin-topbar premium-admin-topbar">
        <div>
          <span className="admin-eyebrow">YOUR PLATFORM AT A GLANCE</span>
          <h1>Dashboard overview</h1>
          <p>Monitor your operations and manage StreamDao from one place.</p>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-date-chip">
            <Icon name="clock" size={15} />
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </div>
          <div className="admin-avatar" title={admin.fullName}>
            {admin.fullName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <section className="admin-hero-panel">
        <div className="admin-hero-content">
          <span className="admin-hero-label"><Icon name="shield" size={14} /> SUPER ADMIN WORKSPACE</span>
          <h2>Good to see you, {firstName}.</h2>
          <p>Your StreamDao operations, all in one place.</p>
          <div className="admin-hero-meta">
            <span className="admin-live-dot" /> Your admin session is active
          </div>
        </div>
        <div className="admin-hero-art" aria-hidden="true">
          <div className="admin-orbit admin-orbit-one" />
          <div className="admin-orbit admin-orbit-two" />
          <div className="admin-hero-emblem"><Icon name="chart" size={39} /></div>
          <span className="admin-art-dot admin-art-dot-one" />
          <span className="admin-art-dot admin-art-dot-two" />
        </div>
      </section>

      <section className="admin-stats premium-admin-stats">
        {stats.map((stat) => (
          <article className={`admin-stat-card premium-stat-card stat-${stat.color}`} key={stat.label}>
            <div className="premium-stat-top">
              <span>{stat.label}</span>
              <div className="premium-stat-icon"><Icon name={stat.icon} /></div>
            </div>
            <strong>{stat.value}</strong>
            <div className="premium-stat-note"><span />{stat.note}</div>
          </article>
        ))}
      </section>

      <section className="admin-content-grid">
        <div className="admin-management-section">
          <div className="premium-section-heading">
            <div>
              <span className="admin-eyebrow">CONTROL CENTER</span>
              <h2>Manage your platform</h2>
              <p>Everything you need to run StreamDao.</p>
            </div>
            <span className="admin-section-count">10 MODULES</span>
          </div>

          <div className="admin-module-grid premium-module-grid">
            {modules.map((module, index) => (
              <Link href={module.href} className="admin-module-card premium-module-card" key={module.title}>
                <div className="module-card-top">
                  <div className="module-icon"><Icon name={module.icon} size={22} /></div>
                  <span className="module-card-arrow"><Icon name="arrow" size={16} /></span>
                </div>
                <span className="module-card-tag">{module.tag}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <aside className="admin-activity-panel">
          <div className="premium-section-heading activity-heading">
            <div>
              <span className="admin-eyebrow">LATEST UPDATES</span>
              <h2>Recent activity</h2>
              <p>Latest recorded transactions.</p>
            </div>
            <div className="activity-heading-icon"><Icon name="transactions" /></div>
          </div>

          <div className="admin-activity-list">
            {recentTransactions.length === 0 ? (
              <div className="admin-empty-activity">
                <div><Icon name="transactions" size={25} /></div>
                <strong>No activity yet</strong>
                <p>Transactions will appear here as users earn and spend.</p>
              </div>
            ) : (
              recentTransactions.map((transaction) => (
                <div className="premium-activity-row" key={transaction.id}>
                  <div className="activity-row-icon">
                    <Icon name={transaction.type === "CREDIT" ? "arrow" : "wallet"} size={17} />
                  </div>
                  <div className="activity-row-info">
                    <strong>{transaction.description || transaction.category}</strong>
                    <span>{transaction.user.fullName} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(transaction.createdAt)}</span>
                    <small>{transaction.status} · {transaction.walletType}</small>
                  </div>
                  <strong className={`activity-amount ${transaction.type === "CREDIT" ? "amount-positive" : ""}`}>
                    {transaction.type === "CREDIT" ? "+" : "-"}{money(Number(transaction.amount))}
                  </strong>
                </div>
              ))
            )}
          </div>
          <div className="activity-panel-footer">
            <span>Live database records</span>
            <Icon name="shield" size={15} />
          </div>
        </aside>
      </section>

      <footer className="admin-dashboard-footer">
        <span>STREAMDAO CONTROL ROOM</span>
        <span>Secure administration workspace</span>
      </footer>
    </main>
  );
}