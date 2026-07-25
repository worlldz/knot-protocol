import livePayment from "../deployments/x402-testnet.json";
import { attestEvidence } from "../src/lib/knot/attestation";

async function main() {
  const result = await attestEvidence(
    livePayment.executionId,
    livePayment.evidenceHash,
  );
  console.log(JSON.stringify({
    network: livePayment.network,
    executionId: livePayment.executionId,
    evidenceHash: livePayment.evidenceHash,
    ...result,
  }, null, 2));

  if (result.status !== "confirmed") {
    process.exitCode = 1;
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
