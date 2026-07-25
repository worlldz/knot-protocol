import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import livePayment from "../deployments/x402-testnet.json";
import { attestJobEvidence } from "../src/lib/knot/attestation";

const commerceAbi = [
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setBudget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "complete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "id", type: "uint256" },
        { name: "client", type: "address" },
        { name: "provider", type: "address" },
        { name: "evaluator", type: "address" },
        { name: "description", type: "string" },
        { name: "budget", type: "uint256" },
        { name: "expiredAt", type: "uint256" },
        { name: "status", type: "uint8" },
        { name: "hook", type: "address" },
      ],
    }],
  },
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "evaluator", type: "address" },
      { indexed: false, name: "expiredAt", type: "uint256" },
      { indexed: false, name: "hook", type: "address" },
    ],
    anonymous: false,
  },
] as const;

const erc20Abi = [{
  type: "function",
  name: "approve",
  stateMutability: "nonpayable",
  inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
}] as const;

async function main() {
  const privateKey = process.env.ARC_DEPLOYER_PRIVATE_KEY;
  const commerce = process.env.KNOT_ACP_ADDRESS as Address | undefined;
  const hook = process.env.KNOT_HOOK_ADDRESS as Address | undefined;
  if (!privateKey?.startsWith("0x") || !commerce || !hook) {
    throw new Error("ARC_DEPLOYER_PRIVATE_KEY, KNOT_ACP_ADDRESS, and KNOT_HOOK_ADDRESS are required.");
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const transport = http(process.env.ARC_RPC_URL);
  const publicClient = createPublicClient({ chain: arcTestnet, transport });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport });
  const transactionHashes: Record<string, Hex> = {};

  async function retryRpc<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await operation();
      } catch (cause) {
        lastError = cause;
        if (!/limit|rate/i.test(cause instanceof Error ? cause.message : "")) throw cause;
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  async function send(label: string, request: Parameters<typeof walletClient.writeContract>[0]) {
    const hash = await walletClient.writeContract(request);
    transactionHashes[label] = hash;
    await retryRpc(() => publicClient.waitForTransactionReceipt({
      hash,
      retryCount: 10,
      pollingInterval: 1_000,
    }));
    return hash;
  }

  const description = `KNOT verified x402 execution ${livePayment.executionId}`;
  const latestJobId = await retryRpc(() => publicClient.readContract({
    address: commerce,
    abi: commerceAbi,
    functionName: "jobCounter",
  }));
  let jobId: bigint | null = null;
  if (latestJobId > 0n) {
    const latest = await retryRpc(() => publicClient.readContract({
      address: commerce,
      abi: commerceAbi,
      functionName: "getJob",
      args: [latestJobId],
    }));
    if (
      latest.description === description
      && latest.client.toLowerCase() === account.address.toLowerCase()
      && latest.hook.toLowerCase() === hook.toLowerCase()
      && Number(latest.status) <= 3
    ) {
      jobId = latestJobId;
    }
  }

  if (jobId === null) {
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3_600);
    const create = await retryRpc(() => publicClient.simulateContract({
      account,
      address: commerce,
      abi: commerceAbi,
      functionName: "createJob",
      args: [
        account.address,
        account.address,
        expiredAt,
        description,
        hook,
      ],
    }));
    const createHash = await send("createJob", create.request);
    const createReceipt = await retryRpc(() => publicClient.getTransactionReceipt({ hash: createHash }));
    for (const log of createReceipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: commerceAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "JobCreated") jobId = decoded.args.jobId;
      } catch {
        continue;
      }
    }
  }
  if (jobId === null) throw new Error("JobCreated event was not found.");

  const budget = parseUnits(livePayment.amountUsdc, 6);
  let job = await retryRpc(() => publicClient.readContract({
    address: commerce,
    abi: commerceAbi,
    functionName: "getJob",
    args: [jobId],
  }));

  if (Number(job.status) === 0) {
    if (job.budget !== budget) {
      const setBudget = await retryRpc(() => publicClient.simulateContract({
        account,
        address: commerce,
        abi: commerceAbi,
        functionName: "setBudget",
        args: [jobId, budget, "0x"],
      }));
      await send("setBudget", setBudget.request);
    }

    const approve = await retryRpc(() => publicClient.simulateContract({
      account,
      address: "0x3600000000000000000000000000000000000000",
      abi: erc20Abi,
      functionName: "approve",
      args: [commerce, budget],
    }));
    await send("approve", approve.request);

    const fund = await retryRpc(() => publicClient.simulateContract({
      account,
      address: commerce,
      abi: commerceAbi,
      functionName: "fund",
      args: [jobId, "0x"],
    }));
    await send("fund", fund.request);
    job = await retryRpc(() => publicClient.readContract({
      address: commerce,
      abi: commerceAbi,
      functionName: "getJob",
      args: [jobId],
    }));
  }

  if (Number(job.status) === 1) {
    const submit = await retryRpc(() => publicClient.simulateContract({
      account,
      address: commerce,
      abi: commerceAbi,
      functionName: "submit",
      args: [jobId, livePayment.evidenceHash as Hex, "0x"],
    }));
    await send("submit", submit.request);
    job = await retryRpc(() => publicClient.readContract({
      address: commerce,
      abi: commerceAbi,
      functionName: "getJob",
      args: [jobId],
    }));
  }

  if (Number(job.status) === 2) {
    const attestation = await attestJobEvidence(jobId, livePayment.evidenceHash);
    if (attestation.status !== "confirmed") {
      throw new Error(attestation.error ?? "KNOT hook attestation failed.");
    }
    if (attestation.transactionHash) {
      transactionHashes.attest = attestation.transactionHash as Hex;
    }

    const complete = await retryRpc(() => publicClient.simulateContract({
      account,
      address: commerce,
      abi: commerceAbi,
      functionName: "complete",
      args: [jobId, livePayment.evidenceHash as Hex, "0x"],
    }));
    await send("complete", complete.request);
  }

  job = await retryRpc(() => publicClient.readContract({
    address: commerce,
    abi: commerceAbi,
    functionName: "getJob",
    args: [jobId],
  }));

  console.log(JSON.stringify({
    network: "Arc Testnet",
    executionId: livePayment.executionId,
    evidenceHash: livePayment.evidenceHash,
    jobId: jobId.toString(),
    status: Number(job.status),
    statusLabel: Number(job.status) === 3 ? "Completed" : `Unexpected (${job.status})`,
    budgetUsdc: livePayment.amountUsdc,
    hook,
    commerce,
    transactions: transactionHashes,
  }, null, 2));

  if (Number(job.status) !== 3) process.exitCode = 1;
}

main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
