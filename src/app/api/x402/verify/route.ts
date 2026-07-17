import { withX402 } from "@x402/next";
import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { deliverySchema, obligationSchema } from "@/lib/knot/schemas";
import { verifyDelivery } from "@/lib/knot/verification";
import {
  ARC_TESTNET_CAIP,
  createCircleResourceServer,
} from "@/lib/x402/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  obligation: obligationSchema,
  delivery: deliverySchema,
});

async function verifyHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid evidence envelope", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({
    verifier: "KNOT deterministic verifier v0.2",
    result: verifyDelivery(parsed.data.obligation, parsed.data.delivery),
  });
}

const sellerAddress = process.env.X402_SELLER_ADDRESS;

export const POST =
  sellerAddress && isAddress(sellerAddress)
    ? withX402(
        verifyHandler,
        {
          accepts: {
            scheme: "exact",
            payTo: sellerAddress,
            price: "$0.001",
            network: ARC_TESTNET_CAIP,
          },
          description: "Deterministic delivery verification by KNOT",
          mimeType: "application/json",
          serviceName: "KNOT Verifier",
          tags: ["verification", "agents", "Arc", "USDC"],
        },
        createCircleResourceServer(),
      )
    : verifyHandler;
