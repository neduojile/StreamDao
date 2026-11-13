"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert,
  Clock3, CreditCard, LoaderCircle, RefreshCw, ShieldCheck,
  Smartphone, Wifi, Zap,
} from "lucide-react";
import {
  DashboardSidebarNav,
  DashboardMobileNav,
} from "@/app/dashboard/dashboard-navigation";

type Plan = {
  id: string;
  serviceId: string;
  network: string;
  type: string;
  name: string;
  amountNgn: string;
  validity: string | null;
  description: string | null;
};

type AirtimeData = {
  success: boolean;
  balance: { referralBalance: string; currency: string };
  cooldown: {
    durationHours: number;
    isCoolingDown: boolean;
    lastSuccessfulPurchaseAt: string | null;
    nextPurchaseAt: string | null;
    remainingMs: number;
  };
  purchaseLimitNgn: string | null;
  services: { airtimeEnabled: boolean; dataEnabled: boolean };
  networks: Record<string, boolean>;
  pricing: {
    minimumAmountNgn: string;
    maximumAmountNgn: string;
    minimumDataAmountNgn: string;
    maximumDataAmountNgn: string;
    markupPercent: string;
    exchangeRateSource: string;
    exchangeRateNgnPerEur: number | null;
  };
  plans: Plan[];
};

type Service = "airtime" | "data";
type Network = "mtn" | "airtel" | "glo" | "9mobile";
type DataType = "sme" | "cg" | "direct";

const networks: {
  id: Network;
  name: string;
  short: string;
  color: string;
}[] = [
  { id: "mtn", name: "MTN", short: "MTN", color: "mtn" },
  { id: "airtel", name: "Airtel", short: "A", color: "airtel" },
  { id: "glo", name: "Glo", short: "G", color: "glo" },
  { id: "9mobile", name: "9mobile", short: "9", color: "nine" },
];

const dataTypes: { id: DataType; name: string; detail: string }[] = [
  { id: "sme", name: "SME", detail: "Affordable data bundles" },
  { id: "cg", name: "CG", detail: "Corporate data plans" },
  { id: "direct", name: "Direct", detail: "Direct data delivery" },
];

const money = (value: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);

const naira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);

export default function AirtimeClient({
  fullName,
  username,
}: {
  fullName: string;
  username: string;
}) {
  const [data, setData] = useState<AirtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [service, setService] = useState<Service>("airtime");
  const [network, setNetwork] = useState<Network>("mtn");
  const [dataType, setDataType] = useState<DataType>("sme");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseRequestId, setPurchaseRequestId] = useState<string | null>(null);
  const [purchaseRequestKey, setPurchaseRequestKey] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);

