import "server-only";

import { createHash } from "node:crypto";
import { formatUnits, isAddress, verifyMessage, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET, getArcRpcUrl } from "../arc-network";
import { getFirstHexEnv } from "../server-env";
import type { Delivery } from "./schemas";

type RpcBlock = { number: string; timestamp: string };
type RpcRequest = { method: string; params?: unknown[] };
type RpcResponse = { id?: number; result?: unknown; error?: { message?: string } };

async function rpcBatch<T extends unknown[]>(requests: RpcRequest[]): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(getArcRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requests.map((request, index) => ({ jsonrpc: "2.0", id: index + 1, ...request, params: request.params ?? [] }))),
      cache: "no-store",
    });
    const raw = await response.json() as RpcResponse | RpcResponse[];
    const replies = Array.isArray(raw) ? raw : [raw];
    const failed = replies.find((reply) => reply.error || reply.result === undefined);
    if (response.ok && !failed && replies.length === requests.length) {
      return requests.map((_, index) => replies.find((reply) => reply.id === index + 1)?.result) as T;
    }

    const message = failed?.error?.message ?? `Arc RPC request failed with status ${response.status}.`;
    const rateLimited = response.status === 429 || /limit|rate/i.test(message);
    if (!rateLimited || attempt === 2) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw new Error("Arc RPC request failed after retrying.");
}

function scoreWallet(balance: bigint, transactionCount: number, isContract: boolean) {
  const balanceUsdc = Number(formatUnits(balance, ARC_TESTNET.nativeCurrency.decimals));
  let score = 50;
  const signals: string[] = [];

  if (transactionCount === 0) { score += 30; signals.push("No outgoing transaction history"); }
  else if (transactionCount < 3) { score += 14; signals.push("Limited transaction history"); }
  else if (transactionCount > 25) { score -= 12; signals.push("Established transaction history"); }

  if (balanceUsdc === 0) { score += 12; signals.push("Zero native USDC balance"); }
  else if (balanceUsdc >= 10) { score -= 10; signals.push("Funded with at least 10 USDC"); }
  else signals.push("Funded wallet");

  if (isContract) { score += 5; signals.push("Contract account requires code-level review"); }
  else signals.push("Externally owned account");

  const riskScore = Math.max(0, Math.min(100, score));
  const risk = riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low";
  return { risk, riskScore, signals, balanceUsdc };
}

type ArcWalletSnapshot = {
  analysis: ReturnType<typeof scoreWallet>;
  latencyMs: number;
  ageSeconds: number;
  observedAt: string;
  transactionCount: number;
  accountType: string;
  latestBlock: number;
  bytecodeHash: string;
};

const snapshotCache = new Map<string, { expiresAt: number; value: Promise<ArcWalletSnapshot> }>();

async function loadArcWallet(subject: string): Promise<ArcWalletSnapshot> {
  if (!isAddress(subject)) throw new Error("A valid Arc address is required.");
  const startedAt = performance.now();
  const [balanceHex, nonceHex, code, block] = await rpcBatch<[string, string, string, RpcBlock]>([
    { method: "eth_getBalance", params: [subject, "latest"] },
    { method: "eth_getTransactionCount", params: [subject, "latest"] },
    { method: "eth_getCode", params: [subject, "latest"] },
    { method: "eth_getBlockByNumber", params: ["latest", false] },
  ]);

  const balance = BigInt(balanceHex);
  const transactionCount = Number(BigInt(nonceHex));
  const isContract = code !== "0x" && code !== "0x0";
  const blockTimestamp = Number(BigInt(block.timestamp));
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - blockTimestamp);
  const analysis = scoreWallet(balance, transactionCount, isContract);
  const observedAt = new Date(blockTimestamp * 1000).toISOString();
  return {
    analysis,
    latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
    ageSeconds,
    observedAt,
    transactionCount,
    accountType: isContract ? "contract" : "wallet",
    latestBlock: Number(BigInt(block.number)),
    bytecodeHash: `0x${createHash("sha256").update(code).digest("hex")}`,
  };
}

async function readArcWallet(subject: string) {
  const key = subject.toLowerCase();
  const cached = snapshotCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = loadArcWallet(subject).catch((cause) => {
    snapshotCache.delete(key);
    throw cause;
  });
  snapshotCache.set(key, { expiresAt: Date.now() + 4_000, value });
  return value;
}

