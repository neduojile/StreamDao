export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WhotIntroPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("streamdao_session")?.value;

  if (!token) redirect("/login");

  const userId = await verifySession(token);
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  if (!user) redirect("/login");

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
          <Link href="/dashboard/whot" className="dashboard-nav-link active"><span className="nav-icon">◈</span> WHOT</Link>
          <Link href="/dashboard/referrals" className="dashboard-nav-link"><span className="nav-icon">♧</span> Referrals</Link>
          <Link href="/dashboard/profile" className="dashboard-nav-link"><span className="nav-icon">♙</span> Profile</Link>
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-label">YOUR ACCOUNT</div>
        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit">↪ Log out</button>
        </form>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">WORKSPACE / WHOT</span>
            <h1>WHOT Rewards</h1>
          </div>
        </header>

        <div className="dashboard-content whot-intro-content">
          <section className="whot-welcome-card">
            <div className="whot-welcome-copy">
              <span className="section-eyebrow">WELCOME TO WHOT REWARDS</span>
              <h2>Ready to try your luck, {user.fullName.trim().split(" ")[0]}?</h2>
              <p>
                Spin the reward wheel, discover what you could win, and collect
                rewards directly in your WHOT wallet.
              </p>
              <Link href="/dashboard/whot/play" className="whot-play-button">
                PLAY NOW <span>↗</span>
              </Link>
              <span className="whot-free-note">3 free spins every day. No payment required.</span>
            </div>
            <div className="whot-welcome-art">
              <div className="whot-art-orbit orbit-one" />
              <div className="whot-art-orbit orbit-two" />
              <div className="whot-art-wheel">
                <span>€0.10</span>
                <span>€0.50</span>
                <span>€3.00</span>
                <span>€0.20</span>
                <strong>WHOT</strong>
              </div>
              <div className="whot-art-spark spark-one">✦</div>
              <div className="whot-art-spark spark-two">✧</div>
            </div>
          </section>

          <section className="whot-intro-benefits">
            <article>
              <span className="whot-benefit-icon">↻</span>
              <div>
                <strong>3 free spins daily</strong>
                <p>Your free spins refresh every day at midnight Lagos time.</p>
              </div>
            </article>
            <article>
              <span className="whot-benefit-icon">€</span>
              <div>
                <strong>Win real rewards</strong>
                <p>Rewards range from €0.05 up to a €3.00 jackpot.</p>
              </div>
            </article>
            <article>
              <span className="whot-benefit-icon">✓</span>
              <div>
                <strong>Instant wallet credit</strong>
                <p>Your winnings are credited to your WHOT wallet.</p>
              </div>
            </article>
          </section>

          <section className="whot-how-panel">
            <div>
              <span className="section-eyebrow">SIMPLE TO PLAY</span>
              <h2>How it works</h2>
              <p>Three simple steps to enjoy your daily rewards.</p>
            </div>
            <div className="whot-how-steps">
              <article>
                <span>01</span>
                <strong>Enter the game</strong>
                <p>Tap Play Now to open the reward wheel.</p>
              </article>
              <article>
                <span>02</span>
                <strong>Spin for free</strong>
                <p>Use up to three free spins every day.</p>
              </article>
              <article>
                <span>03</span>
                <strong>Collect your reward</strong>
                <p>Your prize goes straight into your WHOT wallet.</p>
              </article>
            </div>
          </section>
        </div>
      </section>

      <nav className="dashboard-mobile-nav">
  <a href="/dashboard"><span className="mobile-nav-icon">⌂</span><small>Home</small></a>
  <a href="/dashboard/mining"><span className="mobile-nav-icon">✧</span><small>Mining</small></a>
  <a href="/dashboard/tapping"><span className="mobile-nav-icon">●</span><small>Tapping</small></a>
  <a href="/dashboard/whot" className="mobile-nav-active"><span className="mobile-nav-icon">◈</span><small>WHOT</small></a>
  <a href="/dashboard/referrals"><span className="mobile-nav-icon">♧</span><small>Referrals</small></a>
  <a href="/dashboard/profile"><span className="mobile-nav-icon">♙</span><small>Profile</small></a>
</nav>
    </main>
  );
}