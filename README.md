# KNOT

Pay for verified outcomes, not unproven responses.

KNOT is a verification and settlement layer for autonomous commerce on Arc. A buyer agent turns a job into measurable delivery conditions, compares paid providers, rejects weak evidence, and releases USDC only after the accepted result is bound to an onchain completion hook.

The current build is not a static mock. It runs a server-side execution engine, records durable receipts, can use Circle developer-controlled wallets for buyer agents, settles accepted provider work through x402, and has a deployed Arc Testnet commerce contract plus verification hook.

## Why it exists

Agent payments are getting easy. Agent accountability is still thin.

With x402, an agent can pay an HTTP service in one request. That payment proves a transfer happened, but it does not prove the service delivered current data, a valid schema, a signature, or the specific evidence the buyer needed. KNOT adds the missing boundary:

1. Compile the buyer's request into a fixed obligation.
2. Route through eligible providers inside the declared budget.
3. Verify freshness, latency, schema, signatures, and policy limits.
4. Reject bad evidence and try a better provider.
5. Authorize payment only for the accepted evidence.
6. Anchor the accepted evidence hash before onchain job completion.

## What works

- Responsive KNOT console with Verify, Receipts, Treasury, and Protocol views.
- Judge Mode policy ladder that runs Economy, Balanced, and Strict against the same wallet in one click.
- Job templates for counterparty risk, treasury checks, agent spend, and contract review.
- Economy, Balanced, Strict, and Custom policy presets with visibly different provider routing.
- Preflight quote API that predicts provider route, max spend, and fallback reasons before execution.
- Agent discovery and OpenAPI endpoints for machine-readable integration.
- Judge-ready submission brief at `/api/submission`.
- Launch, domain, utility, revenue, and TGE guardrail kit at `/api/launch`.
- Provider marketplace catalog and accepted-settlement economics at `/api/marketplace`.
- Sites-compatible public worker export for a lightweight hosted KNOT surface.
- Server-side execution API with request validation, spend limits, and rate limits.
- Durable file-backed receipts with explicit receipt lookup instead of public global history.
- Arc Baseline, Arc Sentinel, and Arc Veritas provider lanes with deterministic fallback.
- Circle MPC agent wallet support for user-owned buyer agents.
- x402 seller endpoints for accepted Arc Sentinel and Arc Veritas evidence.
- Optional protocol-funded API mode protected by `KNOT_EXECUTION_API_KEY`.
- ERC-8183-style `KnotCommerce` escrow contract and `KnotVerificationHook`.
- Live Arc Testnet deployment with source verification and a completed testnet job.
- Unit, contract, lint, production build, and production dependency audit coverage.

## Live Arc proof

KNOT has its own Arc Testnet commerce contract and verification hook:

