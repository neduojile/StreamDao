"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Prize = {
  id: string;
  label: string;
  amount: string;
  probability: string;
  color: string;
  sortOrder: number;
};

type Spin = {
  id: string;
  prizeLabel: string;
  reward: string;
  createdAt: string;
  spinNumber: number;
};

type WhotData = {
  enabled: boolean;
  dailySpinLimit: number;
  spinsUsed: number;
  remainingSpins: number;
  balance: string;
  prizes: Prize[];
  recentSpins: Spin[];
};

const money = (value: string | number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value));

export default function WhotPage() {
  const [data, setData] = useState<WhotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [winningPrize, setWinningPrize] = useState<Prize | null>(null);
  const [showResult, setShowResult] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/whot", { cache: "no-store" });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load WHOT.");

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load WHOT.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function spinWheel() {
    if (!data || spinning || !data.enabled || data.remainingSpins <= 0) return;

    setError("");
    setNotice("");
    setWinningPrize(null);
    setShowResult(false);
    setSpinning(true);

    try {
      const response = await fetch("/api/whot/spin", {
        method: "POST",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to spin the wheel.");
      }

      const prize = result.prize as Prize;
      const index = data.prizes.findIndex((item) => item.id === prize.id);

      if (index < 0) throw new Error("The winning prize could not be matched.");

      const segmentAngle = 360 / data.prizes.length;
      const targetAngle = (360 - ((index + 0.5) * segmentAngle) + 360) % 360;
      const extraTurns = 360 * 5;
      const nextRotation = rotation + extraTurns + targetAngle;

      setRotation(nextRotation);
      setWinningPrize(prize);

      window.setTimeout(async () => {
        setSpinning(false);
        setShowResult(true);
        setNotice(`Congratulations! You won ${prize.label}.`);
        await loadData();
      }, 4000);
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : "Spin failed.");
      await loadData();
    }
  }

  const wheelBackground = data?.prizes.length
    ? `conic-gradient(${data.prizes.map((prize, index) => {
        const size = 360 / data.prizes.length;
        return `${prize.color} ${index * size}deg ${(index + 1) * size}deg`;
      }).join(", ")})`
    : "conic-gradient(#8fda3d, #3d8242, #b9f34b)";

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="dashboard-nav">
          <Link href="/dashboard" className="dashboard-nav-link">
            <span className="nav-icon">⌂</span> Overview
          </Link>
          <Link href="/dashboard/mining" className="dashboard-nav-link">
            <span className="nav-icon">✧</span> Mining tasks
          </Link>
          <Link href="/dashboard/airtime" className="dashboard-nav-link">
            <span className="nav-icon">▤</span> Airtime
          </Link>
          <Link href="/dashboard/whot" className="dashboard-nav-link active">
            <span className="nav-icon">◈</span> WHOT
          </Link>
          <Link href="/dashboard/referrals" className="dashboard-nav-link">
            <span className="nav-icon">♧</span> Referrals
          </Link>
          <Link href="/dashboard/profile" className="dashboard-nav-link">
            <span className="nav-icon">♙</span> Profile
          </Link>
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
            <h1>WHOT Spin Wheel</h1>
          </div>
          <div className="whot-topbar-tag">
            <span /> Daily rewards
          </div>
        </header>

        <div className="dashboard-content whot-content">
          <section className="whot-intro">
            <div>
              <span className="section-eyebrow">YOUR DAILY CHANCE</span>
              <h2>Give the wheel a spin.</h2>
              <p>Try your luck and win real rewards. You get free spins every day.</p>
            </div>
            <div className="whot-intro-mark">◈</div>
          </section>

          <section className="whot-stats">
            <article className="whot-stat-card">
              <span>WHOT balance</span>
              <strong>{loading ? "—" : money(data?.balance ?? "0")}</strong>
              <small>Your accumulated wheel rewards</small>
            </article>
            <article className="whot-stat-card">
              <span>Free spins left</span>
              <strong>{loading ? "—" : `${data?.remainingSpins ?? 0}/${data?.dailySpinLimit ?? 3}`}</strong>
              <small>Resets daily at midnight Lagos time</small>
            </article>
          </section>

          <section className="whot-game-layout">
            <div className="whot-wheel-panel">
              <div className="whot-wheel-heading">
                <span className="section-eyebrow">THE REWARD WHEEL</span>
                <h2>What will you win?</h2>
              </div>

              <div className="whot-wheel-stage">
                <div className="whot-pointer" />
                <div
                  className={`whot-wheel ${spinning ? "is-spinning" : ""}`}
                  style={{
                    background: wheelBackground,
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning
                      ? "transform 4s cubic-bezier(.12,.72,.12,1)"
                      : "none",
                  }}
                >
                  {data?.prizes.map((prize, index) => {
                    const angle = (360 / data.prizes.length) * index +
                      180 / data.prizes.length;

                    return (
                      <span
                        key={prize.id}
                        className="whot-wheel-label"
                        style={{ transform: `rotate(${angle}deg) translateY(-125px) rotate(-${angle}deg)` }}
                      >
                        {prize.label}
                      </span>
                    );
                  })}
                  <div className="whot-wheel-center">
                    <span>STREAM</span>
                    <strong>DAO</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="whot-spin-button"
                onClick={spinWheel}
                disabled={loading || spinning || !data?.enabled || (data?.remainingSpins ?? 0) <= 0}
              >
                {spinning ? "SPINNING..." : "SPIN THE WHEEL"}
              </button>

              <p className="whot-spin-caption">
                {loading
                  ? "Loading your rewards..."
                  : !data?.enabled
                    ? "The wheel is temporarily paused."
                    : data.remainingSpins > 0
                      ? `${data.remainingSpins} free ${data.remainingSpins === 1 ? "spin" : "spins"} available today`
                      : "You've used all your free spins today. Come back tomorrow."}
              </p>

              {error && <div className="whot-message whot-error">{error}</div>}
              {notice && <div className="whot-message whot-success">{notice}</div>}
              {showResult && winningPrize && (
                <div className="whot-result">
                  <span className="section-eyebrow">YOU JUST WON</span>
                  <strong>{winningPrize.label}</strong>
                  <p>Your reward has been added to your WHOT wallet.</p>
                </div>
              )}
            </div>
          </section>

          <section className="whot-history-panel">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR ACTIVITY</span>
                <h2>Recent wins</h2>
              </div>
              <span className="section-caption">Last 10 spins</span>
            </div>

            {loading ? (
              <p className="whot-muted">Loading spin history...</p>
            ) : data?.recentSpins.length ? (
              <div className="whot-history-list">
                {data.recentSpins.map((spin) => (
                  <div className="whot-history-row" key={spin.id}>
                    <div className="whot-history-icon">◈</div>
                    <div>
                      <strong>{spin.prizeLabel} reward</strong>
                      <span>
                        Spin {spin.spinNumber} · {new Date(spin.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <strong className="whot-history-amount">+{money(spin.reward)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="whot-empty-history">
                <span>◈</span>
                <strong>No spins yet</strong>
                <p>Your winning history will appear here after your first spin.</p>
              </div>
            )}
          </section>
        </div>
      </section>

      <nav className="dashboard-mobile-nav">
        <Link href="/dashboard"><span className="mobile-nav-icon">⌂</span><small>Home</small></Link>
        <Link href="/dashboard/mining"><span className="mobile-nav-icon">✧</span><small>Mining</small></Link>
        <Link href="/dashboard/airtime"><span className="mobile-nav-icon">▤</span><small>Airtime</small></Link>
        <Link href="/dashboard/whot" className="mobile-nav-active"><span className="mobile-nav-icon">◈</span><small>WHOT</small></Link>
        <Link href="/dashboard/referrals"><span className="mobile-nav-icon">♧</span><small>Referrals</small></Link>
        <Link href="/dashboard/profile"><span className="mobile-nav-icon">♙</span><small>Profile</small></Link>
      </nav>
    </main>
  );
}