import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/manifest", () => {
  it("returns a self-describing developer manifest for the current host", async () => {
    const response = GET(new Request("https://knot.example/api/manifest"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      name: "KNOT",
      chain: {
        name: "Arc Testnet",
        id: 5_042_002,
        nativeAsset: "USDC",
      },
      contracts: {
        commerce: {
          address: "0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f",
          verified: true,
        },
        hook: {
          address: "0x73b00398580ba7a19ffb7a5677cf3970e15918d5",
          verified: true,
        },
      },
      endpoints: {
        discovery: {
          method: "GET",
          url: "https://knot.example/.well-known/knot",
        },
        openapi: {
          method: "GET",
          url: "https://knot.example/api/openapi",
        },
        submission: {
          method: "GET",
          url: "https://knot.example/api/submission",
        },
        launch: {
          method: "GET",
          url: "https://knot.example/api/launch",
        },
        marketplace: {
          method: "GET",
          url: "https://knot.example/api/marketplace",
        },
        quoteExecution: {
          method: "POST",
          url: "https://knot.example/api/quote",
        },
        runExecution: {
          method: "POST",
          url: "https://knot.example/api/executions",
        },
        manifest: {
          method: "GET",
          url: "https://knot.example/api/manifest",
        },
        verifyReceipt: {
          method: "GET",
          url: "https://knot.example/api/receipts/verify?id=run_...&evidenceHash=0x...",
        },
      },
    });
    expect(Object.keys(body.jobs)).toEqual([
      "counterparty",
      "treasury",
      "agent-spend",
      "contract-review",
    ]);
    expect(Object.keys(body.policies)).toEqual(["economy", "balanced", "strict"]);
    expect(body.endpoints.quoteExecution.auth).toContain("Does not execute work");
    expect(body.curl).toContain("https://knot.example/api/executions");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
