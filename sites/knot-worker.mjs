const API_VERSION = "2026-07-24";
const EXAMPLE_SUBJECT = "0x0000000000000000000000000000000000000001";
const RECEIPTS = new Map();

const JOBS = {
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

const POLICIES = {
  economy: {
    label: "Economy",
    description: "Fast public Arc facts for low-risk decisions.",
    maxPriceUsdc: 0.012,
    maxAgeSeconds: 300,
    maxLatencyMs: 5000,
    requireSignature: false,
    requiredFields: ["risk", "observedAt", "balanceUsdc"],
    expectedProvider: "Arc Baseline",
  },
  balanced: {
    label: "Balanced",
    description: "Signed evidence for everyday agent payments.",
    maxPriceUsdc: 0.03,
    maxAgeSeconds: 90,
    maxLatencyMs: 5000,
    requireSignature: true,
    requiredFields: ["risk", "confidence", "observedAt", "balanceUsdc", "transactionCount"],
    expectedProvider: "Arc Sentinel",
  },
  strict: {
    label: "Strict",
    description: "Code-aware proof for treasury and contract decisions.",
    maxPriceUsdc: 0.05,
    maxAgeSeconds: 30,
    maxLatencyMs: 4000,
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

const PROVIDERS = [
  {
    id: "arc-baseline",
    name: "Arc Baseline",
    priceUsdc: 0.008,
    reputation: 78,
    proofSupport: false,
    endpoint: "/api/providers/arc-baseline/report",
    estimatedLatencyMs: 700,
    maxEvidenceAgeSeconds: 300,
    fields: ["risk", "observedAt", "balanceUsdc", "transactionCount", "accountType", "latestBlock", "methodology"],
  },
  {
    id: "arc-sentinel",
    name: "Arc Sentinel",
    priceUsdc: 0.024,
    reputation: 96,
    proofSupport: true,
    endpoint: "/api/providers/arc-sentinel/report",
    estimatedLatencyMs: 1100,
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
    estimatedLatencyMs: 1650,
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

const PROTOCOL_FEE_BPS = 120;

const PROVIDER_META = {
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

const ARC_DEPLOYMENT = {
  network: "Arc Testnet",
  chainId: 5042002,
  paymentToken: "0x3600000000000000000000000000000000000000",
  commerce: {
    contract: "KnotCommerce",
    address: "0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f",
    verified: true,
    explorerUrl: "https://testnet.arcscan.app/address/0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f",
  },
  hook: {
    contract: "KnotVerificationHook",
    address: "0x73b00398580ba7a19ffb7a5677cf3970e15918d5",
    verified: true,
    explorerUrl: "https://testnet.arcscan.app/address/0x73b00398580ba7a19ffb7a5677cf3970e15918d5",
  },
};

const LATEST_PROOF = {
  status: "Completed",
  jobId: "1",
  executionId: "run_d83ad375d77a",
  evidenceHash: "0x7e758fd3a8f4cfb74a4a1e708bec80694fa37553b09e768dcf11eaf85e88c016",
  attestationExplorerUrl: "https://testnet.arcscan.app/tx/0xa61b706111781ce3d9b26f1dc7012dedcb1a33b4cd6b2b63046aff223c0542b2",
  completionExplorerUrl: "https://testnet.arcscan.app/tx/0x97b6e863f1308fc11d2484495f9742be54e5f721ceaed55820e864b2b0a30f8d",
};

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function baseUrlFrom(request) {
  return new URL(request.url).origin;
}

function absolute(baseUrl, path) {
  return `${baseUrl}${path}`;
}

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function roundUsdc(value) {
  return Number(value.toFixed(6));
}

function feeFor(priceUsdc) {
  const protocolFeeUsdc = roundUsdc((priceUsdc * PROTOCOL_FEE_BPS) / 10000);
  return {
    providerPriceUsdc: priceUsdc,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    protocolFeeUsdc,
    buyerTotalUsdc: roundUsdc(priceUsdc + protocolFeeUsdc),
    providerNetUsdc: priceUsdc,
  };
}

function buildObligation(input = {}) {
  const selectedPolicy = input.policyPreset && input.policyPreset !== "custom" ? POLICIES[input.policyPreset] : null;
  return {
    jobType: input.jobType && JOBS[input.jobType] ? input.jobType : "counterparty",
    policyPreset: input.policyPreset && (POLICIES[input.policyPreset] || input.policyPreset === "custom") ? input.policyPreset : "balanced",
    task: typeof input.task === "string" && input.task.trim().length >= 12
      ? input.task.trim().slice(0, 280)
      : "Fetch a current, signed wallet risk assessment and return a confidence score.",
    subject: isAddress(input.subject) ? input.subject : EXAMPLE_SUBJECT,
    maxPriceUsdc: Number.isFinite(input.maxPriceUsdc) ? Math.max(0.001, Math.min(1, input.maxPriceUsdc)) : selectedPolicy?.maxPriceUsdc ?? 0.03,
    maxLatencyMs: Number.isInteger(input.maxLatencyMs) ? Math.max(1, Math.min(30000, input.maxLatencyMs)) : selectedPolicy?.maxLatencyMs ?? 1400,
    maxAgeSeconds: Number.isInteger(input.maxAgeSeconds) ? Math.max(1, Math.min(86400, input.maxAgeSeconds)) : selectedPolicy?.maxAgeSeconds ?? 90,
    requiredFields: Array.isArray(input.requiredFields) && input.requiredFields.length > 0
      ? input.requiredFields.filter((field) => typeof field === "string").slice(0, 12)
      : selectedPolicy?.requiredFields ?? ["risk", "confidence", "observedAt"],
    requireSignature: typeof input.requireSignature === "boolean" ? input.requireSignature : selectedPolicy?.requireSignature ?? true,
  };
}

function assessProvider(obligation, provider) {
  const missingFields = obligation.requiredFields.filter((field) => !provider.fields.includes(field));
  const reasons = [];
  if (provider.priceUsdc > obligation.maxPriceUsdc) reasons.push(`Quote exceeds the ${obligation.maxPriceUsdc.toFixed(3)} USDC ceiling.`);
  if (provider.estimatedLatencyMs > obligation.maxLatencyMs) reasons.push(`Estimated latency exceeds the ${obligation.maxLatencyMs}ms limit.`);
  if (provider.maxEvidenceAgeSeconds > obligation.maxAgeSeconds) reasons.push(`Freshness guarantee is weaker than the ${obligation.maxAgeSeconds}s limit.`);
  if (obligation.requireSignature && !provider.proofSupport) reasons.push("Signed provider evidence is required.");
  if (missingFields.length > 0) reasons.push(`Missing required fields: ${missingFields.join(", ")}.`);
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

function quoteJob(input = {}) {
  const obligation = buildObligation(input);
  const assessed = PROVIDERS.map((provider) => assessProvider(obligation, provider)).sort((a, b) => a.priceUsdc - b.priceUsdc);
  const route = assessed.filter((provider) => provider.budgetEligible);
  const recommendedProvider = route.find((provider) => provider.canSatisfy) ?? null;
  return {
    id: `quote_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    createdAt: new Date().toISOString(),
    obligation,
    decision: recommendedProvider ? "ready" : "blocked",
    recommendedProvider,
    maxSpendUsdc: recommendedProvider?.priceUsdc ?? 0,
    route,
    rejectedProviders: assessed.filter((provider) => !provider.canSatisfy),
    blockers: recommendedProvider
      ? []
      : route.length === 0
        ? ["No provider fits the declared price ceiling."]
        : ["Every budget-eligible provider fails at least one obligation check."],
  };
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function createExecution(input = {}) {
  const quote = quoteJob(input);
  const now = new Date().toISOString();
  const executionId = `run_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const route = quote.route.slice(0, quote.recommendedProvider ? quote.route.findIndex((item) => item.id === quote.recommendedProvider.id) + 1 : quote.route.length);
  const attempts = [];
  const events = [
    {
      id: crypto.randomUUID(),
      sequence: 0,
      kind: "discovery",
      status: "neutral",
      title: `${quote.route.length} eligible providers discovered`,
      detail: "The public worker export ranked offers by budget, proof support, and provider capability.",
    },
  ];

  for (const provider of route) {
    const accepted = provider.canSatisfy;
    const payload = {
      subject: quote.obligation.subject,
      decisionRequest: quote.obligation.task,
      risk: provider.id === "arc-baseline" ? "low" : "medium",
      riskScore: provider.id === "arc-baseline" ? undefined : 42,
      confidence: provider.id === "arc-baseline" ? undefined : provider.id === "arc-veritas" ? 0.97 : 0.92,
      observedAt: now,
      balanceUsdc: 0,
      transactionCount: 0,
      latestBlock: 0,
      signals: provider.id === "arc-baseline" ? undefined : ["Public worker export", "Policy-capability route", "Arc Testnet proof linked"],
      providerSigner: provider.proofSupport ? "0x20bBf0cc5F509B1A84A980a9165E10CD5a5412d9" : undefined,
      bytecodeHash: provider.id === "arc-veritas" ? `0x${"0".repeat(64)}` : undefined,
      proofVersion: provider.id === "arc-veritas" ? "KNOT-SITES-VERITAS-1" : undefined,
    };
    const evidenceHash = await sha256Hex({ providerId: provider.id, payload });
    attempts.push({
      providerId: provider.id,
      provider: provider.name,
      priceUsdc: provider.priceUsdc,
      reputation: provider.reputation,
      proofSupport: provider.proofSupport,
      outcome: accepted ? "accepted" : "rejected",
      delivery: {
        providerId: provider.id,
        provider: provider.name,
        priceUsdc: provider.priceUsdc,
        latencyMs: provider.estimatedLatencyMs,
        ageSeconds: Math.min(provider.maxEvidenceAgeSeconds, quote.obligation.maxAgeSeconds),
        signatureValid: provider.proofSupport,
        payload: Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)),
        evidenceHash,
      },
      verification: {
        accepted,
        checks: provider.reasons.map((reason, index) => ({
          key: `preflight-${index}`,
          label: accepted ? "Provider capability" : "Policy blocker",
          passed: accepted,
          detail: reason,
        })),
      },
    });
    events.push({
      id: crypto.randomUUID(),
      sequence: events.length,
      kind: accepted ? "settlement" : "fallback",
      status: accepted ? "success" : "failure",
      title: accepted ? `${provider.name} authorized` : `${provider.name} rejected`,
      detail: accepted ? "Evidence hash is bound to public worker settlement authorization." : provider.reasons.join(" "),
      providerId: provider.id,
      amountUsdc: accepted ? provider.priceUsdc : undefined,
    });
    if (accepted) break;
  }

  const accepted = attempts.find((attempt) => attempt.outcome === "accepted") ?? null;
  const execution = {
    id: executionId,
    createdAt: now,
    mode: "local",
    status: accepted ? "verified" : "failed",
    owner: null,
    obligation: quote.obligation,
    events,
    attempts,
    settlement: accepted
      ? {
          status: "authorized",
          amountUsdc: accepted.priceUsdc,
          recipient: accepted.providerId,
          rail: "simulated",
          evidenceHash: accepted.delivery.evidenceHash,
          transactionHash: null,
          attestation: {
            status: "not-requested",
            jobId: null,
            hookAddress: null,
            transactionHash: null,
            validUntil: null,
            error: null,
          },
        }
      : {
          status: "blocked",
          amountUsdc: 0,
          recipient: null,
          rail: "simulated",
          evidenceHash: null,
          transactionHash: null,
          attestation: {
            status: "not-requested",
            jobId: null,
            hookAddress: null,
            transactionHash: null,
            validUntil: null,
            error: null,
          },
        },
  };
  RECEIPTS.set(execution.id, execution);
  return execution;
}

function manifest(baseUrl) {
  return {
    name: "KNOT",
    version: API_VERSION,
    description: "Verification-native settlement for autonomous agent work on Arc.",
    chain: {
      name: "Arc Testnet",
      id: 5042002,
      explorerUrl: "https://testnet.arcscan.app",
      nativeAsset: "USDC",
    },
    contracts: {
      commerce: ARC_DEPLOYMENT.commerce,
      hook: ARC_DEPLOYMENT.hook,
      paymentToken: ARC_DEPLOYMENT.paymentToken,
    },
    latestProof: LATEST_PROOF,
    jobs: JOBS,
    policies: POLICIES,
    endpoints: {
      discovery: { method: "GET", path: "/.well-known/knot", url: absolute(baseUrl, "/.well-known/knot"), auth: "Public agent discovery document." },
      openapi: { method: "GET", path: "/api/openapi", url: absolute(baseUrl, "/api/openapi"), auth: "Public OpenAPI 3.1 integration contract." },
      submission: { method: "GET", path: "/api/submission", url: absolute(baseUrl, "/api/submission"), auth: "Public judge and launch brief. Does not expose secrets." },
      launch: { method: "GET", path: "/api/launch", url: absolute(baseUrl, "/api/launch"), auth: "Public launch, domain, utility, and go-to-market kit. Does not expose secrets." },
      marketplace: { method: "GET", path: "/api/marketplace", url: absolute(baseUrl, "/api/marketplace"), auth: "Public provider supply, policy products, and clearing economics. Does not expose secrets." },
      quoteExecution: { method: "POST", path: "/api/quote", url: absolute(baseUrl, "/api/quote"), auth: "Public preflight. Does not execute work, store receipts, or spend funds." },
      runExecution: { method: "POST", path: "/api/executions", url: absolute(baseUrl, "/api/executions"), auth: "Preview execution is public in the worker export. Protocol-funded execution belongs to the full Next deployment." },
      listExecutions: { method: "GET", path: "/api/executions?ids=run_...", url: absolute(baseUrl, "/api/executions?ids=run_..."), auth: "Public by explicit receipt IDs." },
      getExecution: { method: "GET", path: "/api/executions/{id}", url: absolute(baseUrl, "/api/executions/{id}"), auth: "Public by receipt ID." },
      verifyReceipt: { method: "GET", path: "/api/receipts/verify?id=run_...&evidenceHash=0x...", url: absolute(baseUrl, "/api/receipts/verify?id=run_...&evidenceHash=0x..."), auth: "Public by receipt ID with optional evidence hash." },
      systemStatus: { method: "GET", path: "/api/system/status", url: absolute(baseUrl, "/api/system/status"), auth: "Public readiness metadata." },
      manifest: { method: "GET", path: "/api/manifest", url: absolute(baseUrl, "/api/manifest"), auth: "Public developer manifest." },
    },
    curl: [
      `curl -X POST ${absolute(baseUrl, "/api/executions")} \\`,
      '  -H "content-type: application/json" \\',
      `  -d '{"jobType":"treasury","policyPreset":"strict","subject":"${EXAMPLE_SUBJECT}","maxPriceUsdc":0.05}'`,
    ].join("\n"),
  };
}

function discovery(baseUrl) {
  const currentManifest = manifest(baseUrl);
  return {
    name: "KNOT",
    protocol: "knot.verification-settlement",
    version: API_VERSION,
    description: currentManifest.description,
    homepage: absolute(baseUrl, "/"),
    manifestUrl: absolute(baseUrl, "/api/manifest"),
    openapiUrl: absolute(baseUrl, "/api/openapi"),
    statusUrl: absolute(baseUrl, "/api/system/status"),
    capabilities: [
      "preflight-quotes",
      "policy-routed-preview-execution",
      "evidence-bound-receipts",
      "receipt-verification",
      "arc-testnet-proof-links",
      "erc-8183-style-completion-hooks",
      "judge-ready-submission-brief",
      "launch-readiness-kit",
      "provider-marketplace-catalog",
    ],
    chain: currentManifest.chain,
    contracts: currentManifest.contracts,
    endpoints: {
      quote: absolute(baseUrl, "/api/quote"),
      execute: absolute(baseUrl, "/api/executions"),
      readReceipt: absolute(baseUrl, "/api/executions/{id}"),
      verifyReceipt: absolute(baseUrl, "/api/receipts/verify?id=run_...&evidenceHash=0x..."),
      status: absolute(baseUrl, "/api/system/status"),
      manifest: absolute(baseUrl, "/api/manifest"),
      openapi: absolute(baseUrl, "/api/openapi"),
      submission: absolute(baseUrl, "/api/submission"),
      launch: absolute(baseUrl, "/api/launch"),
      marketplace: absolute(baseUrl, "/api/marketplace"),
    },
    auth: {
      quote: "none",
      previewExecution: "none",
      receiptRead: "receipt id",
      receiptVerification: "receipt id with optional evidence hash",
    },
    recommendedFlow: ["GET /.well-known/knot", "POST /api/quote", "POST /api/executions", "GET /api/executions/{id}", "GET /api/receipts/verify?id={id}&evidenceHash={hash}", "GET /api/launch", "GET /api/marketplace"],
  };
}

function openApi(baseUrl) {
  return {
    openapi: "3.1.0",
    info: {
      title: "KNOT API",
      version: API_VERSION,
      description: "Verification-native settlement for autonomous agent work on Arc.",
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/.well-known/knot": { get: { summary: "Discover KNOT capabilities." } },
      "/api/manifest": { get: { summary: "Read KNOT jobs, policies, endpoints, and deployment proof." } },
      "/api/openapi": { get: { summary: "Read the OpenAPI document." } },
      "/api/submission": { get: { summary: "Read a judge-ready project brief and launch evidence checklist." } },
      "/api/launch": { get: { summary: "Read KNOT's launch, domain, utility, and go-to-market kit." } },
      "/api/marketplace": { get: { summary: "Read provider supply, policy products, and clearing economics." } },
      "/api/quote": { post: { summary: "Preflight provider route and max spend before execution." } },
      "/api/executions": { post: { summary: "Create a preview execution receipt." }, get: { summary: "Read selected receipts by IDs." } },
      "/api/executions/{id}": { get: { summary: "Read one receipt." } },
      "/api/receipts/verify": { get: { summary: "Verify an evidence-bound receipt." } },
      "/api/system/status": { get: { summary: "Read public runtime status." } },
    },
    components: {
      schemas: {
        ReceiptId: { type: "string", pattern: "^run_[a-f0-9]{12}$" },
        EvidenceHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        Address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
      },
    },
  };
}

function status(baseUrl) {
  return {
    environment: "Arc Testnet",
    mode: "public-worker-preview",
    deployment: {
      commerce: ARC_DEPLOYMENT.commerce.address,
      hook: ARC_DEPLOYMENT.hook.address,
      explorerUrl: ARC_DEPLOYMENT.commerce.explorerUrl,
      verified: true,
    },
    latestProof: LATEST_PROOF,
    services: {
      verificationEngine: "ready",
      x402Buyer: "full-next-deployment-only",
      x402Seller: "full-next-deployment-only",
      circleAgent: "full-next-deployment-only",
      settlementHook: "verified",
      evidenceAttester: "recorded-testnet-proof",
      durableReceipts: "worker-memory-preview",
      protocolApi: "public-preview",
    },
    links: {
      discovery: absolute(baseUrl, "/.well-known/knot"),
      openapi: absolute(baseUrl, "/api/openapi"),
      manifest: absolute(baseUrl, "/api/manifest"),
    },
  };
}

function submission(baseUrl) {
  const currentManifest = manifest(baseUrl);
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
      chain: currentManifest.chain,
      commerce: currentManifest.contracts.commerce,
      hook: currentManifest.contracts.hook,
      latestProof: currentManifest.latestProof,
    },
    workingSurface: {
      console: absolute(baseUrl, "/"),
      discovery: absolute(baseUrl, "/.well-known/knot"),
      openapi: absolute(baseUrl, "/api/openapi"),
      manifest: absolute(baseUrl, "/api/manifest"),
      launch: absolute(baseUrl, "/api/launch"),
      marketplace: absolute(baseUrl, "/api/marketplace"),
      quote: absolute(baseUrl, "/api/quote"),
      execute: absolute(baseUrl, "/api/executions"),
      verifyReceipt: absolute(baseUrl, "/api/receipts/verify?id=run_...&evidenceHash=0x..."),
      status: absolute(baseUrl, "/api/system/status"),
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
      "The marketplace catalog explains provider supply and accepted-settlement economics.",
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

function launchKit(baseUrl) {
  const currentManifest = manifest(baseUrl);
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
      chain: currentManifest.chain,
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
      console: absolute(baseUrl, "/"),
      discovery: currentManifest.endpoints.discovery.url,
      openapi: currentManifest.endpoints.openapi.url,
      manifest: currentManifest.endpoints.manifest.url,
      submission: currentManifest.endpoints.submission.url,
      launchKit: absolute(baseUrl, "/api/launch"),
      marketplace: absolute(baseUrl, "/api/marketplace"),
      quote: currentManifest.endpoints.quoteExecution.url,
      execute: currentManifest.endpoints.runExecution.url,
      verifyReceipt: currentManifest.endpoints.verifyReceipt.url,
      status: currentManifest.endpoints.systemStatus.url,
    },
    evidence: {
      contracts: currentManifest.contracts,
      latestProof: currentManifest.latestProof,
      proofChecklist: [
        "Economy, Balanced, and Strict policies choose different providers and prices.",
        "Weak evidence is rejected before payment authorization.",
        "Accepted evidence becomes a receipt and can be checked by hash.",
        "The Arc Testnet commerce contract and hook are deployed and source verified.",
        "A completed testnet job links the evidence hash to the onchain completion path.",
      ],
    },
    goToMarket: {
      beachhead: ["agent treasury operations", "wallet counterparty screening", "paid data and risk APIs", "agent-to-agent service marketplaces"],
      wedge: "start as an evidence router for Arc-native agent payments, then become the settlement standard for paid machine work",
      revenue: ["protocol fee on accepted settlements", "provider marketplace fees", "enterprise verifier and audit endpoints", "premium policy templates for treasury and risk teams"],
    },
    tgeNarrative: {
      principle: "Any future token should coordinate verification supply, provider reputation, and protocol governance, not replace USDC settlement.",
      nonSpeculativeUtility: ["provider reputation and challenge markets", "policy template governance", "fee routing and verifier incentives", "operator staking for evidence availability and signer quality"],
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

function marketplace(baseUrl) {
  const currentManifest = manifest(baseUrl);
  return {
    name: "KNOT Marketplace",
    version: API_VERSION,
    description: "Provider supply, buyer demand, and clearing economics for verified agent work on KNOT.",
    settlementAsset: currentManifest.chain.nativeAsset,
    chain: currentManifest.chain,
    protocolFee: {
      bps: PROTOCOL_FEE_BPS,
      description: "Charged only on accepted provider work. Rejected evidence does not earn provider payment or protocol fee.",
    },
    providers: PROVIDERS.map((provider) => ({
      ...provider,
      ...PROVIDER_META[provider.id],
      fee: feeFor(provider.priceUsdc),
    })),
    policyProducts: Object.entries(POLICIES).map(([id, policy]) => ({
      id,
      label: policy.label,
      buyerUseCase: policy.description,
      expectedProvider: policy.expectedProvider,
      maxPriceUsdc: policy.maxPriceUsdc,
      expectedFee: feeFor(policy.maxPriceUsdc),
    })),
    jobDemand: Object.entries(JOBS).map(([id, job]) => ({
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
      marketplace: absolute(baseUrl, "/api/marketplace"),
      discovery: currentManifest.endpoints.discovery.url,
      manifest: currentManifest.endpoints.manifest.url,
      quote: currentManifest.endpoints.quoteExecution.url,
      execute: currentManifest.endpoints.runExecution.url,
      verifyReceipt: currentManifest.endpoints.verifyReceipt.url,
    },
  };
}

function landing() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KNOT | Pay for verified outcomes</title>
  <meta name="description" content="KNOT is a verification-native settlement layer for autonomous commerce on Arc." />
  <style>
    :root { color-scheme: dark; --paper:#07100d; --paper2:#0b1511; --panel:rgba(15,27,22,.82); --panel2:#101d18; --ink:#eff8ee; --soft:#c8d5cd; --muted:#8fa198; --line:rgba(226,246,234,.13); --line2:rgba(226,246,234,.24); --acid:#cbff4a; --mint:#5cf0bb; --blue:#79a7ff; --red:#ff806c; --shadow:rgba(0,0,0,.36); }
    * { box-sizing:border-box; } html { background:var(--paper); scroll-behavior:smooth; } body { margin:0; min-width:320px; min-height:100vh; color:var(--ink); font-family:"Aptos","Segoe UI Variable","Trebuchet MS",system-ui,sans-serif; background:radial-gradient(circle at 8% 2%, rgba(203,255,74,.13), transparent 29rem), radial-gradient(circle at 94% 11%, rgba(92,240,187,.12), transparent 32rem), linear-gradient(145deg,var(--paper),var(--paper2) 58%,var(--paper)); }
    body:before { content:""; position:fixed; inset:0; pointer-events:none; z-index:-1; opacity:.72; background-image:linear-gradient(rgba(220,246,231,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(220,246,231,.035) 1px,transparent 1px); background-size:46px 46px; mask-image:linear-gradient(to bottom,black,transparent 82%); }
    button,input,select,textarea { font:inherit; } button { color:inherit; cursor:pointer; } a { color:inherit; }
    .shell { width:min(1580px,calc(100% - 48px)); margin-inline:auto; }
    .header { position:sticky; top:0; z-index:20; border-bottom:1px solid var(--line); background:rgba(7,16,13,.82); backdrop-filter:blur(24px) saturate(150%); }
    .nav { min-height:84px; display:grid; grid-template-columns:auto 1fr auto; gap:28px; align-items:center; }
    .brand { display:flex; align-items:center; gap:13px; text-decoration:none; } .mark { position:relative; width:39px; height:39px; border-radius:50%; background:var(--ink); overflow:hidden; box-shadow:inset 0 0 0 1px rgba(7,16,13,.2); } .mark:before,.mark:after { content:""; position:absolute; inset:9px 11px; border:2px solid var(--acid); border-radius:50% 50% 45% 55%; transform:rotate(38deg); } .mark:after { border-color:var(--mint); transform:rotate(-38deg); }
    .brand b { display:block; font-size:15px; letter-spacing:.19em; } .brand small { display:block; margin-top:2px; color:var(--muted); font-size:10px; font-weight:750; letter-spacing:.12em; }
    .tabs { justify-self:center; display:flex; gap:4px; padding:5px; border:1px solid var(--line); border-radius:999px; background:rgba(16,29,24,.72); box-shadow:0 10px 35px var(--shadow); }
    .tabs a { border-radius:999px; padding:10px 15px; color:var(--muted); text-decoration:none; font-size:12px; font-weight:800; } .tabs a:first-child { color:#0b1611; background:var(--acid); box-shadow:0 6px 20px rgba(203,255,74,.25); }
    .wallet { display:flex; gap:6px; } .wallet span { min-height:48px; display:flex; flex-direction:column; justify-content:center; border:1px solid var(--line); background:var(--panel); padding:8px 13px; } .wallet span:first-child { border-radius:14px 7px 7px 14px; min-width:145px; } .wallet span:last-child { border-radius:7px 14px 14px 7px; min-width:150px; } .wallet small { color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; } .wallet b { font-size:13px; }
    .hero { padding-block:72px 64px; } .kicker { display:flex; align-items:center; gap:18px; margin-bottom:32px; color:var(--muted); font-size:11px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; } .kicker span { display:grid; place-items:center; width:30px; height:30px; border:1px solid var(--line); border-radius:50%; font-size:9px; }
    .hero-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(500px,.65fr); gap:58px; align-items:center; } h1 { margin:0; font-family:"Bahnschrift","Aptos Display",sans-serif; font-size:clamp(4.2rem,7.15vw,8rem); font-weight:650; line-height:.86; letter-spacing:-.07em; } h1 span { display:block; margin-top:.07em; color:var(--muted); }
    .trust { min-height:560px; border:1px solid rgba(92,240,187,.28); border-radius:32px; background:radial-gradient(circle at 50% 38%,rgba(92,240,187,.10),transparent 17rem),linear-gradient(150deg,rgba(21,37,30,.94),rgba(16,29,24,.80)); padding:28px; box-shadow:0 36px 110px var(--shadow), inset 0 0 0 1px rgba(92,240,187,.06); }
    .trust-top { display:flex; justify-content:space-between; color:var(--soft); font-size:11px; font-weight:900; letter-spacing:.12em; } .trust-top b { color:var(--mint); }
    .pulse { position:relative; height:320px; margin:8px 0 10px; } .orbit { position:absolute; left:50%; top:50%; border:1px solid rgba(92,240,187,.25); border-radius:50%; transform:translate(-50%,-50%); } .o1 { width:210px; height:210px; } .o2 { width:138px; height:138px; border-style:dashed; } .core { position:absolute; left:50%; top:50%; width:94px; height:94px; display:grid; place-items:center; align-content:center; border:1px solid rgba(203,255,74,.48); border-radius:50%; background:radial-gradient(circle,rgba(203,255,74,.22),var(--panel2)); transform:translate(-50%,-50%); box-shadow:0 0 55px rgba(203,255,74,.18); } .core strong { color:var(--acid); font-size:23px; } .core small { color:var(--soft); font-size:10px; letter-spacing:.18em; }
    .node { position:absolute; min-width:118px; display:grid; gap:3px; border:1px solid var(--line2); border-radius:15px; background:rgba(16,29,24,.94); padding:10px 12px; box-shadow:0 12px 36px var(--shadow); } .node b { font-size:11px; letter-spacing:.11em; } .node small { color:var(--muted); font-size:8px; font-weight:900; letter-spacing:.12em; } .n1{left:0;top:14%}.n2{right:0;top:14%}.n3{left:0;bottom:11%}.n4{right:0;bottom:11%}.n4 b{color:var(--acid)}
    .trust p { margin:0; color:var(--soft); font-size:16px; line-height:1.68; } .trust p strong { color:var(--ink); }
    .ribbon { display:grid; grid-template-columns:minmax(240px,1fr) repeat(4,minmax(125px,.46fr)) auto; overflow:hidden; margin-bottom:18px; border:1px solid var(--line); border-radius:22px; background:var(--panel); box-shadow:0 22px 60px var(--shadow); } .ribbon>*{min-height:88px;border-right:1px solid var(--line)} .ribbon>*:last-child{border-right:0}.ribbon-intro{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:17px 22px}.ribbon small,.ribbon-intro span{color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.ribbon p{margin:0;color:var(--soft);font-size:13px;line-height:1.5}.metric{display:flex;align-items:center;gap:12px;padding:14px 17px}.glyph{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(203,255,74,.12);color:var(--acid);font-size:12px;font-weight:900}.metric b{display:block;margin-top:5px;font-size:13px}.ribbon button{border:0;background:var(--acid);color:#0a150f;padding:0 20px;font-size:12px;font-weight:900}
    .demo { display:grid; grid-template-columns:minmax(280px,.78fr) minmax(520px,1.22fr) auto; gap:1px; overflow:hidden; margin-bottom:18px; border:1px solid var(--line); border-radius:24px; background:var(--line); box-shadow:0 22px 65px var(--shadow); } .demo>*{background:var(--panel)}.demo-copy{display:flex;flex-direction:column;justify-content:center;gap:9px;padding:24px;background:radial-gradient(circle at 0 0,rgba(203,255,74,.12),transparent 18rem),var(--panel)}.eyebrow{color:var(--mint);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.demo h2,.workspace h2,.protocol h2{margin:0;font-family:"Bahnschrift",sans-serif;font-size:31px;line-height:.98;letter-spacing:-.04em}.demo p{margin:0;color:var(--soft);font-size:13px;line-height:1.6}.runs{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line)}.run{padding:20px;background:var(--panel2)}.run h3{margin:10px 0 13px;font-size:22px}.run dl{display:grid;grid-template-columns:1fr 1fr;gap:1px;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--line)}.run div{background:var(--panel);padding:9px}.run dt{color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.run dd{margin:4px 0 0;font-size:10px;font-weight:900}.run small{display:block;margin-top:12px;color:var(--muted);font-size:10px;line-height:1.45}.demo button{border:0;background:var(--mint);color:#07100d;padding:0 22px;font-size:12px;font-weight:900}
    .workspace { display:grid; grid-template-columns:minmax(420px,.86fr) minmax(520px,1.14fr); gap:18px; align-items:start; } .panel { border:1px solid var(--line); border-radius:28px; background:var(--panel); padding:25px; box-shadow:0 25px 80px var(--shadow); } label{display:grid;gap:8px;margin-top:14px;color:var(--mint);font-size:12px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.workspace input,.workspace select,.workspace textarea{width:100%;border:1px solid var(--line);border-radius:14px;background:rgba(2,9,7,.46);color:var(--ink);padding:13px 14px}.workspace textarea{min-height:92px}.policies{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:14px}.policies button{min-height:58px;border:1px solid var(--line);border-radius:13px;background:var(--panel2);padding:10px;text-align:left}.policies button.active{border-color:rgba(203,255,74,.55);background:rgba(203,255,74,.12)}.quote-btn,.run-btn{width:100%;border:0;border-radius:17px;background:var(--acid);color:#0a150f;padding:17px 20px;margin-top:14px;font-weight:900}.trace{height:680px;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:28px;background:radial-gradient(circle at 95% 0,rgba(92,240,187,.11),transparent 25rem),linear-gradient(145deg,#0d1713,#07100d);box-shadow:0 28px 90px rgba(0,0,0,.35)}.trace-head{display:flex;justify-content:space-between;padding:28px 30px 23px;border-bottom:1px solid rgba(255,255,255,.1)}.trace-list{flex:1;overflow:auto;margin:0;padding:24px 30px;list-style:none}.trace li{display:grid;grid-template-columns:23px 1fr;gap:13px;min-height:94px}.dot{width:10px;height:10px;margin-top:4px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 4px rgba(92,240,187,.12)}.trace h3{margin:5px 0}.trace p{margin:0;color:#afc0b7;font-size:13px;line-height:1.55}.receipt{display:none;margin-top:18px;border:1px solid rgba(92,240,187,.35);border-radius:24px;background:linear-gradient(100deg,rgba(92,240,187,.09),var(--panel));padding:20px;box-shadow:0 22px 65px var(--shadow)}.receipt.on{display:grid;gap:10px}.receipt code{color:var(--acid)}
    .protocol{margin-top:72px}.protocol-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.market{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;overflow:hidden;border:1px solid var(--line);border-radius:24px;background:var(--line)}.market article{background:var(--panel2);padding:20px}.market h3{margin:10px 0}.market dl{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:13px;overflow:hidden}.market div{display:flex;justify-content:space-between;gap:10px;background:var(--panel);padding:9px}.market dt{color:var(--muted);font-size:8px;font-weight:900}.market dd{margin:0;font-size:10px;font-weight:900}.links{display:grid;gap:10px}.links a{display:flex;justify-content:space-between;border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:15px;text-decoration:none;font-weight:900}.footer{margin:32px 0;border-top:1px solid var(--line);padding-top:18px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;color:var(--muted)} code{color:var(--acid)}
    @media(max-width:1000px){.nav{grid-template-columns:1fr auto}.tabs{order:3;grid-column:1/-1}.hero-grid,.workspace,.protocol-grid{grid-template-columns:1fr}.trust{max-width:760px}.ribbon{grid-template-columns:repeat(2,1fr)}.ribbon-intro,.ribbon button{grid-column:1/-1}.demo{grid-template-columns:1fr}.market{grid-template-columns:1fr}.runs{grid-template-columns:1fr}} @media(max-width:700px){.shell{width:calc(100% - 28px)}.wallet span:first-child{display:none}.brand small{display:none}h1{font-size:clamp(3.6rem,14vw,6rem)}.trust{min-height:520px}.policies{grid-template-columns:1fr}.ribbon{grid-template-columns:1fr}.tabs{width:100%;overflow:auto}.tabs a{flex:1;text-align:center;white-space:nowrap}}
  </style>
</head>
<body>
  <header class="header">
    <nav class="nav shell">
      <a class="brand" href="/" aria-label="KNOT clearing console"><span class="mark"></span><span><b>KNOT</b><small>VERIFICATION-NATIVE SETTLEMENT</small></span></a>
      <div class="tabs"><a href="/">Verify</a><a href="/receipt/demo">Receipts</a><a href="#treasury">Treasury</a><a href="#protocol">Protocol</a></div>
      <div class="wallet"><span><small>Network</small><b>Add Arc Testnet</b></span><span><small>Wallet</small><b>Connect wallet</b></span></div>
    </nav>
  </header>
  <main>
    <section class="hero shell">
      <div class="kicker"><span>01</span><p>OUTCOME CLEARING FOR AUTONOMOUS COMMERCE</p></div>
      <div class="hero-grid">
        <h1>Never pay an API <span>for an answer you cannot trust.</span></h1>
        <article class="trust">
          <div class="trust-top"><span>TRUST ENGINE</span><b>LIVE / ARC TESTNET</b></div>
          <div class="pulse"><i class="orbit o1"></i><i class="orbit o2"></i><div class="core"><strong>5 / 5</strong><small>PROOF</small></div><div class="node n1"><b>INTENT</b><small>DEFINE</small></div><div class="node n2"><b>MARKET</b><small>ROUTE</small></div><div class="node n3"><b>VERIFY</b><small>PROVE</small></div><div class="node n4"><b>SETTLE</b><small>USDC</small></div></div>
          <p><strong>KNOT is the clearing layer for machine work.</strong> Define what a valid result means, let providers compete, and release USDC only when the winning evidence satisfies the policy.</p>
        </article>
      </div>
    </section>
    <section class="ribbon shell">
      <div class="ribbon-intro"><span>Live environment</span><p>Connect once, authorize your agent, and keep its signing key isolated from the browser.</p></div>
      <div class="metric"><i class="glyph">A</i><span><small>Network</small><b>Arc Testnet</b></span></div>
      <div class="metric"><i class="glyph">$</i><span><small>Connected wallet</small><b>Native USDC</b></span></div>
      <div class="metric"><i class="glyph">M</i><span><small>Agent wallet</small><b>Worker preview</b></span></div>
      <div class="metric"><i class="glyph">402</i><span><small>Gateway balance</small><b>x402 ready</b></span></div>
      <button type="button">Connect wallet</button>
    </section>
    <section class="demo shell">
      <div class="demo-copy"><span class="eyebrow">JUDGE MODE</span><h2>Run the whole proof ladder.</h2><p>One click runs the same wallet through Economy, Balanced, and Strict. KNOT should choose a different provider route and price as the obligation gets harder.</p></div>
      <div class="runs" id="runs">
        <article class="run"><span class="eyebrow">Economy</span><h3>Arc Baseline</h3><dl><div><dt>Route</dt><dd>pending</dd></div><div><dt>Price</dt><dd>up to 0.012</dd></div></dl><small>Fast public Arc facts for low-risk decisions.</small></article>
        <article class="run"><span class="eyebrow">Balanced</span><h3>Arc Sentinel</h3><dl><div><dt>Route</dt><dd>pending</dd></div><div><dt>Price</dt><dd>up to 0.030</dd></div></dl><small>Signed evidence for everyday agent payments.</small></article>
        <article class="run"><span class="eyebrow">Strict</span><h3>Arc Veritas</h3><dl><div><dt>Route</dt><dd>pending</dd></div><div><dt>Price</dt><dd>up to 0.050</dd></div></dl><small>Code-aware proof for treasury and contract decisions.</small></article>
      </div>
      <button id="judge" type="button">Run 3-policy proof</button>
    </section>
    <section class="workspace shell">
      <article class="panel">
        <span class="eyebrow">Obligation builder</span><h2>Define the decision.</h2>
        <label>Decision request<textarea id="task">Inspect this Arc address before a contract interaction and return code-aware signed evidence.</textarea></label>
        <label>Wallet to assess<input id="subject" value="${EXAMPLE_SUBJECT}" /></label>
        <label>Protection level<select id="policy"><option value="economy">Economy</option><option value="balanced">Balanced</option><option value="strict" selected>Strict</option></select></label>
        <div class="policies"><button type="button">Economy<br><small>Arc Baseline</small></button><button type="button">Balanced<br><small>Arc Sentinel</small></button><button class="active" type="button">Strict<br><small>Arc Veritas</small></button></div>
        <button class="quote-btn" id="quote" type="button">Quote route</button>
        <button class="run-btn" id="execute" type="button">Run proof preview</button>
      </article>
      <article class="trace">
        <div class="trace-head"><div><span class="eyebrow">Agent execution</span><h2>Clearing trace</h2></div><strong id="eventCount">00</strong></div>
        <ol class="trace-list" id="trace"><li><i class="dot"></i><div><h3>The clearing engine is standing by.</h3><p>Run the obligation to inspect every decision.</p></div></li></ol>
      </article>
    </section>
    <section class="receipt shell" id="receipt"><strong>SEALED EXECUTION RECEIPT</strong><span id="receiptCopy"></span><code id="receiptHash"></code><a id="receiptLink" href="#">Open verified receipt</a></section>
    <section class="protocol shell" id="protocol">
      <div class="kicker"><span>02</span><p>THE PROTOCOL KNOT</p></div>
      <div class="protocol-grid">
        <article class="panel"><span class="eyebrow">Provider marketplace</span><h2>KNOT earns only when evidence clears.</h2><p>Rejected work does not release provider payment or protocol fees. Accepted evidence creates the settlement event, the receipt, and the marketplace revenue moment.</p></article>
        <div class="market">
          <article><span class="eyebrow">Snapshot</span><h3>Arc Baseline</h3><dl><div><dt>Provider</dt><dd>0.008</dd></div><div><dt>KNOT fee</dt><dd>0.000096</dd></div><div><dt>Buyer total</dt><dd>0.008096</dd></div></dl></article>
          <article><span class="eyebrow">Signed</span><h3>Arc Sentinel</h3><dl><div><dt>Provider</dt><dd>0.024</dd></div><div><dt>KNOT fee</dt><dd>0.000288</dd></div><div><dt>Buyer total</dt><dd>0.024288</dd></div></dl></article>
          <article><span class="eyebrow">Code-aware</span><h3>Arc Veritas</h3><dl><div><dt>Provider</dt><dd>0.045</dd></div><div><dt>KNOT fee</dt><dd>0.000540</dd></div><div><dt>Buyer total</dt><dd>0.045540</dd></div></dl></article>
        </div>
      </div>
      <div class="links" style="margin-top:18px"><a href="/.well-known/knot">Agent discovery <span>/.well-known/knot</span></a><a href="/api/openapi">OpenAPI <span>/api/openapi</span></a><a href="/api/submission">Submission brief <span>/api/submission</span></a><a href="/api/marketplace">Marketplace <span>/api/marketplace</span></a><a href="${LATEST_PROOF.completionExplorerUrl}">Arc completed job <span>Job #${LATEST_PROOF.jobId}</span></a></div>
    </section>
    <footer class="footer shell"><span>Commerce <code>${ARC_DEPLOYMENT.commerce.address}</code></span><span>Hook <code>${ARC_DEPLOYMENT.hook.address}</code></span><span>Pay for verified outcomes</span></footer>
  </main>
  <script>
    const subject = document.getElementById("subject");
    const policy = document.getElementById("policy");
    const task = document.getElementById("task");
    const trace = document.getElementById("trace");
    const receipt = document.getElementById("receipt");
    const receiptCopy = document.getElementById("receiptCopy");
    const receiptHash = document.getElementById("receiptHash");
    const receiptLink = document.getElementById("receiptLink");
    const eventCount = document.getElementById("eventCount");
    const body = () => ({ jobType: policy.value === "strict" ? "contract-review" : "treasury", policyPreset: policy.value, task: task.value, subject: subject.value, maxPriceUsdc: policy.value === "economy" ? 0.012 : policy.value === "balanced" ? 0.03 : 0.05 });
    async function post(path) {
      const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body()) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    }
    function renderTrace(execution) {
      trace.innerHTML = execution.events.map((item) => '<li><i class="dot"></i><div><h3>' + item.title + '</h3><p>' + item.detail + '</p></div></li>').join("");
      eventCount.textContent = String(execution.events.length).padStart(2, "0");
      const accepted = execution.attempts.find((attempt) => attempt.outcome === "accepted");
      receipt.classList.add("on");
      receiptCopy.textContent = (accepted ? accepted.provider : "No provider") + " / " + execution.settlement.amountUsdc.toFixed(3) + " USDC / " + execution.attempts.length + " attempt" + (execution.attempts.length === 1 ? "" : "s");
      receiptHash.textContent = execution.settlement.evidenceHash || "no evidence hash";
      receiptLink.href = "/receipt/" + execution.id;
    }
    document.getElementById("quote").onclick = async () => {
      const quote = await post("/api/quote");
      trace.innerHTML = quote.route.map((provider) => '<li><i class="dot"></i><div><h3>' + provider.name + '</h3><p>' + provider.reasons.join(" ") + '</p></div></li>').join("");
      eventCount.textContent = String(quote.route.length).padStart(2, "0");
    };
    document.getElementById("execute").onclick = async () => {
      const execution = await post("/api/executions");
      renderTrace(execution);
    };
    document.getElementById("judge").onclick = async () => {
      const cases = [["economy",0.012],["balanced",0.03],["strict",0.05]];
      const runs = document.querySelectorAll(".run");
      for (let i = 0; i < cases.length; i += 1) {
        const [preset, maxPriceUsdc] = cases[i];
        const res = await fetch("/api/executions", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ jobType: preset === "strict" ? "contract-review" : "treasury", policyPreset:preset, subject: subject.value, maxPriceUsdc }) });
        const execution = await res.json();
        const accepted = execution.attempts.find((attempt) => attempt.outcome === "accepted");
        runs[i].querySelector("h3").textContent = accepted.provider;
        runs[i].querySelectorAll("dd")[0].textContent = execution.attempts.length + " attempt" + (execution.attempts.length === 1 ? "" : "s");
        runs[i].querySelectorAll("dd")[1].textContent = execution.settlement.amountUsdc.toFixed(3) + " USDC";
        runs[i].querySelector("small").textContent = "receipt " + execution.id;
        if (i === cases.length - 1) renderTrace(execution);
      }
    };
  </script>
</body>
</html>`;
}

async function requestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function verifyReceipt(searchParams) {
  const id = searchParams.get("id") ?? "";
  const evidenceHash = searchParams.get("evidenceHash") ?? "";
  const receipt = RECEIPTS.get(id);
  if (!/^run_[a-f0-9]{12}$/.test(id)) return json({ error: "Invalid receipt id." }, { status: 400 });
  if (!receipt) {
    return json({
      id,
      valid: false,
      status: "missing",
      checkedAt: new Date().toISOString(),
      reasons: ["No worker-preview receipt matched that execution ID."],
      receipt: null,
    }, { status: 404 });
  }
  const storedHash = receipt.settlement.evidenceHash;
  const valid = Boolean(storedHash && (!evidenceHash || evidenceHash.toLowerCase() === storedHash.toLowerCase()) && receipt.status === "verified");
  return json({
    id,
    valid,
    status: valid ? "verified" : "mismatch",
    checkedAt: new Date().toISOString(),
    reasons: valid
      ? ["Receipt exists and the submitted evidence hash matches the accepted worker-preview delivery."]
      : ["Submitted evidence hash does not match the worker-preview receipt."],
    receipt: {
      executionId: receipt.id,
      createdAt: receipt.createdAt,
      subject: receipt.obligation.subject,
      provider: receipt.attempts.find((attempt) => attempt.outcome === "accepted")?.provider ?? null,
      attempts: receipt.attempts.length,
      amountUsdc: receipt.settlement.amountUsdc,
      rail: receipt.settlement.rail,
      evidenceHash: storedHash,
      settlementStatus: receipt.settlement.status,
      attestationStatus: receipt.settlement.attestation.status,
      transactionHash: receipt.settlement.transactionHash,
    },
  });
}

async function handle(request) {
  const url = new URL(request.url);
  const baseUrl = baseUrlFrom(request);

  if (request.method === "GET" && url.pathname === "/") return html(landing());
  if (request.method === "GET" && url.pathname === "/.well-known/knot") return json(discovery(baseUrl));
  if (request.method === "GET" && url.pathname === "/api/openapi") return json(openApi(baseUrl));
  if (request.method === "GET" && url.pathname === "/api/manifest") return json(manifest(baseUrl));
  if (request.method === "GET" && url.pathname === "/api/submission") return json(submission(baseUrl));
  if (request.method === "GET" && url.pathname === "/api/launch") return json(launchKit(baseUrl));
  if (request.method === "GET" && url.pathname === "/api/marketplace") return json(marketplace(baseUrl));
  if (request.method === "GET" && url.pathname === "/api/system/status") return json(status(baseUrl));
  if (request.method === "GET" && url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /\nSitemap: " + absolute(baseUrl, "/sitemap.xml") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
  if (request.method === "GET" && url.pathname === "/sitemap.xml") return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}/</loc></url><url><loc>${baseUrl}/.well-known/knot</loc></url><url><loc>${baseUrl}/api/openapi</loc></url><url><loc>${baseUrl}/api/submission</loc></url><url><loc>${baseUrl}/api/launch</loc></url><url><loc>${baseUrl}/api/marketplace</loc></url></urlset>`, { headers: { "content-type": "application/xml; charset=utf-8" } });
  if (request.method === "POST" && url.pathname === "/api/quote") return json(quoteJob(await requestBody(request)));
  if (request.method === "POST" && url.pathname === "/api/executions") return json(await createExecution(await requestBody(request)), { status: 201 });
  if (request.method === "GET" && url.pathname === "/api/executions") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 25);
    return json({ executions: ids.map((id) => RECEIPTS.get(id)).filter(Boolean) });
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/executions/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const receipt = RECEIPTS.get(id);
    return receipt ? json(receipt) : json({ error: "Receipt not found." }, { status: 404 });
  }
  if (request.method === "GET" && url.pathname === "/api/receipts/verify") return verifyReceipt(url.searchParams);
  if (request.method === "GET" && url.pathname.startsWith("/receipt/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const receipt = RECEIPTS.get(id);
    if (!receipt) return html("<h1>Receipt not found</h1>", 404);
    return html(`<main style="font-family:system-ui;background:#06110d;color:#f1ffee;min-height:100vh;padding:40px"><h1>KNOT receipt ${receipt.id}</h1><pre style="white-space:pre-wrap">${JSON.stringify(receipt, null, 2)}</pre></main>`);
  }
  return json({ error: "Not found." }, { status: 404 });
}

const worker = {
  fetch: handle,
};

export default worker;
