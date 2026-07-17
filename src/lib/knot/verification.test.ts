import { describe, expect, it } from "vitest";
import { defaultObligation } from "./engine";
import type { Delivery } from "./schemas";
import { verifyDelivery } from "./verification";

const validDelivery: Delivery = {
  providerId: "provider-a",
  provider: "Provider A",
  priceUsdc: 0.02,
  latencyMs: 400,
  ageSeconds: 20,
  signatureValid: true,
  payload: { risk: "low", confidence: 0.95, observedAt: "now" },
  evidenceHash: "0xvalid",
};

describe("verifyDelivery", () => {
  it("accepts only when every obligation passes", () => {
    const result = verifyDelivery(defaultObligation, validDelivery);
    expect(result.accepted).toBe(true);
    expect(result.checks).toHaveLength(5);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("reports every failed condition instead of stopping early", () => {
    const result = verifyDelivery(defaultObligation, {
      ...validDelivery,
      priceUsdc: 0.04,
      ageSeconds: 500,
      signatureValid: false,
      payload: { risk: "unknown" },
    });
    const failures = result.checks.filter((check) => !check.passed);

    expect(result.accepted).toBe(false);
    expect(failures.map((check) => check.key)).toEqual([
      "price",
      "freshness",
      "schema",
      "signature",
    ]);
  });
});
