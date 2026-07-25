import { describe, expect, it } from "vitest";
import { quoteJob } from "./quote";

describe("quoteJob", () => {
  it("preflights a balanced job to the first provider that satisfies signed evidence", () => {
    const quote = quoteJob({
      policyPreset: "balanced",
      subject: "0x0000000000000000000000000000000000000001",
    });

    expect(quote.decision).toBe("ready");
    expect(quote.recommendedProvider).toMatchObject({
      id: "arc-sentinel",
      name: "Arc Sentinel",
      canSatisfy: true,
      priceUsdc: 0.024,
    });
    expect(quote.maxSpendUsdc).toBe(0.024);
    expect(quote.route.map((provider) => [provider.id, provider.expectedOutcome])).toEqual([
      ["arc-baseline", "will-fallback"],
      ["arc-sentinel", "can-satisfy"],
    ]);
    expect(quote.route[0].reasons).toContain("Signed provider evidence is required.");
  });

  it("escalates strict policy to Arc Veritas before execution is attempted", () => {
    const quote = quoteJob({
      policyPreset: "strict",
      jobType: "contract-review",
      subject: "0x0000000000000000000000000000000000000001",
    });

    expect(quote.recommendedProvider?.id).toBe("arc-veritas");
    expect(quote.route.map((provider) => provider.id)).toEqual([
      "arc-baseline",
      "arc-sentinel",
      "arc-veritas",
    ]);
    expect(quote.route.find((provider) => provider.id === "arc-sentinel")?.missingFields).toContain("bytecodeHash");
    expect(quote.blockers).toEqual([]);
  });

  it("blocks preflight when the declared budget cannot reach a provider", () => {
    const quote = quoteJob({
      maxPriceUsdc: 0.007,
      subject: "0x0000000000000000000000000000000000000001",
    });

    expect(quote.decision).toBe("blocked");
    expect(quote.recommendedProvider).toBeNull();
    expect(quote.route).toEqual([]);
    expect(quote.blockers).toEqual(["No provider fits the declared price ceiling."]);
  });
});
