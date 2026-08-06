# KNOT three-minute demo script

The video should show one decision from policy definition to verifiable settlement. Do not tour every tab.

## Before recording

1. Use a 1920x1080 browser window at 100% zoom.
2. Close unrelated tabs and wallet notifications.
3. Open the landing page, the app, one successful receipt, and the Arcscan completion transaction in separate tabs.
4. Use the Balanced policy for the live walkthrough. It demonstrates rejection, fallback, and acceptance without making the trace too long.
5. Keep the decision request and wallet address filled before recording.

## 00:00-00:25 - Problem

Screen: KNOT landing page.

Narration:

> Autonomous agents can already pay for APIs and machine services. But a successful payment does not prove that the purchased work was fresh, complete, correctly structured, or signed. KNOT is a programmable payment policy layer that checks delivery before an agent releases USDC.

Action: Click **Launch app**.

## 00:25-00:55 - Define the obligation

Screen: Verify workspace.

Narration:

> The buyer defines the decision, not every execution step. Here the agent wants to assess an Arc wallet before sending value. The Balanced policy sets a 0.030 USDC ceiling, a 90-second freshness limit, required output fields, latency, and provider-signature rules.

Action: Briefly point at the decision request, wallet address, and Balanced policy. Do not open Advanced policy.

## 00:55-01:35 - Execute and route

Screen: Clearing trace.

Action: Run **Proof preview**. Let the trace animate without scrolling away.

Narration:

> KNOT discovers eligible providers and evaluates each response against the same obligation. The cheaper provider returns incomplete or unsigned evidence, so KNOT rejects it and releases no payment. The engine then activates fallback automatically. Arc Sentinel returns current, signed evidence that satisfies every check and becomes the selected provider.

## 01:35-02:05 - Explain the result

Screen: Provider cards, verification matrix, and settlement result.

Narration:

> This is the important difference between KNOT and a simple API marketplace. Providers do not grade their own work. KNOT independently checks price, freshness, schema, latency, and signature. Only accepted evidence reaches the payment boundary.

Action: Open the generated receipt.

## 02:05-02:30 - Receipt and x402

Screen: Public receipt.

Narration:

> The receipt preserves the original policy, every failed provider, the accepted evidence hash, and the settlement verdict. In live clearing, a personal Circle MPC agent signs the x402 authorization and Circle Gateway charges only the selected provider amount. This build has completed a real 0.024 USDC x402 payment.

Action: Point at the execution ID, accepted provider, evidence hash, amount, and verification status.

## 02:30-02:50 - Onchain enforcement

Screen: Arcscan completion transaction or verified KnotCommerce contract.

Narration:

> KNOT also includes source-verified Arc Testnet contracts. The verification hook binds the accepted evidence hash to an ERC-8183-style job and blocks completion until the matching proof is attested. This transaction is a completed testnet job, not a mocked UI state.

## 02:50-03:00 - Close

Screen: Return to the landing page or receipt verdict.

Narration:

> Arc provides stablecoin-native settlement, Circle provides agent wallets and x402 payments, and KNOT provides the missing policy boundary. Agents should not pay for promises. They should pay for verified outcomes.

## Recording notes

- If spoken English is uncomfortable, use these lines as subtitles and record the interface without voice.
- Do not run a fresh paid transaction during the final recording unless it has already succeeded in rehearsal.
- Show one policy clearly. Mention Economy and Strict only as alternative protection levels.
- Never call proof preview a payment. State that it uses live Arc data without charging USDC.
