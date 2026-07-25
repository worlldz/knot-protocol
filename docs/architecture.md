# Architecture

KNOT separates three decisions that are often bundled together in agent demos:

1. What did the buyer ask for?
2. Did the provider deliver evidence that satisfies the obligation?
3. Can money or job completion move now?

The answer to the third question is always downstream of the first two.

```text
Buyer intent
    |
    v
Obligation compiler
    |
    v
Preflight quote ----> policy router -----> provider attempt queue
    |                         |
    |                         v
    |                evidence envelope
    |                         |
    v                         v
Deterministic verifier <------+
    |
    +---- reject ----> fallback provider
    |
    +---- accept ----> x402 settlement
                              |
                              v
                      durable receipt
                              |
                              v
                    evidence attestation
                              |
                              v
                 ERC-8183 job completion
```

## Main components

### Console

The Next.js console is a control room for agent commerce. It exposes job templates, policy presets, preview/live mode, receipt history, treasury state, and deployed protocol proof. The browser never receives private keys or Circle credentials.

### Execution API

`POST /api/executions` is the main product boundary. It validates a compact request, compiles an obligation, enforces API limits, runs provider selection, and stores the resulting execution receipt. Anonymous calls can preview decisions. Protocol-funded calls require `KNOT_EXECUTION_API_KEY`.

### Quote API

`POST /api/quote` is the safe preflight boundary. It uses the same obligation compiler as execution, but does not request provider work, create receipts, or spend funds. The response names the expected route, the first provider that can satisfy the policy, max spend, and policy blockers. This lets agents fail fast before signing or funding a settlement.

### Policy engine

The policy engine compares provider attempts against:

- maximum price;
- maximum latency;
- maximum evidence age;
- required payload fields;
- signature requirement;
- job type;
- policy preset.

Economy, Balanced, and Strict are intentionally different. They should produce different traces so a user can see why a stronger policy costs more.

### Providers

KNOT currently models three Arc provider lanes:

| Provider | Role |
| --- | --- |
| Arc Baseline | Cheap evidence, useful for showing rejection and low-trust execution |
| Arc Sentinel | Signed wallet-risk evidence at `0.024 USDC` |
| Arc Veritas | Higher-cost deep evidence at `0.045 USDC` |

Sentinel and Veritas have x402 settlement routes. Payment is attempted only after the evidence satisfies the obligation.

### Durable receipt store

Receipts are stored in a JSON file at `.knot-data/executions.json` by default, or the path supplied by `KNOT_DATA_FILE`. Writes use a temporary file and rename. The API exposes explicit receipt lookup rather than a public global history endpoint.

### x402 boundary

`POST /api/providers/arc-sentinel/settle` and `POST /api/providers/arc-veritas/settle` are payment-protected provider routes when seller mode is configured. In local preview mode, the execution engine can still produce a full receipt without spending.

### ERC-8183 settlement boundary

`KnotCommerce` owns the testnet job lifecycle. `KnotVerificationHook` allows completion only when the completion reason equals an accepted evidence hash attested by the verifier. The hook consumes the attestation after completion.

## Trust boundaries

### Browser to server

The browser can request an execution, but server code owns request validation, spend limits, provider routing, and payment behavior.

### Agent policy

The agent can select only from provider attempts allowed by the compiled obligation. It cannot raise the buyer's price ceiling mid-execution.

### Evidence verification

Verification is deterministic. It returns concrete failed conditions rather than relying on prose confidence from an LLM.

### Payment

x402 settlement happens after acceptance. A failed provider attempt does not receive settlement through KNOT's execution path.

### Onchain completion

Onchain completion requires a verifier attestation for the exact evidence hash. Accepted evidence cannot be replayed after the hook consumes it.

## Data model

An execution receipt contains:

- immutable obligation;
- owner, job type, and policy preset;
- ordered decision events;
- every provider attempt;
- verifier result for each attempt;
- accepted evidence commitment;
- payment attempt status;
- hook attestation status;
- optional transaction hashes and transfer IDs.

The UI renders receipts directly, so the user can inspect how a decision happened instead of seeing only a final green or red state.

A quote is intentionally smaller than a receipt. It contains the compiled obligation, policy route, rejected-provider reasons, and the recommended provider. It is useful for agent planning, but not proof that work happened.

## Production path

- Move receipts from file-backed JSON to Postgres, object-locked storage, or an append-only event log.
- Replace local provider signature booleans with signature recovery over provider keys.
- Add provider identity and outcome reputation through ERC-8004 as the standard matures.
- Put verifier role administration behind multisig or constrained signing policy.
- Add webhook-based Circle settlement reconciliation for batched x402 transfers.
- Move preflight quote telemetry into a public provider reputation graph.
