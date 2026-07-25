import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/quote", () => {
  it("returns a preflight route without creating an execution", async () => {
    const response = await POST(new Request("https://knot.example/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policyPreset: "strict",
        jobType: "contract-review",
        subject: "0x0000000000000000000000000000000000000001",
        maxPriceUsdc: 0.05,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      decision: "ready",
      recommendedProvider: {
        id: "arc-veritas",
        priceUsdc: 0.045,
      },
      maxSpendUsdc: 0.045,
    });
    expect(body.id).toMatch(/^quote_[a-f0-9]{12}$/);
    expect(body).not.toHaveProperty("settlement");
    expect(body).not.toHaveProperty("attempts");
  });

  it("rejects invalid obligations before route calculation", async () => {
    const response = await POST(new Request("https://knot.example/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: "not-an-address" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid obligation");
  });
});
