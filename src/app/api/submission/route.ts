import { NextResponse } from "next/server";
import { createKnotSubmission } from "../../../lib/knot/submission";

export function GET(request: Request) {
  return NextResponse.json(createKnotSubmission({ baseUrl: new URL(request.url).origin }));
}
