import "server-only";

import { createHash } from "node:crypto";
import { formatUnits, isAddress, verifyMessage, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET } from "@/lib/arc-network";
import type { Delivery } from "./schemas";

type RpcBlock = { number: string; timestamp: string };

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(process.env.ARC_RPC_URL ?? ARC_TESTNET.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const body = await response.json() as { result?: T; error?: { message?: string } };
  if (!response.ok || body.error || body.result === undefined) {
    throw new Error(body.error?.message ?? `Arc RPC request failed: ${method}`);
  }
  return body.result;
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

export async function createArcRiskDelivery(subject: string): Promise<Delivery> {
  if (!isAddress(subject)) throw new Error("A valid Arc address is required.");
  const providerKey = process.env.KNOT_PROVIDER_PRIVATE_KEY;
  if (!providerKey?.startsWith("0x")) throw new Error("KNOT_PROVIDER_PRIVATE_KEY is not configured.");

  const startedAt = performance.now();
  const [balanceHex, nonceHex, code, block] = await Promise.all([
    rpc<string>("eth_getBalance", [subject, "latest"]),
    rpc<string>("eth_getTransactionCount", [subject, "latest"]),
    rpc<string>("eth_getCode", [subject, "latest"]),
    rpc<RpcBlock>("eth_getBlockByNumber", ["latest", false]),
  ]);

  const balance = BigInt(balanceHex);
  const transactionCount = Number(BigInt(nonceHex));
  const isContract = code !== "0x" && code !== "0x0";
  const blockTimestamp = Number(BigInt(block.timestamp));
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - blockTimestamp);
  const analysis = scoreWallet(balance, transactionCount, isContract);
  const observedAt = new Date(blockTimestamp * 1000).toISOString();
  const account = privateKeyToAccount(providerKey as Hex);
  const payload = {
    subject,
    risk: analysis.risk,
    riskScore: analysis.riskScore,
    confidence: 0.92,
    observedAt,
    balanceUsdc: analysis.balanceUsdc,
    transactionCount,
    accountType: isContract ? "contract" : "wallet",
    latestBlock: Number(BigInt(block.number)),
    signals: analysis.signals,
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
    latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
    ageSeconds,
    signatureValid,
    payload,
    evidenceHash,
  };
}
