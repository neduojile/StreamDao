"use client";

import { useState } from "react";
import { Activity, RefreshCw, Search } from "lucide-react";

type Network = "mtn" | "airtel" | "glo" | "9mobile";
type Service = "airtime" | "data";
type DataType = "sme" | "cg" | "direct";

export default function TopupWizardPricingPanel() {
  const [network, setNetwork] = useState<Network>("mtn");
  const [service, setService] = useState<Service>("airtime");
  const [dataType, setDataType] = useState<DataType>("sme");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  async function lookupPricing() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/topupwizard/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: service,
          typeSingle: network,
          ...(service === "data" ? { dataType } : {}),
        }),
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Pricing lookup failed.");
      }

      setResult(data.pricing ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve pricing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="settings-pricing-card">
      <div className="settings-pricing-heading">
        <div>
          <span className="settings-admin-eyebrow">PROVIDER CATALOG</span>
          <h2>Service pricing</h2>
          <p>Retrieve actual airtime and data services from TopupWizard.</p>
        </div>
        <Activity size={22} />
      </div>

      <div className="settings-pricing-fields">
        <label>
          Network
          <select value={network} onChange={(e) => setNetwork(e.target.value as Network)}>
            <option value="mtn">MTN</option>
            <option value="airtel">Airtel</option>
            <option value="glo">Glo</option>
            <option value="9mobile">9mobile</option>
          </select>
        </label>

        <label>
          Service
          <select value={service} onChange={(e) => setService(e.target.value as Service)}>
            <option value="airtime">Airtime</option>
            <option value="data">Data</option>
          </select>
        </label>

        {service === "data" && (
          <label>
            Data category
            <select value={dataType} onChange={(e) => setDataType(e.target.value as DataType)}>
              <option value="sme">SME</option>
              <option value="cg">Corporate Gifting</option>
              <option value="direct">Direct</option>
            </select>
          </label>
        )}
      </div>

      <button
        type="button"
        className="settings-primary-button"
        onClick={lookupPricing}
        disabled={loading}
      >
        {loading ? <RefreshCw size={17} className="settings-spin" /> : <Search size={17} />}
        {loading ? "Retrieving provider pricing..." : "Retrieve service pricing"}
      </button>

      {error && <div className="settings-alert settings-alert-error">{error}</div>}

      {result !== null && (
        <div className="settings-pricing-result">
          <strong>TopupWizard response</strong>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}