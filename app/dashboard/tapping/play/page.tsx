"use client";

import { DashboardSidebarNav, DashboardMobileNav } from "@/app/dashboard/dashboard-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Status = {
  taps: number;
  remainingTaps: number;
  sessionComplete: boolean;
  claimable: boolean;
  cooldownSeconds: number;
  nextAvailableAt: string | null;
  balance: string;
  reward: string;
  sessionLimit: number;
};

export default function TappingGamePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [tapBusy, setTapBusy] = useState(false);
  const [pendingTaps, setPendingTaps] = useState(0);
  const [particles, setParticles] = useState<Array<{id:number;x:number;y:number;dx:number;dy:number}>>([]);
  const tapQueue = useRef(0);
  const processingRef = useRef(false);
  const particleId = useRef(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const lastTapAt = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/tapping", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load game.");
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load game.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNow(Date.now());
    void loadStatus();
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  const cooldownSeconds = status?.nextAvailableAt
    ? Math.max(0, Math.ceil((new Date(status.nextAvailableAt).getTime() - now) / 1000))
    : 0;

  const sessionLimit = status?.sessionLimit ?? 100;
  const confirmedTaps = status?.taps ?? 0;
  const taps = Math.min(sessionLimit, confirmedTaps + pendingTaps);
  const progress = Math.min(100, (taps / sessionLimit) * 100);
  const complete = confirmedTaps >= sessionLimit && pendingTaps === 0 && !tapBusy;
  const cooling = cooldownSeconds > 0;

  const clock = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  function recordTap() {
    if (loading || !status || complete || cooling || taps >= sessionLimit) return;

    setError("");
    setNotice("");
    setPendingTaps((count) => count + 1);

    const burst = Array.from({ length: 12 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 65 + Math.random() * 100;
      return {
        id: ++particleId.current,
        x: 50,
        y: 50,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
      };
    });

    setParticles((current) => [...current, ...burst]);
    window.setTimeout(() => {
      const ids = new Set(burst.map((particle) => particle.id));
      setParticles((current) => current.filter((particle) => !ids.has(particle.id)));
    }, 750);

    tapQueue.current += 1;
    if (!processingRef.current) void processTapQueue();
  }

  async function processTapQueue() {
    if (processingRef.current) return;

    processingRef.current = true;
    setTapBusy(true);

    try {
      while (tapQueue.current > 0) {
        const batchSize = Math.min(25, tapQueue.current);
        tapQueue.current -= batchSize;

        const response = await fetch("/api/tapping/tap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: batchSize }),
        });

        const data = await response.json();

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (!response.ok) {
          tapQueue.current = 0;
          setPendingTaps(0);
          await loadStatus();
          throw new Error(data.error || "Tap batch could not be recorded.");
        }

        setStatus((current) => current ? {
          ...current,
          taps: data.taps,
          remainingTaps: data.remainingTaps,
          sessionComplete: data.sessionComplete,
          claimable: data.sessionComplete,
        } : current);

        setPendingTaps((count) => Math.max(0, count - batchSize));

        if (data.sessionComplete) {
          setNotice("100 taps completed! Your €5.00 reward is ready to claim.");
        }

        if (tapQueue.current > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 85));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tap could not be recorded.");
      tapQueue.current = 0;
      setPendingTaps(0);
      await loadStatus();
    } finally {
      processingRef.current = false;
      setTapBusy(false);
    }
  }

  async function claimReward() {
    if (claimBusy || !complete || cooling || tapQueue.current > 0 || processingRef.current) return;

    setClaimBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/tapping/claim", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to claim reward.");

      setStatus((current) => current ? {
        ...current,
        taps: 0,
        remainingTaps: 100,
        sessionComplete: false,
        claimable: false,
        balance: data.balance,
        nextAvailableAt: data.nextAvailableAt,
        cooldownSeconds: 86400,
      } : current);

      setNotice("€5.00 has been added to your Tapping wallet. Great work!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim reward.");
      await loadStatus();
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <main className="dashboard-shell tapping-page">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <DashboardSidebarNav />
        <div className="sidebar-divider" />
        <div className="sidebar-label">YOUR ACCOUNT</div>
        <Link href="/dashboard/profile" className="dashboard-nav-link">My Profile</Link>
        <Link href="/dashboard/airtime" className="dashboard-nav-link">Airtime & Data</Link>
        <Link href="/dashboard/history" className="dashboard-nav-link">Earnings History</Link>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">WORKSPACE / TAPPING</span>
            <h1>Tapping Arena</h1>
          </div>
          <Link href="/dashboard/tapping" className="mining-back-link">← How it works</Link>
        </header>

        <div className="dashboard-content tapping-game-content">
          <section className="tapping-game-heading">
            <div>
              <span className="section-eyebrow">YOUR DAILY CHALLENGE</span>
              <h2>Tap your way to <span>€5.00</span></h2>
              <p>Complete 100 taps to unlock your reward.</p>
            </div>
            <div className="tapping-wallet-pill">
              <span>YOUR TAPPING WALLET</span>
              <strong>€{Number(status?.balance ?? 0).toFixed(2)}</strong>
            </div>
          </section>

          <section className="tapping-game-panel">
            <div className="tapping-game-topline">
              <span>SESSION PROGRESS</span>
              <span>{taps} / {sessionLimit}</span>
            </div>

            <div className="tapping-progress-track">
              <div className="tapping-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="tapping-game-orb-area">
              <div className="tapping-game-halo" />
              <div className="tapping-particle-layer" aria-hidden="true">
                {particles.map((particle) => (
                  <span key={particle.id} className="tapping-particle" style={{ left: `${particle.x}%`, top: `${particle.y}%`, "--particle-x": `${particle.dx}px`, "--particle-y": `${particle.dy}px` } as React.CSSProperties} />
                ))}
              </div>
              <div className="tapping-game-ring" style={{ background: `conic-gradient(var(--accent) ${progress * 3.6}deg, rgba(255,255,255,.07) 0deg)` }}>
                <button
                  type="button"
                  className={`tapping-game-button ${tapBusy ? "is-tapping" : ""} ${complete ? "is-complete" : ""}`}
                  onPointerDown={(event) => { event.preventDefault(); recordTap(); }}
                  disabled={loading || complete || cooling || taps >= sessionLimit}
                  aria-label="Tap to earn progress"
                >
                  <span className="tapping-button-symbol">S</span>
                  <strong>{loading ? "..." : complete ? "DONE" : tapBusy ? "..." : "TAP"}</strong>
                  <small>{complete ? "SESSION COMPLETE" : "TO EARN"}</small>
                </button>
              </div>
              <span className="tapping-orb-caption">{complete ? "You did it!" : "Every tap counts"}</span>
            </div>

            <div className="tapping-game-milestones">
              {[10, 25, 50, 100].map((milestone) => (
                <div className={taps >= milestone ? "reached" : ""} key={milestone}>
                  <span>{milestone === 100 ? "€5" : `${Math.round((milestone / 100) * 100)}%`}</span>
                  <i />
                </div>
              ))}
            </div>

            {error && <div className="tapping-message tapping-error" role="alert">{error}</div>}
            {notice && <div className="tapping-message tapping-success" role="status">{notice}</div>}

            {cooling ? (
              <div className="tapping-cooldown-panel">
                <span>⏳</span>
                <div><strong>Next session available in</strong><b>{clock(cooldownSeconds)}</b></div>
              </div>
            ) : complete ? (
              <button className="tapping-claim-button" onClick={claimReward} disabled={claimBusy}>
                {claimBusy ? "Processing reward..." : "Claim your €5.00 reward"}
              </button>
            ) : (
              <p className="tapping-game-hint">
                {loading ? "Loading your session..." : tapBusy ? "Recording your tap securely..." : `${sessionLimit - taps} taps remaining. Tap the coin to continue.`}
              </p>
            )}
          </section>

          <div className="tapping-game-footer">
            <span>REWARD PER SESSION <strong>€5.00</strong></span>
            <span>SESSION TARGET <strong>100 TAPS</strong></span>
            <span>COOLDOWN <strong>24 HOURS AFTER CLAIM</strong></span>
          </div>
        </div>
      </section>

      <DashboardMobileNav />
    </main>
  );
}
