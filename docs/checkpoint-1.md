# KNOT Checkpoint

## One-line description

KNOT verifies autonomous agent work before USDC settlement is finalized on Arc.

## Tracks

- Agentic Economy
- DeFi and payments
- Arc and Circle agent commerce

## Problem

Agent wallets and x402 make autonomous payments practical, but a payment alone does not prove delivery quality. An agent can pay for stale, malformed, unsigned, or incomplete data unless there is a deterministic verification step between provider response and settlement.

## Solution

KNOT gives buyer agents a settlement control layer. The buyer defines an obligation, KNOT routes through eligible providers, verifies evidence, rejects weak attempts, records the decision trace, and releases payment or onchain completion only for accepted evidence.

## Demo scenario

A treasury agent needs a current wallet-risk signal before approving a payout. The cheapest provider returns incomplete or stale evidence. KNOT rejects it, records the failed conditions, and routes to a stronger provider. The accepted provider is settled through x402, and the accepted evidence hash can be consumed by the Arc Testnet commerce hook during job completion.

## Meaningful Arc and Circle use

- Arc is the USDC settlement network.
- Circle developer-controlled wallets let KNOT operate buyer-side agent wallets.
- Circle Gateway x402 provides HTTP-native provider payment.
- `KnotCommerce` demonstrates an agent job lifecycle on Arc Testnet.
- `KnotVerificationHook` blocks completion unless accepted evidence was attested.

## Current build

- Working KNOT console with policy-driven provider routing.
- Durable receipts and shareable receipt pages.
- Server-side execution API with validation, spend limits, and rate limits.
- Arc Baseline, Arc Sentinel, and Arc Veritas provider lanes.
- x402 settlement endpoints for accepted Sentinel and Veritas evidence.
- Deployed and source-verified Arc Testnet commerce and hook contracts.
- Completed Arc Testnet job with public attestation and completion transactions.
- Unit, contract, lint, build, and production audit verification.

## Live proof

- `KnotCommerce`: `0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f`
- `KnotVerificationHook`: `0x73b00398580ba7a19ffb7a5677cf3970e15918d5`
- Completed job: `1`
- Evidence hash: `0x7e758fd3a8f4cfb74a4a1e708bec80694fa37553b09e768dcf11eaf85e88c016`
- Attestation tx: `0xa61b706111781ce3d9b26f1dc7012dedcb1a33b4cd6b2b63046aff223c0542b2`
- Completion tx: `0x97b6e863f1308fc11d2484495f9742be54e5f721ceaed55820e864b2b0a30f8d`

## Next product milestones

- Public hosted deployment with persistent production storage.
- Provider identity and reputation records as ERC-8004 matures.
- Cryptographic provider signature recovery.
- Receipt verifier page for third-party evidence-hash checks.
- More live provider categories beyond wallet risk and contract review.
