import type { CreateExecutionInput, Execution } from "./schemas";
import type { createKnotManifest } from "./manifest";
import type { createKnotLaunchKit } from "./launch";
import type { createKnotMarketplace } from "./marketplace";
import type { ExecutionQuote } from "./quote";
import type { ReceiptVerification } from "./receipt-verifier";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type KnotClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  fetch?: FetchLike;
};

export type RunExecutionOptions = {
  apiKey?: string;
  signal?: AbortSignal;
};
export type KnotManifest = ReturnType<typeof createKnotManifest>;
export type KnotLaunchKit = ReturnType<typeof createKnotLaunchKit>;
export type KnotMarketplace = ReturnType<typeof createKnotMarketplace>;

export class KnotClientError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "KnotClientError";
    this.status = status;
    this.details = details;
  }
}

function normalizeBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
}

function endpoint(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return "KNOT request failed.";
}

export class KnotClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: FetchLike;

  constructor(options: KnotClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    const fetcher = options.fetch ?? globalThis.fetch;
    if (!fetcher) {
      throw new Error("KnotClient requires a fetch implementation.");
    }
    this.fetcher = fetcher.bind(globalThis) as FetchLike;
  }

  async run(input: CreateExecutionInput = {}, options: RunExecutionOptions = {}) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = options.apiKey ?? this.apiKey;
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    return this.request<Execution>("/api/executions", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: options.signal,
    });
  }

  async quote(input: CreateExecutionInput = {}, options: { signal?: AbortSignal } = {}) {
    return this.request<ExecutionQuote>("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: options.signal,
    });
  }

  async getExecution(id: string) {
    return this.request<Execution>(`/api/executions/${encodeURIComponent(id)}`);
  }

  async listExecutions(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 25);
    if (uniqueIds.length === 0) return [];

    const data = await this.request<{ executions?: Execution[] }>(
      `/api/executions?ids=${encodeURIComponent(uniqueIds.join(","))}`,
    );
    return data.executions ?? [];
  }

  async getManifest() {
    return this.request<KnotManifest>("/api/manifest");
  }

  async getLaunchKit() {
    return this.request<KnotLaunchKit>("/api/launch");
  }

  async getMarketplace() {
    return this.request<KnotMarketplace>("/api/marketplace");
  }

  async verifyReceipt(id: string, evidenceHash?: string) {
    const search = new URLSearchParams({ id });
    if (evidenceHash) search.set("evidenceHash", evidenceHash);
    return this.request<ReceiptVerification>(`/api/receipts/verify?${search.toString()}`);
  }

  private async request<T>(path: string, init?: RequestInit) {
    const response = await this.fetcher(endpoint(this.baseUrl, path), init);
    const body = await readJson(response);
    if (!response.ok) {
      throw new KnotClientError(errorMessage(body), response.status, body);
    }
    return body as T;
  }
}

export function createKnotClient(options: KnotClientOptions = {}) {
  return new KnotClient(options);
}