return () => window.clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/airtime", { cache: "no-store" });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load Airtime services.");
      }

      setData(result);

      const firstAvailable = networks.find(
        (item) => result.networks?.[item.id]
      );

      if (firstAvailable) setNetwork(firstAvailable.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load Airtime services."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableNetworks = networks.filter(
    (item) => data?.networks?.[item.id]
  );

  const filteredPlans = useMemo(
    () =>
      data?.plans.filter(
        (plan) =>
          plan.network.toLowerCase() === network &&
          plan.type.toLowerCase() === dataType
      ) ?? [],
    [data, network, dataType]
  );

  const selectedAmount =
    service === "airtime"
      ? Number(amount)
      : Number(selectedPlan?.amountNgn ?? 0);

  const markup = Number(data?.pricing.markupPercent ?? 0);
  const exchangeRate = data?.pricing.exchangeRateNgnPerEur ?? null;
  const totalNgn = selectedAmount * (1 + markup / 100);
  const totalEur =
    exchangeRate && exchangeRate > 0 ? totalNgn / exchangeRate : null;

  const cooldownEnd = data?.cooldown.nextPurchaseAt
    ? Date.parse(data.cooldown.nextPurchaseAt)
    : 0;

  const cooldownRemainingMs = Math.max(0, cooldownEnd - currentTime);
  const isCoolingDown = cooldownRemainingMs > 0;

  const cooldownHours = Math.floor(cooldownRemainingMs / 3600000);
  const cooldownMinutes = Math.floor((cooldownRemainingMs % 3600000) / 60000);
  const cooldownSeconds = Math.floor((cooldownRemainingMs % 60000) / 1000);

  const cooldownClock = [
    String(cooldownHours).padStart(2, "0"),
    String(cooldownMinutes).padStart(2, "0"),
    String(cooldownSeconds).padStart(2, "0"),
  ].join(":");

  const balance = Number(data?.balance.referralBalance ?? 0);
  const limit = data?.purchaseLimitNgn
    ? Number(data.purchaseLimitNgn)
    : Number(
        service === "airtime"
          ? data?.pricing.maximumAmountNgn
          : data?.pricing.maximumDataAmountNgn
      );

  const minimum = Number(
    service === "airtime"
      ? data?.pricing.minimumAmountNgn
      : data?.pricing.minimumDataAmountNgn
  );

  const maximum = Math.min(
    limit,
    Number(
      service === "airtime"
        ? data?.pricing.maximumAmountNgn
        : data?.pricing.maximumDataAmountNgn
    )
  );

  const phoneDigits = phone.replace(/\D/g, "");
  const validPhone =
    /^0[789][01]\d{8}$/.test(phoneDigits) ||
    /^234[789][01]\d{8}$/.test(phoneDigits);

  const serviceEnabled =
    service === "airtime"
      ? data?.services.airtimeEnabled
      : data?.services.dataEnabled;

  const canReview =
    Boolean(data) &&
    Boolean(serviceEnabled) &&
    availableNetworks.some((item) => item.id === network) &&
    validPhone &&
    selectedAmount >= minimum &&
    selectedAmount <= maximum &&
    totalEur !== null &&
    totalEur <= balance &&
    !isCoolingDown &&
    (service === "airtime" || Boolean(selectedPlan));

    async function submitPurchase() {
    if (!canReview || purchaseLoading) return;

    const payload = {
      service,
      network,
      phoneNumber: phone,
      ...(service === "airtime"
        ? { amountNgn: selectedAmount }
        : { serviceId: selectedPlan?.serviceId }),
    };

    const requestKey = JSON.stringify(payload);
    const requestId =
      purchaseRequestKey === requestKey && purchaseRequestId
        ? purchaseRequestId
        : window.crypto.randomUUID();

    setPurchaseRequestId(requestId);
    setPurchaseRequestKey(requestKey);
    setPurchaseLoading(true);
    setPurchaseError("");
    setPurchaseMessage("");

    try {
      const response = await fetch("/api/airtime/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...payload }),
      });

      const result = await response.json().catch(() => ({}));
      const orderStatus = String(
        result?.order?.status ?? result?.status ?? ""
      ).toUpperCase();

      if (!response.ok) {
        setPurchaseError(
          result?.message ||
          result?.error ||
          "The purchase could not be confirmed. Refresh your balance before trying again."
        );
      } else if (orderStatus === "SUCCESS") {
        setPurchaseMessage(
          "Your purchase has been confirmed successfully."
        );
      } else if (orderStatus === "FAILED") {
        setPurchaseMessage(
          "The provider reported a failed purchase. Check your Referral Balance for the refund."
        );
      } else {
        setPurchaseMessage(
          "Your purchase is being processed. Do not submit another order while this one is pending."
        );
      }

      await loadData();
    } catch {
      setPurchaseError(
        "We could not confirm the provider response. Your request reference has been preserved. Do not create a new order; retry only with the same order details."
      );
    } finally {
      setPurchaseLoading(false);
    }
  }
      function changeService(next: Service) {
    setService(next);
    setReviewOpen(false);
    setAmount("");
    setSelectedPlan(null);
  }

  function changeNetwork(next: Network) {
    setNetwork(next);
    setSelectedPlan(null);
    setReviewOpen(false);
  }

  return (
    <main className="dashboard-shell airtime-page">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <DashboardSidebarNav />

        <div className="sidebar-divider" />
        <div className="sidebar-label">YOUR ACCOUNT</div>
        <div className="sidebar-account">
          <div className="account-avatar">
            {fullName.trim().charAt(0).toUpperCase()}
          </div>
          <div className="account-info">
            <strong>{fullName}</strong>
            <span>@{username}</span>
          </div>
        </div>

        <form action="/api/auth/logout" method="POST" className="sidebar-logout">
          <button type="submit">Log out</button>
        </form>
        <div className="sidebar-bottom">
          <span className="online-dot" />
          Your account is active
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-breadcrumb">
              YOUR ACCOUNT / AIRTIME & DATA
            </span>
            <h1>Airtime & Data</h1>
          </div>
          <div className="topbar-user">
            <div className="topbar-avatar">
              {fullName.trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{fullName}</strong>
              <span>Member account</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content airtime-content">
          <Link href="/dashboard/profile" className="airtime-back">
            <ArrowLeft size={15} /> Back to profile
          </Link>

          <section className="airtime-hero">
            <div className="airtime-hero-copy">
              <span className="airtime-eyebrow">
                <Zap size={13} /> QUICK MOBILE TOP-UP
              </span>
              <h2>Stay connected.<br />Keep moving.</h2>
              <p>
                Buy airtime and mobile data conveniently using your
                available Referral Balance.
              </p>
              <div className="airtime-hero-note">
                <ShieldCheck size={15} />
                Purchases use Referral Balance only
              </div>
            </div>
            <div className="airtime-hero-art">
              <div className="airtime-art-circle">
                <Smartphone size={65} strokeWidth={1.1} />
                <span className="airtime-art-signal"><Wifi size={22} /></span>
              </div>
              <span className="airtime-art-orbit orbit-one" />
              <span className="airtime-art-orbit orbit-two" />
            </div>
          </section>

          {loading ? (
            <div className="airtime-state">
              <LoaderCircle className="airtime-spinner" size={27} />
              <strong>Loading your services</strong>
              <span>Checking your balance and available networks...</span>
            </div>
          ) : error ? (
            <div className="airtime-state airtime-error">
              <CircleAlert size={27} />
              <strong>Unable to load services</strong>
              <span>{error}</span>
              <button onClick={() => void loadData()}>
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          ) : data ? (
            <>
              <section className="airtime-balance-card">
                <div className="airtime-balance-icon">
                  <CreditCard size={22} />
                </div>
                <div className="airtime-balance-copy">
                  <span>AVAILABLE REFERRAL BALANCE</span>
                  <strong>{money(balance)}</strong>
                  <small>Your usable balance for mobile purchases</small>
                </div>
                <button
                  className="airtime-refresh"
                  onClick={() => void loadData()}
                  aria-label="Refresh balance"
                  title="Refresh balance"
                >
                  <RefreshCw size={17} />
                </button>
              </section>

              <section className="airtime-workspace">
                <div className="airtime-section-heading">
                  <div>
                    <span className="airtime-eyebrow">MAKE A PURCHASE</span>
                    <h2>What would you like to buy?</h2>
                  </div>
                  <span className="airtime-secure-label">
                    <ShieldCheck size={14} /> Secure checkout
                  </span>
                </div>

                <div className="airtime-service-tabs">
                  <button
                    className={service === "airtime" ? "active" : ""}
                    onClick={() => changeService("airtime")}
                  >
                    <Smartphone size={18} />
                    <span>
                      <strong>Airtime</strong>
                      <small>Recharge a phone</small>
                    </span>
                  </button>
                  <button
                    className={service === "data" ? "active" : ""}
                    onClick={() => changeService("data")}
                  >
                    <Wifi size={18} />
                    <span>
                      <strong>Mobile Data</strong>
                      <small>Choose a data bundle</small>
                    </span>
                  </button>
                </div>

                <div className={`airtime-limit-card ${isCoolingDown ? "cooling-down" : "cooldown-ready"}`}>
                  <div className="airtime-limit-icon">
                    {isCoolingDown ? <Clock3 size={20} /> : <ShieldCheck size={20} />}
                  </div>
                  <div className="airtime-limit-copy">
                    <span>ACCOUNT PURCHASE STATUS</span>
                    <strong>
                      {isCoolingDown ? cooldownClock : "Ready to purchase"}
                    </strong>
                    <small>
                      {isCoolingDown
                        ? "Time remaining before your next Airtime or Data purchase"
                        : "You can make an Airtime or Data purchase now"}
                    </small>
                    <small className="airtime-limit-source">
                      One successful purchase every 24 hours across both services
                    </small>
                  </div>
                  <span className="airtime-limit-badge">
                    {isCoolingDown ? "COOLDOWN" : "AVAILABLE"}
                  </span>
                </div>

                {!serviceEnabled ? (
                  <div className="airtime-unavailable">
                    <Clock3 size={23} />
                    <strong>
                      {service === "airtime" ? "Airtime" : "Data"} purchases
                      are currently unavailable
                    </strong>
                    <span>Please check again later.</span>
                  </div>
                ) : (
                  <>
                    <div className="airtime-form-section">
                      <label className="airtime-field-label">
                        01. Select your network
                      </label>
                      <div className="airtime-network-grid">
                        {networks.map((item) => {
                          const enabled = Boolean(data.networks[item.id]);
                          return (
                            <button
                              key={item.id}
                              disabled={!enabled}
                              onClick={() => changeNetwork(item.id)}
                              className={`airtime-network ${item.color} ${
                                network === item.id ? "selected" : ""
                              }`}
                            >
                              <span className="airtime-network-logo">
                                <img
                                  src={`/networks/${item.id}.svg`}
                                  alt={`${item.name} logo`}
                                />
                              </span>
                              <strong>{item.name}</strong>
                              {network === item.id && (
                                <span className="airtime-network-check">
                                  <Check size={12} />
                                </span>
                              )}
                              {!enabled && <small>Unavailable</small>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="airtime-form-section">
                      <label htmlFor="airtime-phone" className="airtime-field-label">
                        02. Recipient phone number
                      </label>
                      <div className="airtime-phone-input">
                        <Smartphone size={19} />
                        <input
                          id="airtime-phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="e.g. 08012345678"
                          value={phone}
                          maxLength={14}
                          onChange={(event) => {
                            setPhone(event.target.value.replace(/[^\d+ ]/g, ""));
                            setReviewOpen(false);
                          }}
                        />
                        {validPhone && <Check size={18} className="airtime-valid" />}
                      </div>
                      <small className="airtime-hint">
                        Enter the Nigerian phone number you want to recharge.
                      </small>
                    </div>

                    {service === "airtime" ? (
                      <div className="airtime-form-section">
                        <label htmlFor="airtime-amount" className="airtime-field-label">
                          03. Enter airtime amount
                        </label>
                        <div className="airtime-amount-input">
                          <span>₦</span>
                          <input
                            id="airtime-amount"
                            type="number"
                            min={minimum}
                            max={maximum}
                            placeholder="Enter amount in NGN"
                            value={amount}
                            onChange={(event) => {
                              setAmount(event.target.value);
                              setReviewOpen(false);
                            }}
                          />
                        </div>
                        <small className="airtime-hint">
                          Minimum {naira(minimum)} · Maximum {naira(maximum)}
                        </small>
                        <div className="airtime-quick-amounts">
                          {[100, 200, 500, 1000, 2000, 5000]
                            .filter((value) => value >= minimum && value <= maximum)
                            .map((value) => (
                              <button
                                key={value}
                                className={Number(amount) === value ? "selected" : ""}
                                onClick={() => {
                                  setAmount(String(value));
                                  setReviewOpen(false);
                                }}
                              >
                                ₦{value.toLocaleString("en-NG")}
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="airtime-form-section">
                          <label className="airtime-field-label">
                            03. Choose data plan category
                          </label>
                          <div className="airtime-data-types">
                            {dataTypes.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setDataType(item.id);
                                  setSelectedPlan(null);
                                  setReviewOpen(false);
                                }}
                                className={dataType === item.id ? "selected" : ""}
                              >
                                <strong>{item.name}</strong>
                                <small>{item.detail}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="airtime-form-section">
                          <label className="airtime-field-label">
                            04. Select your data bundle
                          </label>
                          {filteredPlans.length === 0 ? (
                            <div className="airtime-no-plans">
                              No active plans are currently available for this
                              network and category. Try another category.
                            </div>
                          ) : (
                            <div className="airtime-plan-grid">
                              {filteredPlans.map((plan) => (
                                <button
                                  key={plan.id}
                                  onClick={() => {
                                    setSelectedPlan(plan);
                                    setReviewOpen(false);
                                  }}
                                  className={`airtime-plan ${
                                    selectedPlan?.id === plan.id ? "selected" : ""
                                  }`}
                                >
                                  <span className="airtime-plan-name">{plan.name}</span>
                                  <strong>{naira(Number(plan.amountNgn))}</strong>
                                  {plan.validity && <small>{plan.validity}</small>}
                                  {selectedPlan?.id === plan.id && (
                                    <span className="airtime-plan-check">
                                      <Check size={13} />
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <section className="airtime-summary">
                      <div className="airtime-summary-heading">
                        <span>ORDER SUMMARY</span>
                        <span>EUR billing</span>
                      </div>
                      <div className="airtime-summary-row">
                        <span>{service === "airtime" ? "Airtime value" : "Data bundle"}</span>
                        <strong>{selectedAmount > 0 ? naira(selectedAmount) : "—"}</strong>
                      </div>
                      <div className="airtime-summary-row">
                        <span>Service markup ({markup}%)</span>
                        <strong>{selectedAmount > 0 ? naira(totalNgn - selectedAmount) : "—"}</strong>
                      </div>
                      <div className="airtime-summary-total">
                        <span>Total to pay</span>
                        <strong>{totalEur !== null && selectedAmount > 0 ? money(totalEur) : "—"}</strong>
                      </div>
                      <div className="airtime-summary-note">
                        <ShieldCheck size={15} />
                        Only your Referral Balance will be used.
                      </div>
                    </section>

                    {isCoolingDown && (
                      <div className="airtime-validation">
                        <span>
                          Your account is on a 24-hour purchase cooldown.
                          You can purchase again in {cooldownClock}.
                        </span>
                      </div>
                    )}

                    {selectedAmount > 0 && (
                      <div className="airtime-validation">
                        {selectedAmount < minimum && (
                          <span>Amount is below the minimum purchase value.</span>
                        )}
                        {selectedAmount > maximum && (
                          <span>Amount exceeds your permitted purchase limit.</span>
                        )}
                        {totalEur !== null && totalEur > balance && (
                          <span>Your Referral Balance is insufficient for this purchase.</span>
                        )}
                        {!validPhone && phone.length > 0 && (
                          <span>Enter a valid Nigerian mobile number.</span>
                        )}
                        {exchangeRate === null && (
                          <span>Exchange rate unavailable. Pricing cannot be confirmed.</span>
                        )}
                      </div>
                    )}

                    <button
                      className="airtime-review-button"
                      disabled={!canReview}
                      onClick={() => setReviewOpen((current) => !current)}
                    >
                      {reviewOpen ? "Hide order preview" : "Review purchase"}
                      <ArrowRight size={17} />
                    </button>

                    {reviewOpen && (
                      <div className="airtime-review-panel">
                        <div className="airtime-review-icon">
                          <ShieldCheck size={23} />
                        </div>
                        <h3>Your order preview</h3>
                        <p>
                          Check these details before proceeding. No money has
                          been deducted.
                        </p>
                        <div className="airtime-review-row">
                          <span>Service</span>
                          <strong>{service === "airtime" ? "Airtime" : "Mobile Data"}</strong>
                        </div>
                        <div className="airtime-review-row">
                          <span>Network</span>
                          <strong>{networks.find((item) => item.id === network)?.name}</strong>
                        </div>
                        <div className="airtime-review-row">
                          <span>Phone number</span>
                          <strong>{phone}</strong>
                        </div>
                        {selectedPlan && (
                          <div className="airtime-review-row">
                            <span>Data plan</span>
                            <strong>{selectedPlan.name}</strong>
                          </div>
                        )}
                        <div className="airtime-review-row">
                          <span>Total</span>
                          <strong>{totalEur !== null ? money(totalEur) : "—"}</strong>
                        </div>
                        {purchaseError && (
                          <div className="airtime-validation" role="alert">
                            <CircleAlert size={17} />
                            <span>{purchaseError}</span>
                          </div>
                        )}

                        {purchaseMessage && (
                          <div className="airtime-preview-notice" role="status">
                            <ShieldCheck size={17} />
                            <span>{purchaseMessage}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          className="airtime-review-button"
                          disabled={purchaseLoading}
                          onClick={() => void submitPurchase()}
                        >
                          {purchaseLoading
                            ? "Processing purchase..."
                            : "Confirm and purchase"}
                          {purchaseLoading ? (
                            <LoaderCircle className="airtime-spinner" size={17} />
                          ) : (
                            <ArrowRight size={17} />
                          )}
                        </button>

                        <small className="airtime-hint">
                          Your Referral Balance is charged when you confirm.
                          If the provider response is delayed, your order may remain pending.
                        </small>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="airtime-help-strip">
                <div><ShieldCheck size={19} /></div>
                <p>
                  <strong>Your earnings stay protected.</strong>
                  Mobile purchases are designed to use Referral Balance only.
                  Other StreamDao wallet balances are not included.
                </p>
                <ChevronDown size={17} />
              </section>
            </>
          ) : null}
        </div>
      </section>

      <DashboardMobileNav />
    </main>
  );
}






