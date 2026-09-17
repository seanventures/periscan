import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeeAssuranceDesk } from "./tee-assurance-desk";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SCOPE_ID = "22222222-2222-4222-8222-222222222222";
const REQUIREMENT_ID = "33333333-3333-4333-8333-333333333333";
const ATTESTATION_ID = "44444444-4444-4444-8444-444444444444";
const POLICY_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "66666666-6666-4666-8666-666666666666";
const HASH = "a".repeat(64);

const assurance = {
  authorizationReason: "Qualify the approved confidential workload.",
  createdAt: "2026-07-16T12:00:00.000Z",
  createdBy: USER_ID,
  escalationReference: "RUNBOOK-TEE-001",
  evidenceMediaType: "application/psa-attestation-token",
  expectedMeasurement: null,
  expectedRegion: null,
  latestDecision: null,
  maxAttestationAgeMinutes: 10,
  policyDecisionId: POLICY_ID,
  policyReference: "CC-POLICY-004",
  provider: "ArmCCA",
  qualificationValidityMinutes: 60,
  requireDebugDisabled: false,
  requireSecureBoot: false,
  scopeId: SCOPE_ID,
  status: "AwaitingEvidence",
  supportOwner: "Confidential Compute SRE",
  teeAssuranceRequirementId: REQUIREMENT_ID,
  tenantId: TENANT_ID,
  verifierType: "Veraison",
  workloadId: "payments-confidential-worker"
} as const;

const attestation = {
  checkedAt: "2026-07-16T12:01:00.000Z",
  claimsVersion: null,
  confidentialAttestationId: ATTESTATION_ID,
  debugDisabled: null,
  deviceCount: 0,
  expiresAt: "2026-07-16T12:06:00.000Z",
  findings: [],
  hardwareModels: [],
  measurement: null,
  ordinarySignatureIsHardwareAttestation: false,
  outcome: "Verified",
  provider: "ArmCCA",
  rawClaimsHash: HASH,
  region: null,
  resultClaimsHash: "b".repeat(64),
  secureBoot: null,
  signatureVerified: true,
  tenantId: TENANT_ID,
  trustAnchorConfigured: true,
  evidenceMediaType: "application/psa-attestation-token",
  veraisonSessionId: "77777777-7777-4777-8777-777777777777",
  verifierOrigin: "https://verifier.example",
  verifierType: "Veraison",
  workloadId: "payments-confidential-worker"
} as const;

describe("TeeAssuranceDesk", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("seals a matching verifier receipt through one focused decision chain", async () => {
    let qualified = false;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        const url = String(input);
        if (url.includes(`/tee-assurance/${REQUIREMENT_ID}/evaluate`)) {
          qualified = true;
          return new Response(
            JSON.stringify({
              ...assurance,
              latestDecision: {
                attestationCheckedAt: attestation.checkedAt,
                attestationId: ATTESTATION_ID,
                attestationRawClaimsHash: HASH,
                attestationResultClaimsHash: "b".repeat(64),
                decidedAt: "2026-07-16T12:02:00.000Z",
                decidedBy: USER_ID,
                decisionReason:
                  "Release review accepted the exact verifier receipt.",
                decisionReference: "TEE-REVIEW-001",
                decisionType: "Qualified",
                findings: [],
                qualifiedUntil: "2026-07-16T12:06:00.000Z",
                teeAssuranceDecisionId: "88888888-8888-4888-8888-888888888888",
                teeAssuranceRequirementId: REQUIREMENT_ID,
                tenantId: TENANT_ID
              },
              status: "Qualified"
            }),
            { status: 201 }
          );
        }
        if (url.endsWith("/agent-trust/tee-assurance")) {
          return new Response(
            JSON.stringify({
              assurances: qualified
                ? [
                    {
                      ...assurance,
                      latestDecision: {
                        attestationCheckedAt: attestation.checkedAt,
                        attestationId: ATTESTATION_ID,
                        attestationRawClaimsHash: HASH,
                        attestationResultClaimsHash: "b".repeat(64),
                        decidedAt: "2026-07-16T12:02:00.000Z",
                        decidedBy: USER_ID,
                        decisionReason:
                          "Release review accepted the exact verifier receipt.",
                        decisionReference: "TEE-REVIEW-001",
                        decisionType: "Qualified",
                        findings: [],
                        qualifiedUntil: "2026-07-16T12:06:00.000Z",
                        teeAssuranceDecisionId:
                          "88888888-8888-4888-8888-888888888888",
                        teeAssuranceRequirementId: REQUIREMENT_ID,
                        tenantId: TENANT_ID
                      },
                      status: "Qualified"
                    }
                  ]
                : [assurance],
              attestations: [attestation],
              qualificationRulesVersion: "1.0",
              scopes: [
                {
                  scopeId: SCOPE_ID,
                  scopeType: "Domain",
                  value: "demo.periscan.invalid",
                  verificationStatus: "Verified"
                }
              ]
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TeeAssuranceDesk />);

    expect(
      await screen.findByText("Hardware trust qualification")
    ).toBeVisible();
    expect(
      screen.getByText(/Qualify customer-supplied TEE\/H100 attestation evidence/i)
    ).toBeVisible();
    expect(
      screen.getByText(/does not run workloads inside an enclave/i)
    ).toBeVisible();
    expect(document.body.textContent ?? "").not.toMatch(
      /runs (your )?(agents|workloads) inside (an )?enclave/i
    );
    expect(screen.getByText("Awaiting evidence")).toBeVisible();
    fireEvent.change(screen.getByLabelText("TEE assurance verifier receipt"), {
      target: { value: ATTESTATION_ID }
    });
    fireEvent.change(screen.getByLabelText("TEE assurance decision reason"), {
      target: {
        value: "Release review accepted the exact verifier receipt."
      }
    });
    fireEvent.change(
      screen.getByLabelText("TEE assurance decision reference"),
      { target: { value: "TEE-REVIEW-001" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Seal decision" }));

    expect(
      await screen.findByText(
        "Qualification sealed against the exact verifier receipt."
      )
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getAllByText("Qualified").length).toBeGreaterThan(0)
    );
    const request = fetchMock.mock.calls.find(([input]) =>
      String(input).includes(`/tee-assurance/${REQUIREMENT_ID}/evaluate`)
    );
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      attestationId: ATTESTATION_ID,
      decisionReason: "Release review accepted the exact verifier receipt.",
      decisionReference: "TEE-REVIEW-001"
    });
  });

  it("keeps the demo honestly unqualified when no hardware receipt exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              assurances: [assurance],
              attestations: [],
              qualificationRulesVersion: "1.0",
              scopes: []
            }),
            { status: 200 }
          )
      )
    );
    render(<TeeAssuranceDesk />);
    expect(
      await screen.findByText(/No matching hardware result exists/u)
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Seal decision" })
    ).toBeDisabled();
  });
});
