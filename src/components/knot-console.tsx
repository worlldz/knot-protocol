"use client";

import { useEffect, useMemo, useState } from "react";
import type { Execution, ExecutionEvent, ProviderAttempt, VerificationCheck } from "@/lib/knot/schemas";

type SystemStatus = {
  mode: "local" | "live";
  services: { verificationEngine: string; x402Buyer: string; x402Seller: string; settlementHook: string };
};

const defaultTask = "Fetch a current, signed wallet risk assessment and return a confidence score.";
const proofLabels = ["Price ceiling", "Response latency", "Data freshness", "Required schema", "Provider signature"];

function KnotMark() {
  return <span className="knot-mark" aria-hidden="true"><i /><i /></span>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

function ShortHash({ value }: { value: string | null }) {
  return value ? <span title={value}>{`${value.slice(0, 10)}...${value.slice(-8)}`}</span> : <span>Not issued</span>;
}

function StatusPill({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <span className={`status-pill ${ready ? "is-ready" : "is-pending"}`}><i />{children}</span>;
}

function TraceEvent({ item, last }: { item: ExecutionEvent; last: boolean }) {
  const label = { discovery: "DISCOVER", quote: "QUOTE", payment: "PAYMENT INTENT", verification: "VERIFY", fallback: "ROUTE", settlement: "SETTLE" }[item.kind];
  return (
    <li className="trace-event event-enter">
      <div className="trace-rail" aria-hidden="true"><span className={`trace-node is-${item.status}`} />{!last && <i />}</div>
      <div className="trace-copy">
        <div className="trace-meta"><span>{String(item.sequence + 1).padStart(2, "0")}</span><span>{label}</span>{item.amountUsdc !== undefined && <strong>{item.amountUsdc.toFixed(3)} USDC</strong>}</div>
        <h3>{item.title}</h3><p>{item.detail}</p>
      </div>
    </li>
  );
}

function ProviderCard({ attempt, index }: { attempt?: ProviderAttempt; index: number }) {
  const accepted = attempt?.outcome === "accepted";
  const rejected = attempt?.outcome === "rejected";
  return (
    <article className={`provider-card ${accepted ? "is-accepted" : ""}`}>
      <div className="provider-topline"><span>0{index + 1}</span><span className={`outcome ${accepted ? "good" : rejected ? "bad" : ""}`}>{accepted ? "SELECTED" : rejected ? "REJECTED" : "STANDBY"}</span></div>
      <h3>{attempt?.provider ?? (index === 0 ? "Signal Forge" : "Northstar Data")}</h3>
      <div className="provider-stats">
        <div><span>QUOTE</span><b>{attempt ? attempt.priceUsdc.toFixed(3) : index === 0 ? "0.018" : "0.024"} USDC</b></div>
        <div><span>REPUTATION</span><b>{attempt?.reputation ?? (index === 0 ? 71 : 94)} / 100</b></div>
        <div><span>PROOF</span><b>{attempt?.proofSupport ?? true ? "SUPPORTED" : "MISSING"}</b></div>
      </div>
      <p className="provider-note">{accepted ? "Evidence met the full obligation. This provider received settlement authorization." : rejected ? "The low quote was not enough. Stale, incomplete evidence triggered automatic fallback." : index === 0 ? "Lowest price enters the verification gate first." : "Higher-trust fallback remains inside the job ceiling."}</p>
    </article>
  );
}

function ProofRow({ check, label }: { check?: VerificationCheck; label: string }) {
  return (
    <div className="proof-row">
      <span className={`proof-icon ${check?.passed ? "pass" : ""}`}>{check ? (check.passed ? "OK" : "NO") : "--"}</span>
      <strong>{check?.label ?? label}</strong><span>{check?.detail ?? "Waiting for an evidence envelope"}</span>
    </div>
  );
}

export function KnotConsole() {
  const [task, setTask] = useState(defaultTask);
  const [maxPrice, setMaxPrice] = useState("0.030");
  const [execution, setExecution] = useState<Execution | null>(null);
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetch("/api/system/status").then((response) => response.json()).then((data: SystemStatus) => setSystem(data)).catch(() => setSystem(null));
  }, []);

  useEffect(() => {
    if (!execution || visibleEvents >= execution.events.length) return;
    const timer = window.setTimeout(() => setVisibleEvents((count) => count + 1), visibleEvents === 0 ? 120 : 430);
    return () => window.clearTimeout(timer);
  }, [execution, visibleEvents]);

  const acceptedAttempt = useMemo(() => execution?.attempts.find((attempt) => attempt.outcome === "accepted"), [execution]);
  const visibleTrace = execution?.events.slice(0, visibleEvents) ?? [];
  const completed = Boolean(execution && visibleEvents >= execution.events.length);
  const checks = acceptedAttempt?.verification.checks;
  const busy = running || Boolean(execution && !completed);

  async function runAgent() {
    setError(null); setExecution(null); setVisibleEvents(0); setRunning(true);
    try {
      const response = await fetch("/api/executions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, maxPriceUsdc: Number(maxPrice) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Execution could not be created.");
      setExecution(data as Execution);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main>
      <div className="ambient-grid" />
      <nav className="site-nav page-shell">
        <a className="brand" href="#top" aria-label="KNOT home"><KnotMark /><span><b>KNOT</b><small>VERIFICATION-NATIVE SETTLEMENT</small></span></a>
        <div className="nav-status"><span className="version">PROTOTYPE 0.2</span><StatusPill ready={system?.services.verificationEngine === "ready"}>ENGINE READY</StatusPill><StatusPill ready={system?.mode === "live"}>{system?.mode === "live" ? "ARC LIVE" : "LOCAL CLEARING"}</StatusPill></div>
      </nav>

      <header id="top" className="hero page-shell">
        <div className="hero-kicker"><span>01</span><p>THE TRUST LAYER BETWEEN AGENT INTENT AND MACHINE PAYMENT</p></div>
        <div className="hero-grid">
          <h1>Agents can pay.<span>KNOT checks delivery.</span></h1>
          <div className="hero-aside">
            <p>Autonomous services should not get paid for stale, malformed, or missing work. KNOT turns a buyer&apos;s intent into enforceable evidence conditions before USDC settlement.</p>
            <dl><div><dt>NETWORK</dt><dd>ARC TESTNET</dd></div><div><dt>MONEY</dt><dd>USDC</dd></div><div><dt>RAIL</dt><dd>x402</dd></div></dl>
          </div>
        </div>
      </header>

      <section className="workspace page-shell" aria-label="KNOT execution workspace">
        <article className="mission-panel panel-light">
          <div className="section-heading"><div><span>ACTIVE OBLIGATION</span><h2>Define the job, not every step.</h2></div><span className="job-chip">JOB / 001</span></div>
          <label className="field-label" htmlFor="task">SERVICE INTENT</label>
          <textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} maxLength={280} rows={4} />
          <div className="constraint-grid">
            <label><span>MAX PRICE</span><select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="0.025">0.025 USDC</option><option value="0.030">0.030 USDC</option><option value="0.050">0.050 USDC</option></select></label>
            <div><span>MAX AGE</span><strong>90 SEC</strong></div><div><span>MAX LATENCY</span><strong>1,400 MS</strong></div><div><span>SIGNATURE</span><strong>REQUIRED</strong></div>
          </div>
          <button className="run-button" type="button" onClick={runAgent} disabled={busy || task.trim().length < 12}><span>{busy ? "Agent is clearing the job" : "Run autonomous job"}</span><ArrowIcon /></button>
          <div className="mode-note"><span>SAFE DEMO MODE</span><p>Real decision API. Simulated value rail. No wallet or funds are used.</p></div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </article>

        <article className="trace-panel">
          <div className="trace-header"><div><span>AGENT EXECUTION</span><h2>Clearing trace</h2></div><div className="trace-counter"><strong>{String(visibleTrace.length).padStart(2, "0")}</strong><span>EVENTS</span></div></div>
          {visibleTrace.length === 0 ? <div className="trace-empty"><KnotMark /><p>The clearing engine is standing by.</p><span>RUN THE OBLIGATION TO INSPECT EVERY DECISION</span></div> : <ol className="trace-list">{visibleTrace.map((item, index) => <TraceEvent key={item.id} item={item} last={index === visibleTrace.length - 1 && completed} />)}</ol>}
          <footer className="trace-footer"><span>EXECUTION ID</span><code>{execution?.id ?? "NOT ISSUED"}</code><span className={completed ? "complete" : ""}>{completed ? "TRACE SEALED" : "AWAITING RUN"}</span></footer>
        </article>
      </section>

      <section className="results page-shell">
        <div className="section-index"><span>02</span><p>MARKET SELECTION</p></div>
        <div className="provider-grid"><ProviderCard attempt={execution?.attempts[0]} index={0} /><ProviderCard attempt={execution?.attempts[1]} index={1} /></div>
        <div className="evidence-grid">
          <article className="proof-panel panel-light">
            <div className="section-heading compact"><div><span>EVIDENCE ENVELOPE</span><h2>Verification matrix</h2></div><span className={`proof-score ${completed ? "ready" : ""}`}>{completed ? `${checks?.filter((check) => check.passed).length ?? 0} / 5 PASS` : "WAITING"}</span></div>
            <div className="proof-list">{proofLabels.map((label, index) => <ProofRow key={label} label={label} check={checks?.[index]} />)}</div>
          </article>
          <article className={`settlement-panel ${completed ? "is-authorized" : ""}`}>
            <div className="settlement-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div className="settlement-heading"><span>SETTLEMENT AUTHORIZATION</span><b>{completed ? "AUTHORIZED" : "LOCKED"}</b></div>
            <p className="settlement-amount">{completed ? execution?.settlement.amountUsdc.toFixed(3) : "0.000"}<span>USDC</span></p>
            <dl className="settlement-data"><div><dt>RAIL</dt><dd>{execution?.settlement.rail.toUpperCase() ?? "SIMULATED"}</dd></div><div><dt>EVIDENCE</dt><dd><ShortHash value={execution?.settlement.evidenceHash ?? null} /></dd></div><div><dt>ONCHAIN TX</dt><dd>{execution?.settlement.transactionHash ? <ShortHash value={execution.settlement.transactionHash} /> : "Not broadcast"}</dd></div></dl>
            <p className="settlement-disclaimer">{completed ? "The evidence is accepted. Live mode will pass this commitment to the KNOT ERC-8183 hook before value can move." : "Settlement stays unavailable until one provider satisfies every condition."}</p>
          </article>
        </div>
      </section>

      <section className="architecture page-shell">
        <div className="section-index light"><span>03</span><p>THE PROTOCOL KNOT</p></div>
        <div className="architecture-head"><h2>Payment is easy.<br />Proof is the hard part.</h2><p>KNOT is not another agent wallet. It is the policy and evidence layer that sits between service delivery and programmable money.</p></div>
        <div className="flow-map">{[["01", "INTENT", "Buyer defines measurable constraints"], ["02", "MARKET", "Providers expose paid services over x402"], ["03", "EVIDENCE", "KNOT verifies output and binds its hash"], ["04", "SETTLE", "ERC-8183 releases USDC or keeps it blocked"]].map(([number, title, copy], index) => <div className="flow-node" key={title}><span>{number}</span><h3>{title}</h3><p>{copy}</p>{index < 3 && <ArrowIcon />}</div>)}</div>
        <div className="protocol-strip"><p><span>CIRCLE GATEWAY</span>Gas-free x402 nanopayment path after deposit</p><p><span>ERC-8183</span>Job lifecycle and escrow-compatible completion hook</p><p><span>ERC-8004</span>Identity and outcome reputation surface</p></div>
      </section>

      <footer className="site-footer page-shell"><div className="brand"><KnotMark /><span><b>KNOT</b><small>PAY FOR VERIFIED OUTCOMES</small></span></div><p>Built for autonomous commerce on Arc.</p><div><span>ARC TESTNET</span><span>USDC</span><span>x402</span><span>ERC-8183</span></div></footer>
    </main>
  );
}
