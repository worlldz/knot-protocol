# KNOT - Checkpoint 1

## One-line description

KNOT verifies that autonomous agents received what they paid for before USDC settlement is finalized on Arc.

## Tracks

- Agentic Economy
- DeFi: conditional payments and multi-step USDC settlement

## Problem

Agent wallets and x402 make autonomous payments possible, but a successful payment does not prove that an offchain service delivered the promised result. Agents can receive stale, malformed, late, unsigned, or missing responses without a reliable bridge from delivery evidence to settlement.

## Solution

KNOT is a verification-native settlement layer for agent commerce. A buyer agent defines measurable conditions, ranks eligible paid providers, verifies returned evidence, and authorizes or blocks settlement without human intervention. A failed provider triggers an autonomous fallback while the user receives a complete decision and evidence trail.

## Demo scenario

A buyer agent needs a current, signed wallet risk signal for no more than `0.030 USDC`. The cheapest provider returns stale data with a missing confidence field. KNOT rejects it, keeps settlement blocked, and routes to a second provider. The fallback returns fresh, signed, schema-valid evidence for `0.024 USDC`; KNOT binds its hash to settlement authorization.

## Meaningful Arc and Circle use

- Arc is the settlement network for low-cost, fast, USDC-native agent jobs.
- USDC is the job budget and settlement asset.
- Circle Gateway x402 Nanopayments provide the HTTP-native buyer/seller payment rail.
- ERC-8183 provides the agent job lifecycle and hook boundary.
- KNOT's custom hook blocks ERC-8183 completion unless accepted evidence is present.
- ERC-8004 identity and outcome reputation are the next composition milestone.

## Current build

- Working responsive product demo
- Server-side autonomous execution API
- Deterministic evidence verification and fallback
- x402-compatible paid verifier endpoint
- Compiled ERC-8183 verification hook
- Automated unit and contract security tests

## Next checkpoint

- Deploy `KnotVerificationHook` on Arc Testnet
- Fund and connect a Circle Gateway buyer wallet
- Execute a live paid x402 request
- Bind the resulting evidence hash to an ERC-8183 testnet job
- Publish the repository and deployment addresses
