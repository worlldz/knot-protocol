import crypto from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createEIP1193Provider } from "@circle-fin/developer-controlled-wallets/evm";
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits, type Address, type Hex } from "viem";
import { getEnvValue } from "../server-env";

const ARC_BLOCKCHAIN = "ARC-TESTNET";
const ARC_CHAIN_ID = 5_042_002;
const ARC_USDC = "0x3600000000000000000000000000000000000000" as Address;
const GATEWAY_WALLET = "0x0077777d7eba4688bdef3e311b846f25870a19b9" as Address;
const GATEWAY_DOMAIN = 26;
const GATEWAY_DEPOSIT_USDC = "0.5";
const gatewayWalletAbi = [{
  type: "function",
  name: "deposit",
  stateMutability: "nonpayable",
  inputs: [{ name: "token", type: "address" }, { name: "value", type: "uint256" }],
  outputs: [],
}] as const;

export type AgentWallet = {
  id: string;
  address: string;
  owner: string;
  accountType: string;
  blockchain: typeof ARC_BLOCKCHAIN;
  balanceUsdc: string;
  gatewayBalanceUsdc: string;
};

function getCircleClient() {
  const apiKey = getEnvValue("CIRCLE_API_KEY");
  const entitySecret = getEnvValue("CIRCLE_ENTITY_SECRET");

  if (!apiKey || !entitySecret) {
    throw new Error("Circle developer wallet credentials are not configured.");
  }

  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}

function getWalletSetId() {
  const walletSetId = getEnvValue("CIRCLE_WALLET_SET_ID");
  if (!walletSetId) throw new Error("Circle wallet set is not configured.");
  return walletSetId;
}

