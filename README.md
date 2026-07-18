# KNOT

**Pay for verified outcomes, not unproven responses.**

KNOT is a verification-native settlement layer for autonomous commerce on Arc. A buyer agent describes measurable delivery conditions, evaluates paid service responses, rejects invalid evidence, and authorizes USDC settlement only after every condition passes.

The product runs the complete decision loop through a server-side execution API. Each connected user can authorize a personal Circle MPC agent wallet. That agent compares live Arc providers, rejects incomplete evidence, and signs a real `0.024 USDC` x402 authorization only for the accepted delivery. The verification hook is deployed and source-verified on Arc Testnet.

## Why KNOT

x402 makes machine payments easy, but payment success does not prove service quality. An agent can pay for stale data, a malformed payload, a late response, or an unsigned result. KNOT adds the missing boundary between delivery and settlement:

1. Express the job as an obligation.
2. Discover eligible paid providers.
3. Inspect a deterministic evidence envelope.
4. Reject and reroute without human intervention.
5. Bind accepted evidence to settlement authorization.

## What works now

- Professional responsive product console
- Persistent dark/light product themes and deep-linked app views
- Injected wallet connection with live Arc Testnet network and native USDC balance state
- Personal Circle developer-controlled agent wallet provisioned per connected owner
- Five-minute wallet-signed authorization window; Circle wallet IDs are resolved server-side
- Agent funding from the connected Arc wallet with no private key exposed to the browser
- One-click Arc Testnet add/switch flow using the official network configuration
- Direct native USDC payment surface with Arcscan transaction links
- Curated Arc and Circle resource guide using the official Arc brand mark
- Server-side execution engine and execution records
- Deterministic price, latency, freshness, schema, and signature checks
- Live Arc Baseline and signed Arc Sentinel providers competing inside a fixed USDC budget
- Autonomous rejection and fallback over the same cached Arc RPC snapshot
- Circle MPC EIP-712 signing and Circle Gateway x402 settlement from the user-owned agent
- Protocol-funded buyer fallback for direct API and CI smoke tests
- Deployed and source-verified ERC-8183-compatible `KnotVerificationHook`
- Replay protection, verifier roles, validity windows, and evidence-hash binding
- Unit, contract, API, mobile, lint, and production-build verification

## Stack

- Next.js 16, React 19, TypeScript, Zod
- Arc Testnet, chain ID `5042002`
- USDC, Circle Developer-Controlled Wallets, and Circle Gateway x402 Nanopayments
- ERC-8183 Agentic Commerce hooks
- ERC-8004-compatible identity and reputation surface (planned milestone)
- Solidity 0.8.28, Hardhat 3, viem

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Product views can also be opened directly:

- `http://localhost:3000/#console`
- `http://localhost:3000/#payment`
- `http://localhost:3000/#explore`

## Quality commands

```bash
npm run lint
npm run test:unit
npm run test:contracts
npm run build
```

## API

| Route | Purpose |
| --- | --- |
| `POST /api/agents` | Verify the connected owner and provision/read their Circle MPC agent |
| `POST /api/executions` | Run an obligation through discovery, verification, fallback, and authorization |
| `GET /api/executions/:id` | Read a stored execution trace |
| `GET /api/system/status` | Report integration readiness without exposing secrets |
| `POST /api/x402/verify` | Verify an evidence envelope; protected by Circle Gateway when seller mode is configured |

Example:

```bash
curl -X POST http://localhost:3000/api/executions \
  -H "content-type: application/json" \
  -d '{"maxPriceUsdc":0.03}'
```

## Live integration

Copy the variable names from `.env.example` into `.env.local`. Never commit private keys or Circle credentials.

The Arc Sentinel settlement endpoint becomes payment-protected when `X402_SELLER_ADDRESS` is set. Interactive runs use a funded personal Circle agent configured by `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, and `CIRCLE_WALLET_SET_ID`. `X402_BUYER_PRIVATE_KEY` is an optional protocol-funded fallback for direct API calls and CI. Contract deployment requires an Arc Testnet deployer and the target ERC-8183 commerce protocol address.

```bash
npm run deploy:arc
```

## Contracts

`KnotVerificationHook` implements the ERC-8183 `IACPHook` callbacks. Before `complete(...)`, it requires:

- an attestation from a `VERIFIER_ROLE` account;
- an accepted result that has not expired;
- an evidence hash equal to the ERC-8183 completion reason;
- an attestation that has not already been consumed.

`afterAction(...)` consumes the attestation atomically, preventing replay.

See [architecture](docs/architecture.md), [security model](docs/security.md), and the [Checkpoint 1 draft](docs/checkpoint-1.md).

### Arc Testnet deployment

`KnotVerificationHook` is deployed and source-verified on Arc Testnet at [`0x8ce32a5fedd6e1284eb75ee4bb37dd8d8aa93004`](https://testnet.arcscan.app/address/0x8ce32a5fedd6e1284eb75ee4bb37dd8d8aa93004). Machine-readable deployment metadata lives in [`deployments/arc-testnet.json`](deployments/arc-testnet.json).

The first live Circle Gateway payment moved `0.024 USDC` from the KNOT buyer balance to a separate provider through x402. Its public, non-secret execution metadata is recorded in [`deployments/x402-testnet.json`](deployments/x402-testnet.json).

## Honest limitations

- Execution records use in-memory demo storage and should move to a durable database before production.
- Risk scoring is a transparent heuristic over current Arc balance, nonce, bytecode, and block data; it is not financial advice.
- Arc Baseline is intentionally unsigned and lower-cost. Arc Sentinel adds the required schema and cryptographic signature, allowing the policy engine to demonstrate a genuine quality-based fallback.
- The public Arc RPC can rate-limit bursts. KNOT batches reads, shares an in-flight snapshot between providers, retries bounded failures, and surfaces a recoverable error if the RPC remains unavailable.
- The UI does not claim an onchain transaction unless a transaction hash exists.
- Circle Gateway transfer IDs represent accepted x402 transfers; batched onchain settlement can occur later and is not presented as an immediate transaction hash.
- A browser wallet is required to exercise the network-add and direct USDC payment surfaces.

The Arc wordmark used by the interface is sourced from the official [Arc Brand Guidelines and Partner Toolkit](https://www.arc.io/brand-guidelines-and-partner-toolkit).

## License

MIT
