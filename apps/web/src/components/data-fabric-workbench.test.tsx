import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Asset,
  AssetLineage,
  AssetOwnershipSurface,
  DataFabricQualitySurface
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { DataFabricWorkbench } from "./data-fabric-workbench";

const now = "2026-07-15T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const asset: Asset = {
  assetId,
  assetType: "CloudResource",
  businessCriticality: "Critical",
  createdAt: now,
  environment: "production",
  firstSeenAt: now,
  identifiers: { region: "us-east-1", resourceId: "vm-1" },
  internetExposed: true,
  lastSeenAt: now,
  name: "Payments VM",
  owner: "Platform",
  status: "Active",
  tags: ["payments"],
  tenantId,
  updatedAt: now,
  valuation: null
};
const candidateAsset: Asset = {
  ...asset,
  assetId: "77777777-7777-4777-8777-777777777777",
  identifiers: { publicDnsName: "login-other.test" },
  name: "Unreviewed login"
};

const lineage: AssetLineage = {
  asset,
  conflictCount: 1,
  latestObservedAt: now,
  observations: [
    {
      assetId,
      canonicalKeys: ["resourceid:vm-1"],
      conflictFields: ["region"],
      createdAt: now,
      evidenceId: "33333333-3333-4333-8333-333333333333",
      integrationId: "44444444-4444-4444-8444-444444444444",
      observedAt: now,
      observedIdentifiers: { region: "us-west-2", resourceId: "VM-1" },
      observedName: "Renamed payments VM",
      observedType: "CloudResource",
      resolutionConfidence: 1,
      resolutionStatus: "ConflictMatched",
      sourceAssetKey: "a".repeat(64),
      sourceName: "AWS Cloud Inventory",
      sourceObservationId: "55555555-5555-4555-8555-555555555555",
      tenantId,
      updatedAt: now
    }
  ],
  resolutionSummary: {
    ambiguousObservationCount: 0,
    averageConfidence: 1,
    sourceCount: 1
  }
};

const ownership: AssetOwnershipSurface = {
  entries: [
    {
      asset,
      basis: "Hostname is a descendant of verified domain scope example.com.",
      confidence: 0.92,
      evidenceIds: ["33333333-3333-4333-8333-333333333333"],
      hostnames: ["payments.example.com"],
      latestObservedAt: now,
      lifecycle: "New",
      matchedScopeId: "66666666-6666-4666-8666-666666666666",
      matchedScopeValue: "example.com",
      ownershipStatus: "InheritedDomain",
      sourceCount: 1
    },
    {
      asset: candidateAsset,
      basis:
        "Internet-facing source observation has no matching verified domain scope.",
      confidence: 0,
      evidenceIds: ["33333333-3333-4333-8333-333333333333"],
      hostnames: ["login-other.test"],
      latestObservedAt: now,
      lifecycle: "New",
      matchedScopeId: null,
      matchedScopeValue: null,
      ownershipStatus: "UnattributedCandidate",
      review: null,
      sourceCount: 1
    }
  ],
  generatedAt: now,
  summary: {
    attributedAssetCount: 1,
    averageAttributedConfidence: 0.92,
    internetFacingAssetCount: 2,
    unattributedCandidateCount: 1,
    verifiedRootCount: 1
  }
};

const quality: DataFabricQualitySurface = {
  entries: [
    {
      ageHours: 1,
      assetObservationCount: 2,
      freshnessBudgetHours: 30,
      healthStatus: "Healthy",
      integrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      issues: [],
      label: "CrowdStrike Falcon",
      lastEvidenceAt: now,
      lastSyncAt: now,
      signalCount: 4,
      state: "Qualified",
      status: "Connected"
    }
  ],
  generatedAt: now,
  scanFileImport: {
    detail:
      "POST /api/v1/data-fabric/scan-import accepts scoped Nessus (.nessus), vulnerability CSV, and SARIF bodies and writes signal fabric rows as evidenceBasis=Imported (never Measured or Validated). Connector parsers and the Assets workbench upload path are real (uiUpload=true, productPath=ApiAvailable). Raw-file EvidenceArtifact integrity chain on import remains incomplete — status is Partial, not a full evidence chain. Use live connectors for continuous inventory; treat BYO import as prioritization input only.",
    evidenceBasis: "Imported",
    formats: ["nessus", "csv", "sarif"],
    libraryAvailable: true,
    productPath: "ApiAvailable",
    status: "Partial",
    uiUpload: true
  },
  summary: {
    degraded: 0,
    disconnected: 0,
    pendingFirstSync: 0,
    qualified: 1,
    stale: 0,
    total: 1
  }
};

