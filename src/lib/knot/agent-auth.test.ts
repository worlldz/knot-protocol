import { describe, expect, it } from "vitest";
import { createAgentAuthorizationMessage, isAgentAuthorizationFresh } from "./agent-auth";
import { createExecutionSchema } from "./schemas";

const owner = "0x374801c2999C8c41202e3f9245290570DbbC7D76";

describe("agent authorization", () => {
  it("binds the message to a normalized owner and issue time", () => {
    const issuedAt = "2026-07-18T12:00:00.000Z";
    const message = createAgentAuthorizationMessage(owner, issuedAt);

    expect(message).toContain(owner.toLowerCase());
    expect(message).toContain(issuedAt);
    expect(message).toContain("Access my personal agent wallet");
    expect(message).toContain("Up to 0.050 USDC per execution");
  });

  it("accepts only the five-minute authorization window", () => {
    const now = Date.parse("2026-07-18T12:05:00.000Z");

    expect(isAgentAuthorizationFresh("2026-07-18T12:00:00.000Z", now)).toBe(true);
    expect(isAgentAuthorizationFresh("2026-07-18T11:59:59.999Z", now)).toBe(false);
    expect(isAgentAuthorizationFresh("2026-07-18T12:05:31.000Z", now)).toBe(false);
  });

  it("rejects malformed execution authorization fields", () => {
    const result = createExecutionSchema.safeParse({
      agentAuthorization: {
        owner: "not-an-address",
        issuedAt: "not-a-date",
        signature: "signed",
      },
    });

    expect(result.success).toBe(false);
  });
});