export async function createArcBaselineDelivery(subject: string, decisionRequest?: string): Promise<Delivery> {
  const snapshot = await readArcWallet(subject);
  const payload = {
    subject,
    decisionRequest: decisionRequest ?? "Assess this Arc wallet.",
    risk: snapshot.analysis.risk,
    observedAt: snapshot.observedAt,
    balanceUsdc: snapshot.analysis.balanceUsdc,
    transactionCount: snapshot.transactionCount,
    accountType: snapshot.accountType,
    latestBlock: snapshot.latestBlock,
    methodology: "Arc Baseline RPC snapshot v1",
  };

  return {
    providerId: "arc-baseline",
    provider: "Arc Baseline",
    priceUsdc: 0.008,
    latencyMs: snapshot.latencyMs,
    ageSeconds: snapshot.ageSeconds,
    signatureValid: false,
    payload,
    evidenceHash: `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`,
  };
}

export async function createArcRiskDelivery(subject: string, decisionRequest?: string): Promise<Delivery> {
  const providerKey = getFirstHexEnv(
    "KNOT_PROVIDER_PRIVATE_KEY",
    "KNOT_ATTESTER_PRIVATE_KEY",
    "ARC_DEPLOYER_PRIVATE_KEY",
  );
  if (!providerKey) throw new Error("KNOT_PROVIDER_PRIVATE_KEY is not configured.");
  const snapshot = await readArcWallet(subject);
  const account = privateKeyToAccount(providerKey as Hex);
  const payload = {
    subject,
    decisionRequest: decisionRequest ?? "Assess this Arc wallet.",
    risk: snapshot.analysis.risk,
    riskScore: snapshot.analysis.riskScore,
    confidence: 0.92,
    observedAt: snapshot.observedAt,
    balanceUsdc: snapshot.analysis.balanceUsdc,
    transactionCount: snapshot.transactionCount,
    accountType: snapshot.accountType,
    latestBlock: snapshot.latestBlock,
    signals: snapshot.analysis.signals,
    methodology: "KNOT Arc heuristic v1",
    providerSigner: account.address,
  };
  const evidenceHash = `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
  const signature = await account.signMessage({ message: evidenceHash });
  const signatureValid = await verifyMessage({ address: account.address, message: evidenceHash, signature });

  return {
    providerId: "arc-sentinel",
    provider: "Arc Sentinel",
    priceUsdc: 0.024,
    latencyMs: snapshot.latencyMs,
    ageSeconds: snapshot.ageSeconds,
    signatureValid,
    payload,
    evidenceHash,
  };
}

export async function createArcDeepRiskDelivery(subject: string, decisionRequest?: string): Promise<Delivery> {
  const providerKey = getFirstHexEnv(
    "KNOT_PROVIDER_PRIVATE_KEY",
    "KNOT_ATTESTER_PRIVATE_KEY",
    "ARC_DEPLOYER_PRIVATE_KEY",
  );
  if (!providerKey) throw new Error("KNOT_PROVIDER_PRIVATE_KEY is not configured.");
  const snapshot = await readArcWallet(subject);
  const account = privateKeyToAccount(providerKey as Hex);
  const payload = {
    subject,
    decisionRequest: decisionRequest ?? "Run a code-aware Arc counterparty review.",
    risk: snapshot.analysis.risk,
    riskScore: snapshot.analysis.riskScore,
    confidence: 0.97,
    observedAt: snapshot.observedAt,
    balanceUsdc: snapshot.analysis.balanceUsdc,
    transactionCount: snapshot.transactionCount,
    accountType: snapshot.accountType,
    latestBlock: snapshot.latestBlock,
    signals: snapshot.analysis.signals,
    bytecodeHash: snapshot.bytecodeHash,
    proofVersion: "KNOT-VERITAS-1",
    inspectionScope: ["balance", "nonce", "account-code", "block-freshness"],
    methodology: "KNOT Arc code-aware heuristic v1",
    providerSigner: account.address,
  };
  const evidenceHash = `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
  const signature = await account.signMessage({ message: evidenceHash });
  const signatureValid = await verifyMessage({ address: account.address, message: evidenceHash, signature });

  return {
    providerId: "arc-veritas",
    provider: "Arc Veritas",
    priceUsdc: 0.045,
    latencyMs: snapshot.latencyMs,
    ageSeconds: snapshot.ageSeconds,
    signatureValid,
    payload,
    evidenceHash,
  };
}
