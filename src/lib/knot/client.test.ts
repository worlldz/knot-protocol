import { describe, expect, it, vi } from "vitest";
import { KnotClient, KnotClientError } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("KnotClient", () => {
  it("runs an execution against the configured KNOT API with bearer auth", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: "run_123456789abc", status: "verified" }, 201));
    const client = new KnotClient({
      baseUrl: "https://knot.example/",
      apiKey: "server-secret",
      fetch: fetcher,
    });

    const result = await client.run({ policyPreset: "strict", maxPriceUsdc: 0.05 });
    const [url, init] = fetcher.mock.calls[0];

    expect(result.id).toBe("run_123456789abc");
    expect(url).toBe("https://knot.example/api/executions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer server-secret",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      policyPreset: "strict",
      maxPriceUsdc: 0.05,
    });
  });

  it("does not call the API when there are no receipt IDs to load", async () => {
    const fetcher = vi.fn();
    const client = new KnotClient({ fetch: fetcher });

    await expect(client.listExecutions(["", "   "])).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads the public developer manifest", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ name: "KNOT", endpoints: {} }));
    const client = new KnotClient({ baseUrl: "https://knot.example", fetch: fetcher });

    await expect(client.getManifest()).resolves.toMatchObject({ name: "KNOT" });
    expect(fetcher.mock.calls[0][0]).toBe("https://knot.example/api/manifest");
  });

  it("requests a preflight quote without bearer auth", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      decision: "ready",
      recommendedProvider: { id: "arc-veritas" },
    }));
    const client = new KnotClient({ baseUrl: "https://knot.example", apiKey: "server-secret", fetch: fetcher });

    await expect(client.quote({ policyPreset: "strict", maxPriceUsdc: 0.05 })).resolves.toMatchObject({
      decision: "ready",
      recommendedProvider: { id: "arc-veritas" },
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://knot.example/api/quote");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
  });

  it("verifies a receipt with an optional evidence hash", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ valid: true, status: "verified" }));
    const client = new KnotClient({ baseUrl: "https://knot.example", fetch: fetcher });

    await expect(client.verifyReceipt("run_123456789abc", `0x${"a".repeat(64)}`)).resolves.toMatchObject({
      valid: true,
      status: "verified",
    });
    expect(fetcher.mock.calls[0][0]).toBe(
      `https://knot.example/api/receipts/verify?id=run_123456789abc&evidenceHash=0x${"a".repeat(64)}`,
    );
  });

  it("raises a typed error with the API response details", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: "Invalid obligation" }, 400));
    const client = new KnotClient({ fetch: fetcher });

    await expect(client.getExecution("run_missing")).rejects.toMatchObject({
      name: "KnotClientError",
      message: "Invalid obligation",
      status: 400,
      details: { error: "Invalid obligation" },
    } satisfies Partial<KnotClientError>);
  });
});
