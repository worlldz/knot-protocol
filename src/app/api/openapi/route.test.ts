import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/openapi", () => {
  it("returns an agent-usable OpenAPI document for the current host", async () => {
    const response = GET(new Request("https://knot.example/api/openapi"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      openapi: "3.1.0",
      info: {
        title: "KNOT API",
      },
      servers: [{ url: "https://knot.example" }],
      paths: {
        "/.well-known/knot": {
          get: {
            tags: ["Discovery"],
          },
        },
        "/api/quote": {
          post: {
            tags: ["Preflight"],
          },
        },
        "/api/submission": {
          get: {
            tags: ["Discovery"],
          },
        },
        "/api/executions": {
          post: {
            security: [{ bearerAuth: [] }, {}],
          },
        },
        "/api/receipts/verify": {
          get: {
            tags: ["Receipts"],
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    });
    expect(body.components.schemas.PolicyPreset.enum).toEqual([
      "economy",
      "balanced",
      "strict",
      "custom",
    ]);
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
