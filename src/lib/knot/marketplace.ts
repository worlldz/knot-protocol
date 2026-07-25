import { JOB_TYPES, POLICY_PRESETS } from "./catalog";
import { createKnotManifest } from "./manifest";
import { PROVIDER_CAPABILITIES } from "./quote";

type MarketplaceOptions = {
  baseUrl?: string;
};

const PROTOCOL_FEE_BPS = 120;

const PROVIDER_META: Record<string, {
  category: string;
  proofTier: "snapshot" | "signed" | "code-aware";
  minPolicy: "economy" | "balanced" | "strict";
  buyerFit: string;
  supplierPitch: string;
}> = {
  "arc-baseline": {
    category: "public Arc state",
    proofTier: "snapshot",
    minPolicy: "economy",
    buyerFit: "cheap preflight checks where unsigned public state is enough",
    supplierPitch: "sell fast, low-cost Arc observations into agent workflows",
  },
  "arc-sentinel": {
    category: "signed risk evidence",
    proofTier: "signed",
    minPolicy: "balanced",
    buyerFit: "everyday autonomous payments that need signed evidence before spend",
    supplierPitch: "earn more by returning signed, policy-valid wallet evidence",
  },
  "arc-veritas": {
    category: "code-aware verification",
    proofTier: "code-aware",
    minPolicy: "strict",
    buyerFit: "treasury, contract, and high-risk interactions that need deeper proof",
    supplierPitch: "capture premium strict-policy demand with richer evidence envelopes",
  },
};

function cleanBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

function roundUsdc(value: number) {
  return Number(value.toFixed(6));
}

function feeFor(priceUsdc: number) {
  const protocolFeeUsdc = roundUsdc((priceUsdc * PROTOCOL_FEE_BPS) / 10_000);
  return {
    providerPriceUsdc: priceUsdc,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    protocolFeeUsdc,
    buyerTotalUsdc: roundUsdc(priceUsdc + protocolFeeUsdc),
    providerNetUsdc: priceUsdc,
  };
}

export function createKnotMarketplace(options: MarketplaceOptions = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl);
  const manifest = createKnotManifest({ baseUrl });

  const providers = PROVIDER_CAPABILITIES.map((provider) => ({
    ...provider,
    ...PROVIDER_META[provider.id],
    fee: feeFor(provider.priceUsdc),
  }));

  return {
    name: "KNOT Marketplace",
    version: manifest.version,
    description: "Provider supply, buyer demand, and clearing economics for verified agent work on KNOT.",
    settlementAsset: manifest.chain.nativeAsset,
    chain: manifest.chain,
    protocolFee: {
      bps: PROTOCOL_FEE_BPS,
      description: "Charged only on accepted provider work. Rejected evidence does not earn provider payment or protocol fee.",
    },
    providers,
    policyProducts: Object.entries(POLICY_PRESETS).map(([id, policy]) => ({
      id,
      label: policy.label,
      buyerUseCase: policy.description,
      expectedProvider: policy.expectedProvider,
      maxPriceUsdc: policy.maxPriceUsdc,
      expectedFee: feeFor(policy.maxPriceUsdc),
    })),
    jobDemand: Object.entries(JOB_TYPES).map(([id, job]) => ({
      id,
      label: job.label,
      description: job.description,
      defaultTask: job.task,
    })),
    revenueModel: {
      wedge: "KNOT starts as the clearing layer between buyer agents and paid evidence providers.",
      earnsWhen: "an accepted provider delivery satisfies the buyer obligation",
      doesNotEarnWhen: "evidence is rejected, over budget, stale, unsigned when required, or missing required fields",
      exampleStrictClear: feeFor(0.045),
    },
    onboarding: {
      buyer: [
        "Discover KNOT through /.well-known/knot.",
        "Call /api/quote to preflight route, max spend, and fallback reasons.",
        "Run /api/executions when the obligation is acceptable.",
        "Verify the receipt through /api/receipts/verify before downstream settlement or audit.",
      ],
      provider: [
        "Expose a paid evidence endpoint with deterministic schema.",
        "Declare price, latency, freshness, fields, and signing support.",
        "Return evidence that can be hashed and verified against the buyer obligation.",
        "Earn only when KNOT accepts the delivery and settlement unlocks.",
      ],
    },
    endpoints: {
      marketplace: absoluteUrl(baseUrl, "/api/marketplace"),
      discovery: manifest.endpoints.discovery.url,
      manifest: manifest.endpoints.manifest.url,
      quote: manifest.endpoints.quoteExecution.url,
      execute: manifest.endpoints.runExecution.url,
      verifyReceipt: manifest.endpoints.verifyReceipt.url,
    },
  };
}
