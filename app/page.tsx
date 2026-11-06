import Link from "next/link";

const benefits = [
  { icon: "✦", title: "Complete tasks", text: "Do simple tasks and earn rewards." },
  { icon: "↗", title: "Invite friends", text: "Share your link and earn more." },
  { icon: "◎", title: "Play and earn", text: "Enjoy games and get rewarded." },
];

export default function Home() {
  return (
    <main id="top">
      <nav className="navbar">
  <Link href="/" className="brand">
    <span className="brand-symbol">S</span>
    <span>stream<span className="brand-accent">dao</span></span>
  </Link>

  <div className="nav-actions">
    <Link href="/login" className="login-link">Log in</Link>
    <Link href="/register" className="button button-small">Join now <span>↗</span></Link>
  </div>

  <details className="premium-menu">
    <summary className="premium-menu-trigger" aria-label="Open navigation menu">
      <span className="menu-label">Menu</span>
      <span className="menu-icon">
        <span></span><span></span><span></span>
      </span>
    </summary>

    <div className="premium-menu-panel">
      <div className="menu-panel-heading">EXPLORE STREAMDAO</div>
      <Link href="/" className="premium-menu-link"><span>01</span> Home <span className="menu-arrow">↗</span></Link>
      <Link href="/#how" className="premium-menu-link"><span>02</span> How it works <span className="menu-arrow">↗</span></Link>
      <Link href="/top-earners" className="premium-menu-link"><span>03</span> Top Earners <span className="menu-arrow">↗</span></Link>
      <Link href="/#contact" className="premium-menu-link"><span>04</span> Contacts <span className="menu-arrow">↗</span></Link>
      <Link href="/token-purchase" className="premium-menu-link"><span>05</span> TokenPurchase <span className="menu-arrow">↗</span></Link>
    </div>
  </details>
</nav>

      <section className="hero">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <div className="hero-content">
          <div className="eyebrow"><span className="status-dot" /> A SIMPLE WAY TO EARN ONLINE</div>
          <h1>
            Your time can
            <br />
            earn you <span className="gradient-text">more.</span>
          </h1>
          <p className="hero-description">
            Complete simple tasks, invite friends and earn rewards.
            It is that easy!
          </p>
          <div className="hero-actions">
            <Link href="/register" className="button">Get started <span>↗</span></Link>
            <a href="#how" className="secondary-button">See how it works ↓</a>
          </div>
          <div className="hero-trust">
            <span className="trust-check">✓</span>
            Easy to join. Easy to use. More ways to earn.
          </div>
        </div>

        <div className="hero-art">
          <div className="art-circle circle-one" />
          <div className="art-circle circle-two" />
          <div className="earn-card">
            <div className="earn-card-top"><span>YOUR REWARDS</span><span className="live-dot" /></div>
            <div className="earn-amount">Earn <span>more.</span></div>
            <div className="earn-bar"><span /></div>
            <div className="earn-card-bottom"><span>Tasks</span><span>Referrals</span><span>Rewards</span></div>
          </div>
          <div className="float-pill pill-one">✦ Complete tasks</div>
          <div className="float-pill pill-two">↗ Invite friends</div>
          <div className="float-pill pill-three">✓ Get rewarded</div>
          <div className="spark spark-one">✳</div>
          <div className="spark spark-two">✦</div>
        </div>
        <div className="hero-bottom"><span>YOUR NEXT OPPORTUNITY STARTS HERE</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <section className="features-section" id="features">
        <div className="section-label">WHY STREAMDAO?</div>
        <h2>More ways to <span className="gradient-text">earn.</span></h2>
        <p className="section-intro">Everything you need, all in one place.</p>
        <div className="feature-grid">
          {benefits.map((item, index) => (
            <article className="feature-card" key={item.title}>
              <div className="feature-icon">{item.icon}</div>
              <span className="feature-number">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-label">GET STARTED IN 3 STEPS</div>
        <h2>It is as easy as <span className="gradient-text">1, 2, 3.</span></h2>
        <div className="steps-grid">
          <div className="step"><span>01</span><h3>Sign up</h3><p>Create your free account.</p></div>
          <div className="step"><span>02</span><h3>Get active</h3><p>Complete tasks and invite friends.</p></div>
          <div className="step"><span>03</span><h3>Earn rewards</h3><p>Track your earnings and request a payout.</p></div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-glow" />
        <div className="section-label">READY TO GET STARTED?</div>
        <h2>Let's make your time <span className="gradient-text">count.</span></h2>
        <p>Join StreamDao today. Your next opportunity is waiting.</p>
        <Link href="/register" className="button">Create your account <span>↗</span></Link>
      </section>

      <footer className="footer" id="contact">
        <Link href="/" className="brand"><span className="brand-symbol">S</span><span>stream<span className="brand-accent">dao</span></span></Link>
        <span>Simple ways to earn more.</span>
        <span className="copyright">© 2026 StreamDao</span>
      </footer>
    </main>
  );
}