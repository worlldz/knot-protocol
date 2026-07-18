import { NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { z } from "zod";
import { getOrCreateAgentWallet } from "@/lib/circle/wallets";
import { createAgentAuthorizationMessage, isAgentAuthorizationFresh } from "@/lib/knot/agent-auth";

export const runtime = "nodejs";

const requestSchema = z.object({
  owner: z.string().refine(isAddress, "Invalid owner address"),
  issuedAt: z.string().datetime(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid agent authorization." }, { status: 400 });

  const { owner, issuedAt, signature } = parsed.data;
  if (!isAgentAuthorizationFresh(issuedAt)) {
    return NextResponse.json({ error: "Authorization expired. Sign a fresh request." }, { status: 401 });
  }

  const valid = await verifyMessage({
    address: owner as `0x${string}`,
    message: createAgentAuthorizationMessage(owner, issuedAt),
    signature: signature as `0x${string}`,
  });
  if (!valid) return NextResponse.json({ error: "Wallet signature does not match the connected account." }, { status: 401 });

  try {
    const result = await getOrCreateAgentWallet(owner);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (cause) {
    console.error("Circle agent wallet provisioning failed", cause);
    return NextResponse.json({ error: "Agent wallet could not be prepared. Try again shortly." }, { status: 502 });
  }
}
