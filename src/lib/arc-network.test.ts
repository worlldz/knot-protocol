import { describe, expect, it } from "vitest";
import {
  formatArcBalance,
  parseArcPaymentAmount,
  parseChainId,
  requestDifferentAccount,
  shortAddress,
  type Eip1193Provider,
} from "./arc-network";

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
