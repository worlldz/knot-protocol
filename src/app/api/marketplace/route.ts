import { NextResponse } from "next/server";
import { createKnotMarketplace } from "../../../lib/knot/marketplace";

export function GET(request: Request) {
  return NextResponse.json(createKnotMarketplace({ baseUrl: new URL(request.url).origin }));
}
