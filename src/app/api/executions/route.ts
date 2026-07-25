import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { getOrCreateAgentWallet } from "@/lib/circle/wallets";
import { createAgentAuthorizationMessage, isAgentAuthorizationFresh } from "@/lib/knot/agent-auth";
import { executeJob } from "@/lib/knot/engine";
import { consumeRateLimit } from "@/lib/knot/rate-limit";
import { createExecutionSchema } from "@/lib/knot/schemas";
import { getExecution, saveExecution } from "@/lib/knot/store";

export const runtime = "nodejs";

function hasProtocolAccess(request: Request) {
  const expected = process.env.KNOT_EXECUTION_API_KEY;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function requestIdentity(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = url.searchParams.get("ids")?.split(",")
    .map((id) => id.trim())
    .filter((id) => /^run_[a-f0-9]{12}$/.test(id))
    .slice(0, 25);
  if (!ids?.length) {
    return NextResponse.json({ executions: [] });
  }
  const executions = (await Promise.all(ids.map((id) => getExecution(id))))
    .filter((item) => item !== null);
  return NextResponse.json({ executions });
}

export async function POST(request: Request) {
  const protocolAccess = hasProtocolAccess(request);
  const rate = consumeRateLimit(
    `${requestIdentity(request)}:${protocolAccess ? "protocol" : "public"}`,
    protocolAccess ? 30 : 10,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Execution rate limit reached. Retry after the current window." },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 32_768) {
    return NextResponse.json({ error: "Execution request is too large." }, { status: 413 });
  }

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
      if ((parsed.data.maxPriceUsdc ?? 0.03) > 0.05) {
        return NextResponse.json(
          { error: "Personal agent sessions are limited to 0.050 USDC per execution." },
          { status: 400 },
        );
      }
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
      owner: authorization?.owner,
      agentWallet,
      allowProtocolFunding: protocolAccess,
    });
    await saveExecution(execution);

    return NextResponse.json(execution, { status: 201 });
  } catch (cause) {
    console.error("KNOT execution failed", cause);
    const message = cause instanceof Error && /limit|rate/i.test(cause.message)
      ? "Arc data providers are temporarily rate-limited. Retry in a few seconds."
      : "The agent could not complete this execution. Retry shortly.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
