import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { EvidenceLedger } from "./evidence-ledger";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const evidenceId = "77777777-7777-4777-8777-777777777777";
const relatedEntityId = "88888888-8888-4888-8888-888888888888";
const method = {
  algorithm: "SHA-256",
  authority: "Periscan evidence service",
  description:
    "Tenant-scoped hash-chain verification. This is a tamper-evident commitment, not an external digital signature.",
  signaturePresent: false
};
const artifact = {
  artifactType: "NormalizedEvidence",
  createdAt: timestamp,
  evidenceId,
  redactedAt: null,
  redactedSha256: null,
  redactionStatus: "NotRequired",
  relatedEntityId,
  relatedEntityType: "ValidationRun",
  sensitivityLevel: "Moderate",
  sha256: "recorded-content-hash",
  storageUri: "s3://periscan/evidence.json",
  tenantId,
  updatedAt: timestamp
};

function mockFetch(chainValid = true) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input).split("?")[0] ?? "";

    if (route === "/api/v1/evidence") {
      return {
        json: async () => ({ items: [artifact] }),
        ok: true,
        status: 200
      };
    }

    if (route === "/api/v1/evidence/verify-chain") {
      return {
        json: async () => ({
          brokenAtSeq: chainValid ? null : "1",
          chainedArtifacts: 1,
          checked: chainValid ? 1 : 0,
          legacyUnchainedArtifacts: 0,
          links: [
            {
              chainHash: "current-chain-hash",
              chainSeq: "1",
              evidenceId,
              prevChainHash: null,
              reason: chainValid
                ? null
                : "chainHash mismatch at chainSeq 1 (record was tampered)",
              status: chainValid ? "Verified" : "Broken",
              valid: chainValid
            }
          ],
          method,
          reason: chainValid
            ? null
            : "chainHash mismatch at chainSeq 1 (record was tampered)",
          tenantId,
          totalArtifacts: 1,
          valid: chainValid,
          verifiedAt: timestamp
        }),
        ok: true,
        status: 200
      };
    }

    if (route === `/api/v1/evidence/${evidenceId}/verify`) {
      return {
        json: async () => ({
          chain: {
            chainHash: "current-chain-hash",
            chainSeq: "1",
            evidenceId,
            prevChainHash: null,
            reason: null,
            status: "Verified",
            valid: true
          },
          content: {
            commitment: "Ingest",
            computedSha256: "recorded-content-hash",
            recordedSha256: "recorded-content-hash",
            valid: true
          },
          evidenceId,
          method,
          reason: null,
          status: "Verified",
          tenantId,
          valid: true,
          verifiedAt: timestamp
        }),
        ok: true,
        status: 200
      };
    }

    return {
      json: async () => ({ error: `Unhandled route ${route}` }),
      ok: false,
      status: 404
    };
  }) as unknown as typeof fetch;
}

describe("EvidenceLedger", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("verifies the tenant chain and a single artifact with linkage detail", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<EvidenceLedger />);

    await screen.findByText(`ev·${evidenceId.slice(0, 8)}`);
    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(await screen.findByText("Evidence chain intact")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText(/external signature not present/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(
      await screen.findByRole("status", { name: "Evidence integrity Verified" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Content and tenant-chain linkage verified.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Genesis.*current-chain/i)).toBeInTheDocument();
  });

  it("inspects provenance and loads linked claims for an artifact", async () => {
    vi.stubGlobal("fetch", mockFetch());
    vi.spyOn(api, "listFindings").mockResolvedValue([
      {
        evidenceIds: [evidenceId],
        findingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        title: "Cited finding"
      } as never
    ]);
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    render(<EvidenceLedger />);

    await screen.findByText(`ev·${evidenceId.slice(0, 8)}`);
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));

    expect(
      await screen.findByRole("region", {
        name: `Provenance for ev·${evidenceId.slice(0, 8)}`
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Normalized ingest/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Cited finding/i })
    ).toBeInTheDocument();
  });

  it("makes the first tampered sequence unmistakable", async () => {
    vi.stubGlobal("fetch", mockFetch(false));
    render(<EvidenceLedger />);

    await waitFor(() => {
      expect(screen.getByText(`ev·${evidenceId.slice(0, 8)}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(
      await screen.findByText("Evidence chain broken at sequence 1")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/record was tampered/i)).toHaveLength(2);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
