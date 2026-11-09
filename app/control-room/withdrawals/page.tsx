"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "../admin-shell";

type Withdrawal = {
  id: string;
  userId: string;
  walletType: string;
  amount: string;
  payoutMethod: string;
  payoutDetails: Record<string, string | null>;
  status: string;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
  user: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    phone: string | null;
  };
};

const money = (value: string | number) => `€${Number(value).toFixed(2)}`;

function Status({ value }: { value: string }) {
  const styles: Record<string, string> = {
    PENDING: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
    APPROVED: "border-lime-400/20 bg-lime-400/10 text-lime-300",
    REJECTED: "border-red-400/20 bg-red-400/10 text-red-300",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold ${styles[value] || "border-white/10 text-gray-400"}`}>
      {value}
    </span>
  );
}

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [action, setAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/withdrawals", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load withdrawals.");
      }

      setItems(data.withdrawals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load withdrawals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const pending = items.filter((item) => item.status === "PENDING");
  const approved = items.filter((item) => item.status === "APPROVED");
  const rejected = items.filter((item) => item.status === "REJECTED");

  const filtered = items.filter((item) => {
    const matchesFilter = filter === "ALL" || item.status === filter;
    const term = search.toLowerCase();

    const matchesSearch =
      item.user.fullName.toLowerCase().includes(term) ||
      item.user.username.toLowerCase().includes(term) ||
      item.user.email.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term);

    return matchesFilter && matchesSearch;
  });

  function openAction(item: Withdrawal, nextAction: "APPROVED" | "REJECTED") {
    setSelected(item);
    setAction(nextAction);
    setAdminNote("");
    setNotice("");
    setError("");
  }

  async function processWithdrawal() {
    if (!selected || !action) return;

    setProcessing(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/withdrawals/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, adminNote }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to process request.");
      }

      setNotice(data.message);
      setSelected(null);
      setAction(null);
      await loadWithdrawals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AdminShell>
      <div className="min-h-screen bg-[#07100c] px-4 py-7 text-white sm:px-7 lg:px-9">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">Finance management</p>
              <h1 className="text-2xl font-semibold tracking-tight">Withdrawals</h1>
              <p className="mt-2 text-sm text-gray-400">Review and manage user payout requests.</p>
            </div>
            <button
              onClick={loadWithdrawals}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-gray-300 hover:border-lime-400/30 hover:text-lime-300 disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>

          {notice && (
            <div className="mb-5 rounded-xl border border-lime-400/20 bg-lime-400/10 p-4 text-sm text-lime-300">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total requests", value: items.length, color: "text-white" },
              { label: "Pending", value: pending.length, color: "text-yellow-300" },
              { label: "Approved", value: approved.length, color: "text-lime-300" },
              { label: "Rejected", value: rejected.length, color: "text-red-300" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#0d1912] p-5">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className={`mt-3 text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, username, email or ID..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0d1912] px-4 py-3 text-sm text-white outline-none focus:border-lime-400/50"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0d1912] px-4 py-3 text-sm text-white outline-none focus:border-lime-400/50"
            >
              <option value="ALL">All requests</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1912]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold">Withdrawal requests</h2>
              <span className="text-xs text-gray-500">{filtered.length} records</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm text-gray-400">Loading requests...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">No withdrawal requests found.</div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filtered.map((item) => (
                  <div key={item.id} className="p-5 transition hover:bg-white/[0.015]">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-semibold">{item.user.fullName}</p>
                          <Status value={item.status} />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">@{item.user.username} · {item.user.email}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {item.walletType} wallet · {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 break-all text-[10px] text-gray-600">ID: {item.id}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 lg:justify-end">
                        <div className="text-left lg:text-right">
                          <p className="text-xl font-semibold text-lime-300">{money(item.amount)}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.payoutMethod === "BANK" ? "Bank transfer" : "Crypto wallet"}</p>
                        </div>

                        <button
                          onClick={() => setSelected(item)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:border-lime-400/40 hover:text-lime-300"
                        >
                          View details
                        </button>

                        {item.status === "PENDING" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openAction(item, "APPROVED")}
                              className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-bold text-[#07100c] hover:bg-lime-300"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openAction(item, "REJECTED")}
                              className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
            <div className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1912] p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-lime-400">Request details</p>
                  <h2 className="mt-2 text-lg font-semibold">{selected.user.fullName}</h2>
                  <p className="mt-1 text-xs text-gray-500">{selected.user.email}</p>
                </div>
                <button onClick={() => { setSelected(null); setAction(null); }} className="text-xl text-gray-500 hover:text-white" aria-label="Close">×</button>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-gray-500">Amount</span><strong className="text-lime-300">{money(selected.amount)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Wallet</span><strong>{selected.walletType}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Method</span><strong>{selected.payoutMethod}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Status</span><Status value={selected.status} /></div>
                {selected.payoutMethod === "BANK" ? (
                  <>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Bank</span><strong className="text-right">{selected.payoutDetails.bankName || "—"}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Account name</span><strong className="text-right">{selected.payoutDetails.accountName || "—"}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Account number</span><strong className="text-right">{selected.payoutDetails.accountNumber || "—"}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Network</span><strong>{selected.payoutDetails.cryptoNetwork || "—"}</strong></div>
                    <div><p className="mb-1 text-gray-500">Wallet address</p><p className="break-all text-xs">{selected.payoutDetails.walletAddress || "—"}</p></div>
                  </>
                )}
                {selected.adminNote && <div><p className="mb-1 text-gray-500">Admin note</p><p>{selected.adminNote}</p></div>}
              </div>

              {selected.status === "PENDING" && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs text-gray-400">
                      Admin note {action === "REJECTED" ? "(recommended)" : "(optional)"}
                    </label>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add a note about this decision..."
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-lime-400/50"
                    />
                  </div>

                  {!action ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setAction("APPROVED")} className="rounded-xl bg-lime-400 py-3 text-sm font-bold text-[#07100c]">Approve request</button>
                      <button onClick={() => setAction("REJECTED")} className="rounded-xl border border-red-400/30 py-3 text-sm font-semibold text-red-300">Reject request</button>
                    </div>
                  ) : (
                    <>
                      <p className={`rounded-xl p-3 text-xs ${action === "REJECTED" ? "border border-red-400/20 bg-red-400/10 text-red-300" : "border border-lime-400/20 bg-lime-400/10 text-lime-300"}`}>
                        {action === "REJECTED"
                          ? "Confirm rejection. The withdrawn amount will automatically return to the user's original wallet."
                          : "Confirm approval. The request will be marked as approved. You must still complete the actual payout."}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setAction(null)} disabled={processing} className="rounded-xl border border-white/10 py-3 text-sm text-gray-300">Back</button>
                        <button onClick={processWithdrawal} disabled={processing} className={`rounded-xl py-3 text-sm font-bold text-[#07100c] disabled:opacity-50 ${action === "REJECTED" ? "bg-red-400" : "bg-lime-400"}`}>
                          {processing ? "Processing..." : `Confirm ${action === "REJECTED" ? "rejection" : "approval"}`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selected.status !== "PENDING" && (
                <button onClick={() => setSelected(null)} className="mt-5 w-full rounded-xl border border-white/10 py-3 text-sm text-gray-300 hover:bg-white/5">Close details</button>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}