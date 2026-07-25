import { NextResponse } from "next/server";
import { isAddress } from "viem";
import arcDeployment from "../../../../../deployments/arc-testnet.json";
import erc8183Run from "../../../../../deployments/erc8183-testnet.json";
import { isAttestationConfigured } from "../../../../lib/knot/attestation";
import { getEnvValue, getFirstHexEnv } from "../../../../lib/server-env";

export function GET() {
  const x402SellerAddress = getEnvValue("X402_SELLER_ADDRESS");
  const x402BuyerReady = Boolean(getFirstHexEnv("X402_BUYER_PRIVATE_KEY"));
  const x402SellerReady = Boolean(x402SellerAddress && isAddress(x402SellerAddress));
  const circleAgentReady = Boolean(
    getEnvValue("CIRCLE_API_KEY")
    && getEnvValue("CIRCLE_ENTITY_SECRET")
    && getEnvValue("CIRCLE_WALLET_SET_ID"),
  );
  const hookAddress = getEnvValue("KNOT_HOOK_ADDRESS");
  const contractReady = Boolean(hookAddress && isAddress(hookAddress));
  const protocolApiReady = Boolean(getEnvValue("KNOT_EXECUTION_API_KEY"));

  return NextResponse.json({
    environment: "Arc Testnet",
    chainId: 5_042_002,
    mode: x402SellerReady && (x402BuyerReady || circleAgentReady) ? "live" : "local",
    deployment: {
      commerce: arcDeployment.commerce.address,
      hook: arcDeployment.hook.address,
      explorerUrl: arcDeployment.commerce.explorerUrl,
      verified: arcDeployment.commerce.verified && arcDeployment.hook.verified,
    },
    latestProof: {
      status: erc8183Run.status,
      jobId: erc8183Run.jobId,
      executionId: erc8183Run.executionId,
      evidenceHash: erc8183Run.evidenceHash,
      attestationExplorerUrl: erc8183Run.attestationExplorerUrl,
      completionExplorerUrl: erc8183Run.completionExplorerUrl,
    },
    services: {
      verificationEngine: "ready",
      x402Buyer: x402BuyerReady ? "ready" : "configuration-required",
      x402Seller: x402SellerReady ? "ready" : "configuration-required",
      circleAgent: circleAgentReady ? "ready" : "configuration-required",
      settlementHook: contractReady ? "ready" : "not-deployed",
      evidenceAttester: isAttestationConfigured() ? "ready" : "configuration-required",
      durableReceipts: "ready",
      protocolApi: protocolApiReady ? "protected" : "disabled",
    },
  });
}
