type JsonObject = Record<string, unknown>;

const baseUrl = (process.env.KNOT_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const subject = process.env.KNOT_SMOKE_SUBJECT ?? "0x0000000000000000000000000000000000000001";

async function readJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => null) as T | JsonObject | null;
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function urlPath(value: unknown) {
  return typeof value === "string" ? new URL(value).pathname : "";
}

async function runCase(
  label: string,
  input: JsonObject,
  expected: { provider: string; attempts: number; status: string },
) {
  const quote = await readJson<JsonObject>("/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subject, ...input }),
  });
  assert(quote.decision === "ready", `${label}: quote did not report ready`);
  assert(
    quote.recommendedProvider
      && typeof quote.recommendedProvider === "object"
      && "name" in quote.recommendedProvider
      && quote.recommendedProvider.name === expected.provider,
    `${label}: quote did not recommend ${expected.provider}`,
  );

  const execution = await readJson<JsonObject>("/api/executions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subject, ...input }),
  });

  assert(typeof execution.id === "string", `${label}: missing execution id`);
  assert(execution.status === expected.status, `${label}: expected status ${expected.status}`);
  assert(Array.isArray(execution.attempts), `${label}: attempts missing`);
  assert(execution.attempts.length === expected.attempts, `${label}: expected ${expected.attempts} attempts`);

  const accepted = execution.attempts.find((attempt) => {
    return attempt && typeof attempt === "object" && "outcome" in attempt && attempt.outcome === "accepted";
  }) as JsonObject | undefined;
  assert(accepted?.provider === expected.provider, `${label}: expected accepted provider ${expected.provider}`);

  const receipt = await readJson<JsonObject>(`/api/executions/${execution.id}`);
  assert(receipt.id === execution.id, `${label}: receipt API did not return the stored execution`);
  const settlement = execution.settlement as JsonObject | undefined;
  const evidenceHash = settlement?.evidenceHash;
  assert(typeof evidenceHash === "string", `${label}: execution is missing settlement evidence`);

  const verifierQuery = new URLSearchParams({
    id: String(execution.id),
    evidenceHash,
  });
  const verification = await readJson<JsonObject>(`/api/receipts/verify?${verifierQuery.toString()}`);
  assert(verification.valid === true, `${label}: receipt verifier rejected stored evidence`);

  const receiptPage = await fetch(`${baseUrl}/receipt/${execution.id}`);
  assert(receiptPage.ok, `${label}: receipt page returned ${receiptPage.status}`);
  const receiptHtml = await receiptPage.text();
  assert(receiptHtml.includes(String(execution.id)), `${label}: receipt page did not include the execution id`);

  return {
    id: execution.id,
    provider: accepted.provider,
    attempts: execution.attempts.length,
    amount: settlement?.amountUsdc,
    evidenceHash,
  };
}

async function main() {
  const discovery = await readJson<JsonObject>("/.well-known/knot");
  assert(discovery.protocol === "knot.verification-settlement", "discovery endpoint returned the wrong protocol");
  assert(
    discovery.endpoints
      && typeof discovery.endpoints === "object"
      && "quote" in discovery.endpoints
      && urlPath(discovery.endpoints.quote) === "/api/quote",
    "discovery endpoint is missing the quote URL",
  );

  const openapi = await readJson<JsonObject>("/api/openapi");
  assert(openapi.openapi === "3.1.0", "openapi endpoint did not return OpenAPI 3.1");
  assert(
    openapi.paths
      && typeof openapi.paths === "object"
      && "/api/quote" in openapi.paths
      && "/api/receipts/verify" in openapi.paths,
    "openapi endpoint is missing KNOT quote or receipt paths",
  );

  const status = await readJson<JsonObject>("/api/system/status");
  assert(status.environment === "Arc Testnet", "status endpoint is not reporting Arc Testnet");
  assert(status.deployment && typeof status.deployment === "object", "status endpoint is missing deployment proof");

  const runs = [
    await runCase(
      "economy",
      { jobType: "counterparty", policyPreset: "economy", maxPriceUsdc: 0.012 },
      { provider: "Arc Baseline", attempts: 1, status: "verified" },
    ),
    await runCase(
      "balanced",
      { jobType: "treasury", policyPreset: "balanced", maxPriceUsdc: 0.03 },
      { provider: "Arc Sentinel", attempts: 2, status: "verified" },
    ),
    await runCase(
      "strict",
      { jobType: "contract-review", policyPreset: "strict", maxPriceUsdc: 0.05 },
      { provider: "Arc Veritas", attempts: 3, status: "verified" },
    ),
  ];

  console.log(JSON.stringify({ baseUrl, subject, runs }, null, 2));
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exitCode = 1;
});
