"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Code2,
  Database,
  Fingerprint,
  LockKeyhole,
  Moon,
  Network,
  ReceiptText,
  Route as RouteIcon,
  ShieldCheck,
  Sun,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

const flowSteps = [
  {
    number: "01",
    label: "Intent",
    title: "Define the obligation",
    copy: "Price ceiling, freshness, response schema, latency, and signature requirements become executable policy.",
    icon: Workflow,
  },
  {
    number: "02",
    label: "Market",
    title: "Route competing providers",
    copy: "KNOT ranks eligible services by proof support, reputation, cost, and the buyer's exact constraints.",
    icon: RouteIcon,
  },
  {
    number: "03",
    label: "Proof",
    title: "Reject weak delivery",
    copy: "Stale, malformed, unsigned, or incomplete work remains unpaid while fallback continues automatically.",
    icon: ShieldCheck,
  },
  {
    number: "04",
    label: "Settlement",
    title: "Release USDC",
    copy: "Accepted evidence is bound to the receipt and settlement authorization before value can move.",
    icon: CircleDollarSign,
  },
] as const;

const problemCards = [
  {
    eyebrow: "SELF-ATTESTATION",
    title: "A provider cannot be the final judge of its own work.",
    copy: "Payment endpoints can prove that a request was paid. They cannot independently prove the returned work met the buyer's policy.",
    icon: Fingerprint,
  },
  {
    eyebrow: "BRITTLE ROUTING",
    title: "One failed API should not stop an autonomous workflow.",
    copy: "KNOT preserves the budget and requirements while moving to the next eligible provider without asking a human to rescue the job.",
    icon: Network,
  },
  {
    eyebrow: "MISSING MEMORY",
    title: "An agent needs a reason, not only a transaction hash.",
    copy: "Every quote, rejection, fallback, evidence hash, and settlement decision survives inside a machine-readable receipt.",
    icon: ReceiptText,
  },
] as const;

const bentoCards = [
  {
    className: "is-wide",
    eyebrow: "POLICY ENGINE",
    title: "Programmable money begins with a programmable release condition.",
    copy: "The buyer defines what acceptable work means before any provider is selected. KNOT applies the same neutral policy across the market.",
    icon: LockKeyhole,
    metric: "5 / 5",
    metricLabel: "checks required",
  },
  {
    className: "",
    eyebrow: "FALLBACK",
    title: "Failure becomes routing data.",
    copy: "Rejected work does not expand the budget or unlock payment.",
    icon: RouteIcon,
    metric: "02",
    metricLabel: "providers tried",
  },
  {
    className: "",
    eyebrow: "RECEIPTS",
    title: "The decision can be audited later.",
    copy: "Receipt IDs are shareable; evidence bindings are independently verifiable.",
    icon: Database,
    metric: "201",
    metricLabel: "proof created",
  },
  {
    className: "is-wide",
    eyebrow: "MACHINE COMMERCE",
    title: "x402 handles access. KNOT decides whether the result earned settlement.",
    copy: "The payment rail and the verification layer stay separate, so agents can use many providers without inheriting each provider's trust model.",
    icon: Zap,
    metric: "USDC",
    metricLabel: "settlement asset",
  },
] as const;

function KnotMark() {
  return <span className="knot-mark" aria-hidden="true"><i /><i /></span>;
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button className="landing-theme-toggle" type="button" onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.classList.add("is-visible");
      observer.unobserve(element);
    }, { threshold: 0.14, rootMargin: "0px 0px -5% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`landing-reveal ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}

function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return <article className={`landing-spotlight ${className}`} onPointerMove={handlePointerMove}>{children}</article>;
}

function ClearingPreview() {
  return (
    <div className="landing-clearing-preview" aria-label="Animated KNOT clearing preview">
      <div className="preview-topline">
        <span><i /> LIVE CLEARING / ARC TESTNET</span>
        <b>RUN / 01</b>
      </div>
      <div className="preview-intent">
        <div><Workflow /><span><small>OBLIGATION</small><strong>Signed wallet risk assessment</strong></span></div>
        <span>&lt;= 0.030 USDC</span>
      </div>
      <div className="preview-route">
        <div className="preview-beam"><i /></div>
        <div className="preview-provider is-rejected">
          <span><X /> REJECTED</span>
          <strong>Arc Baseline</strong>
          <small>Schema + signature failed</small>
        </div>
        <div className="preview-provider is-accepted">
          <span><Check /> ACCEPTED</span>
          <strong>Arc Sentinel</strong>
          <small>5 evidence checks passed</small>
        </div>
      </div>
      <div className="preview-settlement">
        <div><ShieldCheck /><span><small>EVIDENCE BOUND</small><strong>Settlement authorized</strong></span></div>
        <b>0.024 <small>USDC</small></b>
      </div>
      <div className="preview-foot">
        <span>Intent</span><i /><span>Market</span><i /><span>Proof</span><i /><span>Settle</span>
      </div>
    </div>
  );
}

