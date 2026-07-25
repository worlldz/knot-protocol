import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const hookAbi = [
  {
    type: "function",
    name: "attest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "accepted", type: "bool" },
      { name: "validUntil", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "attestations",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "evidenceHash", type: "bytes32" },
      { name: "validUntil", type: "uint64" },
      { name: "accepted", type: "bool" },
      { name: "consumed", type: "bool" },
    ],
  },
] as const;

export type EvidenceAttestation = {
  status: "not-requested" | "confirmed" | "failed";
  jobId: string | null;
  hookAddress: string | null;
  transactionHash: string | null;
  validUntil: string | null;
  error: string | null;
};

export function isAttestationConfigured() {
  const hook = process.env.KNOT_HOOK_ADDRESS;
  const key = process.env.KNOT_ATTESTER_PRIVATE_KEY
    ?? process.env.ARC_DEPLOYER_PRIVATE_KEY;
  return Boolean(hook && isAddress(hook) && key?.startsWith("0x"));
}

export async function attestEvidence(
  executionId: string,
  evidenceHash: string,
): Promise<EvidenceAttestation> {
  return attestJobEvidence(
    BigInt(keccak256(toHex(executionId))),
    evidenceHash,
  );
}

export async function attestJobEvidence(
  jobId: bigint,
  evidenceHash: string,
): Promise<EvidenceAttestation> {
  const hookAddress = process.env.KNOT_HOOK_ADDRESS;
  const privateKey = process.env.KNOT_ATTESTER_PRIVATE_KEY
    ?? process.env.ARC_DEPLOYER_PRIVATE_KEY;

  if (!hookAddress || !isAddress(hookAddress) || !privateKey?.startsWith("0x")) {
    return {
      status: "not-requested",
      jobId: null,
      hookAddress: hookAddress ?? null,
      transactionHash: null,
      validUntil: null,
      error: null,
    };
  }

  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 86_400);
  const account = privateKeyToAccount(privateKey as Hex);
  const transport = http(process.env.ARC_RPC_URL);
  const publicClient = createPublicClient({ chain: arcTestnet, transport });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport });

  async function retryRateLimit<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await operation();
      } catch (cause) {
        lastError = cause;
        if (!/limit|rate/i.test(cause instanceof Error ? cause.message : "")) throw cause;
        await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  async function readAttestation() {
    return retryRateLimit(() =>
      publicClient.readContract({
          address: hookAddress as Address,
          abi: hookAbi,
          functionName: "attestations",
          args: [jobId],
        }),
    );
  }

  try {
    const existing = await readAttestation();
    if (existing[0].toLowerCase() === evidenceHash.toLowerCase() && existing[2]) {
      return {
        status: "confirmed",
        jobId: jobId.toString(),
        hookAddress,
        transactionHash: null,
        validUntil: new Date(Number(existing[1]) * 1000).toISOString(),
        error: null,
      };
    }

    const simulation = await retryRateLimit(() =>
      publicClient.simulateContract({
        account,
        address: hookAddress as Address,
        abi: hookAbi,
        functionName: "attest",
        args: [jobId, evidenceHash as Hex, true, validUntil],
      }),
    );
    const transactionHash = await walletClient.writeContract(simulation.request);
    try {
      await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    } catch (cause) {
      if (!/limit|rate/i.test(cause instanceof Error ? cause.message : "")) throw cause;
    }

    const confirmed = await readAttestation();
    if (confirmed[0].toLowerCase() !== evidenceHash.toLowerCase() || !confirmed[2]) {
      throw new Error("The hook did not retain the accepted evidence commitment.");
    }

    return {
      status: "confirmed",
      jobId: jobId.toString(),
      hookAddress,
      transactionHash,
      validUntil: new Date(Number(confirmed[1]) * 1000).toISOString(),
      error: null,
    };
  } catch (cause) {
    return {
      status: "failed",
      jobId: jobId.toString(),
      hookAddress,
      transactionHash: null,
      validUntil: new Date(Number(validUntil) * 1000).toISOString(),
      error: cause instanceof Error ? cause.message : "Evidence attestation failed.",
    };
  }
}
