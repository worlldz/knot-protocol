import { dirname, join } from "node:path";
import type { Execution } from "./schemas";
import { executionSchema } from "./schemas";

type ExecutionStore = {
  version: 1;
  executions: Execution[];
};

const defaultDataFile = join(".knot-data", "executions.json");

function getDataFile() {
  return process.env.KNOT_DATA_FILE || defaultDataFile;
}

async function loadStore() {
  const executions = new Map<string, Execution>();
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = JSON.parse(await readFile(/* turbopackIgnore: true */ getDataFile(), "utf8")) as Partial<ExecutionStore>;
    for (const candidate of raw.executions ?? []) {
      const parsed = executionSchema.safeParse(candidate);
      if (parsed.success) executions.set(parsed.data.id, parsed.data);
    }
  } catch (cause) {
    const missing = cause instanceof Error
      && "code" in cause
      && cause.code === "ENOENT";
    if (!missing) console.error("KNOT execution store could not be loaded", cause);
  }

  return executions;
}

async function persistStore(executions: Map<string, Execution>) {
  const { mkdir, rename, writeFile } = await import("node:fs/promises");
  const dataFile = getDataFile();
  await mkdir(/* turbopackIgnore: true */ dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  const payload: ExecutionStore = {
    version: 1,
    executions: [...executions.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500),
  };
  await writeFile(/* turbopackIgnore: true */ temporary, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(/* turbopackIgnore: true */ temporary, dataFile);
}

export async function saveExecution(execution: Execution) {
  const executions = await loadStore();
  executions.set(execution.id, execution);
  await persistStore(executions);
  return execution;
}

export async function getExecution(id: string) {
  return (await loadStore()).get(id) ?? null;
}

export async function listExecutions(limit = 20, owner?: string) {
  const normalizedOwner = owner?.toLowerCase();
  return [...(await loadStore()).values()]
    .filter((execution) => !normalizedOwner || execution.owner?.toLowerCase() === normalizedOwner)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.min(Math.max(limit, 1), 100));
}