function ProductWindow() {
  return (
    <div className="landing-product-window">
      <div className="product-window-bar">
        <div><i /><i /><i /></div>
        <span>KNOT / CLEARING CONSOLE</span>
        <b>LIVE</b>
      </div>
      <div className="product-window-grid">
        <section className="product-obligation">
          <span>ACTIVE OBLIGATION</span>
          <h3>Define the decision.</h3>
          <label>
            <small>Decision request</small>
            <strong>Assess whether this wallet is suitable for a USDC payment.</strong>
          </label>
          <div className="product-policies"><span>ECONOMY</span><span className="active">BALANCED</span><span>STRICT</span></div>
          <button type="button" tabIndex={-1}>Run proof preview <ArrowRight /></button>
        </section>
        <section className="product-trace">
          <div><span>AGENT EXECUTION</span><b>09 <small>EVENTS</small></b></div>
          <ol>
            <li><i>01</i><span><small>DISCOVER</small><strong>2 eligible providers found</strong></span></li>
            <li><i>04</i><span><small>VERIFY</small><strong>First delivery rejected</strong></span></li>
            <li><i>05</i><span><small>ROUTE</small><strong>Fallback activated</strong></span></li>
            <li className="is-success"><i>08</i><span><small>VERIFY</small><strong>Every obligation passed</strong></span></li>
            <li className="is-success"><i>09</i><span><small>SETTLE</small><strong>0.024 USDC authorized</strong></span></li>
          </ol>
        </section>
      </div>
    </div>
  );
}

