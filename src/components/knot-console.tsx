"use client";

import { useState } from "react";
import {
  verifyDelivery,
  type Delivery,
  type Obligation,
  type VerificationResult,
} from "@/lib/verification";

type RunEvent = {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "neutral" | "good" | "bad";
};

const obligation: Obligation = {
  maxPriceUsdc: 0.03,
  maxLatencyMs: 1400,
  maxAgeSeconds: 90,
  requiredFields: ["risk", "confidence", "observedAt"],
  requireSignature: true,
};

const staleDelivery: Delivery = {
  provider: "Signal Forge",
  priceUsdc: 0.018,
  latencyMs: 482,
  ageSeconds: 410,
  signatureValid: true,
  payload: { risk: "low", observedAt: "stale" },
};

const validDelivery: Delivery = {
  provider: "Northstar Data",
  priceUsdc: 0.024,
  latencyMs: 731,
  ageSeconds: 18,
  signatureValid: true,
  payload: { risk: "medium", confidence: 0.94, observedAt: "current" },
};

const wait = (duration: number) =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

export function KnotConsole() {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [settled, setSettled] = useState(false);

  const addEvent = (event: RunEvent) =>
    setEvents((current) => [...current, event]);

  async function runAgent() {
    setEvents([]);
    setResult(null);
    setSettled(false);
    setRunning(true);

    addEvent({
      eyebrow: "DISCOVERY",
      title: "2 providers found",
      detail: "Buyer agent ranked services by price, latency and proof support.",
      tone: "neutral",
    });
    await wait(650);

    addEvent({
      eyebrow: "ATTEMPT 01 · 0.018 USDC",
      title: "Signal Forge returned a delivery",
      detail: "KNOT opened the evidence envelope before settlement.",
      tone: "neutral",
    });
    await wait(650);

    const firstResult = verifyDelivery(obligation, staleDelivery);
    setResult(firstResult);
    addEvent({
      eyebrow: "REJECTED",
      title: "Stale and incomplete response",
      detail: "Funds remain protected. The agent is rerouting automatically.",
      tone: "bad",
    });
    await wait(850);

    addEvent({
      eyebrow: "ATTEMPT 02 · 0.024 USDC",
      title: "Northstar Data selected",
      detail: "The fallback stays inside the 0.030 USDC job ceiling.",
      tone: "neutral",
    });
    await wait(700);

    const finalResult = verifyDelivery(obligation, validDelivery);
    setResult(finalResult);
    addEvent({
      eyebrow: "VERIFIED",
      title: "All delivery conditions passed",
      detail: "Evidence is ready to authorize USDC settlement on Arc.",
      tone: "good",
    });
    await wait(550);

    setSettled(true);
    setRunning(false);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
      <div className="noise" />

      <nav className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ink)] text-sm font-bold text-[var(--acid)]">
            K
          </span>
          <div>
            <p className="text-sm font-bold tracking-[0.18em]">KNOT</p>
            <p className="font-mono text-[10px] text-[var(--muted)]">
              VERIFICATION-NATIVE SETTLEMENT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">
          <span className="hidden text-[var(--muted)] sm:inline">Prototype 0.1</span>
          <span className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-2">
            <i className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--mint)]" />
            Arc Testnet
          </span>
        </div>
      </nav>

      <header className="grid gap-8 border-b border-[var(--line)] py-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:py-16">
        <div>
          <p className="mb-5 font-mono text-xs font-semibold tracking-[0.2em] text-[var(--muted)]">
            INTENT → EVIDENCE → SETTLEMENT
          </p>
          <h1 className="max-w-5xl text-[clamp(3rem,7.5vw,7.8rem)] font-semibold leading-[0.86] tracking-[-0.075em]">
            Agents can pay.
            <br />
            <span className="text-[var(--muted)]">KNOT checks delivery.</span>
          </h1>
        </div>
        <div className="max-w-xl lg:justify-self-end">
          <p className="text-lg leading-7 text-[var(--muted)]">
            A settlement firewall for autonomous commerce. KNOT verifies what a
            service promised before agent money is released.
          </p>
          <div className="mt-7 flex gap-8 border-t border-[var(--line)] pt-5 font-mono text-xs">
            <div>
              <span className="block text-[var(--muted)]">RAIL</span>
              <strong className="mt-1 block">USDC / ARC</strong>
            </div>
            <div>
              <span className="block text-[var(--muted)]">SERVICE</span>
              <strong className="mt-1 block">x402</strong>
            </div>
            <div>
              <span className="block text-[var(--muted)]">MODE</span>
              <strong className="mt-1 block">AUTONOMOUS</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-5 py-5 lg:grid-cols-[0.82fr_1.18fr]">
        <article className="rounded-[2rem] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_24px_80px_rgba(28,45,37,0.08)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[var(--muted)]">
                ACTIVE OBLIGATION
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                Wallet risk signal
              </h2>
            </div>
            <span className="rounded-full bg-[var(--acid)] px-3 py-2 font-mono text-[10px] font-semibold">
              JOB #001
            </span>
          </div>

          <p className="mt-8 border-l-2 border-[var(--ink)] pl-5 text-xl leading-8">
            Fetch a current, signed risk assessment. Stay below 0.030 USDC and
            settle only when every proof condition passes.
          </p>

          <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] font-mono text-xs">
            {[
              ["MAX PRICE", "0.030 USDC"],
              ["MAX AGE", "90 SEC"],
              ["MAX LATENCY", "1,400 MS"],
              ["SIGNATURE", "REQUIRED"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[#f7f8ef] p-4">
                <dt className="text-[10px] text-[var(--muted)]">{label}</dt>
                <dd className="mt-2 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={runAgent}
            disabled={running}
            className="mt-7 flex w-full items-center justify-between rounded-full bg-[var(--ink)] px-6 py-4 text-left text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(11,23,20,0.25)] disabled:cursor-wait disabled:opacity-60"
          >
            <span>{running ? "Agent is executing…" : "Run autonomous job"}</span>
            <span className="font-mono text-[var(--acid)]">→</span>
          </button>
          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
            Local verification prototype · no funds move yet
          </p>
        </article>

        <article className="min-h-[570px] rounded-[2rem] bg-[var(--ink)] p-6 text-white shadow-[0_24px_80px_rgba(11,23,20,0.2)] sm:p-8">
          <div className="flex items-center justify-between border-b border-white/15 pb-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-white/45">
                AGENT EXECUTION
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Live clearing trace
              </h2>
            </div>
            <span className="font-mono text-[10px] text-white/45">
              {events.length.toString().padStart(2, "0")} EVENTS
            </span>
          </div>

          {events.length === 0 ? (
            <div className="grid min-h-[440px] place-items-center text-center">
              <div>
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-dashed border-white/25 font-mono text-xl text-[var(--acid)]">
                  K
                </div>
                <p className="text-lg text-white/70">The agent is standing by.</p>
                <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-white/35">
                  RUN THE JOB TO OBSERVE DECISIONS
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {events.map((event, index) => (
                <div
                  key={`${event.eyebrow}-${index}`}
                  className="event-enter grid grid-cols-[2rem_1fr] gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <span
                    className={`mt-1 h-3 w-3 rounded-full ${
                      event.tone === "good"
                        ? "bg-[var(--mint)]"
                        : event.tone === "bad"
                          ? "bg-[var(--danger)]"
                          : "bg-white/35"
                    }`}
                  />
                  <div>
                    <p
                      className={`font-mono text-[9px] font-semibold tracking-[0.16em] ${
                        event.tone === "good"
                          ? "text-[var(--mint)]"
                          : event.tone === "bad"
                            ? "text-[var(--danger)]"
                            : "text-white/40"
                      }`}
                    >
                      {event.eyebrow}
                    </p>
                    <h3 className="mt-1 font-semibold">{event.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-white/50">
                      {event.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-5 pb-12 lg:grid-cols-[1.18fr_0.82fr]">
        <article className="rounded-[2rem] border border-[var(--line)] bg-white/55 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[var(--muted)]">
                EVIDENCE ENVELOPE
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Delivery checks
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-2 font-mono text-[10px] font-semibold ${
                result?.accepted
                  ? "bg-[var(--mint)]/25"
                  : "border border-[var(--line)]"
              }`}
            >
              {result ? (result.accepted ? "5 / 5 PASS" : "CHECK FAILED") : "WAITING"}
            </span>
          </div>

          <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {(result?.checks ?? [
              { label: "Price ceiling", passed: false, detail: "—" },
              { label: "Response latency", passed: false, detail: "—" },
              { label: "Data freshness", passed: false, detail: "—" },
              { label: "Required schema", passed: false, detail: "—" },
              { label: "Provider signature", passed: false, detail: "—" },
            ]).map((check) => (
              <div key={check.label} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm">
                <span className="font-medium">{check.label}</span>
                <span className="font-mono text-[11px] text-[var(--muted)]">
                  {result && (
                    <b className={check.passed ? "text-[#087452]" : "text-[#c43b2b]"}>
                      {check.passed ? "PASS · " : "FAIL · "}
                    </b>
                  )}
                  {check.detail}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article
          className={`rounded-[2rem] border p-6 transition-colors sm:p-8 ${
            settled
              ? "border-[var(--mint)] bg-[var(--mint)]/15"
              : "border-[var(--line)] bg-white/35"
          }`}
        >
          <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[var(--muted)]">
            SETTLEMENT
          </p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] text-[var(--muted)]">AUTHORIZED</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.06em]">
                {settled ? "0.024" : "0.000"}
                <span className="ml-2 text-base tracking-normal">USDC</span>
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--ink)] font-mono text-[var(--acid)]">
              {settled ? "✓" : "—"}
            </span>
          </div>
          <p className="mt-8 text-sm leading-6 text-[var(--muted)]">
            {settled
              ? "Verification passed. The next milestone connects this authorization to an ERC-8183 job on Arc Testnet."
              : "No settlement can be authorized until the evidence envelope satisfies every obligation."}
          </p>
        </article>
      </section>
    </main>
  );
}
