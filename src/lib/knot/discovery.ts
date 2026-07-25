import { KNOT_API_VERSION, createKnotManifest } from "./manifest";

type DiscoveryOptions = {
  baseUrl?: string;
};

function cleanBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function createKnotDiscovery(options: DiscoveryOptions = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl);
  const manifest = createKnotManifest({ baseUrl });

  return {
    name: manifest.name,
    protocol: "knot.verification-settlement",
    version: KNOT_API_VERSION,
    description: manifest.description,
    homepage: absoluteUrl(baseUrl, "/"),
    manifestUrl: absoluteUrl(baseUrl, "/api/manifest"),
    openapiUrl: absoluteUrl(baseUrl, "/api/openapi"),
    statusUrl: absoluteUrl(baseUrl, "/api/system/status"),
    capabilities: [
      "preflight-quotes",
      "policy-routed-execution",
      "evidence-bound-receipts",
      "receipt-verification",
      "arc-testnet-settlement",
      "x402-provider-settlement",
      "erc-8183-style-completion-hooks",
      "judge-ready-submission-brief",
      "launch-readiness-kit",
      "provider-marketplace-catalog",
    ],
    chain: manifest.chain,
    contracts: manifest.contracts,
    endpoints: {
      quote: manifest.endpoints.quoteExecution.url,
      execute: manifest.endpoints.runExecution.url,
      readReceipt: manifest.endpoints.getExecution.url,
      verifyReceipt: manifest.endpoints.verifyReceipt.url,
      status: manifest.endpoints.systemStatus.url,
      manifest: manifest.endpoints.manifest.url,
      openapi: absoluteUrl(baseUrl, "/api/openapi"),
      submission: absoluteUrl(baseUrl, "/api/submission"),
      launch: absoluteUrl(baseUrl, "/api/launch"),
      marketplace: absoluteUrl(baseUrl, "/api/marketplace"),
    },
    auth: {
      quote: "none",
      previewExecution: "none",
      protocolFundedExecution: "bearer KNOT_EXECUTION_API_KEY",
      receiptRead: "unguessable receipt id",
      receiptVerification: "unguessable receipt id with optional evidence hash",
    },
    recommendedFlow: [
      "GET /.well-known/knot",
      "POST /api/quote",
      "POST /api/executions",
      "GET /api/executions/{id}",
      "GET /api/receipts/verify?id={id}&evidenceHash={hash}",
      "GET /api/launch",
      "GET /api/marketplace",
    ],
  };
}

