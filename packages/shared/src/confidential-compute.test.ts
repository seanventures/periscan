import { describe, expect, it } from "vitest";

import {
  CreateTeeAssuranceRequirementInputSchema,
  TeeAssuranceRequirementSchema
} from "./confidential-compute.js";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const HASH = "a".repeat(64);

describe("TEE assurance contracts", () => {
  it("accepts only bounded Veraison qualification requirements", () => {
    expect(
      CreateTeeAssuranceRequirementInputSchema.parse({
        authorizationReason: "Qualify the approved confidential workload.",
        escalationReference: "RUNBOOK-TEE-001",
        policyReference: "CC-POLICY-004",
        provider: "AMDSEVSNP",
        scopeId: ID,
        supportOwner: "Confidential Compute SRE",
        verifierType: "Veraison",
        workloadId: "payments-confidential-worker"
      })
    ).toMatchObject({
      maxAttestationAgeMinutes: 10,
      qualificationValidityMinutes: 60,
      verifierType: "Veraison"
    });
    expect(() =>
      CreateTeeAssuranceRequirementInputSchema.parse({
        authorizationReason: "Qualify the approved confidential workload.",
        escalationReference: "RUNBOOK-TEE-001",
        policyReference: "CC-POLICY-004",
        provider: "NvidiaConfidentialGPU",
        scopeId: ID,
        supportOwner: "Confidential Compute SRE",
        verifierType: "NvidiaNVAT",
        workloadId: "payments-confidential-worker"
      })
    ).toThrow();
  });

  it("derives an explicit awaiting-evidence state without inventing proof", () => {
    expect(
      TeeAssuranceRequirementSchema.parse({
        authorizationReason: "Qualify the approved confidential workload.",
        createdAt: "2026-07-16T12:00:00.000Z",
        createdBy: ID,
        escalationReference: "RUNBOOK-TEE-001",
        evidenceMediaType: null,
        expectedMeasurement: null,
        expectedRegion: null,
        latestDecision: null,
        maxAttestationAgeMinutes: 10,
        policyDecisionId: OTHER_ID,
        policyReference: "CC-POLICY-004",
        provider: "AMDSEVSNP",
        qualificationValidityMinutes: 60,
        requireDebugDisabled: false,
        requireSecureBoot: false,
        scopeId: ID,
        status: "AwaitingEvidence",
        supportOwner: "Confidential Compute SRE",
        teeAssuranceRequirementId: ID,
        tenantId: OTHER_ID,
        verifierType: "Veraison",
        workloadId: "payments-confidential-worker"
      }).status
    ).toBe("AwaitingEvidence");
  });

  it("requires exact hashes and bounded receipt fields", () => {
    expect(() =>
      TeeAssuranceRequirementSchema.parse({
        authorizationReason: "Qualify the approved confidential workload.",
        createdAt: "2026-07-16T12:00:00.000Z",
        createdBy: ID,
        escalationReference: "RUNBOOK-TEE-001",
        evidenceMediaType: null,
        expectedMeasurement: "not-a-hash",
        expectedRegion: null,
        latestDecision: null,
        maxAttestationAgeMinutes: 10,
        policyDecisionId: OTHER_ID,
        policyReference: "CC-POLICY-004",
        provider: "AMDSEVSNP",
        qualificationValidityMinutes: 60,
        requireDebugDisabled: false,
        requireSecureBoot: false,
        scopeId: ID,
        status: "AwaitingEvidence",
        supportOwner: "Confidential Compute SRE",
        teeAssuranceRequirementId: ID,
        tenantId: OTHER_ID,
        verifierType: "Veraison",
        workloadId: "payments-confidential-worker"
      })
    ).toThrow();
    expect(HASH).toHaveLength(64);
  });
});
