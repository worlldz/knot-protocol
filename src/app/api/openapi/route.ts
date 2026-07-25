import { NextResponse } from "next/server";
import { createKnotOpenApi } from "../../../lib/knot/discovery";

export function GET(request: Request) {
  return NextResponse.json(createKnotOpenApi({ baseUrl: new URL(request.url).origin }));
}
