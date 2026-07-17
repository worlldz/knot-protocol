import "server-only";

import {
  BatchFacilitatorClient,
  GatewayEvmScheme,
} from "@circle-fin/x402-batching/server";
import {
  x402ResourceServer,
  type FacilitatorClient,
} from "@x402/core/server";
import type { SchemeNetworkServer } from "@x402/core/types";

export const ARC_TESTNET_CAIP = "eip155:5042002" as const;
export const CIRCLE_TESTNET_FACILITATOR =
  "https://gateway-api-testnet.circle.com";

export function createCircleResourceServer() {
  // Circle 3.2 ships a narrower local PaymentPayload type than x402 2.18.
  // The runtime interfaces match; normalize them at this package boundary.
  const facilitator = new BatchFacilitatorClient({
    url: CIRCLE_TESTNET_FACILITATOR,
  }) as unknown as FacilitatorClient;
  const scheme = new GatewayEvmScheme() as unknown as SchemeNetworkServer;

  return new x402ResourceServer(facilitator).register(
    ARC_TESTNET_CAIP,
    scheme,
  );
}
