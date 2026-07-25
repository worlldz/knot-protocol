# KNOT hackathon submission

## One-liner

KNOT is a verification-native settlement layer for autonomous agent work on Arc.

## Why we built it

Agent payments are getting easy. Agent accountability is still thin.

x402 lets a service ask for payment directly inside an HTTP request. Arc makes stablecoin-native settlement fast and predictable. But neither one answers the most important buyer question: did the paid service actually deliver fresh, signed, policy-valid evidence?

KNOT fills that gap. It sits between an autonomous buyer agent and paid provider services, turns the buyer request into measurable obligations, rejects weak evidence, falls back to stronger providers, and releases value only when the accepted evidence satisfies the policy.

## Who needs it

- Treasury agents that need proof before releasing USDC.
- Agent wallets that need counterparty checks before sending value.
- API providers that want to sell evidence instead of prose answers.
- Protocols that need an evidence hash before allowing an onchain job to complete.

## What is live

- Responsive KNOT console with Verify, Receipts, Treasury, and Protocol views.
- Judge Mode policy ladder across Economy, Balanced, and Strict.
- Public preflight quote endpoint at `/api/quote`.
- Durable receipt reads and receipt verification.
- Agent discovery at `/.well-known/knot`.
- OpenAPI 3.1 at `/api/openapi`.
- Judge-ready machine-readable brief at `/api/submission`.
- Launch kit at `/api/launch` with domain readiness, utility, revenue paths, and TGE-safe guardrails.
- Arc Testnet `KnotCommerce` and `KnotVerificationHook` contracts.
- Completed ERC-8183-style testnet job recorded in `deployments/erc8183-testnet.json`.
- Sites-compatible public worker export for private hosted preview.

## Demo script

1. Open KNOT.
2. Run Judge Mode.
3. Show Economy accepting Arc Baseline in one attempt at `0.008 USDC`.
4. Show Balanced rejecting Baseline and accepting Arc Sentinel at `0.024 USDC`.
5. Show Strict rejecting Baseline and Sentinel, then accepting Arc Veritas at `0.045 USDC`.
6. Open a generated receipt and verify the evidence hash.
7. Open `/.well-known/knot`, `/api/openapi`, and `/api/submission` to show external agent readiness.
8. Open `/api/launch` to show the custom-domain plan, utility narrative, and launch path.
9. Show the Arcscan links for the live commerce contract, hook, attestation transaction, and completed job.

## Why it should win

KNOT is not only a landing page. It has a working execution engine, policy router, provider fallback path, receipt store, receipt verifier, discovery contract, OpenAPI contract, Arc Testnet contracts, and a completed onchain job.

The product demonstrates the missing primitive for autonomous commerce: agents should not pay for answers. They should pay for verified outcomes.
