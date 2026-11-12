export const instant = false;

import { DashboardSidebarNav, DashboardMobileNav } from "@/app/dashboard/dashboard-navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

const money = (amount: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

export default async function EarningsHistoryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_session")?.value;

  if (!token) redirect("/login");

  const userId = await verifySession(token);
  if (!userId) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
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
  });

  const total = transactions
    .filter((item) => item.type === "CREDIT" && item.status === "COMPLETED")
    .reduce((sum, item) => sum + Number(item.amount), 0);

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
        <Link href="/dashboard/profile" className="dashboard-nav-link">← Back to profile</Link>
        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit">↪ Log out</button>
        </form>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">YOUR ACCOUNT / HISTORY</span>
            <h1>Earnings History</h1>
          </div>
          <Link href="/dashboard/profile" className="history-back-link">Back to Profile</Link>
        </header>

        <div className="dashboard-content history-content">
          <section className="history-summary">
            <span>Completed earnings in this list</span>
            <strong>{money(total)}</strong>
            <small>Showing your latest {transactions.length} transactions</small>
          </section>

          <section className="history-list-panel">
            <div className="history-list-heading">
              <div>
                <span className="section-eyebrow">ACCOUNT ACTIVITY</span>
                <h2>Transactions</h2>
              </div>
              <span className="history-count">{transactions.length} records</span>
            </div>

            {transactions.length === 0 ? (
              <div className="history-empty">
                <span>◷</span>
                <strong>No transactions yet</strong>
                <p>Your earnings and account transactions will appear here.</p>
              </div>
            ) : (
              <div className="history-rows">
                {transactions.map((transaction) => {
                  const credit = transaction.type === "CREDIT";
                  return (
                    <article className="history-row" key={transaction.id}>
                      <div className={`history-transaction-icon ${credit ? "is-credit" : "is-debit"}`}>
                        {credit ? "↓" : "↑"}
                      </div>
                      <div className="history-transaction-info">
                        <strong>{transaction.description}</strong>
                        <span>
                          {transaction.category.replaceAll("_", " ")} · {transaction.walletType}
                        </span>
                        <small>
                          {transaction.createdAt.toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                      <div className="history-transaction-amount">
                        <strong className={credit ? "positive" : "negative"}>
                          {credit ? "+" : "-"}{money(Number(transaction.amount))}
                        </strong>
                        <small className={`history-status status-${transaction.status.toLowerCase()}`}>
                          {transaction.status}
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      <DashboardMobileNav />
    </main>
  );
}
