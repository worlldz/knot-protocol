import { NextResponse } from "next/server";
import { createKnotDiscovery } from "../../../lib/knot/discovery";

export function GET(request: Request) {
  return NextResponse.json(createKnotDiscovery({ baseUrl: new URL(request.url).origin }));
}
