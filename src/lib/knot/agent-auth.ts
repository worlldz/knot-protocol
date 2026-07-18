export const AGENT_AUTH_WINDOW_MS = 5 * 60 * 1000;

export function isAgentAuthorizationFresh(issuedAt: string, now = Date.now()) {
  const age = now - Date.parse(issuedAt);
  return Number.isFinite(age) && age >= -30_000 && age <= AGENT_AUTH_WINDOW_MS;
}

export function createAgentAuthorizationMessage(owner: string, issuedAt: string) {
  return [
    "KNOT Agent Wallet Authorization",
    "",
    `Owner: ${owner.toLowerCase()}`,
    `Issued At: ${issuedAt}`,
    "Action: Provision or access my KNOT agent wallet on Arc Testnet.",
  ].join("\n");
}
