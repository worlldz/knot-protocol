import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cleanEnvValue } from "../server-env";
import type { Execution } from "./schemas";
import { executionSchema } from "./schemas";

type ExecutionStore = {
  version: 1;
  executions: Execution[];
};

const defaultDataFile = join(".knot-data", "executions.json");
const receiptBlobPrefix = "knot-receipts/v1/";

function blobToken() {
  return cleanEnvValue(process.env.BLOB_READ_WRITE_TOKEN);
}

export function hasDurableReceiptStore() {
  return Boolean(blobToken() || cleanEnvValue(process.env.BLOB_STORE_ID));
}

function receiptBlobPath(id: string) {
  return `${receiptBlobPrefix}${id}.json`;
}

async function readBlobExecution(pathname: string) {
  const { get } = await import("@vercel/blob");
  const result = await get(pathname, {
    access: "private",
    useCache: false,
    ...(blobToken() ? { token: blobToken() } : {}),
  });
  if (!result || result.statusCode !== 200) return null;
  const parsed = executionSchema.safeParse(await new Response(result.stream).json());
  return parsed.success ? parsed.data : null;
}

async function saveBlobExecution(execution: Execution) {
  const { put } = await import("@vercel/blob");
  await put(receiptBlobPath(execution.id), JSON.stringify(execution), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(blobToken() ? { token: blobToken() } : {}),
  });
}

async function loadBlobExecutions() {
  const { list } = await import("@vercel/blob");
  const result = await list({
    prefix: receiptBlobPrefix,
    limit: 200,
    ...(blobToken() ? { token: blobToken() } : {}),
  });
  const settled = await Promise.allSettled(
    result.blobs
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map((blob) => readBlobExecution(blob.pathname)),
  );
  return settled.flatMap((item) => item.status === "fulfilled" && item.value ? [item.value] : []);
}

export function getDataFile() {
  const configured = cleanEnvValue(process.env.KNOT_DATA_FILE);
  if (configured) return configured;
  if (process.env.VERCEL) return join(tmpdir(), "knot-data", "executions.json");
  return defaultDataFile;
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
  if (hasDurableReceiptStore()) {
    try {
      await saveBlobExecution(execution);
    } catch (cause) {
      console.error("KNOT receipt could not be persisted to durable blob storage", cause);
    }
  }
  return execution;
}

export async function getExecution(id: string) {
  if (hasDurableReceiptStore()) {
    try {
      const durable = await readBlobExecution(receiptBlobPath(id));
      if (durable) return durable;
    } catch (cause) {
      console.error("KNOT durable receipt could not be loaded", cause);
    }
  }
  return (await loadStore()).get(id) ?? null;
}

export async function listExecutions(limit = 20, owner?: string) {
  const normalizedOwner = owner?.toLowerCase();
  const executions = await loadStore();
  if (hasDurableReceiptStore()) {
    try {
      for (const execution of await loadBlobExecutions()) executions.set(execution.id, execution);
    } catch (cause) {
      console.error("KNOT durable receipt ledger could not be loaded", cause);
    }
  }
  return [...executions.values()]
    .filter((execution) => !normalizedOwner || execution.owner?.toLowerCase() === normalizedOwner)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.min(Math.max(limit, 1), 100));
}
