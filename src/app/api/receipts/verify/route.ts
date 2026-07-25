import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyReceipt } from "../../../../lib/knot/receipt-verifier";

const verifyReceiptSchema = z.object({
  id: z.string().regex(/^run_[a-f0-9]{12}$/),
  evidenceHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = verifyReceiptSchema.safeParse({
    id: url.searchParams.get("id"),
    evidenceHash: url.searchParams.get("evidenceHash") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid receipt verification request." }, { status: 400 });
  }

  const result = await verifyReceipt(parsed.data);
  return NextResponse.json(result, { status: result.status === "missing" ? 404 : 200 });
}

export async function POST(request: Request) {
  const parsed = verifyReceiptSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid receipt verification request." }, { status: 400 });
  }

  const result = await verifyReceipt(parsed.data);
  return NextResponse.json(result, { status: result.status === "missing" ? 404 : 200 });
}
