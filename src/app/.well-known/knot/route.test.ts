import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /.well-known/knot", () => {
  it("returns the public KNOT discovery document", async () => {
    const response = GET(new Request("https://knot.example/.well-known/knot"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      name: "KNOT",
      protocol: "knot.verification-settlement",
      homepage: "https://knot.example/",
      manifestUrl: "https://knot.example/api/manifest",
      openapiUrl: "https://knot.example/api/openapi",
      endpoints: {
        quote: "https://knot.example/api/quote",
        execute: "https://knot.example/api/executions",
        openapi: "https://knot.example/api/openapi",
        submission: "https://knot.example/api/submission",
        launch: "https://knot.example/api/launch",
        marketplace: "https://knot.example/api/marketplace",
      },
      auth: {
        quote: "none",
        previewExecution: "none",
      },
    });
    expect(body.capabilities).toContain("preflight-quotes");
    expect(body.capabilities).toContain("receipt-verification");
    expect(body.capabilities).toContain("judge-ready-submission-brief");
    expect(body.capabilities).toContain("launch-readiness-kit");
    expect(body.capabilities).toContain("provider-marketplace-catalog");
    expect(body.recommendedFlow).toContain("POST /api/quote");
    expect(body.recommendedFlow).toContain("GET /api/launch");
    expect(body.recommendedFlow).toContain("GET /api/marketplace");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
