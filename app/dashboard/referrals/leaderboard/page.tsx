"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy, Crown, Medal, Users, ArrowLeft, RefreshCw, Sparkles
} from "lucide-react";
import {
  DashboardSidebarNav,
  DashboardMobileNav,
} from "@/app/dashboard/dashboard-navigation";

type Member = {
  rank: number;
  username: string;
  fullName: string;
  referralCount: number;
  isCurrentUser: boolean;
};

type LeaderboardData = {
  leaderboard: Member[];
  totalRankedUsers: number;
  currentUser: {
    rank: number | null;
    referralCount: number;
    isInTop50: boolean;
  };
};

export default function ReferralLeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/referrals/leaderboard", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load leaderboard.");

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const podium = data?.leaderboard.slice(0, 3) ?? [];
  const remaining = data?.leaderboard.slice(3, 50) ?? [];

  return (
    <main className="dashboard-shell referral-leaderboard-page">
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
        <Link href="/dashboard/referrals" className="dashboard-nav-link">My Referrals</Link>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">STREAMDAO / COMMUNITY</span>
            <h1>Referral leaderboard</h1>
          </div>
          <button
            type="button"
            className="leaderboard-refresh"
            onClick={() => void loadLeaderboard()}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </header>

        <div className="dashboard-content leaderboard-content">
          <Link href="/dashboard/referrals" className="leaderboard-back">
            <ArrowLeft size={15} /> Back to referrals
          </Link>

          <section className="leaderboard-hero">
            <div className="leaderboard-hero-glow" />
            <div className="leaderboard-hero-copy">
              <span className="leaderboard-kicker">
                <Sparkles size={14} /> STREAMDAO COMMUNITY RANKINGS
              </span>
              <h2>Build your network.<br /><span>Claim your place.</span></h2>
              <p>
                Meet the members growing the StreamDao community.
                Every position is earned through real registered referrals.
              </p>
            </div>
            <div className="leaderboard-hero-icon">
              <Trophy size={54} strokeWidth={1.2} />
              <span>TOP 50</span>
            </div>
            <div className="leaderboard-hero-footer">
              <span><Users size={15} /> {data?.totalRankedUsers ?? 0} ranked members</span>
              <span>Ranked by direct referrals</span>
            </div>
          </section>

          {data?.currentUser && (
            <section className="leaderboard-your-rank">
              <div className="leaderboard-your-icon"><Crown size={21} /></div>
              <div className="leaderboard-your-copy">
                <span>YOUR CURRENT POSITION</span>
                <strong>
                  {data.currentUser.rank
                    ? `#${data.currentUser.rank}`
                    : "Not ranked yet"}
                </strong>
              </div>
              <div className="leaderboard-your-count">
                <strong>{data.currentUser.referralCount}</strong>
                <span>Direct referrals</span>
              </div>
              <div className="leaderboard-your-status">
                {data.currentUser.isInTop50 ? "TOP 50 MEMBER" : "KEEP GROWING"}
              </div>
            </section>
          )}

          {error && (
            <div className="leaderboard-error">
              {error}
              <button type="button" onClick={() => void loadLeaderboard()}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="leaderboard-loading">Loading the real StreamDao rankings...</div>
          ) : data && (
            <>
              <section className="leaderboard-podium-section">
                <div className="leaderboard-section-heading">
                  <div>
                    <span className="section-eyebrow">THE FRONT RUNNERS</span>
                    <h2>Top performers</h2>
                  </div>
                  <span>TOP 3</span>
                </div>

                {podium.length === 0 ? (
                  <div className="leaderboard-empty">
                    No referral rankings yet. Be the first to grow your network.
                  </div>
                ) : (
                  <div className="leaderboard-podium">
                    {[podium[1], podium[0], podium[2]].filter(Boolean).map((member) => (
                      <article
                        key={member.rank}
                        className={`leaderboard-podium-card podium-${member.rank} ${member.isCurrentUser ? "is-you" : ""}`}
                      >
                        <div className="leaderboard-medal">
                          {member.rank === 1 ? <Crown size={25} /> : <Medal size={23} />}
                        </div>
                        <span className="leaderboard-podium-rank">#{member.rank}</span>
                        <div className="leaderboard-avatar">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <strong className="leaderboard-member-name">
                          @{member.username}
                        </strong>
                        {member.isCurrentUser && <span className="leaderboard-you-tag">YOU</span>}
                        <strong className="leaderboard-podium-count">
                          {member.referralCount}
                        </strong>
                        <span className="leaderboard-podium-label">referrals</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="leaderboard-list-section">
                <div className="leaderboard-section-heading">
                  <div>
                    <span className="section-eyebrow">COMMUNITY RANKINGS</span>
                    <h2>Top 50 members</h2>
                  </div>
                  <span>{data.leaderboard.length} / 50</span>
                </div>

                <div className="leaderboard-list">
                  {data.leaderboard.map((member) => (
                    <article
                      key={member.rank}
                      className={`leaderboard-row ${member.isCurrentUser ? "is-you" : ""}`}
                    >
                      <span className="leaderboard-row-rank">
                        {String(member.rank).padStart(2, "0")}
                      </span>
                      <div className="leaderboard-row-avatar">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="leaderboard-row-member">
                        <strong>@{member.username}</strong>
                        <span>{member.isCurrentUser ? "Your account" : "StreamDao member"}</span>
                      </div>
                      {member.isCurrentUser && <span className="leaderboard-you-tag">YOU</span>}
                      <div className="leaderboard-row-count">
                        <strong>{member.referralCount}</strong>
                        <span>referrals</span>
                      </div>
                    </article>
                  ))}
                  {data.leaderboard.length === 0 && (
                    <div className="leaderboard-empty">
                      Rankings will appear here as members invite people to StreamDao.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </section>

      <DashboardMobileNav />
    </main>
  );
}