import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { getOrCreateAgentWallet } from "@/lib/circle/wallets";
import { createAgentAuthorizationMessage, isAgentAuthorizationFresh } from "@/lib/knot/agent-auth";
import { executeJob } from "@/lib/knot/engine";
import { createExecutionSchema } from "@/lib/knot/schemas";
import { saveExecution } from "@/lib/knot/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = createExecutionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid obligation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    let agentWallet: { id: string; address: string } | undefined;
    const authorization = parsed.data.agentAuthorization;
    if (authorization) {
      if (!isAgentAuthorizationFresh(authorization.issuedAt)) {
        return NextResponse.json({ error: "Agent authorization expired. Sign a fresh request." }, { status: 401 });
      }

      const valid = await verifyMessage({
        address: authorization.owner as `0x${string}`,
        message: createAgentAuthorizationMessage(authorization.owner, authorization.issuedAt),
        signature: authorization.signature as `0x${string}`,
      });
      if (!valid) {
        return NextResponse.json({ error: "Agent authorization does not match the connected wallet." }, { status: 401 });
      }

      const prepared = await getOrCreateAgentWallet(authorization.owner);
      agentWallet = { id: prepared.wallet.id, address: prepared.wallet.address };
    }

    const execution = await executeJob(parsed.data, undefined, {
      origin: new URL(request.url).origin,
      agentWallet,
    });
    saveExecution(execution);

    return NextResponse.json(execution, { status: 201 });
  } catch (cause) {
    console.error("KNOT execution failed", cause);
    const message = cause instanceof Error && /limit|rate/i.test(cause.message)
      ? "Arc data providers are temporarily rate-limited. Retry in a few seconds."
      : "The agent could not complete this execution. Retry shortly.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
