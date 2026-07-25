export const AGENT_AUTH_WINDOW_MS = 5 * 60 * 1000;

export function isAgentAuthorizationFresh(issuedAt: string, now = Date.now()) {
  const age = now - Date.parse(issuedAt);
  return Number.isFinite(age) && age >= -30_000 && age <= AGENT_AUTH_WINDOW_MS;
}

export function createAgentAuthorizationMessage(owner: string, issuedAt: string) {
  return [
    "KNOT Agent Session Authorization",
    "",
    `Owner: ${owner.toLowerCase()}`,
    `Issued At: ${issuedAt}`,
    "Network: Arc Testnet (5042002)",
    "Scope: Access my personal agent wallet for verified KNOT executions.",
    "Limit: Up to 0.050 USDC per execution.",
    "Expiry: Five minutes after issuance.",
  ].join("\n");
}
