import arcDeployment from "../../../deployments/arc-testnet.json";
import erc8183Run from "../../../deployments/erc8183-testnet.json";
import { JOB_TYPES, POLICY_PRESETS } from "./catalog";

export const KNOT_API_VERSION = "2026-07-24";

type ManifestOptions = {
  baseUrl?: string;
};

function cleanBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function createKnotManifest(options: ManifestOptions = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl);
  const exampleSubject = "0x0000000000000000000000000000000000000001";

  return {
    name: "KNOT",
    version: KNOT_API_VERSION,
    description: "Verification-native settlement for autonomous agent work on Arc.",
    chain: {
      name: "Arc Testnet",
      id: 5_042_002,
      explorerUrl: "https://testnet.arcscan.app",
      nativeAsset: "USDC",
    },
    contracts: {
      commerce: arcDeployment.commerce,
      hook: arcDeployment.hook,
      paymentToken: arcDeployment.paymentToken,
    },
    latestProof: {
      status: erc8183Run.status,
      jobId: erc8183Run.jobId,
      executionId: erc8183Run.executionId,
      evidenceHash: erc8183Run.evidenceHash,
      attestationExplorerUrl: erc8183Run.attestationExplorerUrl,
      completionExplorerUrl: erc8183Run.completionExplorerUrl,
    },
    jobs: JOB_TYPES,
    policies: POLICY_PRESETS,
    endpoints: {
      discovery: {
        method: "GET",
        path: "/.well-known/knot",
        url: absoluteUrl(baseUrl, "/.well-known/knot"),
        auth: "Public agent discovery document.",
      },
      openapi: {
        method: "GET",
        path: "/api/openapi",
        url: absoluteUrl(baseUrl, "/api/openapi"),
        auth: "Public OpenAPI 3.1 integration contract.",
      },
      submission: {
        method: "GET",
        path: "/api/submission",
        url: absoluteUrl(baseUrl, "/api/submission"),
        auth: "Public judge and launch brief. Does not expose secrets.",
      },
      quoteExecution: {
        method: "POST",
        path: "/api/quote",
        url: absoluteUrl(baseUrl, "/api/quote"),
        auth: "Public preflight. Does not execute work, store receipts, or spend funds.",
        body: {
          jobType: "treasury",
          policyPreset: "strict",
          subject: exampleSubject,
          maxPriceUsdc: 0.05,
        },
      },
      runExecution: {
        method: "POST",
        path: "/api/executions",
        url: absoluteUrl(baseUrl, "/api/executions"),
        auth: "Optional Bearer KNOT_EXECUTION_API_KEY for protocol-funded live execution.",
        body: {
          jobType: "treasury",
          policyPreset: "strict",
          subject: exampleSubject,
          maxPriceUsdc: 0.05,
        },
      },
      listExecutions: {
        method: "GET",
        path: "/api/executions?ids=run_...",
        url: absoluteUrl(baseUrl, "/api/executions?ids=run_..."),
        auth: "Receipt IDs are explicit; there is no public global ledger feed.",
      },
      getExecution: {
        method: "GET",
        path: "/api/executions/{id}",
        url: absoluteUrl(baseUrl, "/api/executions/{id}"),
        auth: "Public by unguessable receipt ID.",
      },
      verifyReceipt: {
        method: "GET",
        path: "/api/receipts/verify?id=run_...&evidenceHash=0x...",
        url: absoluteUrl(baseUrl, "/api/receipts/verify?id=run_...&evidenceHash=0x..."),
        auth: "Public by unguessable receipt ID. Evidence hash is optional but recommended.",
      },
      systemStatus: {
        method: "GET",
        path: "/api/system/status",
        url: absoluteUrl(baseUrl, "/api/system/status"),
        auth: "Public readiness metadata. Does not expose secrets.",
      },
      manifest: {
        method: "GET",
        path: "/api/manifest",
        url: absoluteUrl(baseUrl, "/api/manifest"),
        auth: "Public developer manifest.",
      },
    },
    curl: [
      "curl -X POST " + absoluteUrl(baseUrl, "/api/executions") + " \\",
      "  -H \"content-type: application/json\" \\",
      `  -d '{"jobType":"treasury","policyPreset":"strict","subject":"${exampleSubject}","maxPriceUsdc":0.05}'`,
    ].join("\n"),
  };
}
