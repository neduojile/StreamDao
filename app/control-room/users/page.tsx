"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "../admin-shell";
import {
  Search, Users, UserRound, Wallet, UsersRound,
  ArrowLeft, ChevronLeft, ChevronRight, X,
  RefreshCw, History, CalendarDays, Mail, Phone,
  CircleDollarSign, Pickaxe, Spade, Smartphone
} from "lucide-react";

type UserRecord = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  airtimePurchaseLimitNgn?: string | number | null;
  referralCode: string;
  createdAt: string;
  wallet?: {
    taskBalance: string | number;
    referralBalance: string | number;
    onehubBalance: string | number;
    whotBalance: string | number;
    tappingBalance: string | number;
  } | null;
  tappingProgress?: { taps: number; lastClaimedAt: string | null } | null;
  _count: {
    referrals: number;
    transactions: number;
    taskProgress: number;
    whotSpins: number;
    withdrawals: number;
  };
  referredBy?: { id: string; fullName: string; username: string } | null;
  referrals?: { id: string; fullName: string; username: string; createdAt: string }[];
  transactions?: {
    id: string; walletType: string; type: string; category: string;
    description: string; amount: string | number; status: string; createdAt: string;
  }[];
  withdrawals?: {
    id: string; walletType: string; amount: string | number;
    payoutMethod: string; status: string; createdAt: string;
  }[];
  whotSpins?: {
    id: string; prizeLabel: string; reward: string | number; createdAt: string;
  }[];
  taskProgress?: {
    id: string; startedAt: string; claimedAt: string | null;
    task: { id: string; title: string; category: string; reward: string | number };
  }[];
};

type PageData = {
  users: UserRecord[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2
  }).format(Number(value ?? 0));

const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });

