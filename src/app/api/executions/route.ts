import { NextResponse } from "next/server";
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

  const execution = await executeJob(parsed.data, undefined, {
    origin: new URL(request.url).origin,
  });
  saveExecution(execution);

  return NextResponse.json(execution, { status: 201 });
}
