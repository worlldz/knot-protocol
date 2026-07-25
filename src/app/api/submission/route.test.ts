import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/submission", () => {
  it("returns a judge-ready project brief without secrets", async () => {
    const response = GET(new Request("https://knot.example/api/submission"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      name: "KNOT",
      tagline: "Pay for verified outcomes, not unproven responses.",
      workingSurface: {
        console: "https://knot.example/",
        discovery: "https://knot.example/.well-known/knot",
        openapi: "https://knot.example/api/openapi",
        launch: "https://knot.example/api/launch",
        quote: "https://knot.example/api/quote",
        execute: "https://knot.example/api/executions",
      },
      liveProof: {
        chain: {
          name: "Arc Testnet",
          id: 5_042_002,
        },
      },
    });
    expect(body.problem).toContain("Agent payments are becoming easy, but agent accountability is still thin.");
    expect(body.demoFlow).toContain("Strict rejects Baseline and Sentinel, then accepts Arc Veritas at 0.045 USDC.");
    expect(body.judgeChecklist).toContain("OpenAPI and discovery endpoints let external agents integrate without reading the UI.");
    expect(body.judgeChecklist).toContain("The launch kit explains domain readiness, utility, revenue paths, and TGE guardrails.");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
