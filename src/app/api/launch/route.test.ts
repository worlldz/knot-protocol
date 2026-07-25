import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/launch", () => {
  it("returns a launch-ready product kit without secrets", async () => {
    const response = GET(new Request("https://knot.example/api/launch"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      name: "KNOT",
      status: "testnet-ready",
      domainReadiness: {
        currentHost: "https://knot.example",
        customDomainReady: true,
        canonicalDomainConfigured: false,
      },
      launchSurfaces: {
        console: "https://knot.example/",
        launchKit: "https://knot.example/api/launch",
        marketplace: "https://knot.example/api/marketplace",
        quote: "https://knot.example/api/quote",
        execute: "https://knot.example/api/executions",
      },
      tgeNarrative: {
        guardrail: "The hackathon build does not require a token to work. USDC remains the payment and settlement asset.",
      },
    });
    expect(body.utility).toContain("Buyer agents can preflight provider route, expected spend, and fallback reasons before execution.");
    expect(body.evidence.proofChecklist).toContain("Accepted evidence becomes a receipt and can be checked by hash.");
    expect(body.demoScript).toContain("Open /api/marketplace to show provider supply and accepted-settlement economics.");
    expect(body.launchGaps).toContain("Attach a clean custom domain before public judging or investor sharing.");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("SECRET");
  });
});
