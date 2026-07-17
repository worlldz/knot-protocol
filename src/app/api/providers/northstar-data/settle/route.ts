import { withX402 } from "@x402/next";
import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { ARC_TESTNET_CAIP, createCircleResourceServer } from "@/lib/x402/server";

export const runtime = "nodejs";

const settlementRequestSchema = z.object({
  executionId: z.string().min(1),
  evidenceHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

async function settleHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  const parsed = settlementRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settlement request" }, { status: 400 });
  }

  return NextResponse.json({
    provider: "Northstar Data",
    service: "Signed wallet risk assessment",
    executionId: parsed.data.executionId,
    evidenceHash: parsed.data.evidenceHash,
    deliveredAt: new Date().toISOString(),
  });
}

const sellerAddress = process.env.X402_SELLER_ADDRESS;

export const POST = sellerAddress && isAddress(sellerAddress)
  ? withX402(
      settleHandler,
      {
        accepts: {
          scheme: "exact",
          payTo: sellerAddress,
          price: "$0.024",
          network: ARC_TESTNET_CAIP,
        },
        description: "Settle an accepted Northstar Data delivery",
        mimeType: "application/json",
        serviceName: "Northstar Data via KNOT",
        tags: ["risk-data", "agents", "Arc", "USDC"],
      },
      createCircleResourceServer(),
    )
  : settleHandler;