export function createKnotOpenApi(options: DiscoveryOptions = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl);
  const manifest = createKnotManifest({ baseUrl });

  return {
    openapi: "3.1.0",
    info: {
      title: "KNOT API",
      version: KNOT_API_VERSION,
      description: manifest.description,
    },
    servers: [{ url: baseUrl || "http://localhost:3000" }],
    tags: [
      { name: "Discovery", description: "Machine-readable KNOT metadata." },
      { name: "Preflight", description: "Plan route and cost before execution." },
      { name: "Execution", description: "Run verification-native settlement flows." },
      { name: "Receipts", description: "Read and verify evidence-bound receipts." },
      { name: "Marketplace", description: "Inspect provider supply and accepted-settlement economics." },
      { name: "Status", description: "Inspect public runtime readiness." },
    ],
    paths: {
      "/.well-known/knot": {
        get: {
          tags: ["Discovery"],
          summary: "Discover KNOT capabilities and integration URLs.",
          responses: {
            "200": {
              description: "KNOT discovery document",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Discovery" } } },
            },
          },
        },
      },
      "/api/manifest": {
        get: {
          tags: ["Discovery"],
          summary: "Read jobs, policies, contracts, endpoints, and sample curl.",
          responses: {
            "200": {
              description: "KNOT developer manifest",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/openapi": {
        get: {
          tags: ["Discovery"],
          summary: "Read this OpenAPI document.",
          responses: {
            "200": {
              description: "OpenAPI document",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/submission": {
        get: {
          tags: ["Discovery"],
          summary: "Read a judge-ready project brief and launch evidence checklist.",
          responses: {
            "200": {
              description: "KNOT submission brief",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/launch": {
        get: {
          tags: ["Discovery"],
          summary: "Read KNOT's launch, domain, utility, and go-to-market kit.",
          responses: {
            "200": {
              description: "KNOT launch kit",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/marketplace": {
        get: {
          tags: ["Marketplace"],
          summary: "Read provider supply, policy products, and clearing economics.",
          responses: {
            "200": {
              description: "KNOT marketplace catalog",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/quote": {
        post: {
          tags: ["Preflight"],
          summary: "Quote the provider route without execution or spend.",
          requestBody: {
            required: false,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ExecutionRequest" } } },
          },
          responses: {
            "200": {
              description: "Preflight quote",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Quote" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "413": { $ref: "#/components/responses/PayloadTooLarge" },
          },
        },
      },
      "/api/executions": {
        post: {
          tags: ["Execution"],
          summary: "Run a KNOT obligation and create a durable receipt.",
          security: [{ bearerAuth: [] }, {}],
          requestBody: {
            required: false,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ExecutionRequest" } } },
          },
          responses: {
            "201": {
              description: "Execution receipt",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Execution" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "413": { $ref: "#/components/responses/PayloadTooLarge" },
            "429": { $ref: "#/components/responses/RateLimited" },
            "502": { $ref: "#/components/responses/ProviderFailure" },
          },
        },
        get: {
          tags: ["Receipts"],
          summary: "Read selected stored receipts by explicit IDs.",
          parameters: [
            {
              name: "ids",
              in: "query",
              required: true,
              schema: { type: "string", example: "run_123456789abc,run_abcdef123456" },
            },
          ],
          responses: {
            "200": {
              description: "Selected receipts",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      executions: { type: "array", items: { $ref: "#/components/schemas/Execution" } },
                    },
                    required: ["executions"],
                  },
                },
              },
            },
          },
        },
      },
      "/api/executions/{id}": {
        get: {
          tags: ["Receipts"],
          summary: "Read one stored execution receipt.",
          parameters: [{ $ref: "#/components/parameters/ReceiptId" }],
          responses: {
            "200": {
              description: "Execution receipt",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Execution" } } },
            },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/api/receipts/verify": {
        get: {
          tags: ["Receipts"],
          summary: "Verify that a receipt remains bound to accepted evidence.",
          parameters: [
            {
              name: "id",
              in: "query",
              required: true,
              schema: { $ref: "#/components/schemas/ReceiptId" },
            },
            {
              name: "evidenceHash",
              in: "query",
              required: false,
              schema: { $ref: "#/components/schemas/EvidenceHash" },
            },
          ],
          responses: {
            "200": {
              description: "Receipt verification result",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ReceiptVerification" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/api/system/status": {
        get: {
          tags: ["Status"],
          summary: "Read public system readiness without secrets.",
          responses: {
            "200": {
              description: "Runtime status",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Optional KNOT_EXECUTION_API_KEY for protocol-funded live execution.",
        },
      },
      parameters: {
        ReceiptId: {
          name: "id",
          in: "path",
          required: true,
          schema: { $ref: "#/components/schemas/ReceiptId" },
        },
      },
      responses: {
        BadRequest: {
          description: "Invalid request",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        PayloadTooLarge: {
          description: "Payload exceeds KNOT limits",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        RateLimited: {
          description: "Rate limit reached",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        ProviderFailure: {
          description: "Provider or settlement rail temporarily unavailable",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        NotFound: {
          description: "Receipt not found",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
      schemas: {
        Address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        EvidenceHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        ReceiptId: { type: "string", pattern: "^run_[a-f0-9]{12}$" },
        JobType: { type: "string", enum: Object.keys(manifest.jobs) },
        PolicyPreset: { type: "string", enum: [...Object.keys(manifest.policies), "custom"] },
        ExecutionRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            jobType: { $ref: "#/components/schemas/JobType" },
            policyPreset: { $ref: "#/components/schemas/PolicyPreset" },
            task: { type: "string", minLength: 12, maxLength: 280 },
            subject: { $ref: "#/components/schemas/Address" },
            maxPriceUsdc: { type: "number", exclusiveMinimum: 0, maximum: 1 },
            maxLatencyMs: { type: "integer", exclusiveMinimum: 0, maximum: 30000 },
            maxAgeSeconds: { type: "integer", exclusiveMinimum: 0, maximum: 86400 },
            requiredFields: { type: "array", minItems: 1, maxItems: 12, items: { type: "string" } },
            requireSignature: { type: "boolean" },
          },
        },
        QuoteProvider: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            priceUsdc: { type: "number" },
            proofSupport: { type: "boolean" },
            canSatisfy: { type: "boolean" },
            expectedOutcome: { type: "string", enum: ["can-satisfy", "will-fallback", "over-budget"] },
            reasons: { type: "array", items: { type: "string" } },
          },
          required: ["id", "name", "priceUsdc", "proofSupport", "canSatisfy", "expectedOutcome", "reasons"],
        },
        Quote: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^quote_[a-f0-9]{12}$" },
            createdAt: { type: "string", format: "date-time" },
            decision: { type: "string", enum: ["ready", "blocked"] },
            recommendedProvider: {
              anyOf: [{ $ref: "#/components/schemas/QuoteProvider" }, { type: "null" }],
            },
            maxSpendUsdc: { type: "number" },
            route: { type: "array", items: { $ref: "#/components/schemas/QuoteProvider" } },
            blockers: { type: "array", items: { type: "string" } },
          },
          required: ["id", "createdAt", "decision", "recommendedProvider", "maxSpendUsdc", "route", "blockers"],
        },
        Execution: {
          type: "object",
          description: "Durable KNOT execution receipt. See /api/manifest for current jobs and policies.",
          required: ["id", "createdAt", "mode", "status", "obligation", "events", "attempts", "settlement"],
        },
        ReceiptVerification: {
          type: "object",
          properties: {
            id: { $ref: "#/components/schemas/ReceiptId" },
            valid: { type: "boolean" },
            status: { type: "string", enum: ["verified", "blocked", "missing", "mismatch"] },
            checkedAt: { type: "string", format: "date-time" },
            reasons: { type: "array", items: { type: "string" } },
            receipt: { anyOf: [{ type: "object" }, { type: "null" }] },
          },
          required: ["id", "valid", "status", "checkedAt", "reasons", "receipt"],
        },
        Discovery: {
          type: "object",
          properties: {
            name: { type: "string" },
            protocol: { type: "string" },
            version: { type: "string" },
            capabilities: { type: "array", items: { type: "string" } },
            endpoints: { type: "object" },
            auth: { type: "object" },
          },
          required: ["name", "protocol", "version", "capabilities", "endpoints", "auth"],
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            issues: { type: "object" },
          },
          required: ["error"],
        },
      },
    },
  };
}
