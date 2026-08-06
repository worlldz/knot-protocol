# KNOT final submission

## Submission details

KNOT is a programmable payment policy layer for autonomous agents on Arc. It addresses a simple but important problem: an agent can pay an API or another machine service, but the payment itself does not prove that the purchased work was fresh, complete, correctly structured, or signed by the expected provider.

Before an agent spends USDC, KNOT converts the buyer's request into an executable obligation. The buyer can define a maximum price, evidence freshness, response latency, required output fields, and a provider-signature requirement. KNOT then discovers eligible providers, compares their offers, requests delivery, and verifies every response against the same policy. Failed evidence is rejected without releasing payment, and the engine automatically routes to another provider. The first provider that satisfies every condition is selected, and its evidence hash is bound to the settlement authorization and a durable public receipt.

The application includes four decision templates: counterparty checks, treasury payouts, agent-spend guards, and contract interactions. Economy, Balanced, and Strict protection levels produce different provider routes and spending limits. A proof-preview mode uses live Arc Testnet data without charging USDC, while live clearing authorizes the connected user's Circle MPC agent wallet to pay only the accepted provider through Circle Gateway x402 Nanopayments.

KNOT is not only a frontend simulation. The server-side execution engine produces machine-readable decision traces and receipts. External agents can discover the protocol through `/.well-known/knot`, request a preflight quote, execute an obligation, and verify a receipt through the public OpenAPI 3.1 interface. Receipts preserve the original obligation, every rejected provider, the accepted evidence, evidence hash, payment rail, and settlement result.

The project also includes two source-verified Arc Testnet contracts. `KnotCommerce` implements an ERC-8183-style funded job flow, while `KnotVerificationHook` prevents completion until an approved verifier has attested the matching evidence hash. A testnet job has been funded, attested, and completed onchain. Separately, a real Circle Gateway x402 authorization moved 0.024 USDC from the buyer balance for an accepted provider response.

Arc is central to the product rather than a deployment label. KNOT uses Arc as the stablecoin-native execution and settlement environment, USDC as both money and gas, Circle developer-controlled wallets for isolated agent signing, Circle Gateway for HTTP-native x402 payments, and Solidity contracts for enforceable evidence-bound completion.

The final MVP includes a public landing page, interactive clearing console, live Arc provider evidence, policy-based routing, automatic fallback, Circle MPC agent activation, x402 settlement, durable receipts, receipt verification, agent discovery, OpenAPI integration, deployed and verified contracts, and public onchain proof. The codebase is covered by 40 unit and API tests plus 10 Solidity contract tests, and the production dependency audit reports zero vulnerabilities.

KNOT's core idea is straightforward: autonomous agents should not pay for promises. They should pay for verified outcomes.

## Submission links

- Live app: https://knot-omega.vercel.app/
- Clearing console: https://knot-omega.vercel.app/app
- Repository: https://github.com/worlldz/knot-protocol
- Commerce contract: https://testnet.arcscan.app/address/0xb76e57e5366783ac8aeaf08d06b50d506b0ccf9f
- Verification hook: https://testnet.arcscan.app/address/0x73b00398580ba7a19ffb7a5677cf3970e15918d5
- Completed job transaction: https://testnet.arcscan.app/tx/0x97b6e863f1308fc11d2484495f9742be54e5f721ceaed55820e864b2b0a30f8d

## Tracks

- Agentic Economy Track
- DeFi Track
