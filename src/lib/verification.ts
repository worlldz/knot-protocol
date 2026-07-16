export type Delivery = {
  provider: string;
  priceUsdc: number;
  latencyMs: number;
  ageSeconds: number;
  signatureValid: boolean;
  payload: Record<string, unknown>;
};

export type Obligation = {
  maxPriceUsdc: number;
  maxLatencyMs: number;
  maxAgeSeconds: number;
  requiredFields: string[];
  requireSignature: boolean;
};

export type VerificationResult = {
  accepted: boolean;
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string;
  }>;
};

export function verifyDelivery(
  obligation: Obligation,
  delivery: Delivery,
): VerificationResult {
  const missingFields = obligation.requiredFields.filter(
    (field) => !(field in delivery.payload),
  );

  const checks = [
    {
      label: "Price ceiling",
      passed: delivery.priceUsdc <= obligation.maxPriceUsdc,
      detail: `${delivery.priceUsdc.toFixed(3)} / ${obligation.maxPriceUsdc.toFixed(3)} USDC`,
    },
    {
      label: "Response latency",
      passed: delivery.latencyMs <= obligation.maxLatencyMs,
      detail: `${delivery.latencyMs} / ${obligation.maxLatencyMs} ms`,
    },
    {
      label: "Data freshness",
      passed: delivery.ageSeconds <= obligation.maxAgeSeconds,
      detail: `${delivery.ageSeconds}s old / ${obligation.maxAgeSeconds}s max`,
    },
    {
      label: "Required schema",
      passed: missingFields.length === 0,
      detail:
        missingFields.length === 0
          ? `${obligation.requiredFields.length} fields present`
          : `Missing: ${missingFields.join(", ")}`,
    },
    {
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
