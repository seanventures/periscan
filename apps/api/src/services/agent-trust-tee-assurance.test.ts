import { describe, expect, it } from "vitest";

import { evaluateTeeAssuranceEvidence } from "./agent-trust.js";

const NOW = new Date("2026-07-16T12:00:00.000Z");
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SCOPE_ID = "22222222-2222-4222-8222-222222222222";

const requirement = {
  evidenceMediaType: "application/eat-collection; profile=sevsnp",
  expectedMeasurement: null,
  expectedRegion: null,
  maxAttestationAgeMinutes: 10,
  provider: "AMDSEVSNP",
  requireDebugDisabled: false,
  requireSecureBoot: false,
  scopeId: SCOPE_ID,
  verifierType: "Veraison",
  workloadId: "payments-confidential-worker"
};

const attestation = {
  checkedAt: new Date("2026-07-16T11:58:00.000Z"),
  debugDisabled: null,
  evidenceMediaType: "application/eat-collection; profile=sevsnp",
  expiresAt: new Date("2026-07-16T12:05:00.000Z"),
  measurement: null,
  outcome: "Verified",
  provider: "AMDSEVSNP",
  region: null,
  secureBoot: null,
  signatureVerified: true,
  trustAnchorConfigured: true,
  verifierType: "Veraison",
  workloadId: "payments-confidential-worker"
};

const session = {
  policyDecisionId: "33333333-3333-4333-8333-333333333333",
  scopeId: SCOPE_ID,
  state: "Complete",
  tenantId: TENANT_ID
};

describe("TEE assurance evidence evaluation", () => {
  it("accepts only a fresh, matching, policy-bound Veraison result", () => {
    expect(
      evaluateTeeAssuranceEvidence(
        requirement,
        attestation,
        session,
        TENANT_ID,
        NOW
      )
    ).toEqual([]);
  });

  it("reports every load-bearing mismatch without operator override", () => {
    expect(
      evaluateTeeAssuranceEvidence(
        { ...requirement, requireSecureBoot: true },
        {
          ...attestation,
          checkedAt: new Date("2026-07-16T11:30:00.000Z"),
          outcome: "Rejected",
          workloadId: "other-worker"
        },
        { ...session, scopeId: "44444444-4444-4444-8444-444444444444" },
        TENANT_ID,
        NOW
      )
    ).toEqual(
      expect.arrayContaining([
        "The selected verifier result is not Verified.",
        "The attested workload does not match the requirement.",
        "The Veraison session is bound to a different verified scope.",
        "The attestation is older than the allowed freshness window.",
        "Secure boot is required but was not proven."
      ])
    );
  });
});
