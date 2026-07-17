# Security model

## Protected properties

- A missing attestation cannot complete a job.
- A rejected or expired attestation cannot complete a job.
- The completion evidence hash cannot be substituted.
- An accepted attestation cannot be replayed after completion.
- Only accounts with `VERIFIER_ROLE` can create attestations.
- Only the configured ERC-8183 commerce protocol can call hook callbacks.

These properties are covered by the Hardhat contract test suite.

## Key handling

- Buyer, deployer, and Circle credentials are server-only variables.
- `.env*` is ignored while `.env.example` contains names only.
- The system-status endpoint returns readiness states, never key material.
- No browser bundle imports the x402 buyer client.

## Known limitations

- The verifier role is trusted. Production should use multisig governance, constrained signing policy, or a verifiable execution environment.
- Local provider signatures are modeled as booleans; cryptographic signature recovery is not implemented yet.
- In-memory execution records are not durable or tamper-evident.
- ERC-8183 remains a draft standard, so interface changes must be tracked before mainnet use.
- x402 exact payments are not inherently refundable. KNOT's settlement hook is the intended path for jobs that require conditional release or refund semantics.
