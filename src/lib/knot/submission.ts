import { createKnotManifest } from "./manifest";

type SubmissionOptions = {
  baseUrl?: string;
};

function cleanBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function createKnotSubmission(options: SubmissionOptions = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl);
  const manifest = createKnotManifest({ baseUrl });

  return {
    name: "KNOT",
    tagline: "Pay for verified outcomes, not unproven responses.",
    oneLiner: "KNOT is a verification-native settlement layer for autonomous agent work on Arc.",
    problem: [
      "Agent payments are becoming easy, but agent accountability is still thin.",
      "x402 can prove a payment happened, but not that the paid service delivered fresh, signed, policy-valid evidence.",
      "Autonomous agents need a clearing layer that can reject weak work before money or onchain completion moves.",
    ],
    solution: [
      "Compile each buyer request into a measurable obligation.",
      "Preflight provider route and max spend before execution.",
      "Run providers through deterministic evidence checks.",
      "Fallback automatically when cheaper evidence fails.",
      "Bind accepted evidence to a durable receipt, x402 settlement, and ERC-8183-style completion hook.",
    ],
    users: [
      "Treasury agents that need proof before releasing USDC.",
      "Agent wallets that need counterparty checks before sending value.",
      "API providers that want to sell machine-readable evidence instead of prose answers.",
      "Protocols that need an evidence hash before allowing a job to complete onchain.",
    ],
    liveProof: {
      chain: manifest.chain,
      commerce: manifest.contracts.commerce,
      hook: manifest.contracts.hook,
      latestProof: manifest.latestProof,
    },
    workingSurface: {
      console: absoluteUrl(baseUrl, "/"),
      discovery: absoluteUrl(baseUrl, "/.well-known/knot"),
      openapi: absoluteUrl(baseUrl, "/api/openapi"),
      manifest: absoluteUrl(baseUrl, "/api/manifest"),
      launch: absoluteUrl(baseUrl, "/api/launch"),
      quote: manifest.endpoints.quoteExecution.url,
      execute: manifest.endpoints.runExecution.url,
      verifyReceipt: manifest.endpoints.verifyReceipt.url,
      status: manifest.endpoints.systemStatus.url,
    },
    demoFlow: [
      "Open the console and run Judge Mode.",
      "Economy accepts Arc Baseline in one attempt at 0.008 USDC.",
      "Balanced rejects Baseline and accepts Arc Sentinel at 0.024 USDC.",
      "Strict rejects Baseline and Sentinel, then accepts Arc Veritas at 0.045 USDC.",
      "Open the generated receipt and verify its evidence hash.",
      "Inspect the Arc Testnet commerce contract, hook, attestation transaction, and completed job.",
    ],
    judgeChecklist: [
      "Different policies produce different provider routes.",
      "Bad evidence is rejected before settlement.",
      "Receipts are explicit-id, machine-readable, and verifiable.",
      "Arc Testnet contracts are deployed and source verified.",
      "OpenAPI and discovery endpoints let external agents integrate without reading the UI.",
      "The launch kit explains domain readiness, utility, revenue paths, and TGE guardrails.",
      "The public worker export can run quote, preview execution, receipt lookup, and verification.",
    ],
    whyNow: [
      "Autonomous commerce needs trust boundaries before agents can safely spend at scale.",
      "Arc gives the stablecoin-native settlement rail.",
      "x402 gives HTTP-native payment negotiation.",
      "KNOT adds the missing proof and clearing layer between request, payment, and onchain completion.",
    ],
  };
}
