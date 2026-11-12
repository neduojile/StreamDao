"use client";

import { useState } from "react";

export default function ReferralActions({ referralLink }: { referralLink: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const message = `Join me on StreamDao and discover simple ways to earn. Sign up using my referral link: ${referralLink}`;

  return (
    <div className="referral-actions">
      <button type="button" className="referral-copy-btn" onClick={copyLink}>
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        className="referral-share-btn"
        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
      >
        Share on WhatsApp
      </a>
    </div>
  );
}