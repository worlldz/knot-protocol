import { NextResponse } from "next/server";
import { getExecution } from "@/lib/knot/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const execution = getExecution(id);

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  return NextResponse.json(execution);
}
