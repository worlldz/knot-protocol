import { randomUUID } from "node:crypto";
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
  task: "Fetch a current, signed wallet risk assessment and return a confidence score.",
  maxPriceUsdc: 0.03,
  maxLatencyMs: 1_400,
  maxAgeSeconds: 90,
  requiredFields: ["risk", "confidence", "observedAt"],
  requireSignature: true,
};

function event(
  sequence: number,
  values: Omit<ExecutionEvent, "id" | "sequence">,
): ExecutionEvent {
  return { id: randomUUID(), sequence, ...values };
}

export async function executeJob(
  input: CreateExecutionInput = {},
  providers: ServiceProvider[] = localProviders,
  options: { origin?: string } = {},
): Promise<Execution> {
  const executionId = `run_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const obligation: Obligation = {
    ...defaultObligation,
    ...(input.task ? { task: input.task } : {}),
    ...(input.maxPriceUsdc ? { maxPriceUsdc: input.maxPriceUsdc } : {}),
  };
  const eligible = providers
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

    const canSettleLive = provider.id === "northstar-data"
      && Boolean(options.origin)
      && Boolean(process.env.X402_BUYER_PRIVATE_KEY?.startsWith("0x"))
      && Boolean(process.env.X402_SELLER_ADDRESS);

    if (canSettleLive) {
      try {
        const { payForResource } = await import("../x402/client");
        const paid = await payForResource<{
          provider: string;
          executionId: string;
          evidenceHash: string;
        }>(`${options.origin}/api/providers/northstar-data/settle`, {
          executionId,
          evidenceHash: delivery.evidenceHash,
        });

        events.push(event(events.length, {
          kind: "settlement",
          status: "success",
          title: `${paid.amountUsdc} USDC accepted over x402`,
          detail: "Gateway received the agent authorization and released the verified provider response for batched settlement.",
          providerId: provider.id,
          amountUsdc: provider.priceUsdc,
        }));

        return executionSchema.parse({
          id: executionId,
          createdAt: new Date().toISOString(),
          mode: "live",
          status: "verified",
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
