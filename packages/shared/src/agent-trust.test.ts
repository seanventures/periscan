import { describe, expect, it } from "vitest";

import {
  AgentTrustPolicySchema,
  CreateAgentDidTrustProfileInputSchema,
  CreateVeraisonAttestationSessionInputSchema,
  RunA2ATckInputSchema,
  VerifyAgentVerifiableCredentialInputSchema,
  VerifyVeraisonAttestationInputSchema
} from "./agent-trust";

describe("agent trust proof contracts", () => {
  it("keeps AgentDID receipt binding opt-in for existing endpoints", () => {
    expect(
      AgentTrustPolicySchema.parse({
        allowedAudience: "periscan-agent-gateway",
        maxCredentialTtlSeconds: 300,
        requireSignedArtifacts: true,
        requireSpiffeIdentity: true
      })
    ).toMatchObject({ requireAgentDidCredential: false });
  });

  it("accepts a scoped did:web issuer and subject trust profile", () => {
    expect(
      CreateAgentDidTrustProfileInputSchema.parse({
        agentProtocolEndpointId: "11111111-1111-4111-8111-111111111111",
        allowedCredentialTypes: ["AgentDelegationCredential"],
        authorizationReason: "Approved partner agent delegation profile.",
        expectedAudience: "periscan-agent-gateway",
        issuerDid: "did:web:issuer.partner.example",
        scopeId: "22222222-2222-4222-8222-222222222222",
        subjectDid: "did:web:agent.partner.example"
      })
    ).toMatchObject({ issuerDid: "did:web:issuer.partner.example" });
  });

  it("bounds compact credential submission to one explicit profile", () => {
    expect(
      VerifyAgentVerifiableCredentialInputSchema.parse({
        credentialJwt: `${"a".repeat(30)}.${"b".repeat(30)}.${"c".repeat(30)}`,
        profileId: "33333333-3333-4333-8333-333333333333"
      })
    ).toMatchObject({
      profileId: "33333333-3333-4333-8333-333333333333"
    });
  });

  it("requires explicit A2A TCK traffic acknowledgement", () => {
    expect(() =>
      RunA2ATckInputSchema.parse({
        acknowledgeTestTraffic: false,
        authorizationReason: "Approved interoperability qualification.",
        level: "must",
        scopeId: "11111111-1111-4111-8111-111111111111",
        transports: ["jsonrpc"]
      })
    ).toThrow();
  });

  it("accepts a scoped Veraison verifier session request", () => {
    expect(
      CreateVeraisonAttestationSessionInputSchema.parse({
        authorizationReason: "Approved confidential workload verification.",
        provider: "ArmCCA",
        scopeId: "11111111-1111-4111-8111-111111111111",
        verifierUrl: "https://verifier.example",
        workloadId: "payments-confidential-worker"
      })
    ).toMatchObject({ provider: "ArmCCA" });
  });

  it("bounds Veraison evidence and supports scalar dotted claim checks", () => {
    expect(
      VerifyVeraisonAttestationInputSchema.parse({
        evidenceBase64: "ZXZpZGVuY2U=",
        evidenceMediaType: "application/psa-attestation-token",
        expectedClaims: { "submods.cpu.secure_boot": true },
        veraisonSessionId: "22222222-2222-4222-8222-222222222222"
      })
    ).toMatchObject({
      expectedClaims: { "submods.cpu.secure_boot": true }
    });
  });
});
