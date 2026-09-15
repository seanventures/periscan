import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUSINESS_IMPACT_SCENARIOS,
  BusinessImpactScenarioSchema,
  type Asset,
  type AssetValuationVersion,
  type BusinessImpactPreview,
  type BusinessImpactWorkspace,
  type SubmitAssetValuationVersionInput
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { BusinessImpactWorkbench } from "./business-impact-workbench";

const timestamp = "2026-07-16T13:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";
const scenarios = BUSINESS_IMPACT_SCENARIOS.map((scenario) =>
  BusinessImpactScenarioSchema.parse(scenario)
);

const asset: Asset = {
  assetId,
  assetType: "Application",
  businessCriticality: "Critical",
  createdAt: timestamp,
  environment: "production",
  firstSeenAt: timestamp,
  identifiers: { service: "payments" },
  internetExposed: true,
  lastSeenAt: timestamp,
  name: "Production payments API",
  owner: "Payments engineering",
  status: "Active",
  tags: ["payments"],
  tenantId,
  updatedAt: timestamp,
  valuation: null
};

const input: SubmitAssetValuationVersionInput = {
  assumptionNotes: "Includes response, recovery, and lost transaction costs.",
  businessServiceName: "Payments",
  changeReason: "Establish the initial reviewed payments planning range.",
  confidence: "Medium",
  currency: "USD",
  lossEventFrequencyPerYear: { maximum: 2, minimum: 0.5, mostLikely: 1 },
  lossMagnitudeUsd: {
    maximum: 400_000,
    minimum: 100_000,
    mostLikely: 200_000
  },
  scenarioId: "availability-disruption",
  sources: [
    {
      asOfDate: "2026-07-16",
      note: "Quarterly finance planning range.",
      owner: "Finance operations",
      reference: "FIN-RISK-Q3",
      sourceType: "CustomerEstimate"
    }
  ]
};

const preview: BusinessImpactPreview = {
  assetId,
  estimate: {
    annualizedLossExposureUsd: 234_722.22,
    assetId,
    assetName: asset.name,
    assumptions: ["Customer assumptions only."],
    businessServiceName: "Payments",
    confidence: "Medium",
    currency: "USD",
    expectedLossEventFrequencyPerYear: 1.08,
    expectedLossMagnitudeUsd: 216_666.67,
    lowerBoundUsd: 50_000,
    methodology: "FAIR-inspired PERT range estimate",
    upperBoundUsd: 800_000,
    valuationUpdatedAt: timestamp
  },
  generatedAt: timestamp,
  input,
  scenario: scenarios[0]!
};

const pending: AssetValuationVersion = {
  annualizedLossExposureUsd: preview.estimate.annualizedLossExposureUsd,
  assetId,
  assetName: asset.name,
  changeReason: input.changeReason,
  createdAt: timestamp,
  createdBy: userId,
  input,
  inputDigest: "a".repeat(64),
  integrityVerified: true,
  reviewNote: null,
  reviewReference: null,
  reviewedAt: null,
  reviewedBy: null,
  scenario: scenarios[0]!,
  sequence: 1,
  status: "PendingReview",
  supersededAt: null,
  tenantId,
  valuationVersionId: versionId
};

function workspace(
  versions: AssetValuationVersion[] = []
): BusinessImpactWorkspace {
  return {
    assets: [
      {
        asset,
        currentApprovedVersionId:
          versions.find((version) => version.status === "Approved")
            ?.valuationVersionId ?? null,
        currentExposure: null,
        versions
      }
    ],
    generatedAt: timestamp,
    limitations: ["Customer assumptions only."],
    methodology: "FAIR-inspired PERT range estimate",
    scenarios,
    summary: {
      approvedAssetCount: versions.some(
        (version) => version.status === "Approved"
      )
        ? 1
        : 0,
      assumptionBasedAnnualizedExposureUsd: 0,
      failedIntegrityCount: 0,
      pendingReviewCount: versions.filter(
        (version) => version.status === "PendingReview"
      ).length,
      valuedAssetCount: 0
    }
  };
}

describe("BusinessImpactWorkbench", () => {
  afterEach(() => vi.restoreAllMocks());

  it("previews, submits, and reviews a provenance-bound assumption version", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue({
      membership: { role: "Owner" }
    } as unknown as Awaited<ReturnType<typeof api.getMe>>);
    vi.spyOn(api, "getBusinessImpactWorkspace")
      .mockResolvedValueOnce(workspace())
      .mockResolvedValueOnce(workspace([pending]))
      .mockResolvedValueOnce(
        workspace([
          {
            ...pending,
            reviewNote: "Finance confirmed the source and scenario boundary.",
            reviewReference: "RISK-COMMITTEE-2026-07",
            reviewedAt: timestamp,
            reviewedBy: userId,
            status: "Approved"
          }
        ])
      );
    vi.spyOn(api, "previewAssetValuation").mockResolvedValue(preview);
    vi.spyOn(api, "submitAssetValuationVersion").mockResolvedValue(pending);
    vi.spyOn(api, "reviewAssetValuationVersion").mockResolvedValue({
      ...pending,
      reviewNote: "Finance confirmed the source and scenario boundary.",
      reviewReference: "RISK-COMMITTEE-2026-07",
      reviewedAt: timestamp,
      reviewedBy: userId,
      status: "Approved"
    });
    const onActivated = vi.fn().mockResolvedValue(undefined);

    render(<BusinessImpactWorkbench onActivated={onActivated} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Create assumption version" })
    );
    fireEvent.change(screen.getByLabelText("Business service name"), {
      target: { value: input.businessServiceName }
    });
    for (const [label, value] of [
      ["Loss-event frequency / year minimum", "0.5"],
      ["Loss-event frequency / year most likely", "1"],
      ["Loss-event frequency / year maximum", "2"],
      ["Loss magnitude (USD) minimum", "100000"],
      ["Loss magnitude (USD) most likely", "200000"],
      ["Loss magnitude (USD) maximum", "400000"]
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.change(screen.getByLabelText("Financial assumption notes"), {
      target: { value: input.assumptionNotes }
    });
    fireEvent.change(screen.getByLabelText("Source 1 owner"), {
      target: { value: input.sources[0]!.owner }
    });
    fireEvent.change(screen.getByLabelText("Source 1 reference"), {
      target: { value: input.sources[0]!.reference }
    });
    fireEvent.change(screen.getByLabelText("Source 1 note"), {
      target: { value: input.sources[0]!.note }
    });
    fireEvent.change(screen.getByLabelText("Valuation change reason"), {
      target: { value: input.changeReason }
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview estimate" }));
    expect(await screen.findByText("$234,722")).toBeInTheDocument();
    expect(api.previewAssetValuation).toHaveBeenCalledWith(
      assetId,
      expect.objectContaining({
        sources: [expect.objectContaining({ reference: "FIN-RISK-Q3" })]
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(
      await screen.findByText(/v1 · Availability disruption/u)
    ).toBeInTheDocument();
    expect(screen.getByText(/integrity verified/u)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Review reference for version 1"), {
      target: { value: "RISK-COMMITTEE-2026-07" }
    });
    fireEvent.change(screen.getByLabelText("Review note for version 1"), {
      target: { value: "Finance confirmed the source and scenario boundary." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve & activate" }));

    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1));
    expect(api.reviewAssetValuationVersion).toHaveBeenCalledWith(
      assetId,
      versionId,
      expect.objectContaining({ decision: "Approve" })
    );
  });
});
