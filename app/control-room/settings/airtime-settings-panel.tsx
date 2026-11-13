"use client";

import { useEffect, useState } from "react";
import {
  Activity, CheckCircle2, CircleAlert, RefreshCw,
  Save, Smartphone, Wifi, Zap
} from "lucide-react";

type Settings = {
  airtimeEnabled: boolean;
  dataEnabled: boolean;
  mtnEnabled: boolean;
  airtelEnabled: boolean;
  gloEnabled: boolean;
  nineMobileEnabled: boolean;
  minimumAmountNgn: number;
  maximumAmountNgn: number;
  minimumDataAmountNgn: number;
  maximumDataAmountNgn: number;
  markupPercent: number;
  exchangeRateSource: "EXCHANGE_RATE_API" | "MANUAL";
  exchangeRateOverride: number | null;
};

const defaults: Settings = {
  airtimeEnabled: false,
  dataEnabled: false,
  mtnEnabled: true,
  airtelEnabled: true,
  gloEnabled: true,
  nineMobileEnabled: true,
  minimumAmountNgn: 50,
  maximumAmountNgn: 50000,
  minimumDataAmountNgn: 50,
  maximumDataAmountNgn: 50000,
  markupPercent: 0,
  exchangeRateSource: "EXCHANGE_RATE_API",
  exchangeRateOverride: null,
};

const networks = [
  { key: "mtnEnabled", name: "MTN", color: "#f5c542" },
  { key: "airtelEnabled", name: "Airtel", color: "#ed5555" },
  { key: "gloEnabled", name: "Glo", color: "#67d68a" },
  { key: "nineMobileEnabled", name: "9mobile", color: "#70cfa0" },
] as const;

export default function AirtimeSettingsPanel() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/airtime-settings", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load settings.");
        }

        setSettings({ ...defaults, ...result.settings });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/airtime-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (!response.ok) {
        const details = result.details
          ? Object.values(result.details).flat().join(" ")
          : "";
        throw new Error(details || result.error || "Unable to save settings.");
      }

      setSettings({ ...defaults, ...result.settings });
      setSuccess("Your Airtime and Data settings have been saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function Toggle({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
  }) {
    return (
      <div className="airtime-toggle-row">
        <div>
          <strong>{label}</strong>
          <span>{description}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className={`airtime-switch ${checked ? "is-on" : ""}`}
          onClick={() => onChange(!checked)}
        >
          <span />
        </button>
      </div>
    );
  }

  function NumberField({
    label,
    value,
    onChange,
    suffix = "NGN",
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    suffix?: string;
  }) {
    return (
      <label className="airtime-field">
        <span>{label}</span>
        <div className="airtime-input-wrap">
          <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <small>{suffix}</small>
        </div>
      </label>
    );
  }

  if (loading) {
    return (
      <section className="airtime-settings-card airtime-loading">
        <RefreshCw className="airtime-spin" size={20} />
        Loading Airtime and Data settings...
      </section>
    );
  }

  return (
    <section className="airtime-settings-card">
      <div className="airtime-panel-heading">
        <div className="airtime-panel-icon"><Smartphone size={23} /></div>
        <div>
          <span className="settings-admin-eyebrow">SERVICE MANAGEMENT</span>
          <h2>Airtime & Data Operations</h2>
          <p>Control availability, network access and purchase pricing.</p>
        </div>
      </div>

      {error && (
        <div className="airtime-feedback airtime-error">
          <CircleAlert size={17} /> {error}
        </div>
      )}

      {success && (
        <div className="airtime-feedback airtime-success">
          <CheckCircle2 size={17} /> {success}
        </div>
      )}

      <div className="airtime-section">
        <div className="airtime-section-title">
          <Zap size={18} />
          <div>
            <h3>Service availability</h3>
            <p>Switch each service on or off across the platform.</p>
          </div>
        </div>

        <div className="airtime-toggle-grid">
          <Toggle
            label="Airtime purchases"
            description="Allow users to buy airtime."
            checked={settings.airtimeEnabled}
            onChange={(v) => update("airtimeEnabled", v)}
          />
          <Toggle
            label="Data purchases"
            description="Allow users to buy data bundles."
            checked={settings.dataEnabled}
            onChange={(v) => update("dataEnabled", v)}
          />
        </div>
      </div>

      <div className="airtime-section">
        <div className="airtime-section-title">
          <Wifi size={18} />
          <div>
            <h3>Network availability</h3>
            <p>Choose which mobile networks users can purchase from.</p>
          </div>
        </div>

        <div className="airtime-network-grid">
          {networks.map((network) => (
            <div className="airtime-network-card" key={network.key}>
              <div className="airtime-network-name">
                <span style={{ background: network.color }} />
                <strong>{network.name}</strong>
              </div>
              <Toggle
                label={network.name}
                description={settings[network.key] ? "Network enabled" : "Network disabled"}
                checked={settings[network.key]}
                onChange={(v) => update(network.key, v)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="airtime-section">
        <div className="airtime-section-title">
          <Activity size={18} />
          <div>
            <h3>Purchase limits</h3>
            <p>Set the allowed transaction amount for each service.</p>
          </div>
        </div>

        <div className="airtime-fields-grid">
          <NumberField
            label="Minimum airtime purchase"
            value={settings.minimumAmountNgn}
            onChange={(v) => update("minimumAmountNgn", v)}
          />
          <NumberField
            label="Maximum airtime purchase"
            value={settings.maximumAmountNgn}
            onChange={(v) => update("maximumAmountNgn", v)}
          />
          <NumberField
            label="Minimum data purchase"
            value={settings.minimumDataAmountNgn}
            onChange={(v) => update("minimumDataAmountNgn", v)}
          />
          <NumberField
            label="Maximum data purchase"
            value={settings.maximumDataAmountNgn}
            onChange={(v) => update("maximumDataAmountNgn", v)}
          />
        </div>
      </div>

      <div className="airtime-section">
        <div className="airtime-section-title">
          <Activity size={18} />
          <div>
            <h3>Pricing and exchange rate</h3>
            <p>Configure your markup and NGN to EUR conversion source.</p>
          </div>
        </div>

        <div className="airtime-fields-grid">
          <NumberField
            label="Markup percentage"
            value={settings.markupPercent}
            suffix="%"
            onChange={(v) => update("markupPercent", v)}
          />

          <label className="airtime-field">
            <span>Exchange rate source</span>
            <select
              value={settings.exchangeRateSource}
              onChange={(event) => {
                const source = event.target.value as Settings["exchangeRateSource"];
                update("exchangeRateSource", source);
              }}
            >
              <option value="EXCHANGE_RATE_API">Automatic exchange rate</option>
              <option value="MANUAL">Manual exchange rate</option>
            </select>
          </label>

          {settings.exchangeRateSource === "MANUAL" && (
            <NumberField
              label="NGN per EUR"
              value={settings.exchangeRateOverride ?? 0}
              suffix="NGN / EUR"
              onChange={(v) => update("exchangeRateOverride", v)}
            />
          )}
        </div>
        <p className="airtime-pricing-note">
          Automatic mode uses the platform exchange-rate provider.
          Manual mode uses your configured NGN-per-EUR rate.
        </p>
      </div>

      <div className="airtime-save-row">
        <span>Changes are applied when saved.</span>
        <button
          type="button"
          className="settings-primary-button"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <RefreshCw size={17} className="airtime-spin" />
          ) : (
            <Save size={17} />
          )}
          {saving ? "Saving settings..." : "Save all settings"}
        </button>
      </div>
    </section>
  );
}
