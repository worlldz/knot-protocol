import { NextResponse } from "next/server";
import { quoteJob } from "../../../lib/knot/quote";
import { createExecutionSchema } from "../../../lib/knot/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 32_768) {
    return NextResponse.json({ error: "Quote request is too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createExecutionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid obligation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json(quoteJob(parsed.data));
}
