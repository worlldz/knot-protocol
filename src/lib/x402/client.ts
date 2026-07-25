import "server-only";

import { BatchEvmScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits, isHex, type Hex } from "viem";
import { createCircleAgentSigner, ensureCircleAgentGatewayBalance } from "@/lib/circle/wallets";
import { getArcRpcUrl } from "../arc-network";

export type PaidResource<T> = {
  data: T;
  amountUsdc: string;
  transactionHash: string;
};

export function isX402BuyerConfigured() {
  return isHex(process.env.X402_BUYER_PRIVATE_KEY ?? "");
}

export async function payForResource<T>(
  url: string,
  body: unknown,
): Promise<PaidResource<T>> {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY;

  if (!privateKey || !isHex(privateKey)) {
    throw new Error("X402_BUYER_PRIVATE_KEY is not configured.");
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: privateKey as Hex,
    rpcUrl: getArcRpcUrl(),
  });
  const result = await client.pay<T>(url, { method: "POST", body });

  return {
    data: result.data,
    amountUsdc: result.formattedAmount,
    transactionHash: result.transaction,
  };
}

type PaymentOption = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
};

export async function payForResourceWithCircleAgent<T>(
  wallet: { id: string; address: string },
  url: string,
  body: unknown,
): Promise<PaidResource<T>> {
  const method = "POST";
  const headers = { "content-type": "application/json" };
  const serializedBody = JSON.stringify(body);
  const initialResponse = await fetch(url, { method, headers, body: serializedBody });

  if (initialResponse.status !== 402) {
    if (!initialResponse.ok) throw new Error(`Provider request failed with status ${initialResponse.status}.`);
    return { data: await initialResponse.json() as T, amountUsdc: "0", transactionHash: "" };
  }

  const requiredHeader = initialResponse.headers.get("PAYMENT-REQUIRED");
  if (!requiredHeader) throw new Error("Provider did not return x402 payment requirements.");
  const required = JSON.parse(Buffer.from(requiredHeader, "base64").toString("utf8")) as {
    x402Version?: number;
    resource?: unknown;
    accepts?: PaymentOption[];
  };
  const option = required.accepts?.find((candidate) =>
    candidate.network === "eip155:5042002"
    && candidate.extra?.name === "GatewayWalletBatched"
    && typeof candidate.extra?.verifyingContract === "string",
  );
  if (!option) throw new Error("The provider does not expose an Arc Gateway batching option.");

  await ensureCircleAgentGatewayBalance(wallet.id, wallet.address, BigInt(option.amount));

  const signer = createCircleAgentSigner(wallet.id, wallet.address);
  const scheme = new BatchEvmScheme(signer);
  const payment = await scheme.createPaymentPayload(required.x402Version ?? 2, option);
  const paymentHeader = Buffer.from(JSON.stringify({
    ...payment,
    resource: required.resource,
    accepted: option,
  })).toString("base64");
  const paidResponse = await fetch(url, {
    method,
    headers: { ...headers, "Payment-Signature": paymentHeader },
    body: serializedBody,
  });
  const responseHeader = paidResponse.headers.get("PAYMENT-RESPONSE");
  const settlement = responseHeader
    ? JSON.parse(Buffer.from(responseHeader, "base64").toString("utf8")) as { transaction?: string }
    : undefined;

  if (!paidResponse.ok) {
    const failure = await paidResponse.json().catch(() => ({})) as { error?: string };
    throw new Error(failure.error ?? `Circle agent payment failed with status ${paidResponse.status}.`);
  }

  return {
    data: await paidResponse.json() as T,
    amountUsdc: formatUnits(BigInt(option.amount), 6),
    transactionHash: settlement?.transaction ?? "",
  };
}