| Contract | Address |
| --- | --- |
| `KnotCommerce` | [`0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f`](https://testnet.arcscan.app/address/0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f) |
| `KnotVerificationHook` | [`0x73b00398580ba7a19ffb7a5677cf3970e15918d5`](https://testnet.arcscan.app/address/0x73b00398580ba7a19ffb7a5677cf3970e15918d5) |
| Arc USDC | `0x3600000000000000000000000000000000000000` |

Job `1` was funded, attested, and completed on Arc Testnet:

| Proof | Link |
| --- | --- |
| Evidence hash | `0x7e758fd3a8f4cfb74a4a1e708bec80694fa37553b09e768dcf11eaf85e88c016` |
| Attestation tx | [`0xa61b706111781ce3d9b26f1dc7012dedcb1a33b4cd6b2b63046aff223c0542b2`](https://testnet.arcscan.app/tx/0xa61b706111781ce3d9b26f1dc7012dedcb1a33b4cd6b2b63046aff223c0542b2) |
| Completion tx | [`0x97b6e863f1308fc11d2484495f9742be54e5f721ceaed55820e864b2b0a30f8d`](https://testnet.arcscan.app/tx/0x97b6e863f1308fc11d2484495f9742be54e5f721ceaed55820e864b2b0a30f8d) |

Machine-readable deployment files live in [`deployments/arc-testnet.json`](deployments/arc-testnet.json), [`deployments/erc8183-testnet.json`](deployments/erc8183-testnet.json), and [`deployments/x402-testnet.json`](deployments/x402-testnet.json).

## Product flow

1. Pick a job type and a policy preset in the console.
2. KNOT builds an obligation with a maximum USDC price, freshness limit, latency limit, required fields, and signature requirement.
3. The engine evaluates provider attempts in price and policy order.
4. Weak evidence is rejected with machine-readable reasons.
5. Accepted evidence becomes a receipt with the full decision trace.
6. If live payment is configured, the accepted provider receives x402 settlement.
7. If the ERC-8183 flow is used, the evidence hash is attested and consumed during job completion.

The important part is that the UI shows a different decision trace for different policies. Economy can accept cheaper evidence, Balanced can reject a weak first attempt and settle Arc Sentinel, and Strict can climb to Arc Veritas for signed, code-aware evidence.

For judging or quick demos, the Judge Mode card runs that full policy ladder automatically and stores all three generated receipts.

## Stack

- Next.js 16.2.11, React 19, TypeScript, Zod
- Arc Testnet, chain ID `5042002`
- Circle Developer-Controlled Wallets
- Circle Gateway x402 Nanopayments
- Solidity 0.8.28, Hardhat 3, viem
- ERC-8183-style agentic commerce hooks

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful routes:

| Route | Purpose |
| --- | --- |
| `/` | KNOT product console |
| `/.well-known/knot` | Agent discovery document for capabilities, auth boundaries, and integration URLs |
| `/api/openapi` | OpenAPI 3.1 contract for quote, execute, receipt, and status calls |
| `/api/submission` | Judge-ready problem, solution, demo flow, users, and live proof brief |
| `/api/launch` | Launch kit covering custom-domain readiness, utility, revenue paths, and TGE-safe guardrails |
| `/api/marketplace` | Provider supply, policy products, and accepted-settlement economics |
| `/receipt/:id` | Shareable execution receipt |
| `POST /api/quote` | Preflight provider route, max spend, and policy blockers without storing a receipt |
| `POST /api/executions` | Run preview or live agent execution |
| `GET /api/executions/:id` | Read one stored execution receipt |
| `GET /api/receipts/verify?id=run_...` | Verify that a stored receipt is still bound to accepted evidence |
| `POST /api/agents` | Provision or read a connected user's Circle MPC agent |
| `GET /api/system/status` | Read integration readiness without exposing secrets |
| `GET /api/manifest` | Read KNOT jobs, policies, endpoint metadata, examples, and deployment proof |
| `POST /api/providers/arc-sentinel/settle` | x402-protected Sentinel settlement |
| `POST /api/providers/arc-veritas/settle` | x402-protected Veritas settlement |
| `POST /api/x402/verify` | Payment-protected verifier-as-a-service route |

Example preview execution:

```bash
curl -X POST http://localhost:3000/api/executions \
  -H "content-type: application/json" \
  -d '{"jobType":"treasury","policyPreset":"strict","subject":"0x0000000000000000000000000000000000000001","maxPriceUsdc":0.05}'
```

## Developer integration

Backends and agent runtimes can call KNOT directly through the typed client in `src/lib/knot/client.ts`:

```ts
import { createKnotClient } from "@/lib/knot/client";

const knot = createKnotClient({
  baseUrl: "https://your-knot-deployment.example",
});

const quote = await knot.quote({
  jobType: "treasury",
  policyPreset: "strict",
  subject: "0x0000000000000000000000000000000000000001",
  maxPriceUsdc: 0.05,
});

if (quote.decision !== "ready") {
  throw new Error(quote.blockers.join(" "));
}

const execution = await knot.run({
  jobType: "treasury",
  policyPreset: "strict",
  subject: "0x0000000000000000000000000000000000000001",
  maxPriceUsdc: 0.05,
});

if (execution.status !== "verified") {
  throw new Error("KNOT blocked settlement because no provider satisfied the policy.");
}

console.log(execution.settlement.evidenceHash);
```

The public manifest is available at `/api/manifest` and returns the same policy presets, job templates, contract addresses, endpoint metadata, and sample request shape used by the app. Agent runtimes can start from `/.well-known/knot`, then load `/api/openapi` for the full request contract. Judges can load `/api/submission` or read [`docs/hackathon-submission.md`](docs/hackathon-submission.md) for the project brief and demo flow. The launch kit at `/api/launch` and [`docs/domain-launch-playbook.md`](docs/domain-launch-playbook.md) capture the custom-domain plan, utility narrative, revenue paths, and TGE-safe token guardrails. `/api/marketplace` explains provider supply, policy products, and KNOT's accepted-settlement fee model.

Receipt verifiers can call `/api/receipts/verify?id=run_...&evidenceHash=0x...` to confirm a stored receipt still points at an accepted delivery that satisfies the original obligation.

Protocol-funded live execution is intentionally server-only:

```ts
const knot = createKnotClient({
  baseUrl: process.env.KNOT_URL,
  apiKey: process.env.KNOT_EXECUTION_API_KEY,
});
```

## Environment

Copy names from `.env.example` into `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public URL used for metadata, sitemap, and social previews |
| `ARC_RPC_URL` | Arc Testnet RPC endpoint |
| `ARC_DEPLOYER_PRIVATE_KEY` | Server-only deployer and protocol funding key |
| `ARC_USDC_ADDRESS` | Arc USDC token address for deployments |
| `KNOT_ATTESTER_PRIVATE_KEY` | Optional dedicated verifier key |
| `KNOT_EXECUTION_API_KEY` | Required bearer token for protocol-funded API execution |
| `KNOT_DATA_FILE` | Optional durable receipt file path |
| `KNOT_URL` | Optional smoke-test target |
| `KNOT_SMOKE_SUBJECT` | Optional wallet address used by smoke tests |
| `X402_SELLER_ADDRESS` | Enables seller-mode x402 protection |
| `X402_BUYER_PRIVATE_KEY` | Optional protocol-funded x402 buyer fallback |
| `CIRCLE_API_KEY` | Circle server API key |
| `CIRCLE_ENTITY_SECRET` | Circle entity secret |
| `CIRCLE_WALLET_SET_ID` | Circle wallet set for buyer agents |

Secrets stay server-side. The browser receives only readiness states, public addresses, receipt data, and transaction links.

## Quality

```bash
npm run lint
npm run test:unit
npm run test:contracts
npm run build
npm audit --omit=dev
npm run build:sites
npm run smoke:sites
```

Current verification status:

- `npm run lint` passes.
- `npm run test` passes with 34 unit tests and 10 contract tests.
- `npm run build` passes on Next.js 16.2.11.
- `npm audit --omit=dev` reports 0 vulnerabilities.
- `npm run smoke:local` verifies quote, execution, receipt page, and receipt-binding checks for Economy, Balanced, and Strict routes against a running KNOT server.
- `npm run build:sites && npm run smoke:sites` verifies the public worker export used for Sites deployment.

Smoke a production preview from PowerShell:

```powershell
$env:KNOT_URL = "http://127.0.0.1:3015"
npm run smoke:local
```

## Scripts

```bash
npm run build:sites
npm run smoke:sites
npm run deploy:arc
npm run anchor:live
npm run settle:erc8183
```

`build:sites` creates a Cloudflare Worker-compatible public export at `dist/server/index.js`. `smoke:sites` validates its discovery, OpenAPI, quote, execution, receipt, and verifier paths without starting a server. `deploy:arc` deploys and verifies Arc contracts. `anchor:live` anchors accepted evidence to the verification hook. `settle:erc8183` funds, submits, attests, and completes a live testnet commerce job.

## Security model

KNOT's core rule is simple: payment and completion are downstream of evidence acceptance.

- The execution API validates obligations and clamps spend.
- Protocol-funded execution requires a bearer token.
- Anonymous API calls can preview decisions but cannot spend the protocol wallet.
- Receipt lookup requires explicit IDs and does not expose a public global feed.
- The hook only accepts attestations from `VERIFIER_ROLE`.
- Completion requires the submitted evidence hash to match an accepted, unexpired attestation.
- Accepted attestations are consumed after completion to prevent replay.

See [`docs/security.md`](docs/security.md) for the detailed security model and [`docs/architecture.md`](docs/architecture.md) for the system design.
Use [`docs/launch-readiness.md`](docs/launch-readiness.md) as the operator checklist before a hosted pilot, judging session, or live demo.

## Honest limitations

- Current risk scoring is deterministic and transparent, but it is still a policy engine over Arc wallet, balance, nonce, bytecode, and provider evidence. It is not financial advice.
- Arc Baseline is intentionally lower-trust so the product can demonstrate a real fallback path.
- The Sites worker export is optimized for public discovery and preview execution. The full Next deployment remains the source for Circle MPC, x402 buyer flow, and durable file-backed receipt storage.
- Circle Gateway transfer IDs represent accepted x402 transfers; batched onchain settlement can happen later.
- The durable receipt store is file-backed for the hackathon build. Production should move it to Postgres, S3 with object lock, or an append-only event store.
- ERC-8183 and ERC-8004 integrations should be tracked as standards evolve before mainnet use.

The Arc wordmark used by the interface is sourced from the official [Arc Brand Guidelines and Partner Toolkit](https://www.arc.io/brand-guidelines-and-partner-toolkit).

## License

MIT
