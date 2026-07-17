# Architecture

KNOT separates agent reasoning, deterministic verification, and value movement so that an LLM decision alone cannot release funds.

```text
Buyer intent
    |
    v
Obligation compiler -----> provider discovery and quotes
    |                               |
    |                               v
    |                      x402 service delivery
    |                               |
    v                               v
Deterministic verifier <---- evidence envelope
    |
    +---- reject ----> fallback policy ----> next provider
    |
    +---- accept ----> evidence commitment
                              |
                              v
                   ERC-8183 completion hook
                              |
                              v
                       USDC settlement
```

## Trust boundaries

### Agent policy

The agent can choose a provider only inside the declared price ceiling. It cannot change verification requirements during an execution.

### Evidence verification

The verifier checks measurable properties and returns every failed condition. It does not rely on an LLM to decide pass or fail.

### x402 boundary

`POST /api/x402/verify` uses Circle Gateway's testnet facilitator when a valid seller address is configured. In local mode it remains open for development and is reported as configuration-required by the status API.

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
4. Connect Circle Agent Wallet and Gateway buyer funding.
5. Deploy the hook and bind executions to ERC-8183 jobs on Arc Testnet.
6. Write outcomes to ERC-8004 reputation infrastructure.
