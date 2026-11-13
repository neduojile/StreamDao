"use client";

import { useCallback, useEffect, useState } from "react";
import TopupWizardPricingPanel from "./topupwizard-pricing-panel";
import AirtimeSettingsPanel from "./airtime-settings-panel";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react";

type ProviderSettings = {
  configured: boolean;
  maskedToken: string;
  updatedAt: string | null;
};

type ConnectionResult = {
  success?: boolean;
  connected?: boolean;
  balance?: unknown;
  message?: string;
  error?: string;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncResult, setSyncResult] = useState<{
    total: number;
    active: number;
    inactive: number;
    created: number;
    updated: number;
    syncedAt: string;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/topupwizard/settings", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to load settings.");

      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (token.trim().length < 8) {
      setError("Enter a valid API token before saving.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/topupwizard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to save credentials.");

      setToken("");
      setShowToken(false);
      setConnection(null);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save credentials.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setConnection(null);

    try {
      const response = await fetch("/api/admin/topupwizard/test", {
        cache: "no-store",
      });
      const data: ConnectionResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Connection test failed.");
      }

      setConnection(data);
    } catch (err) {
      setConnection({
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function syncCatalog() {
    if (syncing || !settings?.configured) return;

    setSyncing(true);
    setSyncError("");
    setSyncResult(null);

    try {
      const response = await fetch("/api/admin/topupwizard/sync", {
        method: "POST",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Catalog synchronization failed.");
      }

      setSyncResult(data);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : "Unable to synchronize the provider catalog."
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="settings-admin-page">
      <header className="settings-admin-header">
        <div>
          <span className="settings-admin-eyebrow">PLATFORM CONFIGURATION</span>
          <h1>Settings</h1>
          <p>Manage service integrations and operational connections.</p>
        </div>
        <div className="settings-admin-header-icon">
          <Activity size={23} />
        </div>
      </header>

      {error && (
        <div className="settings-alert settings-alert-error">
          <CircleAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="settings-provider-card">
        <div className="settings-provider-heading">
          <div className="settings-provider-brand">
            <div className="settings-provider-logo">
              <Wallet size={23} />
            </div>
            <div>
              <span className="settings-admin-eyebrow">AIRTIME & DATA PROVIDER</span>
              <h2>TopupWizard</h2>
              <p>Provider credentials and account connection</p>
            </div>
          </div>

          <span className={`settings-connection-badge ${
            connection?.connected
              ? "settings-connected"
              : settings?.configured
                ? "settings-configured"
                : "settings-disconnected"
          }`}>
            {connection?.connected ? (
              <><CheckCircle2 size={14} /> Connected</>
            ) : settings?.configured ? (
              <><ShieldCheck size={14} /> Credentials saved</>
            ) : (
              <><WifiOff size={14} /> Not configured</>
            )}
          </span>
        </div>

        <div className="settings-provider-divider" />

        <div className="settings-provider-description">
          <ShieldCheck size={19} />
          <p>
            Your API token is encrypted before storage. It is never sent back
            to the browser after saving.
          </p>
        </div>

        {loading ? (
          <div className="settings-loading">
            <RefreshCw size={19} className="settings-spin" />
            Loading provider settings...
          </div>
        ) : (
          <>
            <div className="settings-credential-status">
              <div>
                <span>Credential status</span>
                <strong>{settings?.configured ? "API token saved" : "No API token saved"}</strong>
              </div>
              <div>
                <span>Stored credential</span>
                <strong>{settings?.maskedToken || "Not available"}</strong>
              </div>
            </div>

            <form className="settings-token-form" onSubmit={saveToken}>
              <label htmlFor="topup-token">
                {settings?.configured ? "Replace API token" : "TopupWizard API token"}
              </label>
              <div className="settings-token-input-wrap">
                <KeyRound size={18} />
                <input
                  id="topup-token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder={settings?.configured ? "Enter a new token to replace the saved one" : "Paste your API token"}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((value) => !value)}
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button className="settings-primary-button" type="submit" disabled={saving || !token.trim()}>
                {saving ? <RefreshCw size={17} className="settings-spin" /> : <Save size={17} />}
                {saving ? "Saving securely..." : "Save API credentials"}
              </button>
            </form>

            <div className="settings-provider-actions">
              <button
                className="settings-secondary-button"
                type="button"
                onClick={testConnection}
                disabled={testing || !settings?.configured}
              >
                {testing ? (
                  <RefreshCw size={17} className="settings-spin" />
                ) : (
                  <Wifi size={17} />
                )}
                {testing ? "Testing connection..." : "Test connection & refresh balance"}
              </button>
            </div>

            {connection && (
              <div className={`settings-test-result ${
                connection.connected ? "settings-test-success" : "settings-test-failure"
              }`}>
                {connection.connected ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <CircleAlert size={19} />
                )}
                <div>
                  <strong>{connection.connected ? "Connection successful" : "Connection failed"}</strong>
                  <p>{connection.message || connection.error}</p>
                </div>
              </div>
            )}

            {connection?.connected && (
              <div className="settings-balance-card">
                <div className="settings-balance-icon"><Wallet size={20} /></div>
                <div>
                  <span>Provider wallet balance</span>
                  <strong>
                    {connection.balance === null || connection.balance === undefined
                      ? "Balance unavailable"
                      : typeof connection.balance === "object"
                        ? JSON.stringify(connection.balance)
                        : String(connection.balance)}
                  </strong>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <AirtimeSettingsPanel />
      <TopupWizardPricingPanel />

      <section className="settings-catalog-sync">
        <div className="settings-catalog-heading">
          <div>
            <span className="settings-admin-eyebrow">PROVIDER CATALOG</span>
            <h3>Data plan synchronization</h3>
            <p>
              Import the latest available data plans, service IDs,
              provider prices and availability.
            </p>
          </div>

          <div className="settings-catalog-icon">
            <Activity size={21} />
          </div>
        </div>

        <button
          className="settings-primary-button settings-catalog-button"
          type="button"
          onClick={syncCatalog}
          disabled={syncing || !settings?.configured}
        >
          {syncing ? (
            <RefreshCw size={17} className="settings-spin" />
          ) : (
            <RefreshCw size={17} />
          )}
          {syncing ? "Synchronizing catalog..." : "Sync provider catalog"}
        </button>

        {!settings?.configured && (
          <p className="settings-catalog-note">
            Save your TopupWizard API credentials before synchronizing.
          </p>
        )}

        {syncError && (
          <div className="settings-alert settings-alert-error settings-sync-feedback">
            <CircleAlert size={18} />
            <span>{syncError}</span>
          </div>
        )}

        {syncResult && (
          <>
            <div className="settings-catalog-success">
              <CheckCircle2 size={18} />
              <span>Provider catalog synchronized successfully.</span>
            </div>

            <div className="settings-catalog-stats">
              <div>
                <span>Total plans</span>
                <strong>{syncResult.total}</strong>
              </div>
              <div>
                <span>Active plans</span>
                <strong>{syncResult.active}</strong>
              </div>
              <div>
                <span>Inactive plans</span>
                <strong>{syncResult.inactive}</strong>
              </div>
              <div>
                <span>New plans</span>
                <strong>{syncResult.created}</strong>
              </div>
              <div>
                <span>Updated plans</span>
                <strong>{syncResult.updated}</strong>
              </div>
            </div>

            <p className="settings-catalog-note">
              Last synchronization: {new Date(syncResult.syncedAt).toLocaleString()}
            </p>
          </>
        )}
      </section>

      <section className="settings-coming-soon">
        <div className="settings-coming-icon"><Activity size={21} /></div>
        <div>
          <span className="settings-admin-eyebrow">NEXT INTEGRATION STAGE</span>
          <h3>Airtime operations and giveaways</h3>
          <p>
            User airtime purchases, data plans, admin giveaways, transaction
            tracking and provider balance monitoring will be added after
            the connection is verified.
          </p>
        </div>
      </section>
    </main>
  );
}
