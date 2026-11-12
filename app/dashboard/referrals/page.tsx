export const instant = false;

import { DashboardSidebarNav, DashboardMobileNav } from "@/app/dashboard/dashboard-navigation";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import ReferralActions from "./referral-actions";

const money = (value: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default async function ReferralsPage() {
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

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const referralLink = `${protocol}://${host}/register?ref=${user.referralCode}`;

  const [directReferrals, directEarnings, secondaryEarnings] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        username: true,
        createdAt: true,
        _count: { select: { referrals: true } },
      },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: "CREDIT",
        status: "COMPLETED",
        category: "DIRECT_REFERRAL",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: "CREDIT",
        status: "COMPLETED",
        category: "SECONDARY_REFERRAL",
      },
      _sum: { amount: true },
    }),
  ]);

  const directTotal = Number(directEarnings._sum.amount ?? 0);
  const secondaryTotal = Number(secondaryEarnings._sum.amount ?? 0);
  const totalEarnings = directTotal + secondaryTotal;
  const firstName = user.fullName.trim().split(" ")[0];

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
          <div className="account-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
          <div className="account-info">
            <strong>{user.fullName}</strong>
            <span>@{user.username}</span>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit"><span>↪</span> Log out</button>
        </form>
        <div className="sidebar-bottom">
          <span className="online-dot" />
          Your account is active
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">WORKSPACE / REFERRALS</span>
            <h1>My referrals</h1>
          </div>
          <div className="topbar-user">
            <div className="topbar-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{user.fullName}</strong>
              <span>Member account</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content referrals-content">

          <section className="referral-link-panel">
            <div className="referral-link-heading">
              <span className="section-eyebrow">YOUR PERSONAL INVITE LINK</span>
              <h2>Share StreamDao with your friends</h2>
              <p>Anyone who registers through your link will be connected to your account.</p>
            </div>
            <div className="referral-link-field">
              <span>{referralLink}</span>
            </div>
            <ReferralActions referralLink={referralLink} />
            <div className="referral-code-label">
              Your referral code: <strong>{user.referralCode}</strong>
            </div>
          </section>
          <Link href="/dashboard/referrals/leaderboard" className="referral-leaderboard-card">
            <div className="referral-leaderboard-card-glow" />
            <div className="referral-leaderboard-card-content">
              <span className="referral-leaderboard-kicker">STREAMDAO COMMUNITY</span>
              <h2>Who's leading the network?</h2>
              <p>Explore the Top 50 members building the StreamDao community through real referrals.</p>
              <span className="referral-leaderboard-cta">Explore leaderboard <span>→</span></span>
            </div>
            <div className="referral-leaderboard-card-art">
              <span className="leaderboard-card-crown">♛</span>
              <strong>TOP</strong>
              <b>50</b>
              <span>LEADERS</span>
            </div>
          </Link>

          <section className="dashboard-stats referral-stats">
            <article className="stat-card total-stat">
              <div className="stat-heading">
                <span>Total referrals</span>
                <span className="stat-icon">♧</span>
              </div>
              <strong>{directReferrals.length}</strong>
              <p>People who joined through your link</p>
            </article>
            <article className="stat-card">
              <div className="stat-heading">
                <span>Direct earnings</span>
                <span className="stat-icon">↗</span>
              </div>
              <strong>{money(directTotal)}</strong>
              <p>From your direct referrals</p>
            </article>
            <article className="stat-card">
              <div className="stat-heading">
                <span>Secondary earnings</span>
                <span className="stat-icon">⌘</span>
              </div>
              <strong>{money(secondaryTotal)}</strong>
              <p>From your network's invites</p>
            </article>
          </section>

          <div className="referral-total-line">
            <span>Total referral earnings</span>
            <strong>{money(totalEarnings)}</strong>
          </div>
          <section className="referral-reward-panel">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">HOW IT WORKS</span>
                <h2>Earn from your network</h2>
              </div>
            </div>
                        <div className="referral-reward-strip">
              <span>Direct referral <strong>€0.50</strong></span>
              <span>Secondary referral <strong>€0.20</strong></span>
            </div>
          </section>

          <section className="dashboard-section referral-members">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR NETWORK</span>
                <h2>My direct referrals</h2>
              </div>
              <span className="section-caption">{directReferrals.length} members</span>
            </div>

            <div className="activity-panel">
              {directReferrals.length === 0 ? (
                <div className="empty-activity">
                  <div className="empty-activity-icon">♧</div>
                  <h3>Your network starts here</h3>
                  <p>Share your referral link and your new members will appear here.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {directReferrals.map((member) => (
                    <div className="activity-row" key={member.id}>
                      <div className="account-avatar referral-member-avatar">
                        {member.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="activity-description">
                        <strong>{member.fullName}</strong>
                        <span>@{member.username} · {member._count.referrals} invited members</span>
                      </div>
                      <div className="activity-amount">
                        <strong className="credit">Joined</strong>
                        <span>
                          {member.createdAt.toLocaleDateString("en-GB", {
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

          <footer className="dashboard-footer">
            <span>© {new Date().getFullYear()} StreamDao</span>
            <span>Small actions. Real rewards.</span>
          </footer>
        </div>
      </section>

      <DashboardMobileNav />
    </main>
  );
}
