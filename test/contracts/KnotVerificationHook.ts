import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

describe("KnotVerificationHook", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [admin, verifier, stranger] = await viem.getWalletClients();
  let commerce: Awaited<ReturnType<typeof viem.deployContract>>;
  let hook: Awaited<ReturnType<typeof viem.deployContract>>;

  beforeEach(async function () {
    commerce = await viem.deployContract("MockAgenticCommerce");
    hook = await viem.deployContract("KnotVerificationHook", [
      commerce.address,
      admin.account.address,
      verifier.account.address,
    ]);
    await commerce.write.setHook([hook.address]);
  });

  async function futureTimestamp() {
    const block = await publicClient.getBlock();
    return Number(block.timestamp + 3_600n);
  }

  it("blocks completion when no evidence was attested", async function () {
    const evidence = keccak256(toBytes("job-1-evidence"));

    await viem.assertions.revertWithCustomError(
      commerce.write.complete([1n, evidence, "0x"]),
      hook,
      "EvidenceNotAttested",
    );
  });

  it("blocks evidence that the verifier rejected", async function () {
    const evidence = keccak256(toBytes("job-2-evidence"));
    await hook.write.attest([2n, evidence, false, await futureTimestamp()], {
      account: verifier.account,
    });

    await viem.assertions.revertWithCustomError(
      commerce.write.complete([2n, evidence, "0x"]),
      hook,
      "EvidenceRejected",
    );
  });

  it("binds an accepted evidence hash to completion and consumes it", async function () {
    const evidence = keccak256(toBytes("job-3-evidence"));
    await hook.write.attest([3n, evidence, true, await futureTimestamp()], {
      account: verifier.account,
    });

    await viem.assertions.emitWithArgs(
      commerce.write.complete([3n, evidence, "0x"]),
      hook,
      "EvidenceConsumed",
      [3n, evidence],
    );

    const attestation = await hook.read.attestations([3n]);
    assert.equal(attestation[3], true);
  });

  it("rejects a substituted evidence hash", async function () {
    const accepted = keccak256(toBytes("accepted"));
    const substituted = keccak256(toBytes("substituted"));
    await hook.write.attest([4n, accepted, true, await futureTimestamp()], {
      account: verifier.account,
    });

    await viem.assertions.revertWithCustomError(
      commerce.write.complete([4n, substituted, "0x"]),
      hook,
      "EvidenceHashMismatch",
    );
  });

  it("allows only verifier-role accounts to attest", async function () {
    const evidence = keccak256(toBytes("job-5-evidence"));

    await viem.assertions.revertWithCustomError(
      hook.write.attest([5n, evidence, true, await futureTimestamp()], {
        account: stranger.account,
      }),
      hook,
      "AccessControlUnauthorizedAccount",
    );
  });
});
