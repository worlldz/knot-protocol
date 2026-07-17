import "server-only";

import { GatewayClient } from "@circle-fin/x402-batching/client";
import { isHex, type Hex } from "viem";

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
    rpcUrl: process.env.ARC_RPC_URL,
  });
  const result = await client.pay<T>(url, { method: "POST", body });

  return {
    data: result.data,
    amountUsdc: result.formattedAmount,
    transactionHash: result.transaction,
  };
}
