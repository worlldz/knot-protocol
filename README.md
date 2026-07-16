# KNOT

KNOT binds agent intent, service evidence, and USDC settlement on Arc.

The first prototype demonstrates the core clearing loop: an autonomous buyer evaluates a paid service delivery against deterministic conditions, rejects stale or malformed evidence, reroutes to a fallback provider, and authorizes settlement only after every check passes.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current milestone

- Product console
- Deterministic delivery verifier
- Autonomous fallback simulation
- Settlement authorization state
- Checkpoint 1 project description

## Next milestone

- Circle Agent Wallet on Arc Testnet
- Live x402 buyer and seller endpoints
- ERC-8004 agent identity
- ERC-8183 job settlement
- KNOT verification hook

See [Checkpoint 1](docs/checkpoint-1.md) for the hackathon submission draft.
