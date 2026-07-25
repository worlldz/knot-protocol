import type { JobType, PolicyPreset } from "./schemas";

export const JOB_TYPES: Record<JobType, {
  label: string;
  shortLabel: string;
  task: string;
  description: string;
}> = {
  counterparty: {
    label: "Counterparty check",
    shortLabel: "Counterparty",
    task: "Assess whether this wallet is suitable for a USDC payment using current Arc activity.",
    description: "Screen a wallet before an agent sends value.",
  },
  treasury: {
    label: "Treasury payout",
    shortLabel: "Treasury",
    task: "Check this wallet before approving a treasury payout and return signed risk evidence.",
    description: "Require stronger evidence before a treasury release.",
  },
  "agent-spend": {
    label: "Agent spend guard",
    shortLabel: "Agent spend",
    task: "Evaluate whether an autonomous agent should transact with this wallet under the selected policy.",
    description: "Place a deterministic guardrail in front of agent spend.",
  },
  "contract-review": {
    label: "Contract interaction",
    shortLabel: "Contract",
    task: "Inspect this Arc address before a contract interaction and return code-aware signed evidence.",
    description: "Escalate contract accounts to deeper bytecode-aware evidence.",
  },
};

export const POLICY_PRESETS: Record<Exclude<PolicyPreset, "custom">, {
  label: string;
  description: string;
  maxPriceUsdc: number;
  maxAgeSeconds: number;
  maxLatencyMs: number;
  requireSignature: boolean;
  requiredFields: string[];
  expectedProvider: string;
}> = {
  economy: {
    label: "Economy",
    description: "Fast public Arc facts for low-risk decisions.",
    maxPriceUsdc: 0.012,
    maxAgeSeconds: 300,
    maxLatencyMs: 5_000,
    requireSignature: false,
    requiredFields: ["risk", "observedAt", "balanceUsdc"],
    expectedProvider: "Arc Baseline",
  },
  balanced: {
    label: "Balanced",
    description: "Signed evidence for everyday agent payments.",
    maxPriceUsdc: 0.03,
    maxAgeSeconds: 90,
    maxLatencyMs: 5_000,
    requireSignature: true,
    requiredFields: [
      "risk",
      "confidence",
      "observedAt",
      "balanceUsdc",
      "transactionCount",
    ],
    expectedProvider: "Arc Sentinel",
  },
  strict: {
    label: "Strict",
    description: "Code-aware proof for treasury and contract decisions.",
    maxPriceUsdc: 0.05,
    maxAgeSeconds: 30,
    maxLatencyMs: 4_000,
    requireSignature: true,
    requiredFields: [
      "risk",
      "riskScore",
      "confidence",
      "observedAt",
      "balanceUsdc",
      "transactionCount",
      "latestBlock",
      "signals",
      "providerSigner",
      "bytecodeHash",
      "proofVersion",
    ],
    expectedProvider: "Arc Veritas",
  },
};

