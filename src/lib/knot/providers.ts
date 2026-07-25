import { createHash } from "node:crypto";
import type { Delivery, Obligation } from "./schemas";

export type ProviderQuote = {
  id: string;
  name: string;
  priceUsdc: number;
  reputation: number;
  proofSupport: boolean;
  endpoint: string;
};

export type ServiceProvider = ProviderQuote & {
  request: (obligation: Obligation) => Promise<Delivery>;
};

function evidenceHash(value: unknown) {
  return `0x${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function makeDelivery(
  quote: ProviderQuote,
  values: Pick<Delivery, "latencyMs" | "ageSeconds" | "signatureValid" | "payload">,
): Delivery {
  const envelope = {
    providerId: quote.id,
    priceUsdc: quote.priceUsdc,
    ...values,
  };

  return {
    providerId: quote.id,
    provider: quote.name,
    priceUsdc: quote.priceUsdc,
    ...values,
    evidenceHash: evidenceHash(envelope),
  };
}

export const localProviders: ServiceProvider[] = [
  {
    id: "arc-baseline",
    name: "Arc Baseline",
    priceUsdc: 0.008,
    reputation: 78,
    proofSupport: false,
    endpoint: "/api/providers/arc-baseline/report",
    async request() {
      return makeDelivery(this, {
        latencyMs: 482,
        ageSeconds: 410,
        signatureValid: false,
        payload: { risk: "low", observedAt: "stale" },
      });
    },
  },
  {
    id: "arc-sentinel",
    name: "Arc Sentinel",
    priceUsdc: 0.024,
    reputation: 96,
    proofSupport: true,
    endpoint: "/api/providers/arc-sentinel/report",
    async request() {
      return makeDelivery(this, {
        latencyMs: 731,
        ageSeconds: 18,
        signatureValid: true,
        payload: {
          risk: "medium",
          confidence: 0.94,
          observedAt: "current",
        },
      });
    },
  },
];
