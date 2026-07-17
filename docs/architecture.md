# Architecture

KNOT separates agent reasoning, deterministic verification, and value movement so that an LLM decision alone cannot release funds.

```text
Buyer intent
    |
    v
Obligation compiler -----> provider discovery and quotes
    |                               |
    |                               v
    |                      evidence preview
    |                               |
    v                               v
Deterministic verifier <---- evidence envelope
    |
    +---- reject ----> fallback policy ----> next provider
    |
    +---- accept ----> x402 paid final delivery
                              |
                              +----> Circle Gateway transfer
                              |
                              v
                   evidence commitment
                              |
                              v
                   ERC-8183 completion hook
```

## Trust boundaries

### Agent policy

The agent can choose a provider only inside the declared price ceiling. It cannot change verification requirements during an execution.

### Evidence verification

The verifier checks measurable properties and returns every failed condition. It does not rely on an LLM to decide pass or fail.

### x402 boundary

`POST /api/providers/northstar-data/settle` uses Circle Gateway's testnet facilitator and charges `0.024 USDC` only after KNOT accepts the provider evidence. `POST /api/x402/verify` exposes the same payment rail for verifier-as-a-service experiments. Both routes remain open in local mode when no seller address is configured.

### Settlement boundary

The onchain hook accepts a completion only when the ERC-8183 `reason` equals a live, accepted attestation hash. The attestation is consumed after completion.

## Data model

An execution contains:

- the immutable obligation;
- ordered decision events;
- every provider attempt and verification result;
- the accepted evidence commitment;
- settlement status, rail, recipient, amount, and optional transaction hash.

The UI renders this record rather than recreating decision logic in the browser.

## Production path

1. Replace in-memory execution storage with Postgres or an append-only event store.
2. Sign evidence envelopes and verify provider signatures cryptographically.
3. Run the verifier behind an authenticated service or TEE-backed attester.
4. Move the locally managed buyer key into Circle Agent Wallet or equivalent policy-controlled custody.
5. Bind live executions and evidence attestations to the deployed ERC-8183 hook.
6. Write outcomes to ERC-8004 reputation infrastructure.
