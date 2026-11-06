
"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!phone) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          username: form.get("username"),
          email: form.get("email"),
          phone,
          password: form.get("password"),
          referralCode: form.get("referralCode"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Registration failed. Please try again.");
        return;
      }

      window.location.assign("/login?registered=true");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page register-page">
      <div className="auth-glow" />

      <section className="auth-card register-card">
        <Link href="/" className="auth-brand">
          <span className="auth-icon">S</span>
          <span>stream<span>dao</span></span>
        </Link>

        <p className="auth-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h1>Create your <span>account.</span></h1>
        <p className="auth-description">
          Join StreamDao and discover more ways to earn.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />

          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Choose a username"
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            required
          />

          <label htmlFor="phone">Phone Number</label>
          <div className="phone-input-wrap">
            <Suspense fallback={<div className="phone-loading">Loading phone input...</div>}>
              <PhoneInput
                defaultCountry="ng"
                value={phone}
                onChange={(value) => setPhone(value)}
                placeholder="Enter phone number"
                disableDialCodeAndPrefix={false}
              />
            </Suspense>
          </div>

          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label htmlFor="referralCode">
            Referral Code <span className="optional-label">(optional)</span>
          </label>
          <input
            id="referralCode"
            name="referralCode"
            type="text"
            placeholder="Enter referral code"
          />

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
            {!loading && <span aria-hidden="true">↗</span>}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>

      <footer className="auth-footer">
        Simple ways to earn more. © 2026 StreamDao
      </footer>
    </main>
  );
}
