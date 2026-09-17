import { describe, expect, it } from "vitest";

import {
  signModelToolInterventionToken,
  verifyModelToolInterventionToken,
  type InterventionTokenPayload
} from "./model-gateway.js";

const PAYLOAD: InterventionTokenPayload = {
  envelopeHash: "a".repeat(64),
  expiresAt: "2026-07-16T12:15:00.000Z",
  interventionId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  toolRequestId: "33333333-3333-4333-8333-333333333333",
  version: 1
};

describe("model tool intervention signatures", () => {
  it("round-trips the exact authorization payload", () => {
    const token = signModelToolInterventionToken(PAYLOAD, "test-secret");
    expect(verifyModelToolInterventionToken(token, "test-secret")).toEqual(
      PAYLOAD
    );
  });

  it("rejects a changed payload, signature, or signing secret", () => {
    const token = signModelToolInterventionToken(PAYLOAD, "test-secret");
    const [payload, signature] = token.split(".");

    expect(
      verifyModelToolInterventionToken(
        `${payload?.slice(0, -1)}A.${signature}`,
        "test-secret"
      )
    ).toBeNull();
    expect(
      verifyModelToolInterventionToken(
        `${payload}.${signature?.slice(0, -1)}A`,
        "test-secret"
      )
    ).toBeNull();
    expect(
      verifyModelToolInterventionToken(token, "different-secret")
    ).toBeNull();
  });
});
