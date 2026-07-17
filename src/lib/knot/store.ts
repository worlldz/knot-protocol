import type { Execution } from "./schemas";

const globalStore = globalThis as typeof globalThis & {
  knotExecutions?: Map<string, Execution>;
};

const executions = globalStore.knotExecutions ?? new Map<string, Execution>();

if (process.env.NODE_ENV !== "production") {
  globalStore.knotExecutions = executions;
}

export function saveExecution(execution: Execution) {
  executions.set(execution.id, execution);
  return execution;
}

export function getExecution(id: string) {
  return executions.get(id) ?? null;
}
