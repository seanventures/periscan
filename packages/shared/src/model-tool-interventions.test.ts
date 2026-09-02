import { describe, expect, it } from "vitest";

import {
  DecideModelToolInterventionInputSchema,
  IssueModelToolInterventionInputSchema,
  ModelToolInterventionSchema
} from "./model-tool-interventions.js";

const ID = "11111111-1111-4111-8111-111111111111";
const HASH = "a".repeat(64);
const TOKEN = "t".repeat(100);

describe("model tool intervention contracts", () => {
  it("defaults review links to a short copy-link handoff", () => {
    expect(IssueModelToolInterventionInputSchema.parse({})).toEqual({
      expiresInMinutes: 15,
      transport: "CopyLink"
    });
  });

  it("never accepts a plain chat message as a decision", () => {
    expect(() =>
      DecideModelToolInterventionInputSchema.parse({ message: "approve" })
    ).toThrow();
  });

  it("requires an exact decision, reason, reference, and signed token", () => {
    expect(
      DecideModelToolInterventionInputSchema.parse({
        decision: "Resume",
        reason: "The exact request and scope were reviewed.",
        reviewReference: "CAB-214",
        token: TOKEN
      })
    ).toMatchObject({ decision: "Resume", reviewReference: "CAB-214" });
  });

  it("parses the immutable envelope without exposing a raw token", () => {
    const intervention = ModelToolInterventionSchema.parse({
      decision: null,
      decisionAt: null,
      decisionBy: null,
      decisionReason: null,
      envelopeHash: HASH,
      expiresAt: "2026-07-16T12:15:00.000Z",
      inputPayloadHash: HASH,
      interventionId: ID,
      issuedAt: "2026-07-16T12:00:00.000Z",
      issuedBy: ID,
      modelSessionId: ID,
      policyDecisionId: null,
      policyProfileName: "Human boundary",
      requestReason: "Validate the exposure",
      reviewReference: null,
      scopeIds: [ID],
      sessionMode: "SafeValidation",
      sessionPurpose: "Review the top exposure",
      status: "Pending",
      tenantId: ID,
      tokenFingerprint: HASH,
      toolName: "request_exposure_validation",
      toolRequestId: ID,
      transport: "Slack"
    });

    expect(intervention.tokenFingerprint).toBe(HASH);
    expect(intervention).not.toHaveProperty("token");
  });
});
