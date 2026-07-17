import { NextResponse } from "next/server";

export function GET() {
  const x402BuyerReady = Boolean(process.env.X402_BUYER_PRIVATE_KEY);
  const x402SellerReady = Boolean(process.env.X402_SELLER_ADDRESS);
  const contractReady = Boolean(process.env.KNOT_HOOK_ADDRESS);

  return NextResponse.json({
    environment: "Arc Testnet",
    chainId: 5_042_002,
    mode: x402BuyerReady && x402SellerReady ? "live" : "local",
    services: {
      verificationEngine: "ready",
      x402Buyer: x402BuyerReady ? "ready" : "configuration-required",
      x402Seller: x402SellerReady ? "ready" : "configuration-required",
      settlementHook: contractReady ? "ready" : "not-deployed",
    },
  });
}
