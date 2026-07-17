import { describe, expect, it } from "vitest";
import { formatArcBalance, parseArcPaymentAmount, parseChainId, shortAddress } from "./arc-network";

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
});
