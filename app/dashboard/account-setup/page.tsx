"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PayoutProfile = {
  payoutMethod: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  countryCode: string | null;
  countryName: string | null;
  payoutCurrency: string | null;
  cryptoNetwork: string | null;
  walletAddress: string | null;
};

export default function AccountSetupPage() {
  const [method, setMethod] = useState("BANK");
  const [form, setForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    bankCode: "",
    countryCode: "NG",
    countryName: "Nigeria",
    payoutCurrency: "NGN",
    cryptoNetwork: "",
    walletAddress: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account-setup")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load details");

        const profile = data.profile as PayoutProfile | null;
        if (profile) {
          setMethod(profile.payoutMethod);
          setForm({
            bankName: profile.bankName ?? "",
            accountName: profile.accountName ?? "",
            accountNumber: profile.accountNumber ?? "",
            bankCode: profile.bankCode ?? "",
            countryCode: profile.countryCode ?? "NG",
            countryName: profile.countryName ?? "Nigeria",
            payoutCurrency: profile.payoutCurrency ?? "NGN",
            cryptoNetwork: profile.cryptoNetwork ?? "",
            walletAddress: profile.walletAddress ?? "",
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/account-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutMethod: method, ...form }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save details");

      setMessage("Your payout details have been saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-[#101b16] px-4 py-3 text-sm text-white outline-none transition focus:border-lime-400/60";
  const labelClass = "mb-2 block text-xs font-medium text-gray-400";

  const countries = [
    { name: "Nigeria", code: "NG", currency: "NGN" },
    { name: "Ghana", code: "GH", currency: "GHS" },
    { name: "Kenya", code: "KE", currency: "KES" },
    { name: "Egypt", code: "EG", currency: "EGP" },
    { name: "South Africa", code: "ZA", currency: "ZAR" },
    { name: "Cameroon", code: "CM", currency: "XAF" },
    { name: "Zambia", code: "ZM", currency: "ZMW" },
  ];

  return (
    <main className="min-h-screen bg-[#07100c] px-4 pb-28 pt-7 text-white md:px-8 md:pb-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard/profile" className="mb-7 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-lime-300">
          ← Back to Profile
        </Link>

        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">Payment settings</p>
          <h1 className="text-2xl font-semibold tracking-tight">Account Setup</h1>
          <p className="mt-2 text-sm text-gray-400">Choose where you want to receive your StreamDao withdrawals.</p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0d1912] p-5 shadow-xl sm:p-7">
          <div className="mb-6 grid grid-cols-2 gap-3">
            {[
              { id: "BANK", title: "Bank Transfer", detail: "Receive funds in your bank" },
              { id: "CRYPTO", title: "Crypto Wallet", detail: "Receive funds in your wallet" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  method === item.id
                    ? "border-lime-400/60 bg-lime-400/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-1 block text-xs text-gray-500">{item.detail}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading your payout details...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {method === "BANK" ? (
                <>
                  <div>
                    <label className={labelClass}>Country</label>
                    <select
                      required
                      className={inputClass}
                      value={form.countryCode ?? "NG"}
                      onChange={(e) => {
                        const selected = countries.find(
                          (country) => country.code === e.target.value
                        );
                        if (selected) {
                          setForm((current) => ({
                            ...current,
                            countryCode: selected.code,
                            countryName: selected.name,
                            payoutCurrency: selected.currency,
                          }));
                        }
                      }}
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name} ({country.currency})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-lime-300">
                      Payout currency: {form.payoutCurrency || "NGN"}
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>Bank Name</label>
                    <input required className={inputClass} value={form.bankName} onChange={(e) => updateField("bankName", e.target.value)} placeholder="Enter bank name" />
                  </div>
                  <div>
                    <label className={labelClass}>Account Name</label>
                    <input required className={inputClass} value={form.accountName} onChange={(e) => updateField("accountName", e.target.value)} placeholder="Name on your bank account" />
                  </div>
                  <div>
                    <label className={labelClass}>Account Number</label>
                    <input required inputMode="numeric" className={inputClass} value={form.accountNumber} onChange={(e) => updateField("accountNumber", e.target.value)} placeholder="Enter account number" />
                  </div>
                  <div>
                    <label className={labelClass}>Bank Code <span className="text-gray-600">(Optional)</span></label>
                    <input className={inputClass} value={form.bankCode} onChange={(e) => updateField("bankCode", e.target.value)} placeholder="Enter bank code if required" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Network</label>
                    <select required className={inputClass} value={form.cryptoNetwork} onChange={(e) => updateField("cryptoNetwork", e.target.value)}><option value="">Select a network</option><option value="Bitcoin (BTC)">Bitcoin (BTC)</option><option value="Ethereum (ERC-20)">Ethereum (ERC-20)</option><option value="BNB Smart Chain (BEP-20)">BNB Smart Chain (BEP-20)</option><option value="TRON (TRC-20)">TRON (TRC-20)</option><option value="Solana">Solana</option><option value="Polygon (POL)">Polygon (POL)</option><option value="Arbitrum One">Arbitrum One</option><option value="Base">Base</option><option value="Avalanche C-Chain">Avalanche C-Chain</option><option value="Optimism">Optimism</option></select>
                  </div>
                  <div>
                    <label className={labelClass}>Wallet Address</label>
                    <textarea required rows={3} className={inputClass} value={form.walletAddress} onChange={(e) => updateField("walletAddress", e.target.value)} placeholder="Enter your wallet address" />
                  </div>
                </>
              )}

              {message && <p className="rounded-xl border border-lime-400/20 bg-lime-400/10 p-3 text-sm text-lime-300">{message}</p>}
              {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}

              <button disabled={saving} className="w-full rounded-xl bg-gradient-to-r from-lime-400 to-green-400 py-3.5 text-sm font-bold text-[#07100c] transition hover:brightness-110 disabled:opacity-50">
                {saving ? "Saving..." : "Save Payout Details"}
              </button>
            </form>
          )}
        </section>

        <p className="mt-4 text-center text-xs leading-5 text-gray-500">
          Always double-check your payout information. Incorrect details may delay your withdrawal.
        </p>
      </div>
    </main>
  );
}