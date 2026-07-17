import { describe, expect, it } from "vitest";
import { executeJob } from "./engine";

describe("executeJob", () => {
  it("rejects bad evidence, falls back, and authorizes only the accepted provider", async () => {
    const execution = await executeJob();

    expect(execution.status).toBe("verified");
    expect(execution.attempts.map((attempt) => attempt.outcome)).toEqual([
      "rejected",
      "accepted",
    ]);
    expect(execution.events.some((event) => event.kind === "fallback")).toBe(true);
    expect(execution.settlement).toMatchObject({
      status: "authorized",
      amountUsdc: 0.024,
      recipient: "northstar-data",
      rail: "simulated",
      transactionHash: null,
    });
    expect(execution.settlement.evidenceHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("blocks settlement when the budget excludes every provider", async () => {
    const execution = await executeJob({ maxPriceUsdc: 0.01 });

    expect(execution.status).toBe("failed");
    expect(execution.attempts).toHaveLength(0);
    expect(execution.settlement.status).toBe("blocked");
    expect(execution.settlement.amountUsdc).toBe(0);
  });
});
