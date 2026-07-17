import crypto from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const ARC_BLOCKCHAIN = "ARC-TESTNET";

export type AgentWallet = {
  id: string;
  address: string;
  owner: string;
  accountType: string;
  blockchain: typeof ARC_BLOCKCHAIN;
  balanceUsdc: string;
};

function getCircleClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error("Circle developer wallet credentials are not configured.");
  }

  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}

function getWalletSetId() {
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
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

function toAgentWallet(wallet: { id?: string; address?: string; accountType?: string }, owner: string, balanceUsdc = "0"): AgentWallet {
  if (!wallet.id || !wallet.address) throw new Error("Circle returned an incomplete wallet record.");
  return {
    id: wallet.id,
    address: wallet.address,
    owner,
    accountType: wallet.accountType ?? "EOA",
    blockchain: ARC_BLOCKCHAIN,
    balanceUsdc,
  };
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
    return toAgentWallet(wallet, owner, usdc?.amount ?? "0");
  } catch {
    // Wallet access must remain available even if Circle's indexed balance is briefly delayed.
    return toAgentWallet(wallet, owner);
  }
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
