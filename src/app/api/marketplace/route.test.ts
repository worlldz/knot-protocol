import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/marketplace", () => {
  it("returns provider supply and clearing economics without secrets", async () => {
    const response = GET(new Request("https://knot.example/api/marketplace"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      name: "KNOT Marketplace",
      settlementAsset: "USDC",
      protocolFee: {
        bps: 120,
      },
      endpoints: {
        marketplace: "https://knot.example/api/marketplace",
        quote: "https://knot.example/api/quote",
        execute: "https://knot.example/api/executions",
      },
      revenueModel: {
        earnsWhen: "an accepted provider delivery satisfies the buyer obligation",
        doesNotEarnWhen: "evidence is rejected, over budget, stale, unsigned when required, or missing required fields",
      },
    });
    expect(body.providers).toHaveLength(3);
    expect(body.providers.map((provider: { id: string }) => provider.id)).toEqual([
      "arc-baseline",
      "arc-sentinel",
      "arc-veritas",
    ]);
    expect(body.providers[2]).toMatchObject({
      id: "arc-veritas",
      proofTier: "code-aware",
      minPolicy: "strict",
      fee: {
        providerPriceUsdc: 0.045,
        protocolFeeUsdc: 0.00054,
        buyerTotalUsdc: 0.04554,
      },
    });
    expect(body.policyProducts.map((policy: { id: string }) => policy.id)).toEqual([
      "economy",
      "balanced",
      "strict",
    ]);
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
