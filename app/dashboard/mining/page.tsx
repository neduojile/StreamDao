"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  taskLink: string | null;
  sharePlatform: "WHATSAPP" | "FACEBOOK" | null;
  shareMessage: string | null;
  category: "REGULAR" | "SPONSORED";
  reward: string;
  totalCompletions: number;
  minDurationSeconds: number;
  progress: {
    startedAt: string;
    claimedAt: string | null;
  }[];
};

type Filter = "ALL" | "REGULAR" | "SPONSORED";

const money = (value: string | number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export default function MiningPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/mining/tasks", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load tasks.");
      setTasks(data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, [loadTasks]);

  async function startTask(task: Task) {
    setError("");
    setNotice("");

    const sponsored = task.category === "SPONSORED";
    const platform = task.sharePlatform;
    const message = `${task.shareMessage?.trim() || `${task.title}\n\n${task.description}`}\n\n${task.taskLink || ""}`;

    let destination = "";

    if (!sponsored && task.taskLink) {
      destination = task.taskLink;
    } else if (sponsored && platform === "WHATSAPP") {
      destination = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    } else if (sponsored && platform === "FACEBOOK") {
      destination = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(task.taskLink || window.location.origin)}&quote=${encodeURIComponent(task.shareMessage?.trim() || `${task.title}\n\n${task.description}`)}`;
    }

    // Open the real destination immediately to avoid popup blocking.
    const newTab = destination
      ? window.open(destination, "_blank")
      : null;

    setBusyTask(task.id);

    try {
      const response = await fetch("/api/mining/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (newTab) newTab.close();
        throw new Error(data.error || "Unable to start task.");
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                progress: [{
                  startedAt: data.startedAt,
                  claimedAt: null,
                }],
              }
            : item
        )
      );

      if (destination && !newTab) {
        window.location.assign(destination);
        return;
      }

      if (false) {
        try {
          if (navigator.share) {
            await navigator.share({
              title: task.title,
              text: message,
            });
            setNotice("Share menu opened. Choose your selected platform. Your timer is running.");
          } else {
            await navigator.clipboard.writeText(message);
            setNotice("Message copied. Paste it into your selected social app. Your timer is running.");
          }
        } catch (shareError) {
          if (false) {
            setNotice("Share cancelled. Your timer is still running.");
          } else {
            setNotice("Your timer is running. Open your selected app to share the message.");
          }
        }
      } else {
        setNotice(data.alreadyStarted
          ? "Your task timer is already running."
          : "Task started. Complete the task and wait for the timer.");
      }
    } catch (err) {
      if (newTab) newTab.close();
      setError(err instanceof Error ? err.message : "Unable to start task.");
    } finally {
      setBusyTask(null);
    }
  }
  async function claimReward(task: Task) {
    setBusyTask(task.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/mining/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to claim reward.");

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                progress: item.progress.map((progress) => ({
                  ...progress,
                  claimedAt: new Date().toISOString(),
                })),
              }
            : item
        )
      );

      setNotice(`${money(data.reward)} has been credited to your Mining Task wallet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim reward.");
    } finally {
      setBusyTask(null);
    }
  }

  const filteredTasks = tasks.filter(
    (task) => filter === "ALL" || task.category === filter
  );

  const completedCount = tasks.filter(
    (task) => task.progress[0]?.claimedAt
  ).length;

  return (
    <main className="dashboard-shell mining-page">
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
          <Link href="/dashboard/mining" className="dashboard-nav-link active">
            <span className="nav-icon">✧</span> Mining Tasks
          </Link>
          <Link href="/dashboard/airtime" className="dashboard-nav-link">
            <span className="nav-icon">▤</span> Airtime
          </Link>
          <Link href="/dashboard/whot" className="dashboard-nav-link">
            <span className="nav-icon">◈</span> WHOT
          </Link>
          <Link href="/dashboard/profile" className="dashboard-nav-link">
            <span className="nav-icon">♙</span> Profile
          </Link>
        </nav>

        <div className="sidebar-divider" />
        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit">↪ Log out</button>
        </form>
        <div className="sidebar-bottom">
          <span className="online-dot" /> Your account is active
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">WORKSPACE / EARN</span>
            <h1>Mining Tasks</h1>
          </div>
          <Link href="/dashboard" className="mining-back-link">← Dashboard</Link>
        </header>

        <div className="dashboard-content">
          <section className="mining-intro">
            <div>
              <span className="section-eyebrow">EARN REWARDS</span>
              <h2>Complete tasks. Get rewarded.</h2>
              <p>Choose a task, follow the instructions and claim your reward when the timer finishes.</p>
            </div>
            <div className="mining-intro-icon">✧</div>
          </section>

          <section className="mining-summary">
            <article>
              <span>Available tasks</span>
              <strong>{tasks.length}</strong>
            </article>
            <article>
              <span>Rewards claimed</span>
              <strong>{completedCount}</strong>
            </article>
            <article>
              <span>Tasks in progress</span>
              <strong>{tasks.filter((task) => task.progress[0] && !task.progress[0].claimedAt).length}</strong>
            </article>
          </section>

          {notice && <div className="mining-message success">{notice}</div>}
          {error && <div className="mining-message error">{error}</div>}

          <section className="dashboard-section mining-task-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">TASK CENTRE</span>
                <h2>Available tasks</h2>
              </div>
              <span className="section-caption">Earn for completing activities</span>
            </div>

            <div className="mining-filters">
              {(["ALL", "REGULAR", "SPONSORED"] as Filter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={filter === item ? "selected" : ""}
                >
                  {item === "ALL" ? "All tasks" : item === "REGULAR" ? "Regular" : "Sponsored"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="mining-empty">Loading available tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="mining-empty">
                <span>✧</span>
                <h3>No tasks available</h3>
                <p>New earning opportunities will appear here when available.</p>
              </div>
            ) : (
              <div className="mining-task-grid">
                {filteredTasks.map((task) => {
                  const progress = task.progress[0];
                  const claimed = Boolean(progress?.claimedAt);
                  const started = Boolean(progress && !claimed);
                  const elapsed = progress
                    ? Math.floor((now - new Date(progress.startedAt).getTime()) / 1000)
                    : 0;
                  const remaining = Math.max(0, task.minDurationSeconds - elapsed);
                  const ready = started && remaining === 0;
                  const percent = Math.min(
                    100,
                    Math.max(0, (elapsed / task.minDurationSeconds) * 100)
                  );

                  return (
                    <article className="mining-task-card" key={task.id}>
                      <div className="mining-task-card-top">
                        <span className={`mining-category ${task.category.toLowerCase()}`}>
                          {task.category === "SPONSORED" ? "Sponsored task" : "Regular task"}
                        </span>
                        {task.category === "SPONSORED" && task.sharePlatform && (
                          <span className="mining-platform-label">{task.sharePlatform}</span>
                        )}
                        <span className="mining-task-reward">{money(task.reward)}</span>
                      </div>

                      <h3>{task.title}</h3>
                      <p className="mining-task-description">{task.description}</p>

                      <div className="mining-task-meta">
                        <span>◷ {Math.ceil(task.minDurationSeconds / 60)} min minimum</span>
                        <span>{task.totalCompletions} claims</span>
                      </div>

                      <div className="mining-instructions">
                        <strong>What to do</strong>
                        <p>{task.instructions}</p>
                      </div>

                      {started && (
                        <div className="mining-progress">
                          <div className="mining-progress-label">
                            <span>{ready ? "Timer completed" : "Time remaining"}</span>
                            <strong>{ready ? "00:00" : formatTime(remaining)}</strong>
                          </div>
                          <div className="mining-progress-track">
                            <span style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      )}

                      {claimed ? (
                        <button className="mining-action claimed" disabled>
                          ✓ Reward claimed
                        </button>
                      ) : ready ? (
                        <button
                          className="mining-action"
                          onClick={() => claimReward(task)}
                          disabled={busyTask === task.id}
                        >
                          {busyTask === task.id ? "Claiming..." : `Claim ${money(task.reward)}`}
                        </button>
                      ) : started ? (
                        <button className="mining-action waiting" disabled>
                          Timer running · {formatTime(remaining)}
                        </button>
                      ) : (
                        <button
                          className="mining-action"
                          onClick={() => startTask(task)}
                          disabled={busyTask === task.id}
                        >
                          {busyTask === task.id ? "Starting..." : "Perform Task →"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      <nav className="dashboard-mobile-nav">
        <Link href="/dashboard"><span className="mobile-nav-icon">⌂</span><small>Home</small></Link>
        <Link href="/dashboard/mining" className="mobile-nav-active"><span className="mobile-nav-icon">✧</span><small>Mining</small></Link>
        <Link href="/dashboard/airtime"><span className="mobile-nav-icon">▤</span><small>Airtime</small></Link>
        <Link href="/dashboard/whot"><span className="mobile-nav-icon">◈</span><small>WHOT</small></Link>
        <Link href="/dashboard/referrals"><span className="mobile-nav-icon">♧</span><small>Referrals</small></Link>
        <Link href="/dashboard/profile"><span className="mobile-nav-icon">♙</span><small>Profile</small></Link>
      </nav>
    </main>
  );
}