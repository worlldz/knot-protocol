import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from "viem";

export const ARC_TESTNET = {
  id: 5_042_002,
  idHex: "0x4cef52",
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorerUrl: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
} as const;

export const ARC_PAYMENT_ASSETS = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    role: "Native gas and dollar settlement",
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    role: "Euro-denominated settlement",
  },
  cirBTC: {
    symbol: "cirBTC",
    name: "Circle Wrapped Bitcoin",
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    role: "Bitcoin-denominated testnet value",
  },
} as const satisfies Record<string, {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  role: string;
}>;

export type ArcPaymentAssetId = keyof typeof ARC_PAYMENT_ASSETS;
export type ArcPaymentAsset = (typeof ARC_PAYMENT_ASSETS)[ArcPaymentAssetId];

export function getArcRpcUrl(value = process.env.ARC_RPC_URL) {
  const normalized = value?.replace(/^\uFEFF/, "").trim();
  return normalized || ARC_TESTNET.rpcUrl;
}

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
};

export function getInjectedProvider() {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: Eip1193Provider }).ethereum;
}

export async function requestDifferentAccount(provider: Eip1193Provider) {
  let permissionRevoked = false;

  try {
    await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    permissionRevoked = true;
  } catch {
    // Some injected wallets do not expose permission revocation.
  }

  if (!permissionRevoked) {
    try {
      await provider.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
    } catch (cause) {
      const code = typeof cause === "object" && cause !== null && "code" in cause
        ? Number((cause as { code: unknown }).code)
        : null;
      if (code !== -32601) throw cause;
    }
  }

  const accountsValue = await provider.request({ method: "eth_requestAccounts" });
  const accounts = Array.isArray(accountsValue)
    ? accountsValue.filter((item): item is string => typeof item === "string")
    : [];

  return accounts[0] ?? null;
}

export function parseChainId(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatArcBalance(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("0x")) return "0.00";
  const formatted = Number(formatUnits(BigInt(value), ARC_TESTNET.nativeCurrency.decimals));
  return formatted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function parseArcPaymentAmount(value: string) {
  const normalized = value.trim();
  if (!normalized || Number(normalized) <= 0) throw new Error("Enter an amount greater than zero.");
  return toHex(parseUnits(normalized, ARC_TESTNET.nativeCurrency.decimals));
}

export function createArcTokenTransfer(asset: ArcPaymentAsset, recipient: string, value: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error("Enter a valid recipient wallet.");
  const normalized = value.trim();
  if (!normalized || Number(normalized) <= 0) throw new Error("Enter an amount greater than zero.");
  return {
    to: asset.address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient as Address, parseUnits(normalized, asset.decimals)],
    }),
  };
}

export async function readArcTokenBalance(
  provider: Eip1193Provider,
  account: string,
  asset: ArcPaymentAsset,
) {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account as Address],
  });
  const result = await provider.request({
    method: "eth_call",
    params: [{ to: asset.address, data }, "latest"],
  });
  if (typeof result !== "string" || !result.startsWith("0x")) {
    throw new Error(`${asset.symbol} balance could not be read.`);
  }
  const balance = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "balanceOf",
    data: result as Hex,
  });
  return {
    raw: balance,
    formatted: Number(formatUnits(balance, asset.decimals)).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: asset.symbol === "cirBTC" ? 8 : 4,
    }),
  };
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
