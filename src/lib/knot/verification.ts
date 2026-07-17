import type {
  Delivery,
  Obligation,
  VerificationCheck,
  VerificationResult,
} from "./schemas";

export function verifyDelivery(
  obligation: Obligation,
  delivery: Delivery,
): VerificationResult {
  const missingFields = obligation.requiredFields.filter(
    (field) => !(field in delivery.payload),
  );

  const checks: VerificationCheck[] = [
    {
      key: "price",
      label: "Price ceiling",
      passed: delivery.priceUsdc <= obligation.maxPriceUsdc,
      detail: `${delivery.priceUsdc.toFixed(3)} / ${obligation.maxPriceUsdc.toFixed(3)} USDC`,
    },
    {
      key: "latency",
      label: "Response latency",
      passed: delivery.latencyMs <= obligation.maxLatencyMs,
      detail: `${delivery.latencyMs.toLocaleString("en-US")} / ${obligation.maxLatencyMs.toLocaleString("en-US")} ms`,
    },
    {
      key: "freshness",
      label: "Data freshness",
      passed: delivery.ageSeconds <= obligation.maxAgeSeconds,
      detail: `${delivery.ageSeconds}s old / ${obligation.maxAgeSeconds}s max`,
    },
    {
      key: "schema",
      label: "Required schema",
      passed: missingFields.length === 0,
      detail:
        missingFields.length === 0
          ? `${obligation.requiredFields.length} fields present`
          : `Missing: ${missingFields.join(", ")}`,
    },
    {
      key: "signature",
      label: "Provider signature",
      passed: !obligation.requireSignature || delivery.signatureValid,
      detail: delivery.signatureValid ? "Signature valid" : "Signature invalid",
    },
  ];

  return {
    accepted: checks.every((check) => check.passed),
    checks,
  };
}
