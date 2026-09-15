import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentTrustConsole } from "./agent-trust-console";

describe("AgentTrustConsole", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("guides an operator through an honest NVIDIA EAT verification flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/agent-trust/attestations/challenges")) {
          return new Response(
            JSON.stringify({
              challengeId: "11111111-1111-4111-8111-111111111111",
              expiresAt: "2026-07-15T20:05:00.000Z",
              nonce: "a".repeat(64),
              provider: "NvidiaConfidentialGPU",
              workloadId: "confidential-inference-prod"
            }),
            { status: 201 }
          );
        }
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      })
    );

    render(<AgentTrustConsole />);

    expect(
      screen.getByTestId("partner-capability-honesty-panel")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Partner residual honesty \(matrix #2/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/GET \/api\/v1\/partner-capabilities\/honesty/)
    ).toBeInTheDocument();

    const verifier = await screen.findByText(
      "Verify an NVIDIA detached EAT bundle"
    );
    fireEvent.click(verifier);

    expect(
      screen.getByText(/generate a challenge before collecting evidence/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /no token is accepted when the server trust anchor is missing/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /qualifies customer-supplied TEE\/H100 attestation evidence/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not run agents or inference inside an enclave/i)
    ).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(
      /we run (your )?(agents|workloads) inside/i
    );
    expect(
      screen.getByRole("button", { name: "Verify bundle" })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("NVIDIA workload ID"), {
      target: { value: "confidential-inference-prod" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByDisplayValue("a".repeat(64))).toHaveAttribute(
      "readonly"
    );
    fireEvent.change(screen.getByLabelText("NVIDIA detached EAT bundle JSON"), {
      target: { value: '[["JWT","signed-token-placeholder"]]' }
    });

    expect(screen.getByRole("button", { name: "Verify bundle" })).toBeEnabled();
  });

  it("shows a live AgentDID verification chain and clears the raw credential", async () => {
    let finishVerification: ((response: Response) => void) | undefined;
    const verificationResponse = new Promise<Response>((resolve) => {
      finishVerification = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/agent-trust/did/profiles")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  agentDidTrustProfileId:
                    "11111111-1111-4111-8111-111111111111",
                  agentProtocolEndpointId:
                    "22222222-2222-4222-8222-222222222222",
                  allowedCredentialTypes: ["AgentDelegationCredential"],
                  authorizationReason: "Approved partner delegation.",
                  createdAt: "2026-07-15T20:00:00.000Z",
                  createdBy: "33333333-3333-4333-8333-333333333333",
                  expectedAudience: "periscan-agent-gateway",
                  expectedEndpointOrigin: "https://agent.partner.example",
                  issuerDid: "did:web:issuer.partner.example",
                  issuerDidDocumentHash: "a".repeat(64),
                  issuerResolutionUrl:
                    "https://issuer.partner.example/.well-known/did.json",
                  issuerResolvedAt: "2026-07-15T20:00:00.000Z",
                  policyDecisionId: "44444444-4444-4444-8444-444444444444",
                  revokedAt: null,
                  revokedBy: null,
                  revocationReason: null,
                  scopeId: "55555555-5555-4555-8555-555555555555",
                  status: "Active",
                  subjectDid: "did:web:agent.partner.example",
                  subjectDidDocumentHash: "b".repeat(64),
                  subjectResolutionUrl:
                    "https://agent.partner.example/.well-known/did.json",
                  subjectResolvedAt: "2026-07-15T20:00:00.000Z",
                  tenantId: "66666666-6666-4666-8666-666666666666",
                  updatedAt: "2026-07-15T20:00:00.000Z"
                }
              ]
            }),
            { status: 200 }
          );
        }
        if (
          url.endsWith("/agent-trust/did/credentials/verify") &&
          init?.method === "POST"
        ) {
          return verificationResponse;
        }
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      })
    );

    render(<AgentTrustConsole />);
    fireEvent.click(await screen.findByText("did:web:agent.partner.example"));
    const credential = screen.getByLabelText("Agent verifiable credential JWT");
    fireEvent.change(credential, {
      target: { value: "raw-compact-credential-that-must-not-remain" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify credential" }));

    expect(await screen.findByText("Resolve issuer DID")).toBeInTheDocument();
    finishVerification?.(
      new Response(
        JSON.stringify({
          agentDidTrustProfileId: "11111111-1111-4111-8111-111111111111",
          agentVerifiableCredentialId: "77777777-7777-4777-8777-777777777777",
          algorithm: "ES256",
          allowedCapabilities: ["read-proof-summary"],
          claimsHash: "c".repeat(64),
          credentialHash: "d".repeat(64),
          credentialId: "urn:uuid:delegation",
          credentialTypes: [
            "VerifiableCredential",
            "AgentDelegationCredential"
          ],
          findings: [],
          issuerDid: "did:web:issuer.partner.example",
          issuerDidDocumentHash: "a".repeat(64),
          status: "Verified",
          subjectDid: "did:web:agent.partner.example",
          tenantId: "66666666-6666-4666-8666-666666666666",
          validFrom: "2026-07-15T20:00:00.000Z",
          validUntil: "2026-07-15T20:05:00.000Z",
          verificationMethodId: "did:web:issuer.partner.example#delegation-key",
          verifiedAt: "2026-07-15T20:00:01.000Z",
          workloadId: "spiffe://partner.example/agents/proof-reader"
        }),
        { status: 201 }
      )
    );

    await waitFor(() => expect(credential).toHaveValue(""));
    expect(
      await screen.findByText(/credential verified and bound/i)
    ).toBeInTheDocument();
  });
});
