import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeJob } from "./engine";
import { getDataFile, getExecution, saveExecution } from "./store";

const originalDataFile = process.env.KNOT_DATA_FILE;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalDataFile === undefined) {
    delete process.env.KNOT_DATA_FILE;
  } else {
    process.env.KNOT_DATA_FILE = originalDataFile;
  }
  if (originalVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }
});

describe("execution store", () => {
  it("uses the durable file as the source of truth across route module instances", async () => {
    const dataFile = join(await mkdtemp(join(tmpdir(), "knot-store-")), "receipts.json");
    process.env.KNOT_DATA_FILE = dataFile;

    const first = await executeJob({ policyPreset: "economy" });
    await saveExecution(first);

    const second = await executeJob({ policyPreset: "strict", maxPriceUsdc: 0.05 });
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(
      dataFile,
      `${JSON.stringify({ version: 1, executions: [second] }, null, 2)}\n`,
      "utf8",
    );

    await expect(getExecution(second.id)).resolves.toMatchObject({ id: second.id });
  });

  it("uses tmp storage on Vercel's read-only deployment filesystem", () => {
    delete process.env.KNOT_DATA_FILE;
    process.env.VERCEL = "1";

    expect(getDataFile()).toBe(join(tmpdir(), "knot-data", "executions.json"));
  });
});
