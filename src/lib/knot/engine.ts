import { randomUUID } from "node:crypto";
import { attestEvidence } from "./attestation";
import { POLICY_PRESETS } from "./catalog";
import { localProviders, type ServiceProvider } from "./providers";
import type {
  CreateExecutionInput,
  Execution,
  ExecutionEvent,
  Obligation,
  ProviderAttempt,
} from "./schemas";
import { executionSchema } from "./schemas";
import { verifyDelivery } from "./verification";

export const defaultObligation: Obligation = {
  jobType: "counterparty",
  policyPreset: "balanced",
  task: "Fetch a current, signed wallet risk assessment and return a confidence score.",
  subject: "0x0000000000000000000000000000000000000001",
  maxPriceUsdc: 0.03,
  maxLatencyMs: 1_400,
  maxAgeSeconds: 90,
  requiredFields: ["risk", "confidence", "observedAt"],
  requireSignature: true,
};

export function buildObligation(input: CreateExecutionInput = {}): Obligation {
  const selectedPolicy = input.policyPreset && input.policyPreset !== "custom"
    ? POLICY_PRESETS[input.policyPreset]
    : null;

  return {
    ...defaultObligation,
    ...(input.jobType ? { jobType: input.jobType } : {}),
    ...(input.policyPreset ? { policyPreset: input.policyPreset } : {}),
    ...(input.task ? { task: input.task } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    maxPriceUsdc: input.maxPriceUsdc ?? selectedPolicy?.maxPriceUsdc ?? defaultObligation.maxPriceUsdc,
    maxLatencyMs: input.maxLatencyMs ?? selectedPolicy?.maxLatencyMs ?? defaultObligation.maxLatencyMs,
    maxAgeSeconds: input.maxAgeSeconds ?? selectedPolicy?.maxAgeSeconds ?? defaultObligation.maxAgeSeconds,
    requiredFields: input.requiredFields ?? selectedPolicy?.requiredFields ?? defaultObligation.requiredFields,
    requireSignature: input.requireSignature ?? selectedPolicy?.requireSignature ?? defaultObligation.requireSignature,
  };
}

function event(
  sequence: number,
  values: Omit<ExecutionEvent, "id" | "sequence">,
): ExecutionEvent {
  return { id: randomUUID(), sequence, ...values };
}

export async function executeJob(
  input: CreateExecutionInput = {},
  providers: ServiceProvider[] = localProviders,
  options: {
    origin?: string;
    owner?: string;
    agentWallet?: { id: string; address: string };
    allowProtocolFunding?: boolean;
  } = {},
): Promise<Execution> {
  const executionId = `run_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const obligation = buildObligation(input);
  const activeProviders = options.origin && providers === localProviders
    ? [
        {
          id: "arc-baseline",
          name: "Arc Baseline",
          priceUsdc: 0.008,
          reputation: 78,
          proofSupport: false,
          endpoint: "/api/providers/arc-baseline/report",
          request: async () => (await import("./arc-risk")).createArcBaselineDelivery(obligation.subject, obligation.task),
        },
        {
          id: "arc-sentinel",
          name: "Arc Sentinel",
          priceUsdc: 0.024,
          reputation: 96,
          proofSupport: true,
          endpoint: "/api/providers/arc-sentinel/report",
          request: async () => (await import("./arc-risk")).createArcRiskDelivery(obligation.subject, obligation.task),
        },
        {
          id: "arc-veritas",
          name: "Arc Veritas",
          priceUsdc: 0.045,
          reputation: 99,
          proofSupport: true,
          endpoint: "/api/providers/arc-veritas/report",
          request: async () => (await import("./arc-risk")).createArcDeepRiskDelivery(obligation.subject, obligation.task),
        },
      ] satisfies ServiceProvider[]
    : providers;
  const eligible = activeProviders
    .filter((provider) => provider.priceUsdc <= obligation.maxPriceUsdc)
    .sort((a, b) => a.priceUsdc - b.priceUsdc);

  const events: ExecutionEvent[] = [
    event(0, {
      kind: "discovery",
      status: "neutral",
      title: `${eligible.length} eligible providers discovered`,
      detail: "KNOT ranked offers by budget, proof support, and reputation.",
    }),
  ];
  const attempts: ProviderAttempt[] = [];

  for (const provider of eligible) {
    events.push(
      event(events.length, {
        kind: "quote",
        status: "neutral",
        title: `${provider.name} quoted ${provider.priceUsdc.toFixed(3)} USDC`,
        detail: "The offer fits the job ceiling. A delivery was requested.",
        providerId: provider.id,
        amountUsdc: provider.priceUsdc,
      }),
      event(events.length + 1, {
        kind: "payment",
        status: "neutral",
        title: "Payment intent prepared",
        detail: "Authorization remains conditional while KNOT opens the evidence envelope.",
        providerId: provider.id,
        amountUsdc: provider.priceUsdc,
      }),
    );

    const delivery = await provider.request(obligation);
    const verification = verifyDelivery(obligation, delivery);
    attempts.push({
      providerId: provider.id,
      provider: provider.name,
      priceUsdc: provider.priceUsdc,
      reputation: provider.reputation,
      proofSupport: provider.proofSupport,
      outcome: verification.accepted ? "accepted" : "rejected",
      delivery,
      verification,
    });

    if (!verification.accepted) {
      const failed = verification.checks
        .filter((check) => !check.passed)
        .map((check) => check.label.toLowerCase())
        .join(" and ");
      events.push(
        event(events.length, {
          kind: "verification",
          status: "failure",
          title: `${provider.name} failed verification`,
          detail: `Rejected on ${failed}. Settlement stayed blocked.`,
          providerId: provider.id,
        }),
        event(events.length + 1, {
          kind: "fallback",
          status: "neutral",
          title: "Fallback policy activated",
          detail: "The buyer agent continued without human intervention or budget expansion.",
          providerId: provider.id,
        }),
      );
      continue;
    }

    events.push(
      event(events.length, {
        kind: "verification",
        status: "success",
        title: `${provider.name} satisfied every obligation`,
        detail: "Price, latency, freshness, schema, and signature checks passed.",
        providerId: provider.id,
      }),
    );

    const canSettleLive = provider.id !== "arc-baseline"
      && Boolean(options.origin)
      && Boolean(options.agentWallet || (
        options.allowProtocolFunding
        && process.env.X402_BUYER_PRIVATE_KEY?.startsWith("0x")
      ))
      && Boolean(process.env.X402_SELLER_ADDRESS);

    if (canSettleLive) {
      try {
        const { payForResource, payForResourceWithCircleAgent } = await import("../x402/client");
        const settlementUrl = `${options.origin}/api/providers/${provider.id}/settle`;
        const settlementBody = {
          executionId,
          evidenceHash: delivery.evidenceHash,
          subject: obligation.subject,
        };
        const paid = options.agentWallet
          ? await payForResourceWithCircleAgent<{
              provider: string;
              executionId: string;
              evidenceHash: string;
            }>(options.agentWallet, settlementUrl, settlementBody)
          : await payForResource<{
          provider: string;
          executionId: string;
          evidenceHash: string;
        }>(settlementUrl, settlementBody);

        events.push(event(events.length, {
          kind: "settlement",
          status: "success",
          title: `${paid.amountUsdc} USDC accepted over x402`,
          detail: options.agentWallet
            ? "The personal Circle MPC agent signed the x402 authorization. Gateway released the verified response for batched settlement."
            : "Gateway received the protocol agent authorization and released the verified response for batched settlement.",
          providerId: provider.id,
          amountUsdc: provider.priceUsdc,
        }));

        const attestation = await attestEvidence(executionId, delivery.evidenceHash);
        events.push(event(events.length, {
          kind: "settlement",
          status: attestation.status === "confirmed" ? "success" : "failure",
          title: attestation.status === "confirmed"
            ? "Evidence anchored on Arc"
            : "Evidence anchor unavailable",
          detail: attestation.status === "confirmed"
            ? "The accepted evidence hash is now an active KNOT hook attestation for ERC-8183 completion."
            : attestation.status === "failed"
              ? "The x402 payment was received, but the onchain hook attestation failed and is reported separately."
              : "The x402 payment was received without an onchain attester configured.",
          providerId: provider.id,
        }));

        return executionSchema.parse({
          id: executionId,
          createdAt: new Date().toISOString(),
          mode: "live",
          status: "verified",
          owner: options.owner ?? null,
          obligation,
          events,
          attempts,
          settlement: {
            status: "received",
            amountUsdc: provider.priceUsdc,
            recipient: process.env.X402_SELLER_ADDRESS,
            rail: "x402-gateway",
            evidenceHash: delivery.evidenceHash,
            transactionHash: paid.transactionHash,
            attestation,
          },
        });
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : "The x402 payment could not be completed.";
        events.push(event(events.length, {
          kind: "settlement",
          status: "failure",
          title: "x402 settlement blocked",
          detail,
          providerId: provider.id,
          amountUsdc: provider.priceUsdc,
        }));

        return executionSchema.parse({
          id: executionId,
          createdAt: new Date().toISOString(),
          mode: "live",
          status: "failed",
          owner: options.owner ?? null,
          obligation,
          events,
          attempts,
          settlement: {
            status: "blocked",
            amountUsdc: 0,
            recipient: process.env.X402_SELLER_ADDRESS,
            rail: "x402-gateway",
            evidenceHash: delivery.evidenceHash,
            transactionHash: null,
          },
        });
      }
    }

    events.push(event(events.length, {
      kind: "settlement",
      status: "success",
      title: `${provider.priceUsdc.toFixed(3)} USDC authorized`,
      detail: "The accepted evidence hash is now bound to settlement authorization.",
      providerId: provider.id,
      amountUsdc: provider.priceUsdc,
    }));

    return executionSchema.parse({
      id: executionId,
      createdAt: new Date().toISOString(),
      mode: "local",
      status: "verified",
      owner: options.owner ?? null,
      obligation,
      events,
      attempts,
      settlement: {
        status: "authorized",
        amountUsdc: provider.priceUsdc,
        recipient: provider.id,
        rail: "simulated",
        evidenceHash: delivery.evidenceHash,
        transactionHash: null,
      },
    });
  }

  events.push(
    event(events.length, {
      kind: "settlement",
      status: "failure",
      title: "Settlement blocked",
      detail: "No eligible provider produced evidence that satisfied the obligation.",
    }),
  );

  return executionSchema.parse({
    id: executionId,
    createdAt: new Date().toISOString(),
    mode: "local",
    status: "failed",
    owner: options.owner ?? null,
    obligation,
    events,
    attempts,
    settlement: {
      status: "blocked",
      amountUsdc: 0,
      recipient: null,
      rail: "simulated",
      evidenceHash: null,
      transactionHash: null,
    },
  });
}
