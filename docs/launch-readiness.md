# KNOT launch readiness

This document is the operator checklist for taking the hackathon build from local proof to a hosted pilot.

## Current launch state

KNOT is already a working Arc Testnet product:

- The console runs against a server-side execution engine.
- Receipts are durable and shareable by execution ID.
- Economy, Balanced, and Strict policies choose different provider routes.
- Circle Gateway x402 seller routes exist for Sentinel and Veritas.
- Circle MPC agent-wallet provisioning is wired behind wallet-signed ownership.
- `KnotCommerce` and `KnotVerificationHook` are deployed and source-verified on Arc Testnet.
- A completed ERC-8183-style job is recorded in `deployments/erc8183-testnet.json`.

## Proof checklist

Run these before any demo, judging session, or hosted pilot:

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
npm run build:sites
npm run smoke:sites
```

With a local production server running, prove the live product path:

```powershell
$env:KNOT_URL = "http://127.0.0.1:3016"
npm run smoke:local
```

Before running paid or receipt-producing work, preflight the route:

```bash
curl -X POST "$KNOT_URL/api/quote" \
  -H "content-type: application/json" \
  -d '{"jobType":"contract-review","policyPreset":"strict","subject":"0x0000000000000000000000000000000000000001","maxPriceUsdc":0.05}'
```

The quote should return `decision: "ready"`, `recommendedProvider.id: "arc-veritas"`, and a route that explains why cheaper providers would fall back.

For a Sites-hosted public preview, `npm run build:sites` must create `dist/server/index.js`, and `npm run smoke:sites` must prove discovery, OpenAPI, quote, execution, receipt lookup, and receipt verification inside that worker entrypoint.

The smoke script must show three different accepted providers:

| Policy | Expected route |
| --- | --- |
| Economy | Arc Baseline in 1 attempt |
| Balanced | Arc Sentinel after Baseline rejection |
| Strict | Arc Veritas after Baseline and Sentinel rejection |

That check is important because it proves KNOT is not a one-path UI mock. The decision policy changes the provider market path and settlement amount.

## Environment checklist

The hosted environment should define:

| Variable | Required for |
| --- | --- |
| `ARC_RPC_URL` | Live Arc wallet and contract evidence |
| `X402_SELLER_ADDRESS` | x402 seller routes |
| `X402_BUYER_PRIVATE_KEY` | Protocol-funded x402 buyer fallback |
| `KNOT_EXECUTION_API_KEY` | Protected protocol-funded execution |
| `KNOT_HOOK_ADDRESS` | Onchain evidence attestation |
| `KNOT_ATTESTER_PRIVATE_KEY` | Hook attestation signer |
| `CIRCLE_API_KEY` | Circle MPC agent wallets |
| `CIRCLE_ENTITY_SECRET` | Circle MPC agent wallets |
| `CIRCLE_WALLET_SET_ID` | Circle MPC agent wallets |
| `KNOT_DATA_FILE` | Durable receipt file location |

`/api/system/status` should report:

- `mode: "live"` when seller payment and a buyer rail are configured.
- `deployment.verified: true` for the Arc contracts.
- `latestProof.status: "Completed"` for the recorded testnet job.
- `services.protocolApi: "protected"` when protocol-funded execution is enabled.

`/api/manifest` should report:

- all job templates and policy presets used by the UI;
- the public Arc Testnet contract addresses;
- links to `/.well-known/knot` and `/api/openapi`;
- endpoint metadata for execution, receipt reads, system status, and the manifest itself;
- endpoint metadata for preflight quotes, so agents can plan route and max spend before execution;
- an example `curl` command pointing at the current host.

`/.well-known/knot` and `/api/openapi` should be reachable before judging. These are the machine-readable entry points an external agent would use to discover KNOT, quote a route, execute an obligation, and verify the resulting receipt.

`/api/submission` should also be reachable. It is the judge-facing project brief with problem framing, target users, demo flow, live proof links, and the checklist of what is actually working.

`/api/launch` should be reachable before any public share. It is the launch-facing kit with custom-domain readiness, utility, revenue paths, go-to-market wedge, and TGE-safe guardrails.

Receipt verification should also work:

```bash
curl "$KNOT_URL/api/receipts/verify?id=run_..."
```

When an evidence hash is supplied, the endpoint should only return `valid: true` if the hash matches the stored settlement evidence and the accepted delivery still satisfies the original obligation.

## Pilot runbook

1. Start with preview mode and run Economy, Balanced, and Strict against the same wallet address.
2. Open each generated receipt and confirm the accepted provider, attempt count, evidence hash, and settlement result.
3. Connect a wallet on Arc Testnet.
4. Activate the agent wallet with a wallet signature.
5. Switch to Live clearing only after the agent has enough Circle Gateway or wallet balance.
6. Run a strict contract-review obligation.
7. Save the receipt URL and the Arcscan transaction links.

## Production hardening path

The hackathon build is intentionally narrow and transparent. Before a mainnet pilot:

- Replace the file-backed receipt store with Postgres, S3 object lock, or an append-only event store.
- Replace the public worker export's in-memory preview receipts with D1, R2, or the full Next runtime before using it as the canonical production ledger.
- Move public rate limiting to a shared backend such as Redis or a gateway-level limiter.
- Add provider identity registration and signer rotation.
- Add webhook reconciliation for delayed Circle Gateway batch settlement.
- Add alerting for failed attestations and stale Arc RPC reads.
- Gate protocol-funded live execution behind an operator dashboard and audit log.

## Domain launch

Use [`docs/domain-launch-playbook.md`](domain-launch-playbook.md) before a public judging link, investor link, or pilot link goes out.

The preview host is temporary. The canonical KNOT surface should be a purchased custom domain with:

- `/` for the console or hosted worker preview;
- `/.well-known/knot` for agent discovery;
- `/api/openapi` for integration;
- `/api/submission` for judging;
- `/api/launch` for launch and utility narrative;
- `/api/system/status` for readiness;
- `/api/quote`, `/api/executions`, and `/api/receipts/verify` for the working proof path.

## Positioning

KNOT should be described as a clearing layer for autonomous commerce:

- x402 makes machine payment easy.
- Arc makes USDC-native settlement fast and predictable.
- KNOT decides whether the paid work is actually good enough to release value.
- ERC-8183-style hooks make the accepted evidence enforceable onchain.

The core message is simple: agents should not pay for answers, they should pay for verified outcomes.
