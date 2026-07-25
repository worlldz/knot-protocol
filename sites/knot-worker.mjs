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
    },
    auth: {
      quote: "none",
      previewExecution: "none",
      receiptRead: "receipt id",
      receiptVerification: "receipt id with optional evidence hash",
    },
    recommendedFlow: ["GET /.well-known/knot", "POST /api/quote", "POST /api/executions", "GET /api/executions/{id}", "GET /api/receipts/verify?id={id}&evidenceHash={hash}"],
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

function landing() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KNOT - Verified outcome clearing</title>
  <meta name="description" content="KNOT is a verification-native settlement layer for autonomous commerce on Arc." />
  <style>
    :root { color-scheme: dark; --bg:#06110d; --panel:#0d1d16; --ink:#f1ffee; --muted:#95a99b; --acid:#d7ff69; --mint:#7dffc3; --line:rgba(255,255,255,.13); --red:#ff7979; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; background:radial-gradient(circle at 15% 0%, rgba(125,255,195,.2), transparent 32rem), radial-gradient(circle at 86% 15%, rgba(215,255,105,.16), transparent 30rem), var(--bg); color:var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
    main { width:min(1120px, calc(100% - 32px)); margin:0 auto; padding:48px 0; } nav, .hero, .grid, .panel, footer { border:1px solid var(--line); background:rgba(13,29,22,.76); backdrop-filter: blur(16px); box-shadow: 0 30px 90px rgba(0,0,0,.28); }
    nav { display:flex; justify-content:space-between; align-items:center; gap:16px; border-radius:999px; padding:12px 16px; } nav strong { letter-spacing:.18em; } nav a, .actions a { color:var(--ink); text-decoration:none; font-size:13px; font-weight:800; }
    .hero { margin-top:28px; border-radius:34px; padding:42px; display:grid; grid-template-columns:1.2fr .8fr; gap:28px; overflow:hidden; } h1 { margin:0; font-size:clamp(48px, 8vw, 112px); line-height:.86; letter-spacing:-.08em; } h1 span { display:block; color:var(--acid); } p { color:var(--muted); line-height:1.65; } .hero p { max-width:56ch; font-size:18px; }
    .proof { display:grid; gap:12px; align-content:start; } .proof div { border:1px solid var(--line); border-radius:22px; padding:18px; background:rgba(255,255,255,.04); } .proof span, .eyebrow { color:var(--mint); font-size:11px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; } .proof b { display:block; margin-top:8px; font-size:28px; }
    .grid { margin-top:18px; border-radius:28px; padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:16px; } .panel { border-radius:24px; padding:22px; background:rgba(6,17,13,.62); } h2 { margin:8px 0 10px; font-size:30px; letter-spacing:-.04em; } label { display:grid; gap:8px; color:var(--muted); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; } input, select, button { width:100%; border:1px solid var(--line); border-radius:14px; background:#081611; color:var(--ink); padding:13px 14px; font:inherit; } button { margin-top:12px; background:var(--acid); color:#09120e; border:0; font-weight:900; cursor:pointer; }
    pre { white-space:pre-wrap; word-break:break-word; border:1px solid var(--line); border-radius:18px; background:#07130f; padding:16px; color:#c8ffd9; min-height:160px; } .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; } .actions a { border:1px solid var(--line); border-radius:999px; padding:10px 13px; background:rgba(255,255,255,.04); }
    footer { margin-top:18px; border-radius:24px; padding:18px; display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; color:var(--muted); } code { color:var(--acid); }
    @media (max-width: 820px) { .hero, .grid { grid-template-columns:1fr; } .hero { padding:28px; } nav { align-items:flex-start; border-radius:24px; flex-direction:column; } }
  </style>
</head>
<body>
  <main>
    <nav><strong>KNOT</strong><div class="actions"><a href="/.well-known/knot">Discovery</a><a href="/api/openapi">OpenAPI</a><a href="/api/manifest">Manifest</a></div></nav>
    <section class="hero">
      <div><span class="eyebrow">Verification-native settlement on Arc</span><h1>Never pay an API <span>for an answer you cannot trust.</span></h1><p>KNOT routes agent work through policy-aware providers, rejects weak evidence, and authorizes USDC only when a delivery satisfies the buyer's obligation.</p></div>
      <div class="proof"><div><span>Live Arc proof</span><b>Job #${LATEST_PROOF.jobId}</b><p>Evidence hash anchored through the KNOT hook and completed on Arc Testnet.</p></div><div><span>Machine-readable</span><b>Discovery + OpenAPI</b><p>External agents can quote, execute, read receipts, and verify evidence bindings.</p></div></div>
    </section>
    <section class="grid">
      <article class="panel">
        <span class="eyebrow">Preflight</span><h2>Quote a route</h2>
        <label>Wallet<input id="subject" value="${EXAMPLE_SUBJECT}" /></label>
        <label>Policy<select id="policy"><option value="economy">Economy</option><option value="balanced">Balanced</option><option value="strict" selected>Strict</option></select></label>
        <button id="quote">Quote route</button>
        <pre id="quoteOut">Ready to quote.</pre>
      </article>
      <article class="panel">
        <span class="eyebrow">Execution</span><h2>Create a receipt</h2>
        <p>This public worker export runs preview execution and in-memory receipt verification. The full Next build adds Circle MPC, x402, and durable file-backed receipts.</p>
        <button id="execute">Run preview execution</button>
        <pre id="execOut">Ready to execute.</pre>
      </article>
    </section>
    <footer><span>Commerce <code>${ARC_DEPLOYMENT.commerce.address}</code></span><span>Hook <code>${ARC_DEPLOYMENT.hook.address}</code></span><span><a href="${LATEST_PROOF.completionExplorerUrl}" style="color:var(--acid)">View completed job</a></span></footer>
  </main>
  <script>
    const subject = document.getElementById("subject");
    const policy = document.getElementById("policy");
    const quoteOut = document.getElementById("quoteOut");
    const execOut = document.getElementById("execOut");
    const body = () => ({ jobType: policy.value === "strict" ? "contract-review" : "treasury", policyPreset: policy.value, subject: subject.value, maxPriceUsdc: policy.value === "economy" ? 0.012 : policy.value === "balanced" ? 0.03 : 0.05 });
    async function post(path) {
      const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body()) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    }
    document.getElementById("quote").onclick = async () => { quoteOut.textContent = "Quoting..."; quoteOut.textContent = JSON.stringify(await post("/api/quote"), null, 2); };
    document.getElementById("execute").onclick = async () => {
      execOut.textContent = "Executing...";
      const execution = await post("/api/executions");
      const hash = execution.settlement.evidenceHash || "";
      const verify = await fetch("/api/receipts/verify?id=" + execution.id + "&evidenceHash=" + hash).then((res) => res.json());
      execOut.textContent = JSON.stringify({ execution, verification: verify }, null, 2);
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
  if (request.method === "GET" && url.pathname === "/api/system/status") return json(status(baseUrl));
  if (request.method === "GET" && url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /\nSitemap: " + absolute(baseUrl, "/sitemap.xml") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
  if (request.method === "GET" && url.pathname === "/sitemap.xml") return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}/</loc></url><url><loc>${baseUrl}/.well-known/knot</loc></url><url><loc>${baseUrl}/api/openapi</loc></url></urlset>`, { headers: { "content-type": "application/xml; charset=utf-8" } });
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
