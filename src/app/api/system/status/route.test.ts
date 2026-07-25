import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const trackedKeys = [
  "X402_BUYER_PRIVATE_KEY",
  "X402_SELLER_ADDRESS",
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "CIRCLE_WALLET_SET_ID",
  "KNOT_HOOK_ADDRESS",
  "KNOT_ATTESTER_PRIVATE_KEY",
  "KNOT_EXECUTION_API_KEY",
] as const;

const originalEnv = Object.fromEntries(
  trackedKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof trackedKeys)[number], string | undefined>;

afterEach(() => {
  for (const key of trackedKeys) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("GET /api/system/status", () => {
  it("reports deployment proof without leaking configured secrets", async () => {
    process.env.X402_BUYER_PRIVATE_KEY = `\uFEFF0x${"11".repeat(32)} `;
    process.env.X402_SELLER_ADDRESS = " 0x0000000000000000000000000000000000000001 ";
    process.env.CIRCLE_API_KEY = "circle-secret-key";
    process.env.CIRCLE_ENTITY_SECRET = "circle-entity-secret";
    process.env.CIRCLE_WALLET_SET_ID = "circle-wallet-set";
    process.env.KNOT_HOOK_ADDRESS = "0x73b00398580ba7a19ffb7a5677cf3970e15918d5";
    process.env.KNOT_ATTESTER_PRIVATE_KEY = `"0x${"22".repeat(32)}"`;
    process.env.KNOT_EXECUTION_API_KEY = "execution-secret-key";

    const response = GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body).toMatchObject({
      environment: "Arc Testnet",
      chainId: 5_042_002,
      mode: "live",
      deployment: {
        commerce: "0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f",
        hook: "0x73b00398580ba7a19ffb7a5677cf3970e15918d5",
        verified: true,
      },
      latestProof: {
        status: "Completed",
        jobId: "1",
      },
      services: {
        x402Buyer: "ready",
        x402Seller: "ready",
        circleAgent: "ready",
        settlementHook: "ready",
        evidenceAttester: "ready",
        protocolApi: "protected",
      },
    });
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("circle-wallet-set");
  });
});
