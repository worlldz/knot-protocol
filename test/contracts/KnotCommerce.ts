import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseUnits, toBytes, zeroAddress } from "viem";

describe("KnotCommerce", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner, client, provider, evaluator, verifier, stranger] =
    await viem.getWalletClients();
  let token: Awaited<ReturnType<typeof viem.deployContract>>;
  let commerce: Awaited<ReturnType<typeof viem.deployContract>>;
  let hook: Awaited<ReturnType<typeof viem.deployContract>>;

  beforeEach(async function () {
    token = await viem.deployContract("MockUsdc");
    commerce = await viem.deployContract("KnotCommerce", [
      token.address,
      owner.account.address,
    ]);
    hook = await viem.deployContract("KnotVerificationHook", [
      commerce.address,
      owner.account.address,
      verifier.account.address,
    ]);
    await commerce.write.setHookAllowed([hook.address, true], {
      account: owner.account,
    });
    await token.write.mint([client.account.address, parseUnits("100", 6)]);
  });

  async function futureTimestamp(offset = 3_600n) {
    const block = await publicClient.getBlock();
    return block.timestamp + offset;
  }

  async function createJob(withHook = true) {
    await commerce.write.createJob([
      provider.account.address,
      evaluator.account.address,
      await futureTimestamp(),
      "Verify live API evidence before settlement.",
      withHook ? hook.address : zeroAddress,
    ], { account: client.account });
    return commerce.read.jobCounter();
  }

  async function fundAndSubmit(jobId: bigint, evidence: `0x${string}`) {
    const budget = parseUnits("4.25", 6);
    await commerce.write.setBudget([jobId, budget, "0x"], {
      account: provider.account,
    });
    await token.write.approve([commerce.address, budget], {
      account: client.account,
    });
    await commerce.write.fund([jobId, "0x"], { account: client.account });
    await commerce.write.submit([jobId, evidence, "0x"], {
      account: provider.account,
    });
    return budget;
  }

  it("completes escrow only after KNOT consumes matching evidence", async function () {
    const evidence = keccak256(toBytes("verified-delivery"));
    const jobId = await createJob();
    const budget = await fundAndSubmit(jobId, evidence);
    const providerBefore = await token.read.balanceOf([provider.account.address]);

    await hook.write.attest([
      jobId,
      evidence,
      true,
      await futureTimestamp(),
    ], { account: verifier.account });
    await commerce.write.complete([jobId, evidence, "0x"], {
      account: evaluator.account,
    });

    const job = await commerce.read.getJob([jobId]);
    const providerAfter = await token.read.balanceOf([provider.account.address]);
    const attestation = await hook.read.attestations([jobId]);
    assert.equal(job.status, 3);
    assert.equal(providerAfter - providerBefore, budget);
    assert.equal(attestation[3], true);
  });

  it("keeps submitted escrow locked when evidence was not attested", async function () {
    const evidence = keccak256(toBytes("unattested-delivery"));
    const jobId = await createJob();
    await fundAndSubmit(jobId, evidence);

    await viem.assertions.revertWithCustomError(
      commerce.write.complete([jobId, evidence, "0x"], {
        account: evaluator.account,
      }),
      hook,
      "EvidenceNotAttested",
    );

    const job = await commerce.read.getJob([jobId]);
    assert.equal(job.status, 2);
  });

  it("refunds the client when the evaluator rejects funded work", async function () {
    const jobId = await createJob(false);
    const budget = parseUnits("2", 6);
    const balanceBefore = await token.read.balanceOf([client.account.address]);
    await commerce.write.setBudget([jobId, budget, "0x"], {
      account: provider.account,
    });
    await token.write.approve([commerce.address, budget], {
      account: client.account,
    });
    await commerce.write.fund([jobId, "0x"], { account: client.account });
    await commerce.write.reject([
      jobId,
      keccak256(toBytes("policy-rejected")),
      "0x",
    ], { account: evaluator.account });

    const balanceAfter = await token.read.balanceOf([client.account.address]);
    const job = await commerce.read.getJob([jobId]);
    assert.equal(balanceAfter, balanceBefore);
    assert.equal(job.status, 4);
  });

  it("enforces client, provider, and evaluator roles", async function () {
    const jobId = await createJob(false);
    const evidence = keccak256(toBytes("role-test"));

    await viem.assertions.revertWithCustomError(
      commerce.write.setBudget([jobId, 1n, "0x"], {
        account: stranger.account,
      }),
      commerce,
      "InvalidRole",
    );
    await viem.assertions.revertWithCustomError(
      commerce.write.submit([jobId, evidence, "0x"], {
        account: stranger.account,
      }),
      commerce,
      "InvalidRole",
    );
  });

  it("requires the owner to approve compatible hooks", async function () {
    await viem.assertions.revertWithCustomError(
      commerce.write.setHookAllowed([stranger.account.address, true], {
        account: owner.account,
      }),
      commerce,
      "InvalidJob",
    );
  });
});
