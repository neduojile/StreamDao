"use client";

import { useState, useRef, useEffect } from "react";

type EarningsCard = {
  title: string;
  amount: number;
  subtitle: string;
  theme: string;
};

export default function EarningsCardCarousel({
  cards,
}: {
  cards: EarningsCard[];
}) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState("from-right");
  const pointerStart = useRef<number | null>(null);

  function next() {
    setDirection("from-right");
    setActive((current) => (current + 1) % cards.length);
  }

  function previous() {
    setDirection("from-left");
    setActive((current) => (current - 1 + cards.length) % cards.length);
  }

  // Continuous automatic movement every 3 seconds.
  useEffect(() => {
  if (cards.length < 2) return;

  let shown = 0;

  const timer = window.setInterval(() => {
    if (shown >= cards.length - 1) {
      window.clearInterval(timer);
      return;
    }

    setDirection("from-right");
    setActive((current) => (current + 1) % cards.length);
    shown += 1;
  }, 5000);

  return () => window.clearInterval(timer);
}, [cards.length]);

  const card = cards[active];

  const balance = new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
  }).format(card.amount);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return;

    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;

    if (Math.abs(distance) > 40) {
      if (distance < 0) {
        next();
      } else {
        previous();
      }
    }
  }

  return (
    <div className="earnings-carousel">
      <div
        key={card.title}
        className={`premium-bank-card ${card.theme} card-${direction}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <div className="bank-card-top">
          <div className="bank-card-brand">
            <span className="bank-card-logo">S</span>
            <span>STREAM<span>DAO</span></span>
          </div>
          <span className="bank-card-type">PREMIUM MEMBER</span>
        </div>

        <div className="bank-card-chip-row">
          <div className="bank-card-chip">
            <span /><span /><span />
            <span /><span /><span />
          </div>
          <span className="bank-card-contactless">)))</span>
        </div>

        <div className="bank-card-balance">
          <span>{card.title.toUpperCase()}</span>
          <strong>{balance}</strong>
          <small>{card.subtitle}</small>
        </div>

        <div className="bank-card-bottom">
          <div>
            <span>CARD HOLDER</span>
            <strong>STREAMDAO MEMBER</strong>
          </div>
          <div className="bank-card-mark">
            <i /><i />
          </div>
        </div>

        <div className="bank-card-shine" />
      </div>

      <div className="card-carousel-controls">
        <button type="button" onClick={previous} aria-label="Previous card">‹</button>

        <div className="card-indicators">
          {cards.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={index === active ? "selected" : ""}
              onClick={() => {
                setDirection(index >= active ? "from-right" : "from-left");
                setActive(index);
              }}
              aria-label={`Show ${item.title}`}
            />
          ))}
        </div>

        <span className="card-counter">
          {String(active + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
        </span>

        <button type="button" onClick={next} aria-label="Next card">›</button>
      </div>

      <p className="card-swipe-hint">SWIPE TO EXPLORE YOUR EARNINGS</p>
    </div>
  );
}