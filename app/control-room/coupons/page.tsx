"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminShell from "../admin-shell";

type Batch = {
  id: string;
  name: string | null;
  totalCodes: number;
  expiresAt: string;
  createdAt: string;
  _count: { coupons: number };
};

type CouponStats = { status: string; _count: { _all: number } };
type SavedCoupon = { id: string; code: string | null; status: string; expiresAt: string };

export default function CouponsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<CouponStats[]>([]);
  const [count, setCount] = useState("25");
  const [name, setName] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [savedCoupons, setSavedCoupons] = useState<SavedCoupon[]>([]);
  const [visibleBatchId, setVisibleBatchId] = useState("");
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [customerServiceUrl, setCustomerServiceUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingScope, setDeletingScope] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/coupons", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to load coupons.");

      setBatches(data.batches || []);
      setStats(data.stats || []);
      setCustomerServiceUrl(data.customerServiceUrl || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalFor = (status: string) =>
    stats.find((item) => item.status === status)?._count._all || 0;

  const totalGenerated = stats.reduce(
    (sum, item) => sum + item._count._all,
    0
  );

  async function generateCoupons(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setError("");
    setNotice("");
    setCodes([]);

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(count), name }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Generation failed.");

      setCodes(data.codes || []);
      setVisibleBatchId(data.batch?.id || "");
      setSavedCoupons([]);
      setNotice(data.message || "Coupons generated successfully.");
      setName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate coupons.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
      setError("");
    } catch {
      setError("Copy failed. Select and copy the codes manually.");
    }
  }


  async function revokeCoupons(scope: "all" | "batch", batchId?: string) {
    const confirmation = scope === "all"
      ? "Revoke ALL unused coupons across every batch? Redeemed coupons will remain untouched."
      : "Revoke all unused coupons in this batch? This cannot be undone.";

    if (!window.confirm(confirmation)) return;

    setDeletingScope(scope === "all" ? "all" : batchId || "");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, batchId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to revoke coupons.");

      setNotice(data.message || "Coupons revoked successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke coupons.");
    } finally {
      setDeletingScope("");
    }
  }

  async function showSavedCodes(batchId: string) {
    setLoadingCodes(true);
    setError("");
    setNotice("");
    setCodes([]);
    setSavedCoupons([]);
    setVisibleBatchId(batchId);

    try {
      const response = await fetch(
        `/api/admin/coupons?batchId=${encodeURIComponent(batchId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to retrieve saved codes.");
      }

      setSavedCoupons(data.coupons || []);
      setNotice("Saved coupon codes loaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve saved codes.");
      setVisibleBatchId("");
    } finally {
      setLoadingCodes(false);
    }
  }

  function clearCodeDisplay() {
    setCodes([]);
    setSavedCoupons([]);
    setVisibleBatchId("");
    setNotice("Coupon display cleared. Your codes remain saved and usable.");
  }
  async function saveCustomerService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/coupons/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerServiceUrl }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to save settings.");

      setCustomerServiceUrl(data.customerServiceUrl || "");
      setNotice("Customer service link saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <AdminShell>
      <main className="admin-dashboard coupon-admin-page">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">CONTROL ROOM / FINANCIAL TOOLS</span>
            <h1>Coupon Management</h1>
          </div>
          <span className="coupon-live-status"><i /> SYSTEM ACTIVE</span>
        </header>

        <section className="admin-welcome coupon-welcome">
          <div>
            <span className="admin-eyebrow">WITHDRAWAL ACCESS</span>
            <h2>Generate and manage coupon codes</h2>
            <p>Create secure, one-time withdrawal codes for your users.</p>
          </div>
          <div className="coupon-welcome-icon">SD</div>
        </section>

        {error && <div className="coupon-alert coupon-alert-error">{error}</div>}
        {notice && <div className="coupon-alert coupon-alert-success">{notice}</div>}

        <section className="admin-stats premium-admin-stats coupon-stats">
          <article className="premium-stat-card">
            <div className="premium-stat-top"><span>Total generated</span><span className="premium-stat-icon">#</span></div>
            <strong>{loading ? "—" : totalGenerated.toLocaleString()}</strong>
            <div className="premium-stat-note"><span /> All coupon batches</div>
          </article>
          <article className="premium-stat-card">
            <div className="premium-stat-top"><span>Active codes</span><span className="premium-stat-icon">✓</span></div>
            <strong>{loading ? "—" : totalFor("ACTIVE").toLocaleString()}</strong>
            <div className="premium-stat-note"><span /> Available for redemption</div>
          </article>
          <article className="premium-stat-card">
            <div className="premium-stat-top"><span>Redeemed</span><span className="premium-stat-icon">↗</span></div>
            <strong>{loading ? "—" : totalFor("REDEEMED").toLocaleString()}</strong>
            <div className="premium-stat-note"><span /> Successfully used</div>
          </article>
          <article className="premium-stat-card">
            <div className="premium-stat-top"><span>Expired / disabled / deleted</span><span className="premium-stat-icon">!</span></div>
            <strong>{loading ? "—" : (totalFor("EXPIRED") + totalFor("DISABLED") + totalFor("DELETED")).toLocaleString()}</strong>
            <div className="premium-stat-note"><span /> No longer usable</div>
          </article>
        </section>

        <div className="coupon-layout">
          <section className="coupon-panel">
            <div className="premium-section-heading">
              <div>
                <span className="admin-eyebrow">NEW COUPON BATCH</span>
                <h2>Generate codes</h2>
              </div>
              <span className="coupon-panel-icon">＋</span>
            </div>

            <form onSubmit={generateCoupons} className="coupon-form">
              <label>
                Batch name <span>Optional</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. November withdrawal batch"
                  maxLength={80}
                />
              </label>

              <label>
                Number of codes
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  required
                />
              </label>

              <div className="coupon-info-strip">
                <div><span>CODE FORMAT</span><strong>SD-123-456-789</strong></div>
                <div><span>VALIDITY</span><strong>20 days</strong></div>
                <div><span>REDEMPTION</span><strong>One time</strong></div>
              </div>

              <button className="coupon-primary-button" type="submit" disabled={generating || loading}>
                {generating ? "Generating codes..." : "Generate coupon codes"}
              </button>
              <p className="coupon-footnote">You can generate between 1 and 1,000 unique codes per batch.</p>
            </form>
          </section>

          <section className="coupon-panel coupon-settings-panel">
            <div className="premium-section-heading">
              <div>
                <span className="admin-eyebrow">USER SUPPORT</span>
                <h2>Customer service link</h2>
              </div>
              <span className="coupon-panel-icon">↗</span>
            </div>
            <p className="coupon-description">
              Users without a coupon will see a contact button on their withdrawal page.
            </p>
            <form onSubmit={saveCustomerService} className="coupon-form">
              <label>
                Contact URL
                <input
                  type="url"
                  value={customerServiceUrl}
                  onChange={(event) => setCustomerServiceUrl(event.target.value)}
                  placeholder="https://wa.me/234..."
                />
              </label>
              <button className="coupon-secondary-button" type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save customer service link"}
              </button>
            </form>
            {customerServiceUrl && (
              <a className="coupon-test-link" href={customerServiceUrl} target="_blank" rel="noreferrer">
                Open customer service link ↗
              </a>
            )}
          </section>
        </div>

        {(codes.length > 0 || savedCoupons.length > 0 || loadingCodes) && (
          <section className="coupon-panel coupon-generated-panel">
            <div className="premium-section-heading">
              <div>
                <span className="admin-eyebrow">JUST CREATED</span>
                <h2>Saved coupon codes</h2>
              <button
                className="coupon-refresh-button"
                type="button"
                onClick={clearCodeDisplay}
              >
                Clear display
              </button>
              </div>
              <span className="coupon-count-badge">{codes.length} CODES</span>
            </div>

            <div className="coupon-warning">
              Codes are encrypted in the database and can be retrieved again by an authorized admin. Clearing this display does not invalidate them.
            </div>

            <button
              className="coupon-primary-button coupon-copy-all"
              type="button"
              onClick={() => copyText(codes.join("\n"), "All coupon codes copied.")}
            >
              Copy all {codes.length} codes
            </button>

            {loadingCodes ? (
              <p className="coupon-empty">Loading saved coupon codes...</p>
            ) : (
              <div className="coupon-code-grid">
                {(savedCoupons.length > 0
                  ? savedCoupons
                      .filter((coupon) => coupon.code)
                      .map((coupon) => coupon.code as string)
                  : codes
                ).map((code) => (
                  <div className="coupon-code-item" key={code}>
                    <strong>{code}</strong>
                    <button type="button" onClick={() => copyText(code, `${code} copied.`)}>Copy</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="coupon-panel coupon-batches-panel">
          <div className="premium-section-heading">
            <div>
              <span className="admin-eyebrow">GENERATION RECORDS</span>
              <h2>Coupon batches</h2>
              <button
                className="coupon-danger-button"
                type="button"
                disabled={!!deletingScope || loading}
                onClick={() => revokeCoupons("all")}
              >
                {deletingScope === "all" ? "Revoking..." : "Revoke all unused codes"}
              </button>
            </div>
            <button className="coupon-refresh-button" type="button" onClick={loadData}>Refresh ↻</button>
          </div>

          {loading ? (
            <p className="coupon-empty">Loading coupon batches...</p>
          ) : batches.length === 0 ? (
            <p className="coupon-empty">No coupon batches have been generated yet.</p>
          ) : (
            <div className="coupon-table-wrap">
              <table className="coupon-table">
                <thead>
                  <tr><th>Batch</th><th>Codes</th><th>Created</th><th>Expires</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td><strong>{batch.name || "Untitled batch"}</strong><small>{batch.id.slice(-8)}</small></td>
                      <td>{batch._count?.coupons ?? batch.totalCodes}</td>
                      <td>{new Date(batch.createdAt).toLocaleDateString()}</td>
                      <td>{new Date(batch.expiresAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="coupon-secondary-button"
                          type="button"
                          disabled={!!deletingScope || loadingCodes}
                          onClick={() => showSavedCodes(batch.id)}
                        >
                          Show codes
                        </button>
                        <button
                          className="coupon-danger-button coupon-danger-small"
                          type="button"
                          disabled={!!deletingScope || loading}
                          onClick={() => revokeCoupons("batch", batch.id)}
                        >
                          {deletingScope === batch.id ? "Revoking..." : "Delete batch"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}