"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type Wallet = {
  referralBalance: string;
  taskBalance: string;
  onehubBalance: string;
  whotBalance: string;
  tappingBalance: string;
};

type Withdrawal = {
  id: string;
  walletType: string;
  amount: string;
  payoutMethod: string;
  payoutDetails: Record<string, unknown>;
  status: string;
  createdAt: string;
};

type PayoutProfile = {
  payoutMethod: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  countryName: string | null;
  payoutCurrency: string | null;
  cryptoNetwork: string | null;
  walletAddress: string | null;
};

type ExchangeRate = {
  currency: string;
  rate: number;
  updatedAt: string | null;
};

const money = (value: number | string) =>
  `€${Number(value || 0).toFixed(2)}`;

function statusStyle(status: string) {
  if (status === "APPROVED" || status === "COMPLETED")
    return "border-lime-400/20 bg-lime-400/10 text-lime-300";
  if (status === "REJECTED")
    return "border-red-400/20 bg-red-400/10 text-red-300";
  return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
}

export default function WithdrawPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [payout, setPayout] = useState<PayoutProfile | null>(null);
  const [customerServiceUrl, setCustomerServiceUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/withdrawals", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to load withdrawal information.");

      setWallet(data.wallet);
      setWithdrawals(data.withdrawals ?? []);
      setPayout(data.payoutProfile);
      setCustomerServiceUrl(data.customerServiceUrl || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const balances = useMemo(() => [
    { key: "REFERRAL", label: "Referral", value: Number(wallet?.referralBalance || 0), minimum: 20 },
    { key: "TASK", label: "Mining + Sponsored Tasks", value: Number(wallet?.taskBalance || 0), minimum: 115 },
    { key: "WHOT", label: "WHOT", value: Number(wallet?.whotBalance || 0), minimum: 25 },
    { key: "TAPPING", label: "Tapping", value: Number(wallet?.tappingBalance || 0), minimum: 100 },
  ], [wallet]);

  const totalBalance = balances.reduce((sum, item) => sum + item.value, 0);

  const eligibleBalances = balances.map((item) => ({
    ...item,
    eligible: item.value >= item.minimum,
    withdrawal: item.value >= item.minimum ? item.value : 0,
  }));

  const totalEligible = eligibleBalances.reduce((sum, item) => sum + item.withdrawal, 0);
  const lockedBalance = totalBalance - totalEligible;

  useEffect(() => {
    const currency = payout?.payoutMethod === "BANK" ? payout.payoutCurrency : null;

    if (!currency) {
      setRate(null);
      setRateError("");
      return;
    }

    let active = true;
    setRateLoading(true);
    setRateError("");

    fetch(`/api/exchange-rates?currency=${encodeURIComponent(currency)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Exchange rate unavailable.");
        return data;
      })
      .then((data) => {
        if (active) setRate(data);
      })
      .catch((err) => {
        if (active) {
          setRate(null);
          setRateError(err.message || "Unable to load exchange rate.");
        }
      })
      .finally(() => {
        if (active) setRateLoading(false);
      });

    return () => {
      active = false;
    };
  }, [payout?.payoutMethod, payout?.payoutCurrency]);

  const convertedAmount = rate && totalEligible > 0
    ? totalEligible * rate.rate
    : 0;

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!payout) {
      setError("Please set up your payout details before withdrawing.");
      return;
    }
if (payout.payoutMethod === "BANK" && !rate) {
      setError("Your payout exchange rate is unavailable. Please try again.");
      return;
    }

    const normalizedCode = couponCode.trim().toUpperCase();

    if (!/^SD-\d{3}-\d{3}-\d{3}$/.test(normalizedCode)) {
      setError("Enter your coupon in the format SD-123-456-789.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: normalizedCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to submit withdrawal.");

      setMessage("Your withdrawal request has been submitted successfully.");
      setCouponCode("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const localMoney = (value: number) => {
    if (!rate) return "—";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: rate.currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${rate.currency} ${value.toFixed(2)}`;
    }
  };

  return (
    <main className="min-h-screen bg-[#07100c] px-4 pb-28 pt-7 text-white md:px-8 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard/profile" className="mb-7 inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-lime-300">
          ← Back to Profile
        </Link>

        <div className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-[2px] text-lime-300">YOUR EARNINGS</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Withdraw funds</h1>
          <p className="mt-2 text-sm text-gray-400">Choose how much you want to withdraw and see your estimated payout.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d1912] p-10 text-center text-sm text-gray-400">
            Loading your withdrawal information...
          </div>
        ) : (
          <>
            <section className="relative mb-6 overflow-hidden rounded-2xl border border-lime-300/15 bg-gradient-to-br from-[#17291a] via-[#102016] to-[#0c1710] p-6">
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-300/[0.07] blur-3xl" />
              <div className="relative">
                <p className="text-xs font-medium text-gray-400">Total available for withdrawal</p>
                <h2 className="mt-3 text-4xl font-bold tracking-tight">{money(totalBalance)}</h2>
                <p className="mt-2 text-xs text-gray-500">One combined balance from your four eligible wallets</p>

                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {balances.map((item) => (
                    <div key={item.key} className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <p className="text-[10px] text-gray-500">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-lime-200">{money(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-6 rounded-2xl border border-white/10 bg-[#0d1912] p-5 sm:p-6">
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-lime-300">PAYOUT DESTINATION</p>
                <h2 className="mt-2 text-lg font-semibold">Your receiving details</h2>
              </div>

              {!payout ? (
                <div className="rounded-xl border border-yellow-400/15 bg-yellow-400/[0.05] p-4">
                  <p className="text-sm text-yellow-200">You have not added payout details yet.</p>
                  <Link href="/dashboard/account-setup" className="mt-3 inline-flex text-sm font-semibold text-lime-300 hover:text-lime-200">
                    Set up payout details →
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  {payout.payoutMethod === "BANK" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{payout.bankName}</p>
                          <p className="mt-1 text-xs text-gray-400">{payout.accountName}</p>
                        </div>
                        <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-[10px] font-bold text-lime-300">
                          {payout.payoutCurrency || "BANK"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">Account: {payout.accountNumber}</p>
                      <p className="mt-1 text-xs text-gray-500">{payout.countryName}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">{payout.cryptoNetwork}</p>
                      <p className="mt-2 break-all text-xs text-gray-400">{payout.walletAddress}</p>
                    </>
                  )}
                  <Link href="/dashboard/account-setup" className="mt-3 inline-flex text-xs font-medium text-lime-300 hover:text-lime-200">
                    Change payout details →
                  </Link>
                </div>
              )}
            </section>

            {payout && (
              <section className="rounded-2xl border border-white/10 bg-[#0d1912] p-5 sm:p-6">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-lime-300">WITHDRAWAL REQUEST</p>
                  <h2 className="mt-2 text-lg font-semibold">Your eligible earnings</h2>
                  <p className="mt-1 text-xs leading-5 text-gray-400">Each wallet has its own minimum. All wallets that qualify will be combined into one withdrawal.</p>
                </div>

                <form onSubmit={submitWithdrawal} className="space-y-5">
                  <div className="space-y-3">
                    {eligibleBalances.map((item) => (
                      <div key={item.key} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.label}</p>
                            <p className="mt-1 text-[11px] text-gray-500">Minimum: {money(item.minimum)}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${
                            item.eligible
                              ? "border-lime-400/20 bg-lime-400/10 text-lime-300"
                              : "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
                          }`}>
                            {item.eligible ? "Eligible" : "Not yet eligible"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">Current balance</span>
                          <span className="text-sm font-semibold text-white">{money(item.value)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">Withdrawal amount</span>
                          <span className={`text-sm font-bold ${item.eligible ? "text-lime-300" : "text-gray-500"}`}>
                            {money(item.withdrawal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-lime-300/20 bg-lime-300/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-400">Total eligible withdrawal</span>
                      <span className="text-xl font-bold text-lime-300">{money(totalEligible)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <span className="text-xs text-gray-400">Below-minimum balance (untouched)</span>
                      <span className="text-sm font-semibold text-white">{money(lockedBalance)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-400">Estimated local payout</span>
                      <span className="text-[10px] font-semibold text-lime-300">
                        {payout.payoutMethod === "BANK" ? payout.payoutCurrency : "EUR"}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-lime-300">
                      {payout.payoutMethod === "BANK"
                        ? rateLoading
                          ? "Loading rate..."
                          : rate && totalEligible > 0
                            ? localMoney(convertedAmount)
                            : "—"
                        : totalEligible > 0
                          ? money(totalEligible)
                          : "—"}
                    </p>

                    {payout.payoutMethod === "BANK" && (
                      <div className="mt-2 text-[11px] text-gray-500">
                        {rate?.rate ? (
                          <>
                            1 EUR = {rate.rate.toLocaleString()} {rate.currency}
                            <p className="mt-1">Rate updated: {rate.updatedAt || "Time unavailable"}</p>
                          </>
                        ) : rateError ? (
                          <span className="text-yellow-300">{rateError}</span>
                        ) : (
                          "Waiting for exchange rate..."
                        )}
                      </div>
                    )}

                    {payout.payoutMethod === "CRYPTO" && (
                      <p className="mt-1 text-[11px] text-gray-500">EUR reference amount. Crypto conversion is determined by your payout provider.</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-400">Withdrawal coupon code</label>
                    <input
                      required
                      type="text"
                      autoComplete="off"
                      maxLength={14}
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                      placeholder="SD-123-456-789"
                      className="w-full rounded-xl border border-white/10 bg-[#101b16] px-4 py-3.5 text-sm font-semibold tracking-wider text-white outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-600 focus:border-lime-400/60"
                    />
                    <p className="mt-2 text-[11px] text-gray-500">Each coupon can only be used once and expires 20 days after generation.</p>
                  </div>

                  {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
                  {message && <p className="rounded-xl border border-lime-400/20 bg-lime-400/10 p-3 text-sm text-lime-300">{message}</p>}

                  {customerServiceUrl && (
                    <a
                      href={customerServiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="withdraw-support-card group relative block overflow-hidden rounded-2xl border border-lime-300/30 p-4 transition duration-300 hover:-translate-y-1 hover:border-lime-300/60"
                    >
                      <span className="withdraw-support-glow" />
                      <span className="relative flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-300/15 text-xl text-lime-300">✦</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-white">Need a withdrawal coupon?</span>
                          <span className="mt-1 block text-xs text-gray-300">Contact our support team for assistance.</span>
                        </span>
                        <span className="text-lg font-semibold text-lime-300 transition-transform duration-300 group-hover:translate-x-1">↗</span>
                      </span>
                      <span className="relative mt-3 flex items-center gap-2 text-xs font-bold text-lime-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-lime-300" />
                        Contact Customer Service
                      </span>
                    </a>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || totalEligible <= 0 || !payout || (payout.payoutMethod === "BANK" && !rate)}
                    className="w-full rounded-xl bg-gradient-to-r from-lime-400 to-green-400 py-4 text-sm font-bold text-[#07100c] shadow-lg shadow-lime-400/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Processing request..." : totalEligible <= 0 ? "No eligible wallet balances" : "Withdraw All Eligible Earnings"}
                  </button>
                </form>
              </section>
            )}

            <section className="mt-7">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Withdrawal history</h2>
                <span className="text-xs text-gray-500">{withdrawals.length} requests</span>
              </div>

              {withdrawals.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0d1912] p-8 text-center">
                  <p className="text-sm text-gray-400">No withdrawal requests yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((item) => {
                    const details = item.payoutDetails || {};
                    const currency = typeof details.payoutCurrency === "string" ? details.payoutCurrency : "";
                    const converted = typeof details.convertedAmount === "number" ? details.convertedAmount : null;

                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1912] p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.walletType === "COMBINED" ? "Combined withdrawal" : `${item.walletType} Wallet`}</p>
                          <p className="mt-1 text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.payoutMethod === "BANK" ? "Bank transfer" : "Crypto wallet"}</p>
                          {converted !== null && currency && (
                            <p className="mt-1 text-xs text-lime-300">Estimated payout: {currency} {converted.toFixed(2)}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold">{money(item.amount)}</p>
                          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusStyle(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}