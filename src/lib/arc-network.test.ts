import { describe, expect, it } from "vitest";
import { decodeFunctionData, getAddress } from "viem";
import {
  ARC_PAYMENT_ASSETS,
  createArcTokenTransfer,
  formatArcBalance,
  parseArcPaymentAmount,
  parseChainId,
  requestDifferentAccount,
  shortAddress,
  type Eip1193Provider,
} from "./arc-network";

const transferAbi = [{
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
}] as const;

describe("Arc wallet helpers", () => {
  it("parses Arc's hexadecimal chain id", () => {
    expect(parseChainId("0x4cef52")).toBe(5_042_002);
  });

  it("formats Arc native USDC from its 18-decimal balance representation", () => {
    expect(formatArcBalance("0x0de0b6b3a7640000")).toBe("1.00");
  });

  it("encodes a native USDC payment amount", () => {
    expect(parseArcPaymentAmount("1.5")).toBe("0x14d1120d7b160000");
  });

  it("defines Arc Testnet treasury assets with their native token precision", () => {
    expect(ARC_PAYMENT_ASSETS.USDC).toMatchObject({
      address: "0x3600000000000000000000000000000000000000",
      decimals: 6,
    });
    expect(ARC_PAYMENT_ASSETS.EURC).toMatchObject({
      address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
      decimals: 6,
    });
    expect(ARC_PAYMENT_ASSETS.cirBTC).toMatchObject({
      address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
      decimals: 8,
    });
  });

  it("encodes cirBTC transfers with eight-decimal precision", () => {
    const recipient = "0x1234567890abcdef1234567890abcdef12345678";
    const transfer = createArcTokenTransfer(ARC_PAYMENT_ASSETS.cirBTC, recipient, "0.00000001");
    const decoded = decodeFunctionData({ abi: transferAbi, data: transfer.data });

    expect(transfer.to).toBe(ARC_PAYMENT_ASSETS.cirBTC.address);
    expect(decoded.functionName).toBe("transfer");
    expect(decoded.args).toEqual([getAddress(recipient), 1n]);
  });

  it("shortens wallet addresses for the app shell", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678");
  });

  it("resets account permissions before reopening the wallet selector", async () => {
    const methods: string[] = [];
    const provider: Eip1193Provider = {
      request: async ({ method }) => {
        methods.push(method);
        if (method === "eth_requestAccounts") return ["0x1234567890abcdef1234567890abcdef12345678"];
        return null;
      },
    };

    await expect(requestDifferentAccount(provider)).resolves.toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(methods).toEqual(["wallet_revokePermissions", "eth_requestAccounts"]);
  });

  it("falls back when the wallet cannot revoke permissions", async () => {
    const methods: string[] = [];
    const provider: Eip1193Provider = {
      request: async ({ method }) => {
        methods.push(method);
        if (method === "wallet_revokePermissions") throw Object.assign(new Error("Unsupported"), { code: -32601 });
        if (method === "eth_requestAccounts") return ["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"];
        return null;
      },
    };

    await expect(requestDifferentAccount(provider)).resolves.toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(methods).toEqual(["wallet_revokePermissions", "wallet_requestPermissions", "eth_requestAccounts"]);
  });
});
