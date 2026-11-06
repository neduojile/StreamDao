export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import EarningsCardCarousel from "./earnings-card-carousel";

const money = (value: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const navigation = [
  { label: "Overview", href: "#overview", icon: "⌂" },
  { label: "My wallets", href: "#wallets", icon: "◈" },
  { label: "Recent activity", href: "#activity", icon: "↗" },
];

export default async function DashboardPage() {
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
      referralCode: true,
    },
  });

  if (!user) redirect("/login");

  const wallet = await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const [earnings, transactions, referralCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId,
        type: "CREDIT",
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        description: true,
        category: true,
        walletType: true,
        type: true,
        status: true,
        amount: true,
        createdAt: true,
      },
    }),
    prisma.user.count({
      where: { referredById: userId },
    }),
  ]);

  const totalEarnings = Number(earnings._sum.amount ?? 0);

  const earningsCards = [
    {
      title: "Overall Earnings",
      amount: totalEarnings,
      subtitle: "Your total StreamDao earnings",
      theme: "card-overall",
    },
    {
      title: "Referral Earnings",
      amount: Number(wallet.referralBalance),
      subtitle: "Rewards from inviting friends",
      theme: "card-referral",
    },
    {
      title: "Mining Task Earnings",
      amount: Number(wallet.taskBalance),
      subtitle: "Rewards from completed tasks",
      theme: "card-mining",
    },
    {
      title: "WHOT Earnings",
      amount: Number(wallet.whotBalance),
      subtitle: "Rewards from WHOT games",
      theme: "card-whot",
    },
    {
      title: "Tapping Earnings",
      amount: Number(wallet.tappingBalance),
      subtitle: "Rewards from tapping activities",
      theme: "card-tapping",
    },
  ];
  const firstName = user.fullName.trim().split(" ")[0];

  return (
    <main className="dashboard-shell" id="overview">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="dashboard-nav">
          {navigation.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className={`dashboard-nav-link ${index === 0 ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-label">YOUR ACCOUNT</div>

        <div className="sidebar-account">
          <div className="account-avatar">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="account-info">
            <strong>{user.fullName}</strong>
            <span>@{user.username}</span>
          </div>
        </div>

        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit">
            <span>↪</span> Log out
          </button>
        </form>

        <div className="sidebar-bottom">
          <span className="online-dot" />
          Your account is active
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">WORKSPACE / OVERVIEW</span>
            <h1>Dashboard</h1>
          </div>

          <div className="topbar-user">
            <div className="topbar-avatar">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user.fullName}</strong>
              <span>Member account</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-panel compact-welcome">
            <h2>Welcome back, {firstName}!</h2>
          </section>

          <section className="dashboard-section" id="wallets">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR MONEY</span>
                <h2>Wallet overview</h2>
              </div>
              <span className="section-caption">Live account balances</span>
            </div>

            <EarningsCardCarousel cards={earningsCards} />
          </section>

          <section className="dashboard-stats">
            <article className="stat-card total-stat">
              <div className="stat-heading">
                <span>Total earnings</span>
                <span className="stat-icon">↗</span>
              </div>
              <strong>{money(totalEarnings)}</strong>
              <p>All completed earning transactions</p>
            </article>

            <article className="stat-card">
              <div className="stat-heading">
                <span>Available balance</span>
                <span className="stat-icon">◈</span>
              </div>
              <strong>
                {money(Number(wallet.taskBalance) + Number(wallet.referralBalance) + Number(wallet.onehubBalance) + Number(wallet.whotBalance) + Number(wallet.tappingBalance))}
              </strong>
              <p>Across your three wallets</p>
            </article>

            <article className="stat-card">
              <div className="stat-heading">
                <span>Direct referrals</span>
                <span className="stat-icon">♧</span>
              </div>
              <strong>{referralCount}</strong>
              <p>People who joined using your code</p>
            </article>
          </section>



          <section className="dashboard-section" id="activity">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">ACCOUNT RECORDS</span>
                <h2>Recent activity</h2>
              </div>
              <span className="section-caption">Your latest transactions</span>
            </div>

            <div className="activity-panel">
              {transactions.length === 0 ? (
                <div className="empty-activity">
                  <div className="empty-activity-icon">↗</div>
                  <h3>Your journey starts here</h3>
                  <p>Your completed earnings and account transactions will appear here.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {transactions.map((transaction) => (
                    <div className="activity-row" key={transaction.id}>
                      <div className="activity-symbol">
                        {transaction.type === "CREDIT" ? "↙" : "↗"}
                      </div>
                      <div className="activity-description">
                        <strong>{transaction.description}</strong>
                        <span>
                          {transaction.category} · {transaction.walletType}
                        </span>
                      </div>
                      <div className="activity-amount">
                        <strong className={transaction.type === "CREDIT" ? "credit" : "debit"}>
                          {transaction.type === "CREDIT" ? "+" : "-"}
                          {money(Number(transaction.amount))}
                        </strong>
                        <span>
                          {transaction.createdAt.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="referral-panel">
            <div>
              <span className="section-eyebrow">GROW YOUR COMMUNITY</span>
              <h2>Invite friends. Earn rewards.</h2>
              <p>Share your referral code and earn when people join through you.</p>
            </div>
            <div className="referral-code">
              <span>YOUR REFERRAL CODE</span>
              <strong>{user.referralCode}</strong>
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>© {new Date().getFullYear()} StreamDao</span>
            <span>Small actions. Real rewards.</span>
          </footer>
        </div>
      </section>

      <nav className="dashboard-mobile-nav">
  <a href="/dashboard" className="mobile-nav-active">
    <span className="mobile-nav-icon">⌂</span>
    <small>Home</small>
  </a>
  <a href="/dashboard/mining">
    <span className="mobile-nav-icon">✧</span>
    <small>Mining</small>
  </a>
  <a href="/dashboard/airtime">
    <span className="mobile-nav-icon">▤</span>
    <small>Airtime</small>
  </a>
  <a href="/dashboard/whot">
    <span className="mobile-nav-icon">◈</span>
    <small>WHOT</small>
  </a>
  <a href="/dashboard/profile">
    <span className="mobile-nav-icon">♙</span>
    <small>Profile</small>
  </a>
</nav>
    </main>
  );
}