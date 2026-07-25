const worker = (await import("../dist/server/index.js")).default;
const baseUrl = "https://knot-worker.example";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path, init) {
  const response = await worker.fetch(new Request(`${baseUrl}${path}`, init));
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const discovery = await readJson("/.well-known/knot");
  assert(discovery.protocol === "knot.verification-settlement", "discovery protocol mismatch");
  assert(discovery.endpoints.quote === `${baseUrl}/api/quote`, "discovery quote URL mismatch");

  const openapi = await readJson("/api/openapi");
  assert(openapi.openapi === "3.1.0", "openapi version mismatch");
  assert(openapi.paths["/api/quote"], "openapi missing quote path");
  assert(openapi.paths["/api/submission"], "openapi missing submission path");

  const submission = await readJson("/api/submission");
  assert(submission.tagline === "Pay for verified outcomes, not unproven responses.", "submission tagline mismatch");
  assert(submission.judgeChecklist.includes("Different policies produce different provider routes."), "submission checklist mismatch");

  const subject = "0x0000000000000000000000000000000000000001";
  const executionInput = {
    jobType: "contract-review",
    policyPreset: "strict",
    subject,
    maxPriceUsdc: 0.05,
  };
  const quote = await readJson("/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(executionInput),
  });
  assert(quote.decision === "ready", "quote should be ready");
  assert(quote.recommendedProvider.id === "arc-veritas", "strict quote should recommend Arc Veritas");

  const execution = await readJson("/api/executions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(executionInput),
  });
  assert(/^run_[a-f0-9]{12}$/.test(execution.id), "execution id mismatch");
  assert(execution.status === "verified", "execution should verify");
  assert(execution.settlement.evidenceHash, "execution missing evidence hash");

  const receipt = await readJson(`/api/executions/${execution.id}`);
  assert(receipt.id === execution.id, "receipt lookup mismatch");

  const verification = await readJson(`/api/receipts/verify?id=${execution.id}&evidenceHash=${execution.settlement.evidenceHash}`);
  assert(verification.valid === true, "receipt verification failed");

  console.log(JSON.stringify({
    discovery: discovery.protocol,
    submission: submission.name,
    quote: quote.recommendedProvider.name,
    execution: execution.id,
    verification: verification.status,
  }, null, 2));
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exitCode = 1;
});
