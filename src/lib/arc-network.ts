import { formatUnits, parseUnits, toHex } from "viem";

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

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