export function KnotLanding() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const appHashes = new Set(["#console", "#receipts", "#payment", "#explore"]);
    if (appHashes.has(window.location.hash)) {
      window.location.replace(`/app${window.location.hash}`);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const current = document.documentElement.dataset.theme;
      setTheme(current === "light" ? "light" : "dark");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("knot-theme", nextTheme);
  }

  return (
    <main className="landing-root">
      <div className="landing-grid-bg" aria-hidden="true" />
      <header className="landing-header">
        <nav className="landing-nav landing-shell" aria-label="Primary navigation">
          <Link className="landing-brand" href="/" aria-label="KNOT home">
            <KnotMark />
            <span><b>KNOT</b><small>VERIFICATION-NATIVE SETTLEMENT</small></span>
          </Link>
          <div className="landing-nav-links">
            <a href="#problem">Why KNOT</a>
            <a href="#protocol">Protocol</a>
            <a href="#product">Product</a>
            <a href="#proof">Proof</a>
          </div>
          <div className="landing-nav-actions">
            <ThemeToggle theme={theme} onToggle={() => updateTheme(theme === "dark" ? "light" : "dark")} />
            <a className="landing-nav-launch" href="/app">Launch app <ArrowUpRight /></a>
          </div>
        </nav>
      </header>

      <section className="landing-hero landing-shell">
        <div className="landing-hero-copy">
          <div className="landing-live-pill"><i /><span>LIVE ON ARC TESTNET</span><b>v0.1</b></div>
          <h1><span>Agents can pay.</span><strong>KNOT decides when they should.</strong></h1>
          <p>KNOT is a programmable payment policy layer for autonomous agents. Providers compete, evidence is checked, and USDC moves only after the purchased work satisfies the obligation.</p>
          <div className="landing-hero-actions">
            <a className="landing-button is-primary" href="/app">Launch clearing app <ArrowRight /></a>
            <a className="landing-button is-secondary" href="#protocol">See how it clears</a>
          </div>
          <div className="landing-hero-note"><ShieldCheck /><span><strong>Neutral verification.</strong> The provider does not grade its own delivery.</span></div>
        </div>
        <div className="landing-hero-visual">
          <ClearingPreview />
          <span className="hero-orbit-label label-intent">INTENT</span>
          <span className="hero-orbit-label label-proof">PROOF</span>
          <span className="hero-orbit-label label-settle">SETTLE</span>
        </div>
      </section>

      <section className="landing-rail landing-shell" aria-label="KNOT stack">
        <div><span>NETWORK</span><strong>Arc Testnet</strong><small>Sub-second finality</small></div>
        <div><span>MONEY</span><strong>USDC</strong><small>Native gas + settlement</small></div>
        <div><span>PAYMENT RAIL</span><strong>x402</strong><small>Machine-native access</small></div>
        <div><span>ENFORCEMENT</span><strong>ERC-8183</strong><small>Evidence-bound jobs</small></div>
        <a href="/app#console">Open live console <ArrowRight /></a>
      </section>

      <section id="problem" className="landing-story landing-shell">
        <div className="landing-story-heading">
          <span className="landing-section-tag">01 / THE GAP</span>
          <h2>Payment proves money moved.<br /><em>Not that the work was good.</em></h2>
          <p>x402 can negotiate and authorize machine payments. Autonomous commerce still needs an independent answer to a harder question: did the purchased result satisfy the buyer&apos;s conditions?</p>
          <div className="story-rule"><span>KNOT sits here</span><i /><b>between intent and settlement</b></div>
        </div>
        <div className="landing-problem-list">
          {problemCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.eyebrow} delay={index * 90}>
                <SpotlightCard className="problem-card">
                  <div><span>0{index + 1}</span><Icon /></div>
                  <small>{card.eyebrow}</small>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section id="protocol" className="landing-protocol">
        <div className="landing-shell">
          <Reveal className="landing-protocol-heading">
            <span className="landing-section-tag">02 / CLEARING LOGIC</span>
            <div><h2>One obligation.<br />Four hard gates.</h2><p>KNOT turns a natural-language job into deterministic checks that every provider must satisfy under the same budget.</p></div>
          </Reveal>
          <div className="landing-flow">
            <div className="landing-flow-beam" aria-hidden="true"><i /></div>
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.number} delay={index * 100}>
                  <article>
                    <div><span>{step.number}</span><Icon /></div>
                    <small>{step.label}</small>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section id="product" className="landing-product landing-shell">
        <Reveal className="landing-product-heading">
          <span className="landing-section-tag">03 / THE PRODUCT</span>
          <h2>Not a diagram.<br /><em>A working clearing console.</em></h2>
          <p>Choose a decision, enter an Arc address, set the protection level, preflight the market, and watch every route and verification event unfold.</p>
          <a className="landing-inline-link" href="/app">Enter the app <ArrowRight /></a>
        </Reveal>
        <Reveal delay={100}><ProductWindow /></Reveal>
      </section>

      <section className="landing-bento landing-shell">
        <Reveal className="landing-bento-heading">
          <span className="landing-section-tag">WHAT KNOT ADDS</span>
          <h2>A trust layer with an opinion.</h2>
          <p>Accept only what can be proven. Remember why it cleared.</p>
        </Reveal>
        <div className="landing-bento-grid">
          {bentoCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.eyebrow} className={card.className} delay={index * 70}>
                <SpotlightCard>
                  <div className="bento-icon"><Icon /></div>
                  <small>{card.eyebrow}</small>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                  <div className="bento-metric"><strong>{card.metric}</strong><span>{card.metricLabel}</span></div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section id="proof" className="landing-proof landing-shell">
        <Reveal className="landing-proof-copy">
          <span className="landing-section-tag">04 / PUBLIC PROOF</span>
          <h2>The demo ends.<br /><em>The evidence remains.</em></h2>
          <p>KNOT is deployed on Arc Testnet with a verified commerce contract and verification hook. Receipts can be fetched and checked independently of the interface.</p>
          <div className="proof-actions">
            <a href="https://testnet.arcscan.app/address/0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f" target="_blank" rel="noreferrer">Commerce contract <ArrowUpRight /></a>
            <a href="/api/openapi">OpenAPI <ArrowUpRight /></a>
          </div>
        </Reveal>
        <Reveal className="landing-proof-terminal" delay={120}>
          <div className="terminal-title"><span><i /><i /><i /></span><b>receipt / verified</b><small>ARC TESTNET</small></div>
          <div className="terminal-verdict"><ShieldCheck /><span><small>SETTLEMENT VERDICT</small><strong>Every obligation passed.</strong></span><b>VERIFIED</b></div>
          <dl>
            <div><dt>Commerce</dt><dd>0xb76e...cf9f</dd></div>
            <div><dt>Hook</dt><dd>0x73b0...18d5</dd></div>
            <div><dt>Evidence</dt><dd>0x7e75...c016</dd></div>
            <div><dt>Settlement</dt><dd>0.024 USDC</dd></div>
          </dl>
          <div className="terminal-command"><Code2 /><code>GET /api/receipts/verify?id=run_...</code></div>
        </Reveal>
      </section>

      <section className="landing-cta landing-shell">
        <div className="cta-grid" aria-hidden="true" />
        <span><i /> CLEARING RAIL ONLINE</span>
        <h2>Give your agent a budget.<br /><em>Not blind trust.</em></h2>
        <p>Define the outcome, let the market compete, and settle only the delivery that earns it.</p>
        <div>
          <a className="landing-button is-primary" href="/app">Launch KNOT <ArrowRight /></a>
          <a className="landing-button is-secondary" href="/app#explore">Developer surface</a>
        </div>
      </section>

      <footer className="landing-footer landing-shell">
        <Link className="landing-brand" href="/"><KnotMark /><span><b>KNOT</b><small>PAY FOR VERIFIED OUTCOMES</small></span></Link>
        <p>Programmable payment policy for autonomous commerce.</p>
        <div><a href="https://www.arc.io/" target="_blank" rel="noreferrer">Built on Arc</a><a href="/api/manifest">Manifest</a><a href="/app">App</a></div>
      </footer>
    </main>
  );
}
