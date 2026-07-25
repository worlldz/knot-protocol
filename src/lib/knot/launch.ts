import { createKnotManifest } from "./manifest";

type LaunchOptions = {
  baseUrl?: string;
};

function cleanBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function createKnotLaunchKit(options: LaunchOptions = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl);
  const manifest = createKnotManifest({ baseUrl });

  return {
    name: "KNOT",
    status: "testnet-ready",
    headline: "A clearing layer for autonomous commerce where agents pay only for verified outcomes.",
    whyCreated: [
      "Machine payments can move faster than human review.",
      "A payment receipt alone does not prove the paid service delivered current, signed, policy-valid work.",
      "KNOT creates a verification boundary before autonomous agents spend USDC or complete an onchain job.",
    ],
    product: {
      category: "verification-native settlement",
      chain: manifest.chain,
      primaryUser: "autonomous buyer agents that need proof before spending value",
      promise: "turn a buyer intent into measurable obligations, reject weak evidence, and settle only the accepted result",
    },
    domainReadiness: {
      currentHost: baseUrl || "local-development",
      customDomainReady: true,
      canonicalDomainConfigured: false,
      recommendedHostnames: ["knot.market", "knotprotocol.xyz", "useknot.xyz"],
      nextAction: "Attach a purchased hostname through Sites custom domain and publish the same validated source under that brand.",
      note: "The product is host-agnostic. A preview host is not part of the KNOT brand.",
    },
    utility: [
      "Buyer agents can preflight provider route, expected spend, and fallback reasons before execution.",
      "Treasury agents can require signed wallet evidence before releasing USDC.",
      "Providers can sell machine-readable evidence instead of opaque prose responses.",
      "Protocols can require an accepted evidence hash before allowing an onchain job to complete.",
      "Auditors can verify receipts by execution ID and evidence hash without reading private global history.",
    ],
    launchSurfaces: {
      console: absoluteUrl(baseUrl, "/"),
      discovery: manifest.endpoints.discovery.url,
      openapi: manifest.endpoints.openapi.url,
      manifest: manifest.endpoints.manifest.url,
      submission: manifest.endpoints.submission.url,
      launchKit: absoluteUrl(baseUrl, "/api/launch"),
      marketplace: absoluteUrl(baseUrl, "/api/marketplace"),
      quote: manifest.endpoints.quoteExecution.url,
      execute: manifest.endpoints.runExecution.url,
      verifyReceipt: manifest.endpoints.verifyReceipt.url,
      status: manifest.endpoints.systemStatus.url,
    },
    evidence: {
      contracts: manifest.contracts,
      latestProof: manifest.latestProof,
      proofChecklist: [
        "Economy, Balanced, and Strict policies choose different providers and prices.",
        "Weak evidence is rejected before payment authorization.",
        "Accepted evidence becomes a receipt and can be checked by hash.",
        "The Arc Testnet commerce contract and hook are deployed and source verified.",
        "A completed testnet job links the evidence hash to the onchain completion path.",
      ],
    },
    goToMarket: {
      beachhead: [
        "agent treasury operations",
        "wallet counterparty screening",
        "paid data and risk APIs",
        "agent-to-agent service marketplaces",
      ],
      wedge: "start as an evidence router for Arc-native agent payments, then become the settlement standard for paid machine work",
      revenue: [
        "protocol fee on accepted settlements",
      "provider marketplace fees",
        "enterprise verifier and audit endpoints",
        "premium policy templates for treasury and risk teams",
      ],
    },
    tgeNarrative: {
      principle: "Any future token should coordinate verification supply, provider reputation, and protocol governance, not replace USDC settlement.",
      nonSpeculativeUtility: [
        "provider reputation and challenge markets",
        "policy template governance",
        "fee routing and verifier incentives",
        "operator staking for evidence availability and signer quality",
      ],
      guardrail: "The hackathon build does not require a token to work. USDC remains the payment and settlement asset.",
    },
    demoScript: [
      "Open the console.",
      "Run Judge Mode.",
      "Show Economy accepting Arc Baseline in one attempt.",
      "Show Balanced falling back to Arc Sentinel.",
      "Show Strict falling back to Arc Veritas.",
      "Open the receipt and verify the evidence hash.",
      "Open /.well-known/knot, /api/openapi, /api/submission, and /api/launch.",
      "Open /api/marketplace to show provider supply and accepted-settlement economics.",
      "Open the Arcscan links for the deployed commerce contract, hook, attestation, and completed job.",
    ],
    launchGaps: [
      "Attach a clean custom domain before public judging or investor sharing.",
      "Move hosted preview receipts from worker memory to durable storage before a public pilot.",
      "Configure live Circle and x402 credentials in the hosted environment for production paid execution.",
    ],
  };
}
