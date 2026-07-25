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
      },
      auth: {
        quote: "none",
        previewExecution: "none",
      },
    });
    expect(body.capabilities).toContain("preflight-quotes");
    expect(body.capabilities).toContain("receipt-verification");
    expect(body.recommendedFlow).toContain("POST /api/quote");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
