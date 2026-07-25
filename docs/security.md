# Security Model

KNOT is designed around one protected property: a paid or completed agent job must be tied to accepted evidence, not just to a provider response.

## Protected properties

- A missing attestation cannot complete a commerce job.
- A rejected attestation cannot complete a commerce job.
- An expired attestation cannot complete a commerce job.
- A completion evidence hash cannot be substituted.
- An accepted attestation cannot be replayed after completion.
- Only accounts with `VERIFIER_ROLE` can create attestations.
- Only the configured commerce contract can call hook callbacks.
- Anonymous API calls cannot spend the protocol-funded buyer wallet.
- Public receipt reads require explicit receipt IDs.

These properties are covered by the unit and Hardhat contract suites.

## API controls

`POST /api/executions` validates request size and body shape before running the engine. It also applies rate limits and clamps spend ceilings. Protocol-funded execution is available only when the caller sends a bearer token matching `KNOT_EXECUTION_API_KEY`.

Without that token, the route can run preview decisions but cannot use the protocol buyer key. This keeps the demo useful while preventing an unauthenticated caller from draining configured funds.

## Key handling

- Buyer, deployer, verifier, Circle, and x402 keys are server-only variables.
- `.env*` files are ignored, while `.env.example` contains names only.
- `GET /api/system/status` reports readiness booleans and public addresses, never secrets.
- The browser bundle does not import the x402 buyer client.
- Circle wallet IDs are resolved server-side.

## Payment safety

Provider settlement is attempted only after evidence acceptance. A rejected provider can appear in a receipt, but KNOT does not authorize settlement for that attempt.

Circle Gateway transfer IDs are treated as x402 settlement records, not immediate onchain transaction hashes. The UI avoids claiming an onchain transfer unless a transaction hash exists.

## Onchain safety

`KnotVerificationHook` binds job completion to a verifier-created attestation. Completion succeeds only when:

- the attestation exists;
- the attestation is accepted;
- the attestation has not expired;
- the evidence hash equals the ERC-8183 completion reason;
- the attestation has not already been consumed.

`afterAction(...)` consumes the attestation after completion to prevent replay.

## Receipt integrity

Receipts are stored server-side in a durable JSON file by default. Writes use a temp file and rename so partial writes do not corrupt the store. Production deployments should move receipts to a database or append-only store with stronger tamper evidence.

## Known limitations

- The verifier role is trusted in this build. Production should use multisig governance, constrained signing policy, or verifiable execution.
- Provider signatures are still modeled inside deterministic provider simulations. A production provider network should recover and verify provider signatures cryptographically.
- File-backed receipts are durable enough for the hackathon build, but not the final production storage design.
- ERC-8183 and ERC-8004 are still evolving, so interface updates must be tracked before mainnet use.
- x402 exact payments are not inherently refundable. Conditional release and refund semantics belong in the commerce contract path.