describe("DataFabricWorkbench", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows evidence-linked source resolution and preserved conflicts", async () => {
    vi.spyOn(api, "listAssets").mockResolvedValue([asset, candidateAsset]);
    vi.spyOn(api, "getAssetLineage").mockResolvedValue(lineage);
    vi.spyOn(api, "getAssetOwnershipSurface").mockResolvedValue(ownership);
    vi.spyOn(api, "getDataFabricQualitySurface").mockResolvedValue(quality);
    const reviewCandidate = vi
      .spyOn(api, "reviewAssetOwnershipCandidate")
      .mockResolvedValue({
        assetId: candidateAsset.assetId,
        assetOwnershipReviewId: "88888888-8888-4888-8888-888888888888",
        createdAt: now,
        disposition: "NeedsVerification",
        note: "Confirm ownership with the acquisition security owner.",
        reviewedAt: now,
        reviewedBy: "99999999-9999-4999-8999-999999999999",
        tenantId,
        updatedAt: now
      });

    render(<DataFabricWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Payments VM" })
    ).toBeInTheDocument();
    expect(screen.getByText("AWS Cloud Inventory")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Data source quality" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Scan file import" })
    ).toBeInTheDocument();
    expect(screen.getByText(/product path ApiAvailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Imported ≠ Measured/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/raw-file EvidenceArtifact/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Import as Imported signals/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Scan file content")).toBeInTheDocument();
    expect(screen.getByLabelText("Scan file upload")).toBeInTheDocument();
    expect(screen.getByText("CrowdStrike Falcon")).toBeInTheDocument();
    expect(screen.getByText("ConflictMatched")).toBeInTheDocument();
    expect(screen.getByText("conflict · region")).toBeInTheDocument();
    expect(screen.getByText(/Evidence 33333333/)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "External ownership confidence" })
    ).toBeInTheDocument();
    expect(screen.getByText("Verified domain descendant")).toBeInTheDocument();
    expect(screen.getAllByText("92%")).toHaveLength(2);
    expect(
      screen.getByText(/equal candidates create a separate/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Payments VM/i })[1]!
    );
    expect(api.getAssetLineage).toHaveBeenCalledWith(assetId);

    fireEvent.click(
      screen.getByRole("button", { name: "Request verification" })
    );
    fireEvent.change(screen.getByLabelText("Review note"), {
      target: {
        value: "Confirm ownership with the acquisition security owner."
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));

    expect(
      await screen.findByText(
        "Verification requested. Authorized scope has not changed."
      )
    ).toBeInTheDocument();
    expect(reviewCandidate).toHaveBeenCalledWith(candidateAsset.assetId, {
      disposition: "NeedsVerification",
      note: "Confirm ownership with the acquisition security owner."
    });
    expect(screen.getByText("Verification requested")).toBeInTheDocument();
  });

  it("imports a pasted scan body via importScanFile (P19-r4)", async () => {
    vi.spyOn(api, "listAssets").mockResolvedValue([asset]);
    vi.spyOn(api, "getAssetLineage").mockResolvedValue(lineage);
    vi.spyOn(api, "getAssetOwnershipSurface").mockResolvedValue({
      ...ownership,
      entries: ownership.entries.slice(0, 1),
      summary: {
        ...ownership.summary,
        internetFacingAssetCount: 1,
        unattributedCandidateCount: 0
      }
    });
    vi.spyOn(api, "getDataFabricQualitySurface").mockResolvedValue(quality);
    const importScanFile = vi.spyOn(api, "importScanFile").mockResolvedValue({
      disclaimer:
        "Imported findings are prioritization input only — not Measured re-probe.",
      evidenceBasis: "Imported",
      findingCount: 1,
      format: "csv",
      importedAt: now,
      label: "lab-export.csv",
      signalCount: 1,
      signalIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
    });

    render(<DataFabricWorkbench />);
    expect(
      await screen.findByRole("region", { name: "Scan file import" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Scan file format"), {
      target: { value: "csv" }
    });
    fireEvent.change(screen.getByLabelText("Import label"), {
      target: { value: "lab-export.csv" }
    });
    fireEvent.change(screen.getByLabelText("Scan file content"), {
      target: { value: "Host,Severity,Name\nweb-01,High,OpenSSH" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Import as Imported signals/i })
    );

    expect(
      await screen.findByText(/Imported 1 signal from 1 finding/i)
    ).toBeInTheDocument();
    expect(importScanFile).toHaveBeenCalledWith({
      content: "Host,Severity,Name\nweb-01,High,OpenSSH",
      format: "csv",
      label: "lab-export.csv"
    });
  });
});
