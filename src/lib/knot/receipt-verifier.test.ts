import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeJob } from "./engine";
import { verifyReceipt } from "./receipt-verifier";
import { saveExecution } from "./store";

const originalDataFile = process.env.KNOT_DATA_FILE;

afterEach(() => {
  if (originalDataFile === undefined) {
    delete process.env.KNOT_DATA_FILE;
  } else {
    process.env.KNOT_DATA_FILE = originalDataFile;
  }
});

async function useTemporaryReceiptStore() {
  process.env.KNOT_DATA_FILE = join(await mkdtemp(join(tmpdir(), "knot-receipts-")), "executions.json");
}

describe("verifyReceipt", () => {
  it("confirms a stored receipt when the accepted evidence is still bound to settlement", async () => {
    await useTemporaryReceiptStore();
    const execution = await executeJob();
    await saveExecution(execution);

    const result = await verifyReceipt({
      id: execution.id,
      evidenceHash: execution.settlement.evidenceHash ?? undefined,
    });

    expect(result).toMatchObject({
      id: execution.id,
      valid: true,
      status: "verified",
      receipt: {
        executionId: execution.id,
        provider: "Arc Sentinel",
        attempts: 2,
        amountUsdc: 0.024,
        settlementStatus: "authorized",
      },
    });
  });

  it("rejects a mismatched evidence hash without hiding the receipt summary", async () => {
    await useTemporaryReceiptStore();
    const execution = await executeJob();
    await saveExecution(execution);

    const result = await verifyReceipt({
      id: execution.id,
      evidenceHash: `0x${"0".repeat(64)}`,
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe("mismatch");
    expect(result.reasons).toContain("Submitted evidence hash does not match the stored receipt.");
    expect(result.receipt?.executionId).toBe(execution.id);
  });

  it("reports missing receipts without leaking other stored executions", async () => {
    await useTemporaryReceiptStore();

    const result = await verifyReceipt({ id: "run_000000000000" });

    expect(result).toEqual({
      id: "run_000000000000",
      valid: false,
      status: "missing",
      checkedAt: expect.any(String),
      reasons: ["No stored KNOT receipt matched that execution ID."],
      receipt: null,
    });
  });
});
