import { randomUUID } from "node:crypto";
import { buildObligation } from "./engine";
import type { CreateExecutionInput, Obligation } from "./schemas";

type ProviderCapability = {
  id: string;
  name: string;
  priceUsdc: number;
  reputation: number;
  proofSupport: boolean;
  endpoint: string;
  estimatedLatencyMs: number;
  maxEvidenceAgeSeconds: number;
  fields: string[];
};

export type QuoteProvider = ProviderCapability & {
  budgetEligible: boolean;
  canSatisfy: boolean;
  expectedOutcome: "can-satisfy" | "will-fallback" | "over-budget";
  reasons: string[];
  missingFields: string[];
};

export type ExecutionQuote = {
  id: string;
  createdAt: string;
  obligation: Obligation;
  decision: "ready" | "blocked";
  recommendedProvider: QuoteProvider | null;
  maxSpendUsdc: number;
  route: QuoteProvider[];
  rejectedProviders: QuoteProvider[];
  blockers: string[];
};

export const PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    id: "arc-baseline",
    name: "Arc Baseline",
    priceUsdc: 0.008,
    reputation: 78,
    proofSupport: false,
    endpoint: "/api/providers/arc-baseline/report",
    estimatedLatencyMs: 700,
    maxEvidenceAgeSeconds: 300,
    fields: [
      "risk",
      "observedAt",
      "balanceUsdc",
      "transactionCount",
      "accountType",
      "latestBlock",
      "methodology",
    ],
  },
  {
    id: "arc-sentinel",
    name: "Arc Sentinel",
    priceUsdc: 0.024,
    reputation: 96,
    proofSupport: true,
    endpoint: "/api/providers/arc-sentinel/report",
    estimatedLatencyMs: 1_100,
    maxEvidenceAgeSeconds: 90,
    fields: [
      "risk",
      "riskScore",
      "confidence",
      "observedAt",
      "balanceUsdc",
      "transactionCount",
      "accountType",
      "latestBlock",
      "signals",
      "methodology",
      "providerSigner",
    ],
  },
  {
    id: "arc-veritas",
    name: "Arc Veritas",
    priceUsdc: 0.045,
    reputation: 99,
    proofSupport: true,
    endpoint: "/api/providers/arc-veritas/report",
    estimatedLatencyMs: 1_650,
    maxEvidenceAgeSeconds: 30,
    fields: [
      "risk",
      "riskScore",
      "confidence",
      "observedAt",
      "balanceUsdc",
      "transactionCount",
      "accountType",
      "latestBlock",
      "signals",
      "methodology",
      "providerSigner",
      "bytecodeHash",
      "proofVersion",
      "inspectionScope",
    ],
  },
];

function assessProvider(obligation: Obligation, provider: ProviderCapability): QuoteProvider {
  const missingFields = obligation.requiredFields.filter((field) => !provider.fields.includes(field));
  const reasons: string[] = [];

  if (provider.priceUsdc > obligation.maxPriceUsdc) {
    reasons.push(`Quote exceeds the ${obligation.maxPriceUsdc.toFixed(3)} USDC ceiling.`);
  }
  if (provider.estimatedLatencyMs > obligation.maxLatencyMs) {
    reasons.push(`Estimated latency exceeds the ${obligation.maxLatencyMs}ms limit.`);
  }
  if (provider.maxEvidenceAgeSeconds > obligation.maxAgeSeconds) {
    reasons.push(`Freshness guarantee is weaker than the ${obligation.maxAgeSeconds}s limit.`);
  }
  if (obligation.requireSignature && !provider.proofSupport) {
    reasons.push("Signed provider evidence is required.");
  }
  if (missingFields.length > 0) {
    reasons.push(`Missing required fields: ${missingFields.join(", ")}.`);
  }

  const budgetEligible = provider.priceUsdc <= obligation.maxPriceUsdc;
  const canSatisfy = reasons.length === 0;

  return {
    ...provider,
    budgetEligible,
    canSatisfy,
    expectedOutcome: canSatisfy ? "can-satisfy" : budgetEligible ? "will-fallback" : "over-budget",
    reasons: canSatisfy ? ["Provider can satisfy this obligation without widening budget or policy."] : reasons,
    missingFields,
  };
}

export function quoteJob(input: CreateExecutionInput = {}): ExecutionQuote {
  const obligation = buildObligation(input);
  const assessed = PROVIDER_CAPABILITIES
    .map((provider) => assessProvider(obligation, provider))
    .sort((a, b) => a.priceUsdc - b.priceUsdc);
  const route = assessed.filter((provider) => provider.budgetEligible);
  const recommendedProvider = route.find((provider) => provider.canSatisfy) ?? null;
  const rejectedProviders = assessed.filter((provider) => !provider.canSatisfy);
  const blockers = recommendedProvider
    ? []
    : route.length === 0
      ? ["No provider fits the declared price ceiling."]
      : ["Every budget-eligible provider fails at least one obligation check."];

  return {
    id: `quote_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    createdAt: new Date().toISOString(),
    obligation,
    decision: recommendedProvider ? "ready" : "blocked",
    recommendedProvider,
    maxSpendUsdc: recommendedProvider?.priceUsdc ?? 0,
    route,
    rejectedProviders,
    blockers,
  };
}
