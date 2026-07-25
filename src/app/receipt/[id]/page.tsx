import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARC_TESTNET } from "@/lib/arc-network";
import { JOB_TYPES } from "@/lib/knot/catalog";
import { getExecution } from "@/lib/knot/store";

export const dynamic = "force-dynamic";

function shortHash(value: string | null) {
  return value ? `${value.slice(0, 12)}...${value.slice(-10)}` : "Not issued";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const execution = await getExecution(id);
  if (!execution) {
    return {
      title: "Receipt not found",
    };
  }

  const accepted = execution.attempts.find((attempt) => attempt.outcome === "accepted");
  const provider = accepted?.provider ?? "no accepted provider";
  const description = `${execution.status === "verified" ? "Verified" : "Blocked"} KNOT receipt for ${JOB_TYPES[execution.obligation.jobType].label.toLowerCase()} through ${provider}.`;

  return {
    title: `${execution.status === "verified" ? "Verified" : "Blocked"} receipt ${execution.id}`,
    description,
    openGraph: {
      title: `KNOT receipt ${execution.id}`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `KNOT receipt ${execution.id}`,
      description,
    },
  };
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const execution = await getExecution(id);
  if (!execution) notFound();

  const accepted = execution.attempts.find((attempt) => attempt.outcome === "accepted");
  const attestation = execution.settlement.attestation;

  return (
    <main className="receipt-document">
      <header>
        <Link href="/#receipts" className="receipt-wordmark"><i /><span><b>KNOT</b><small>VERIFIED OUTCOME RECEIPT</small></span></Link>
        <span className={`receipt-verdict is-${execution.status}`}><i />{execution.status.toUpperCase()}</span>
      </header>

      <section className="receipt-document-hero">
        <span>{JOB_TYPES[execution.obligation.jobType].label} / {execution.obligation.policyPreset} policy</span>
        <h1>{execution.status === "verified" ? "This outcome cleared." : "Payment stayed blocked."}</h1>
        <p>{execution.obligation.task}</p>
        <code>{execution.id}</code>
      </section>

      <section className="receipt-document-grid">
        <article>
          <span>SUBJECT</span>
          <h2>{execution.obligation.subject}</h2>
          <a href={`${ARC_TESTNET.explorerUrl}/address/${execution.obligation.subject}`} target="_blank" rel="noreferrer">Inspect on Arcscan</a>
        </article>
        <article>
          <span>ACCEPTED PROVIDER</span>
          <h2>{accepted?.provider ?? "No provider"}</h2>
          <p>{accepted ? `${accepted.priceUsdc.toFixed(3)} USDC · ${accepted.reputation}/100 reputation` : "No evidence satisfied the obligation."}</p>
        </article>
        <article>
          <span>SETTLEMENT</span>
          <h2>{execution.settlement.amountUsdc.toFixed(3)} USDC</h2>
          <p>{execution.settlement.rail.replaceAll("-", " ")} · {execution.settlement.status}</p>
        </article>
        <article>
          <span>ARC ATTESTATION</span>
          <h2>{attestation.status}</h2>
          <p>{attestation.jobId ? `Job ${attestation.jobId.slice(0, 16)}...` : "No onchain anchor requested"}</p>
        </article>
      </section>

      <section className="receipt-document-section">
        <div className="receipt-document-heading"><span>01</span><div><small>ROUTING</small><h2>Provider market</h2></div></div>
        <div className="receipt-attempts">
          {execution.attempts.map((attempt) => <article key={attempt.providerId} className={`is-${attempt.outcome}`}>
            <div><span>{attempt.provider}</span><b>{attempt.outcome.toUpperCase()}</b></div>
            <p>{attempt.verification.checks.filter((check) => !check.passed).map((check) => check.label).join(", ") || "Every policy check passed"}</p>
            <small>{attempt.priceUsdc.toFixed(3)} USDC · {attempt.delivery.latencyMs}ms · evidence {shortHash(attempt.delivery.evidenceHash)}</small>
          </article>)}
        </div>
      </section>

      <section className="receipt-document-section">
        <div className="receipt-document-heading"><span>02</span><div><small>PROOF</small><h2>Verification matrix</h2></div></div>
        <div className="receipt-checks">
          {(accepted ?? execution.attempts.at(-1))?.verification.checks.map((check) => <div key={check.key} className={check.passed ? "is-pass" : "is-fail"}><i>{check.passed ? "OK" : "NO"}</i><strong>{check.label}</strong><span>{check.detail}</span></div>)}
        </div>
      </section>

      <section className="receipt-document-section receipt-proof-block">
        <div className="receipt-document-heading"><span>03</span><div><small>COMMITMENT</small><h2>Machine-verifiable anchors</h2></div></div>
        <dl>
          <div><dt>Evidence hash</dt><dd>{execution.settlement.evidenceHash ?? "Not issued"}</dd></div>
          <div><dt>Gateway transfer</dt><dd>{execution.settlement.transactionHash || "Preview execution"}</dd></div>
          <div><dt>Hook contract</dt><dd>{attestation.hookAddress || "Not requested"}</dd></div>
          <div><dt>Attestation transaction</dt><dd>{attestation.transactionHash || "Not broadcast"}</dd></div>
          <div><dt>Valid until</dt><dd>{attestation.validUntil ? new Date(attestation.validUntil).toLocaleString() : "Not applicable"}</dd></div>
        </dl>
        <div className="receipt-proof-actions">
          <a href={`/api/executions/${execution.id}`} target="_blank" rel="noreferrer">Open JSON receipt</a>
          <a href={`/api/receipts/verify?id=${execution.id}${execution.settlement.evidenceHash ? `&evidenceHash=${execution.settlement.evidenceHash}` : ""}`} target="_blank" rel="noreferrer">Verify binding</a>
          {attestation.transactionHash && <a href={`${ARC_TESTNET.explorerUrl}/tx/${attestation.transactionHash}`} target="_blank" rel="noreferrer">Inspect attestation on Arcscan</a>}
        </div>
      </section>

      <footer><span>Generated {new Date(execution.createdAt).toLocaleString()}</span><b>PAY FOR VERIFIED OUTCOMES</b></footer>
    </main>
  );
}
