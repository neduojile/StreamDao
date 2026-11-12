"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Headset, Pickaxe, Sparkles, X } from "lucide-react";

type Props = {
  supportUrl: string;
};

export default function HomeWelcomePopup({ supportUrl }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="home-welcome-overlay"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <section
        className="home-welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-welcome-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="home-welcome-close"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close welcome popup"
        >
          <X size={19} />
        </button>

        <div className="home-welcome-glow" />
        <div className="home-welcome-content">
          <div className="home-welcome-icon">
            <Sparkles size={23} />
          </div>

          <span className="home-welcome-eyebrow">WELCOME TO STREAMDAO</span>
          <h2 id="home-welcome-title">
            Your next reward is <span>one click away.</span>
          </h2>
          <p className="home-welcome-description">
            Explore available tasks, earn rewards, and get help whenever you need it.
          </p>

          <Link
            href="/dashboard/mining"
            className="home-welcome-mining"
            onClick={() => setOpen(false)}
          >
            <span className="home-welcome-action-icon"><Pickaxe size={21} /></span>
            <span className="home-welcome-action-copy">
              <strong>Explore Mining Tasks</strong>
              <small>Discover tasks and start earning</small>
            </span>
            <ArrowUpRight size={20} />
          </Link>

          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="home-welcome-support"
          >
            <Headset size={18} />
            Contact Support
            <ArrowUpRight size={16} />
          </a>

          <span className="home-welcome-footnote">
            Your rewards journey starts here.
          </span>
        </div>
      </section>
    </div>
  );
}