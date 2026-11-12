"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = {
  balance: string;
  taps: number;
  remainingTaps: number;
  claimable: boolean;
  cooldownSeconds: number;
  nextAvailableAt: string | null;
};

export default function TappingPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tapping", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.assign("/login");
          return null;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load tapping status.");
        return data;
      })
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const cooldown = status?.cooldownSeconds ?? 0;
  const hours = Math.floor(cooldown / 3600);
  const minutes = Math.floor((cooldown % 3600) / 60);

  return (
    <main className="dashboard-shell tapping-page">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="dashboard-nav">
          <Link href="/dashboard" className="dashboard-nav-link"><span className="nav-icon">⌂</span> Overview</Link>
          <Link href="/dashboard/mining" className="dashboard-nav-link"><span className="nav-icon">✧</span> Mining Tasks</Link>
          <Link href="/dashboard/tapping" className="dashboard-nav-link active"><span className="nav-icon">●</span> Tapping</Link>
          <Link href="/dashboard/whot" className="dashboard-nav-link"><span className="nav-icon">◈</span> WHOT</Link>
          <Link href="/dashboard/referrals" className="dashboard-nav-link"><span className="nav-icon">♧</span> Referrals</Link>
          <Link href="/dashboard/profile" className="dashboard-nav-link"><span className="nav-icon">♙</span> Profile</Link>
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">YOUR ACCOUNT</div>
        <Link href="/dashboard/profile" className="dashboard-nav-link">My Profile</Link>
        <Link href="/dashboard/airtime" className="dashboard-nav-link">Airtime & Data</Link>
        <Link href="/dashboard/history" className="dashboard-nav-link">Earnings History</Link>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">WORKSPACE / EARN</span>
            <h1>Tapping Rewards</h1>
          </div>
          <Link href="/dashboard" className="mining-back-link">← Dashboard</Link>
        </header>

        <div className="dashboard-content tapping-content">
          <section className="tapping-hero">
            <div className="tapping-hero-copy">
              <span className="section-eyebrow">TAP · COMPLETE · EARN</span>
              <h2>One hundred taps.<br /><span>Five euros.</span></h2>
              <p>Take a moment, enjoy the challenge and earn a reward directly into your Tapping wallet.</p>
              <Link href="/dashboard/tapping/play" className="tapping-start-button">
                Start tapping <span>→</span>
              </Link>
            </div>
            <div className="tapping-hero-visual">
              <div className="tapping-orbit tapping-orbit-one" />
              <div className="tapping-orbit tapping-orbit-two" />
              <div className="tapping-coin">S<span>+</span></div>
              <span className="tapping-spark spark-one">✦</span>
              <span className="tapping-spark spark-two">✧</span>
              <span className="tapping-floating-reward">€5.00</span>
            </div>
          </section>

          <section className="tapping-stats">
            <article><span>SESSION TARGET</span><strong>100 <small>taps</small></strong></article>
            <article><span>SESSION REWARD</span><strong>€5.00</strong></article>
            <article><span>YOUR TAPPING WALLET</span><strong>{loading ? "Loading..." : `€${Number(status?.balance ?? 0).toFixed(2)}`}</strong></article>
          </section>

          <section className="tapping-how">
            <div className="tapping-section-heading">
              <span className="section-eyebrow">SIMPLE & REWARDING</span>
              <h2>How it works</h2>
            </div>
            <div className="tapping-steps">
              <article><span className="tapping-step-number">01</span><div><h3>Enter the challenge</h3><p>Start a tapping session whenever you are ready.</p></div></article>
              <article><span className="tapping-step-number">02</span><div><h3>Reach 100 taps</h3><p>Tap the button until your session progress is complete.</p></div></article>
              <article><span className="tapping-step-number">03</span><div><h3>Claim €5.00</h3><p>Claim your reward and it will be credited to your Tapping wallet.</p></div></article>
            </div>
          </section>

          <section className="tapping-session-status">
            <div>
              <span className="section-eyebrow">YOUR SESSION</span>
              <h3>{loading ? "Checking availability..." : cooldown > 0 ? "Your next session is resting" : "Your next session is ready"}</h3>
              <p>{loading ? "Loading your tapping progress." : cooldown > 0 ? `Come back in approximately ${hours}h ${minutes}m to start again.` : `${status?.taps ?? 0} of 100 taps completed in your current session.`}</p>
            </div>
            <span className="tapping-status-icon">{cooldown > 0 ? "◷" : "✓"}</span>
          </section>

          <p className="tapping-footnote">A 24-hour cooldown begins after each successful reward claim. Your progress stays available until you complete and claim your session.</p>
        </div>
      </section>

      <nav className="dashboard-mobile-nav">
        <Link href="/dashboard"><span className="mobile-nav-icon">⌂</span><small>Home</small></Link>
        <Link href="/dashboard/mining"><span className="mobile-nav-icon">✧</span><small>Mining</small></Link>
        <Link href="/dashboard/tapping" className="mobile-nav-active"><span className="mobile-nav-icon">●</span><small>Tapping</small></Link>
        <Link href="/dashboard/whot"><span className="mobile-nav-icon">◈</span><small>WHOT</small></Link>
        <Link href="/dashboard/referrals"><span className="mobile-nav-icon">♧</span><small>Referrals</small></Link>
        <Link href="/dashboard/profile"><span className="mobile-nav-icon">♙</span><small>Profile</small></Link>
      </nav>
    </main>
  );
}