function StatCard({ label, value, icon: Icon, note }: {
  label: string; value: string; icon: typeof Users; note: string;
}) {
  return (
    <div className="users-stat-card">
      <div className="users-stat-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function UsersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitFeedback, setLimitFeedback] = useState("");
  const [limitError, setLimitError] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        ...(search.trim() ? { search: search.trim() } : {})
      });
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load users.");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers(); }, 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function openUser(user: UserRecord) {
    setSelected(user);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load user details.");
      const detail = result.user ?? user;
      setSelected({ ...detail, totalEarnings: result.totalEarnings });
      setLimitDraft(
        detail.airtimePurchaseLimitNgn == null
          ? ""
          : String(detail.airtimePurchaseLimitNgn)
      );
      setLimitFeedback("");
      setLimitError(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load user details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveAirtimeLimit(clear = false) {
    if (!selected || limitSaving) return;

    const amount = clear ? null : Number(limitDraft);

    if (
      !clear &&
      (amount === null || !Number.isFinite(amount) || amount < 0 || amount > 50000000)
    ) {
      setLimitError(true);
      setLimitFeedback("Enter a valid amount between ₦0 and ₦50,000,000.");
      return;
    }

    setLimitSaving(true);
    setLimitFeedback("");
    setLimitError(false);

    try {
      const response = await fetch("/api/admin/users/airtime-limit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, limitNgn: amount }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update purchase limit.");
      }

      const savedLimit = result.user.airtimePurchaseLimitNgn;
      setSelected((current) =>
        current
          ? { ...current, airtimePurchaseLimitNgn: savedLimit }
          : current
      );
      setLimitDraft(savedLimit == null ? "" : String(savedLimit));
      setLimitFeedback(result.message || "Purchase limit updated.");
    } catch (error) {
      setLimitError(true);
      setLimitFeedback(
        error instanceof Error ? error.message : "Unable to update purchase limit."
      );
    } finally {
      setLimitSaving(false);
    }
  }

  const totalUsers = data?.pagination.total ?? 0;

  return (
    <AdminShell>
      <main className="users-admin-page">
        <header className="users-page-heading">
          <div>
            <span className="users-eyebrow">CONTROL ROOM / ACCOUNTS</span>
            <h1>User Management</h1>
            <p>Explore registered accounts, wallet balances and platform activity.</p>
          </div>
          <button className="users-refresh" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "users-spinning" : ""} />
            Refresh
          </button>
        </header>

        <section className="users-stats-grid">
          <StatCard label="Registered users" value={totalUsers.toLocaleString()}
            icon={Users} note="Accounts matching current search" />
          <StatCard label="On this page" value={String(data?.users.length ?? 0)}
            icon={UserRound} note="Currently displayed" />
          <StatCard label="Referrals" value={(data?.users.reduce((sum, user) => sum + user._count.referrals, 0) ?? 0).toLocaleString()}
            icon={UsersRound} note="Direct referrals on this page" />
          <StatCard label="Transactions" value={(data?.users.reduce((sum, user) => sum + user._count.transactions, 0) ?? 0).toLocaleString()}
            icon={History} note="Recorded on this page" />
        </section>

        <section className="users-directory-panel">
          <div className="users-directory-heading">
            <div>
              <h2>All accounts</h2>
              <p>Search and inspect registered StreamDao members.</p>
            </div>
            <span className="users-total-label">{totalUsers.toLocaleString()} results</span>
          </div>

          <div className="users-search-wrap">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search name, username, email or phone..."
              aria-label="Search users"
            />
            {search && <button onClick={() => { setSearch(""); setPage(1); }} aria-label="Clear search"><X size={17} /></button>}
          </div>

          {error && <div className="users-error">{error}</div>}

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>CONTACT</th>
                  <th>WALLET TOTAL</th>
                  <th>REFERRALS</th>
                  <th>JOINED</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="users-empty">Loading accounts...</td></tr>
                ) : !data?.users.length ? (
                  <tr><td colSpan={6} className="users-empty">No accounts found.</td></tr>
                ) : data.users.map((user) => {
                  const wallet = user.wallet;
                  const total = wallet
                    ? Number(wallet.taskBalance) + Number(wallet.referralBalance) +
                      Number(wallet.onehubBalance) + Number(wallet.whotBalance) +
                      Number(wallet.tappingBalance)
                    : 0;
                  return (
                    <tr key={user.id} onClick={() => void openUser(user)}>
                      <td>
                        <div className="users-identity">
                          <span className="users-avatar">{user.fullName.charAt(0).toUpperCase()}</span>
                          <span><strong>{user.fullName}</strong><small>@{user.username}</small></span>
                        </div>
                      </td>
                      <td><span>{user.email}</span><small className="users-secondary">{user.phone}</small></td>
                      <td><strong>{money(total)}</strong></td>
                      <td>{user._count.referrals}</td>
                      <td>{date(user.createdAt)}</td>
                      <td><button className="users-view-button" onClick={(event) => { event.stopPropagation(); void openUser(user); }}>View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="users-pagination">
            <span>Page {data?.pagination.page ?? 1} of {Math.max(1, data?.pagination.totalPages ?? 1)}</span>
            <div>
              <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
              <button disabled={page >= (data?.pagination.totalPages ?? 1) || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={18} /></button>
            </div>
          </div>
        </section>

        {selected && (
          <div className="users-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
            <section className="users-detail-modal" role="dialog" aria-modal="true" aria-label="User details">
              <header className="users-detail-header">
                <button onClick={() => setSelected(null)} aria-label="Close details"><X size={20} /></button>
                <span>ACCOUNT PROFILE</span>
              </header>

              {detailLoading ? <div className="users-empty">Loading account details...</div> : (
                <>
                  <div className="users-detail-profile">
                    <span className="users-detail-avatar">{selected.fullName.charAt(0).toUpperCase()}</span>
                    <div><h2>{selected.fullName}</h2><p>@{selected.username}</p><small>Member since {date(selected.createdAt)}</small></div>
                  </div>

                  <div className="users-contact-grid">
                    <div><Mail size={15} /><span>{selected.email}</span></div>
                    <div><Phone size={15} /><span>{selected.phone}</span></div>
                  </div>

                  <div className="users-detail-section users-airtime-limit-section">
                    <h3><Smartphone size={17} /> Airtime & Data purchase limit</h3>
                    <p className="users-muted">
                      Set the maximum amount this member can spend on a single Airtime or Data purchase.
                    </p>
                    <div className="users-limit-current">
                      <span>Current individual limit</span>
                      <strong>
                        {selected.airtimePurchaseLimitNgn == null
                          ? "Using global default"
                          : `₦${Number(selected.airtimePurchaseLimitNgn).toLocaleString("en-NG", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}
                      </strong>
                    </div>
                    <label className="users-limit-label" htmlFor="airtime-user-limit">
                      New maximum purchase amount (NGN)
                    </label>
                    <div className="users-limit-input-wrap">
                      <span>₦</span>
                      <input
                        id="airtime-user-limit"
                        type="number"
                        min="0"
                        max="50000000"
                        step="0.01"
                        value={limitDraft}
                        onChange={(event) => setLimitDraft(event.target.value)}
                        placeholder="Enter amount in Naira"
                        disabled={limitSaving}
                      />
                    </div>
                    <div className="users-limit-actions">
                      <button
                        type="button"
                        className="users-limit-save"
                        onClick={() => void saveAirtimeLimit()}
                        disabled={limitSaving || !limitDraft.trim()}
                      >
                        {limitSaving ? "Saving..." : "Save purchase limit"}
                      </button>
                      <button
                        type="button"
                        className="users-limit-clear"
                        onClick={() => void saveAirtimeLimit(true)}
                        disabled={limitSaving || selected.airtimePurchaseLimitNgn == null}
                      >
                        Clear override
                      </button>
                    </div>
                    {limitFeedback && (
                      <p className={limitError ? "users-limit-feedback error" : "users-limit-feedback success"}>
                        {limitFeedback}
                      </p>
                    )}
                  </div>

                  <div className="users-detail-section">
                    <h3><Wallet size={17} /> Wallet balances</h3>
                    <div className="users-wallet-grid">
                      {[
                        ["Mining", selected.wallet?.taskBalance],
                        ["Referral", selected.wallet?.referralBalance],
                        ["Sponsored", selected.wallet?.onehubBalance],
                        ["WHOT", selected.wallet?.whotBalance],
                        ["Tapping", selected.wallet?.tappingBalance]
                      ].map(([label, amount]) => (
                        <div key={String(label)}><span>{label}</span><strong>{money(amount)}</strong></div>
                      ))}
                    </div>
                    <div className="users-total-earnings">
                      <span>Total completed earnings</span>
                      <strong>{money((selected as UserRecord & { totalEarnings?: number }).totalEarnings)}</strong>
                    </div>
                  </div>

                  <div className="users-detail-section">
                    <h3><History size={17} /> Activity overview</h3>
                    <div className="users-activity-grid">
                      <div><Pickaxe size={17} /><strong>{selected._count.taskProgress}</strong><span>Task starts</span></div>
                      <div><Smartphone size={17} /><strong>{selected.tappingProgress?.taps ?? 0}</strong><span>Current taps</span></div>
                      <div><Spade size={17} /><strong>{selected._count.whotSpins}</strong><span>WHOT spins</span></div>
                      <div><Wallet size={17} /><strong>{selected._count.withdrawals}</strong><span>Withdrawals</span></div>
                      <div><UsersRound size={17} /><strong>{selected._count.referrals}</strong><span>Referrals</span></div>
                      <div><History size={17} /><strong>{selected._count.transactions}</strong><span>Transactions</span></div>
                    </div>
                  </div>

                  <div className="users-detail-section">
                    <h3><UsersRound size={17} /> Referral information</h3>
                    <p className="users-referral-code">{selected.referralCode}</p>
                    <p className="users-muted">Referred by: {selected.referredBy ? `${selected.referredBy.fullName} (@${selected.referredBy.username})` : "Direct registration"}</p>
                    {selected.referrals?.length ? (
                      <div className="users-recent-list">
                        {selected.referrals.map((referral) => (
                          <div key={referral.id}><span>{referral.fullName} <small>@{referral.username}</small></span><small>{date(referral.createdAt)}</small></div>
                        ))}
                      </div>
                    ) : <p className="users-muted">No referrals recorded.</p>}
                  </div>

                  <div className="users-detail-section">
                    <h3><History size={17} /> Recent transactions</h3>
                    {selected.transactions?.length ? (
                      <div className="users-recent-list">
                        {selected.transactions.map((transaction) => (
                          <div key={transaction.id}>
                            <span>{transaction.description}<small>{transaction.walletType} · {transaction.status}</small></span>
                            <strong>{money(transaction.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : <p className="users-muted">No transactions recorded.</p>}
                  </div>

                  <div className="users-detail-section">
                    <h3><Wallet size={17} /> Recent withdrawals</h3>
                    {selected.withdrawals?.length ? (
                      <div className="users-recent-list">
                        {selected.withdrawals.map((withdrawal) => (
                          <div key={withdrawal.id}>
                            <span>{withdrawal.walletType}<small>{withdrawal.payoutMethod} · {withdrawal.status}</small></span>
                            <strong>{money(withdrawal.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : <p className="users-muted">No withdrawals recorded.</p>}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </AdminShell>
  );
}