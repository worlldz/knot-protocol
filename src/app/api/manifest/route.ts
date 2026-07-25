import { NextResponse } from "next/server";
import { createKnotManifest } from "../../../lib/knot/manifest";

export function GET(request: Request) {
  return NextResponse.json(createKnotManifest({ baseUrl: new URL(request.url).origin }));
}
