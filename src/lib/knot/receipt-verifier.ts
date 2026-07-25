import { getExecution } from "./store";
import { verifyDelivery } from "./verification";

export type ReceiptVerificationInput = {
  id: string;
  evidenceHash?: string;
};

export type ReceiptVerification = {
  id: string;
  valid: boolean;
  status: "verified" | "blocked" | "missing" | "mismatch";
  checkedAt: string;
  reasons: string[];
  receipt: null | {
    executionId: string;
    createdAt: string;
    subject: string;
    provider: string | null;
    providerId: string | null;
    attempts: number;
    amountUsdc: number;
    rail: string;
    evidenceHash: string | null;
    settlementStatus: string;
    attestationStatus: string;
    transactionHash: string | null;
  };
};

function normalizeHash(value?: string | null) {
  return value?.toLowerCase() ?? null;
}

export async function verifyReceipt(input: ReceiptVerificationInput): Promise<ReceiptVerification> {
  const execution = await getExecution(input.id);
  const checkedAt = new Date().toISOString();

  if (!execution) {
    return {
      id: input.id,
      valid: false,
      status: "missing",
      checkedAt,
      reasons: ["No stored KNOT receipt matched that execution ID."],
      receipt: null,
    };
  }

  const accepted = execution.attempts.find((attempt) => attempt.outcome === "accepted") ?? null;
  const reasons: string[] = [];

  if (execution.status !== "verified") {
    reasons.push(`Execution status is ${execution.status}, not verified.`);
  }

  if (!accepted) {
    reasons.push("No provider attempt was accepted.");
  } else {
    const verification = verifyDelivery(execution.obligation, accepted.delivery);
    if (!verification.accepted) {
      reasons.push("Accepted provider delivery no longer satisfies the stored obligation.");
    }
    if (normalizeHash(execution.settlement.evidenceHash) !== normalizeHash(accepted.delivery.evidenceHash)) {
      reasons.push("Settlement evidence hash does not match the accepted provider delivery.");
    }
  }

  if (input.evidenceHash && normalizeHash(input.evidenceHash) !== normalizeHash(execution.settlement.evidenceHash)) {
    reasons.push("Submitted evidence hash does not match the stored receipt.");
  }

  if (execution.settlement.status === "blocked") {
    reasons.push("Settlement was blocked.");
  }

  const valid = reasons.length === 0;

  return {
    id: execution.id,
    valid,
    status: valid ? "verified" : input.evidenceHash ? "mismatch" : "blocked",
    checkedAt,
    reasons: valid
      ? ["Receipt exists, accepted evidence still satisfies the obligation, and settlement evidence is bound."]
      : reasons,
    receipt: {
      executionId: execution.id,
      createdAt: execution.createdAt,
      subject: execution.obligation.subject,
      provider: accepted?.provider ?? null,
      providerId: accepted?.providerId ?? null,
      attempts: execution.attempts.length,
      amountUsdc: execution.settlement.amountUsdc,
      rail: execution.settlement.rail,
      evidenceHash: execution.settlement.evidenceHash,
      settlementStatus: execution.settlement.status,
      attestationStatus: execution.settlement.attestation.status,
      transactionHash: execution.settlement.transactionHash,
    },
  };
}
