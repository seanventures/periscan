import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExtensionDeveloperStudio } from "./extension-developer-studio";

function release(
  id: string,
  version: string,
  status: "CatalogActive" | "Superseded"
) {
  return {
    activatedAt: "2026-07-15T20:00:00.000Z",
    activatedBy: "44444444-4444-4444-8444-444444444444",
    activationReason: "Approved tenant catalog release.",
    capabilities: ["ReadEvidence"],
    certifiedAt: "2026-07-15T19:00:00.000Z",
    certifiedBy: "44444444-4444-4444-8444-444444444444",
    certificationReason: "Compatibility and security review passed.",
    compatible: true,
    compatibilityReport: {
      arbitraryPythonUploadAllowed: false,
      checks: [
        {
          checkId: "immutable-image",
          message: "OCI image reference is pinned.",
          status: "Pass"
        }
      ],
      compatible: true,
      contractDigest:
        id === "55555555-5555-4555-8555-555555555555"
          ? "a".repeat(64)
          : "b".repeat(64),
      executionAuthorized: false,
      generatedAt: "2026-07-15T18:00:00.000Z",
      requiresCatalogAndSecurityReview: true
    },
    contract: {
      capabilities: ["ReadEvidence"],
      contractVersion: "1.0",
      cpuLimitMillis: 500,
      imageDigest: "sha256:" + "c".repeat(64),
      imageReference:
        "registry.example/safe-source-adapter@sha256:" + "c".repeat(64),
      maxOutputBytes: 1000000,
      memoryLimitMb: 512,
      networkAllowlist: [],
      outputSchema: {
        properties: { findings: { type: "array" } },
        type: "object"
      },
      packageName: "safe-source-adapter",
      redactionFields: ["rawResponse"],
      signature: "a".repeat(80),
      signerIdentity: "spiffe://example/extensions/reviewer",
      signerPublicKeyPem:
        "-----BEGIN PUBLIC KEY-----\n" +
        "a".repeat(120) +
        "\n-----END PUBLIC KEY-----",
      timeoutSeconds: 60
    },
    contractDigest:
      id === "55555555-5555-4555-8555-555555555555"
        ? "a".repeat(64)
        : "b".repeat(64),
    createdAt: "2026-07-15T18:00:00.000Z",
    createdBy: "44444444-4444-4444-8444-444444444444",
    executionAuthorized: false,
    extensionProjectId: "22222222-2222-4222-8222-222222222222",
    extensionReleaseId: id,
    imageDigest: "sha256:" + "c".repeat(64),
    imageReference:
      "registry.example/safe-source-adapter@sha256:" + "c".repeat(64),
    networkAllowlist: [],
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    signerIdentity: "spiffe://example/extensions/reviewer",
    signerPublicKeySha256: "d".repeat(64),
    status,
    tenantId: "11111111-1111-4111-8111-111111111111",
    updatedAt: "2026-07-15T20:00:00.000Z",
    version
  };
}

describe("ExtensionDeveloperStudio", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the immutable release rail, active digest, rollback, and runtime boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              generatedAt: "2026-07-15T20:00:00.000Z",
              projects: [
                {
                  activeReleaseId: "55555555-5555-4555-8555-555555555555",
                  createdAt: "2026-07-15T17:00:00.000Z",
                  createdBy: "44444444-4444-4444-8444-444444444444",
                  description:
                    "Normalize a customer-authorized source into typed findings.",
                  displayName: "Safe source adapter",
                  extensionProjectId: "22222222-2222-4222-8222-222222222222",
                  licenseSpdx: "Apache-2.0",
                  packageName: "safe-source-adapter",
                  repositoryUrl:
                    "https://github.com/example/safe-source-adapter",
                  status: "Active",
                  supportUrl:
                    "https://support.example/extensions/safe-source-adapter",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  updatedAt: "2026-07-15T20:00:00.000Z"
                }
              ],
              releases: [
                release(
                  "55555555-5555-4555-8555-555555555555",
                  "2.0.0",
                  "CatalogActive"
                ),
                release(
                  "66666666-6666-4666-8666-666666666666",
                  "1.0.0",
                  "Superseded"
                )
              ],
              summary: {
                activeCatalogReleases: 1,
                certifiedReleases: 2,
                compatibilityFailures: 0,
                projects: 1,
                revokedReleases: 0,
                runtimeExecutionAuthorized: 0
              }
            }),
            { status: 200 }
          )
      )
    );

    render(<ExtensionDeveloperStudio />);

    expect(
      await screen.findByRole("heading", { name: "Safe source adapter" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Extension release stages" })
    ).toBeInTheDocument();
    expect(screen.getByText("Catalog active")).toBeInTheDocument();
    expect(screen.getAllByText("Runtime blocked")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Roll back here" })
    ).toBeEnabled();
    await waitFor(() => {
      expect(screen.getByText(/contract aaaaaaaaaa/i)).toBeInTheDocument();
    });
  });
});
