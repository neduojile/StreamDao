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
    PROCESSING: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    APPROVED: "border-lime-400/20 bg-lime-400/10 text-lime-300",
    PAID: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
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
  const [action, setAction] = useState<"PROCESSING" | "APPROVED" | "PAID" | "REJECTED" | null>(null);
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
  const processingCount = items.filter((item) => item.status === "PROCESSING").length;
  const approved = items.filter((item) => item.status === "APPROVED");
  const paid = items.filter((item) => item.status === "PAID");
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

  function openAction(item: Withdrawal, nextAction: "PROCESSING" | "APPROVED" | "PAID" | "REJECTED") {
    setSelected(item);
    setAction(nextAction);
    setAdminNote("");
    setNotice("");
    setError("");
  }

  async function processWithdrawal(
    target: Withdrawal,
    nextStatus: "PROCESSING" | "APPROVED" | "PAID" | "REJECTED"
  ) {
    if (processing) return;

    setProcessing(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/withdrawals/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNote }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update withdrawal.");
      }

      setNotice(data.message);
      setSelected(null);
      setAction(null);
      setAdminNote("");
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
              { label: "Processing", value: processingCount, color: "text-blue-300" },
              { label: "Approved", value: approved.length, color: "text-lime-300" },
              { label: "Paid", value: paid.length, color: "text-emerald-300" },
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
              <option value="PROCESSING">Processing</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

                      <div className="flex w-full flex-1 flex-wrap items-center justify-end gap-2 sm:ml-auto">
                        <div className="min-w-[85px] text-right">
                          <p className="text-xl font-semibold text-lime-300">{money(item.amount)}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.payoutMethod === "BANK" ? "Bank transfer" : "Crypto wallet"}</p>
                        </div>

                        <button
                          onClick={() => setSelected(item)}
                          className="whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-2 text-[11px] font-semibold text-gray-300 transition hover:border-lime-400/40 hover:bg-white/[0.03] hover:text-lime-300"
                        >
                          View details
                        </button>

                        {["PENDING", "PROCESSING", "APPROVED"].includes(item.status) && (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {item.status === "PENDING" && (
                              <button onClick={() => openAction(item, "PROCESSING")} className="rounded-lg bg-blue-400 px-3.5 py-2.5 text-xs font-bold text-[#07100c] transition hover:bg-blue-300 disabled:opacity-50">
                                Start processing
                              </button>
                            )}
                            {item.status === "PROCESSING" && (
                              <button onClick={() => openAction(item, "APPROVED")} className="whitespace-nowrap rounded-lg bg-lime-400 px-3 py-2 text-[11px] font-bold text-[#07100c] transition hover:bg-lime-300 disabled:opacity-50">
                                Approve
                              </button>
                            )}
                            {item.status === "APPROVED" && (
                              <button onClick={() => openAction(item, "PAID")} className="rounded-lg bg-emerald-400 px-3.5 py-2.5 text-xs font-bold text-[#07100c] transition hover:bg-emerald-300 disabled:opacity-50">
                                Mark as paid
                              </button>
                            )}
                            <button onClick={() => openAction(item, "REJECTED")} className="whitespace-nowrap rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-[11px] font-semibold text-red-300 transition hover:border-red-400/60 hover:bg-red-400/10">
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

              {selected.status !== "PAID" && selected.status !== "REJECTED" && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs text-gray-400">
                      Admin note (optional)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add a note for the user..."
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-lime-400/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selected.status === "PENDING" && (
                      <button
                        onClick={() => processWithdrawal(selected, "PROCESSING")}
                        disabled={processing}
                        className="rounded-xl bg-blue-400 px-4 py-3 text-sm font-bold text-[#07100c] transition hover:bg-blue-300 disabled:opacity-50"
                      >
                        {processing ? "Updating..." : "Start processing"}
                      </button>
                    )}
                    {selected.status === "PROCESSING" && (
                      <button
                        onClick={() => processWithdrawal(selected, "APPROVED")}
                        disabled={processing}
                        className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-bold text-[#07100c] transition hover:bg-lime-300 disabled:opacity-50"
                      >
                        {processing ? "Updating..." : "Approve request"}
                      </button>
                    )}
                    {selected.status === "APPROVED" && (
                      <button
                        onClick={() => processWithdrawal(selected, "PAID")}
                        disabled={processing}
                        className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07100c] transition hover:bg-emerald-300 disabled:opacity-50"
                      >
                        {processing ? "Updating..." : "Mark as paid"}
                      </button>
                    )}
                    <button
                      onClick={() => processWithdrawal(selected, "REJECTED")}
                      disabled={processing}
                      className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {processing ? "Updating..." : "Reject request"}
                    </button>
                  </div>
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