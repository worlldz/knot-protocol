"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";

const methodSteps = [
  {
    number: "01",
    label: "Intent",
    title: "Write the rule before the request.",
    copy: "The buyer sets the price ceiling, freshness, latency, schema, and signature requirements. Every provider faces the same obligation.",
    core: "POLICY LOCKED",
    detail: "5 CONDITIONS",
  },
  {
    number: "02",
    label: "Market",
    title: "Let services compete on evidence.",
    copy: "KNOT ranks eligible providers, requests delivery, and rejects work that is stale, malformed, or unsigned. Failure becomes routing data.",
    core: "ROUTE ACTIVE",
    detail: "2 PROVIDERS",
  },
  {
    number: "03",
    label: "Settlement",
    title: "Pay the proof, not the promise.",
    copy: "Only accepted evidence unlocks USDC. The decision, evidence hash, route, and settlement stay together in a portable receipt.",
    core: "PROOF ACCEPTED",
    detail: "0.024 USDC",
  },
] as const;

function KnotMark() {
  return <span className="knot-mark" aria-hidden="true"><i /><i /></span>;
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      className="landing-theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

function ProofRail() {
  return (
    <figure className="proof-rail" aria-label="KNOT routes a request, rejects weak work, and settles accepted evidence">
      <div className="proof-rail-head">
        <span><i /> CLEARING LIVE</span>
        <b>ARC TESTNET / 01</b>
      </div>

      <div className="proof-rail-canvas">
        <svg viewBox="0 0 620 430" role="presentation" aria-hidden="true">
          <defs>
            <linearGradient id="railGradient" x1="0" x2="1">
              <stop offset="0" stopColor="var(--landing-mint)" stopOpacity=".18" />
              <stop offset=".55" stopColor="var(--landing-mint)" stopOpacity=".7" />
              <stop offset="1" stopColor="var(--landing-acid)" stopOpacity=".9" />
            </linearGradient>
            <filter id="railGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path className="rail-line" d="M68 210 H190 C224 210 228 120 270 120 H362" />
          <path className="rail-line" d="M190 210 C224 210 228 300 270 300 H362" />
          <path className="rail-line rail-line-main" d="M362 300 H440 C478 300 475 210 518 210 H566" />
          <path className="rail-line rail-line-reject" d="M362 120 H400" />
          <circle className="rail-packet rail-packet-a" r="6" filter="url(#railGlow)">
            <animateMotion
              dur="5.6s"
              repeatCount="indefinite"
              path="M68 210 H190 C224 210 228 300 270 300 H362 H440 C478 300 475 210 518 210 H566"
            />
          </circle>
          <circle className="rail-packet rail-packet-b" r="5">
            <animateMotion
              begin=".85s"
              dur="5.6s"
              repeatCount="indefinite"
              path="M68 210 H190 C224 210 228 120 270 120 H400"
            />
          </circle>
        </svg>

        <div className="rail-node rail-intent">
          <small>OBLIGATION</small>
          <strong>Wallet risk signal</strong>
          <span>&le; 0.030 USDC</span>
        </div>

        <div className="rail-node rail-provider rail-provider-rejected">
          <span><X /> REJECTED</span>
          <strong>Baseline API</strong>
          <small>stale + unsigned</small>
        </div>

        <div className="rail-node rail-provider rail-provider-accepted">
          <span><Check /> ACCEPTED</span>
          <strong>Sentinel API</strong>
          <small>5 / 5 checks passed</small>
        </div>

        <div className="rail-gate">
          <span><ShieldCheck /></span>
          <small>PROOF GATE</small>
        </div>

        <div className="rail-settlement">
          <small>RELEASED</small>
          <strong>0.024</strong>
          <span>USDC</span>
        </div>
      </div>

      <figcaption>
        <span>One policy</span>
        <i />
        <span>Neutral verification</span>
        <i />
        <span>Evidence-bound settlement</span>
      </figcaption>
    </figure>
  );
}

function MethodSection() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.step);
        if (Number.isFinite(index)) setActiveStep(index);
      },
      { threshold: [0.3, 0.55, 0.75], rootMargin: "-22% 0px -26% 0px" },
    );

    stepRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const active = methodSteps[activeStep];

  return (
    <section id="method" className="landing-method">
      <div className="landing-shell method-intro">
        <span>01 / THE CLEARING METHOD</span>
        <h2>Money becomes programmable<br />at the moment of release.</h2>
      </div>

      <div className="landing-shell method-layout">
        <div className={`method-core is-step-${activeStep}`} aria-live="polite">
          <div className="method-core-grid" aria-hidden="true" />
          <div className="method-orbit method-orbit-outer" aria-hidden="true"><i /></div>
          <div className="method-orbit method-orbit-inner" aria-hidden="true"><i /></div>
          <div className="method-core-status">
            <span>KNOT / POLICY ENGINE</span>
            <b>{active.number} / 03</b>
          </div>
          <div className="method-core-center">
            <small>{active.label}</small>
            <strong>{active.core}</strong>
            <span>{active.detail}</span>
          </div>
          <div className="method-core-nodes" aria-hidden="true">
            <span className={activeStep >= 0 ? "active" : ""}>INTENT</span>
            <span className={activeStep >= 1 ? "active" : ""}>ROUTE</span>
            <span className={activeStep >= 2 ? "active" : ""}>SETTLE</span>
          </div>
        </div>

        <div className="method-copy">
          {methodSteps.map((step, index) => (
            <article
              key={step.number}
              id={`method-step-${index + 1}`}
              ref={(element) => { stepRefs.current[index] = element; }}
              data-step={index}
              className={activeStep === index ? "is-active" : ""}
            >
              <div>
                <span>{step.number}</span>
                <small>{step.label}</small>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section id="proof" className="landing-proof">
      <div className="landing-shell proof-layout">
        <div className="proof-copy">
          <span>02 / PUBLIC PROOF</span>
          <h2>Open the receipt.<br />Do not trust the pitch.</h2>
          <p>
            KNOT keeps the obligation, provider route, failed checks, accepted evidence,
            and settlement verdict in one machine-readable record.
          </p>
          <div className="proof-links">
            <a href="/app#receipts">Inspect receipts <ArrowRight /></a>
            <a
              href="https://testnet.arcscan.app/address/0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f"
              target="_blank"
              rel="noreferrer"
            >
              Verified contract <ArrowUpRight />
            </a>
          </div>
        </div>

        <div className="proof-receipt">
          <header>
            <span><i /> VERIFIED EXECUTION</span>
            <b>ARC / 201</b>
          </header>
          <div className="receipt-verdict">
            <ShieldCheck />
            <div><small>SETTLEMENT VERDICT</small><strong>Delivery earned payment.</strong></div>
            <span>PASS</span>
          </div>
          <dl>
            <div><dt>Policy</dt><dd>5 conditions</dd></div>
            <div><dt>Route</dt><dd>2 providers</dd></div>
            <div><dt>Evidence</dt><dd>0x7e75...c016</dd></div>
            <div><dt>Settlement</dt><dd>0.024 USDC</dd></div>
          </dl>
          <footer>
            <span><Check /> PRICE</span>
            <span><Check /> FRESHNESS</span>
            <span><Check /> SCHEMA</span>
            <span><Check /> SIGNATURE</span>
          </footer>
        </div>
      </div>
    </section>
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
      const requested = new URLSearchParams(window.location.search).get("theme");
      const nextTheme = requested === "light" || requested === "dark"
        ? requested
        : document.documentElement.dataset.theme === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
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
      <header className="landing-header">
        <nav className="landing-nav landing-shell" aria-label="Primary navigation">
          <Link className="landing-brand" href="/" aria-label="KNOT home">
            <KnotMark />
            <span><b>KNOT</b><small>VERIFICATION-NATIVE SETTLEMENT</small></span>
          </Link>
          <div className="landing-nav-links">
            <a href="#method">Method</a>
            <a href="#proof">Proof</a>
          </div>
          <div className="landing-nav-actions">
            <ThemeToggle theme={theme} onToggle={() => updateTheme(theme === "dark" ? "light" : "dark")} />
            <a className="landing-nav-launch" href="/app">Launch app <ArrowUpRight /></a>
          </div>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-glow" aria-hidden="true" />
        <div className="landing-shell landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><i /> PROGRAMMABLE PAYMENT POLICY</span>
            <h1>Pay for outcomes.<br /><em>Not promises.</em></h1>
            <p>KNOT verifies machine work before autonomous agents release USDC.</p>
            <div className="landing-hero-actions">
              <a className="landing-button is-primary" href="/app">Launch app <ArrowRight /></a>
              <a className="landing-text-link" href="#method">See the clearing method <span>↓</span></a>
            </div>
          </div>
          <ProofRail />
        </div>
        <div className="landing-shell landing-foundation" aria-label="Protocol foundation">
          <span>BUILT ON ARC</span>
          <span><b>USDC</b> settlement</span>
          <span><b>x402</b> access</span>
          <span><b>ERC-8183</b> enforcement</span>
        </div>
      </section>

      <MethodSection />
      <ProofSection />

      <section className="landing-close">
        <div className="landing-shell">
          <CircleDollarSign aria-hidden="true" />
          <h2>Give agents a budget.<br /><em>Keep the conditions.</em></h2>
          <a href="/app">Open the clearing console <ArrowRight /></a>
        </div>
      </section>

      <footer className="landing-footer landing-shell">
        <Link className="landing-brand" href="/"><KnotMark /><span><b>KNOT</b><small>PAY FOR VERIFIED OUTCOMES</small></span></Link>
        <p>Programmable payment policy for autonomous commerce.</p>
        <div>
          <a href="https://www.arc.io/" target="_blank" rel="noreferrer">Built on Arc</a>
          <a href="/api/openapi" target="_blank" rel="noreferrer">OpenAPI</a>
          <a href="/app">App</a>
        </div>
      </footer>
    </main>
  );
}
