"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    setRegistered(new URLSearchParams(window.location.search).get("registered") === "true");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Login failed. Please try again.");
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page login-page">
      <div className="auth-glow" />

      <section className="auth-card login-card">
        <Link href="/" className="auth-brand">
          <span className="auth-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>

        <p className="auth-eyebrow">WELCOME BACK</p>
        <h1>Good to see you <span>again.</span></h1>
        <p className="auth-description">
          Log in to continue your earning journey.
        </p>

        {registered && (
          <p className="auth-success" role="status">
            Your account has been created successfully. Please log in.
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="identifier">Email or Username</label>
          <input id="identifier" name="identifier" type="text"
            placeholder="Enter your email or username"
            autoComplete="username" required />

          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input id="password" name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password" required />
            <button type="button" className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
            {!loading && <span aria-hidden="true">↗</span>}
          </button>
        </form>

        <p className="auth-switch">
          New to StreamDao? <Link href="/register">Create an account</Link>
        </p>
      </section>

      <footer className="auth-footer">
        Simple ways to earn more. © 2026 StreamDao
      </footer>
    </main>
  );
}