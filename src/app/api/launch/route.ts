import { NextResponse } from "next/server";
import { createKnotLaunchKit } from "../../../lib/knot/launch";

export function GET(request: Request) {
  return NextResponse.json(createKnotLaunchKit({ baseUrl: new URL(request.url).origin }));
}
