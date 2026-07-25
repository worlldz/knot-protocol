# KNOT domain and launch playbook

This is the public-launch checklist for moving KNOT from a private preview host to a clean branded product surface.

## Domain stance

The current preview host is only a deployment surface. It should not be treated as the KNOT brand.

KNOT is ready to move behind a purchased custom domain. Good candidates should be short, memorable, and easy to say out loud in a demo:

- `knot.market`
- `knotprotocol.xyz`
- `useknot.xyz`
- `knot.clear`
- `knotpay.xyz`

Before final judging or investor sharing, attach one custom domain and use only that canonical URL in screenshots, Discord posts, docs, and demo scripts.

## What the custom domain must prove

The domain is not just cosmetic. It should make the product feel externally usable:

- `/` opens the KNOT console or hosted worker preview.
- `/.well-known/knot` returns the agent discovery document.
- `/api/openapi` returns the machine-readable integration contract.
- `/api/submission` returns the judge-ready brief.
- `/api/launch` returns the product launch kit.
- `/api/system/status` returns public readiness metadata.
- `/api/quote` can preflight an execution route.
- `/api/executions` can create a preview receipt.
- `/api/receipts/verify` can verify an evidence hash against a receipt.

## Launch story

KNOT exists because machine payments are becoming easier than machine accountability.

The core sentence:

> Agents should not pay for answers. They should pay for verified outcomes.

In a demo, keep the story tight:

1. x402 can prove a payment happened.
2. Arc can settle stablecoin value quickly.
3. Neither proves the paid service delivered acceptable work.
4. KNOT adds the verification boundary between request, payment, and onchain completion.
5. Different policies produce different provider routes and prices.
6. Weak evidence is rejected before settlement.
7. Accepted evidence becomes a verifiable receipt and an onchain completion input.

## TGE-safe utility narrative

The hackathon product does not need a token to function. USDC remains the settlement asset.

If KNOT later moves toward a TGE, the token story should be about coordination and quality, not replacing payment:

- provider reputation and challenge markets;
- verifier incentives and signer quality;
- policy template governance;
- fee routing for accepted settlements;
- operator staking for evidence availability.

Avoid promising token value, yield, or price. The strongest story is product utility first, token only as a coordination layer if the network becomes large enough to need it.

## Demo script

1. Open the canonical domain.
2. Run Judge Mode.
3. Show Economy accepting Arc Baseline in one attempt at `0.008 USDC`.
4. Show Balanced falling back to Arc Sentinel at `0.024 USDC`.
5. Show Strict falling back to Arc Veritas at `0.045 USDC`.
6. Open the generated receipt.
7. Verify the receipt evidence hash.
8. Open `/.well-known/knot`.
9. Open `/api/openapi`.
10. Open `/api/submission`.
11. Open `/api/launch`.
12. Open the Arcscan links for the commerce contract, hook, attestation, and completed job.

## Public pilot checklist

Before inviting users outside the hackathon:

- Attach a clean custom domain.
- Configure hosted runtime secrets for Circle MPC and x402 if live paid execution is required.
- Move hosted receipt storage from worker memory to durable storage.
- Keep protocol-funded execution behind `KNOT_EXECUTION_API_KEY`.
- Keep receipt reads explicit-ID only.
- Add monitoring for failed provider calls, stale Arc RPC reads, and failed hook attestations.

## Current honest boundary

The full Next build has the durable file-backed receipt path, Circle MPC agent wallet flow, x402 buyer/seller routes, and local production smoke coverage.

The Sites worker export is a lightweight hosted surface for public discovery, quote, preview execution, receipt lookup, and receipt verification. It is strong enough for demo discovery and judge review. A public pilot should use durable hosted storage before treating it as the canonical production ledger.