function stableIdempotencyKey(owner: string) {
  const bytes = Buffer.from(crypto.createHash("sha256").update(`knot-agent:${owner}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toAgentWallet(
  wallet: { id?: string; address?: string; accountType?: string },
  owner: string,
  balanceUsdc = "0",
  gatewayBalanceUsdc = "0",
): AgentWallet {
  if (!wallet.id || !wallet.address) throw new Error("Circle returned an incomplete wallet record.");
  return {
    id: wallet.id,
    address: wallet.address,
    owner,
    accountType: wallet.accountType ?? "EOA",
    blockchain: ARC_BLOCKCHAIN,
    balanceUsdc,
    gatewayBalanceUsdc,
  };
}

export async function getCircleGatewayBalance(address: string) {
  const response = await fetch("https://gateway-api-testnet.circle.com/v1/balances", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources: [{ depositor: address, domain: GATEWAY_DOMAIN }] }),
    cache: "no-store",
  });
  const data = await response.json() as { balances?: Array<{ balance?: string }>; message?: string };
  if (!response.ok) throw new Error(data.message ?? "Circle Gateway balance lookup failed.");
  return data.balances?.[0]?.balance ?? "0";
}

async function withBalance(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  wallet: { id?: string; address?: string; accountType?: string },
  owner: string,
) {
  if (!wallet.id) return toAgentWallet(wallet, owner);
  try {
    const balances = await client.getWalletTokenBalance({ id: wallet.id, includeAll: true, pageSize: 50 });
    const usdc = balances.data?.tokenBalances?.find((balance) =>
      balance.token.symbol?.toUpperCase() === "USDC" || (balance.token.blockchain === ARC_BLOCKCHAIN && balance.token.isNative),
    );
    const gatewayBalance = await getCircleGatewayBalance(wallet.address ?? "").catch(() => "0");
    return toAgentWallet(wallet, owner, usdc?.amount ?? "0", gatewayBalance);
  } catch {
    // Wallet access must remain available even if Circle's indexed balance is briefly delayed.
    return toAgentWallet(wallet, owner);
  }
}

export async function ensureCircleAgentGatewayBalance(
  walletId: string,
  walletAddress: string,
  minimumAtomic: bigint,
) {
  const current = parseUnits(await getCircleGatewayBalance(walletAddress), 6);
  if (current >= minimumAtomic) return formatUnits(current, 6);

  const client = getCircleClient();
  const balances = await client.getWalletTokenBalance({ id: walletId, includeAll: true, pageSize: 50 });
  const walletUsdc = balances.data?.tokenBalances?.find((balance) =>
    balance.token.symbol?.toUpperCase() === "USDC" || (balance.token.blockchain === ARC_BLOCKCHAIN && balance.token.isNative),
  );
  const depositAmount = parseUnits(GATEWAY_DEPOSIT_USDC, 6);
  if (parseUnits(walletUsdc?.amount ?? "0", 6) < depositAmount) {
    throw new Error(`Agent needs ${GATEWAY_DEPOSIT_USDC} USDC in its wallet before Gateway can be funded.`);
  }

  const apiKey = getEnvValue("CIRCLE_API_KEY");
  const entitySecret = getEnvValue("CIRCLE_ENTITY_SECRET");
  if (!apiKey || !entitySecret) throw new Error("Circle developer wallet credentials are not configured.");
  const provider = createEIP1193Provider({ apiKey, entitySecret, chain: ARC_CHAIN_ID, txPollingTimeout: 60_000 });
  const send = (to: Address, data: Hex) => provider.request({
    method: "eth_sendTransaction",
    params: [{ from: walletAddress, to, data }],
  });

  await send(ARC_USDC, encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [GATEWAY_WALLET, depositAmount],
  }));
  await send(GATEWAY_WALLET, encodeFunctionData({
    abi: gatewayWalletAbi,
    functionName: "deposit",
    args: [ARC_USDC, depositAmount],
  }));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const available = parseUnits(await getCircleGatewayBalance(walletAddress), 6);
    if (available >= minimumAtomic) return formatUnits(available, 6);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("Gateway deposit is still confirming. Retry the assessment in a few seconds.");
}

export async function getOrCreateAgentWallet(ownerAddress: string) {
  const owner = ownerAddress.toLowerCase();
  const client = getCircleClient();
  const walletSetId = getWalletSetId();
  const existing = await client.listWallets({
    walletSetId,
    blockchain: ARC_BLOCKCHAIN,
    refId: owner,
    pageSize: 10,
  });
  const wallet = existing.data?.wallets?.[0];
  if (wallet) return { wallet: await withBalance(client, wallet, owner), created: false };

  const created = await client.createWallets({
    blockchains: [ARC_BLOCKCHAIN],
    count: 1,
    walletSetId,
    accountType: "EOA",
    metadata: [{ name: `KNOT Agent ${owner.slice(0, 6)}...${owner.slice(-4)}`, refId: owner }],
    idempotencyKey: stableIdempotencyKey(owner),
  });
  const createdWallet = created.data?.wallets?.[0];
  if (!createdWallet) throw new Error("Circle did not return the new agent wallet.");
  return { wallet: await withBalance(client, createdWallet, owner), created: true };
}

export function createCircleAgentSigner(walletId: string, walletAddress: string) {
  const client = getCircleClient();
  return {
    address: walletAddress as Address,
    async signTypedData(params: {
      domain: { name: string; version: string; chainId: number; verifyingContract: Address };
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> {
      const domainTypes = Object.entries(params.domain).map(([name, value]) => ({
        name,
        type: typeof value === "number" ? "uint256" : name === "verifyingContract" ? "address" : "string",
      }));
      const response = await client.signTypedData({
        walletId,
        memo: "KNOT verified x402 settlement",
        data: JSON.stringify({
          domain: params.domain,
          types: { EIP712Domain: domainTypes, ...params.types },
          primaryType: params.primaryType,
          message: params.message,
        }, (_key, value) => typeof value === "bigint" ? value.toString() : value),
      });
      const signature = response.data?.signature;
      if (!signature?.startsWith("0x")) throw new Error("Circle did not return an x402 signature.");
      return signature as Hex;
    },
  };
}
