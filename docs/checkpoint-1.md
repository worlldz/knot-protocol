# KNOT — Checkpoint 1

## One-line description

KNOT verifies that autonomous agents received what they paid for before USDC settlement is finalized on Arc.

## Track

- Agentic Economy
- DeFi (conditional payments and multi-step USDC settlement)

## Problem

Agent wallets and x402 make autonomous payments possible, but a valid payment does not prove that an offchain service delivered the promised result. Agents can receive stale, malformed, late, or missing responses with no reliable path from evidence to settlement.

## Solution

KNOT is a verification-native settlement layer for agent commerce. A buyer agent defines measurable delivery conditions, discovers and pays service providers, verifies the returned evidence, and settles or rejects the job without human intervention. Failed services trigger an autonomous fallback while the user receives a complete evidence and payment trail.

## Initial demo

A Circle-powered buyer agent purchases a wallet risk signal from an x402 service. The first provider returns stale and incomplete data, so KNOT rejects it and routes to a second provider. When freshness, schema, latency, and signature checks pass, KNOT authorizes USDC settlement on Arc.

## Planned Arc and Circle stack

- Arc Testnet and USDC
- Circle Agent Wallets
- Circle Agent Stack service discovery
- x402 / Circle Nanopayments
- ERC-8004 agent identity and reputation
- ERC-8183 jobs and escrow settlement
- A custom KNOT verification hook and evidence passport

## Current status

The product interface and deterministic delivery verification engine are running locally. Arc Testnet contracts, Circle Wallet integration, and live x402 buyer/seller endpoints are the next milestones.
