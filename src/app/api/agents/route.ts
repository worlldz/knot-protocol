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

function safeProvisioningError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const status = typeof cause === "object" && cause !== null && "status" in cause
    ? Number((cause as { status?: unknown }).status)
    : null;

  if (/parameter invalid|malformed api key|wallet set|not configured/i.test(message)) {
    return {
      status: 503,
      code: "AGENT_CONFIGURATION",
      error: "Agent wallet configuration needs attention. Proof preview remains available.",
      retryable: false,
    };
  }
  if (status === 429 || /rate|limit|too many/i.test(message)) {
    return {
      status: 429,
      code: "AGENT_RATE_LIMITED",
      error: "Circle is rate-limiting wallet preparation. Retry in a few seconds.",
      retryable: true,
    };
  }
  return {
    status: 502,
    code: "AGENT_TEMPORARILY_UNAVAILABLE",
    error: "The personal agent service is temporarily unavailable. Proof preview remains available.",
    retryable: true,
  };
}

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
    const failure = safeProvisioningError(cause);
    return NextResponse.json(
      { error: failure.error, code: failure.code, retryable: failure.retryable },
      { status: failure.status },
    );
  }
}
