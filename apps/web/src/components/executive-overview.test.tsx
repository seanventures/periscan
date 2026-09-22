import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_FIRST_RUN_WATCH_LABEL,
  type ExecutiveTrendSeries,
  type ExecutiveTrendSummary
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  CTEM_FIRST_MEASURE_NOT_BOARD,
  CTEM_NOT_MEASURED_YET,
  CTEM_RUN_IN_FLIGHT
} from "../lib/ctem-board-honesty";
import {
  computeExecutivePeriodMetrics,
  computeSlaDisciplineSummary,
  ExecutiveOverview
} from "./executive-overview";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

const { honestyTrustFixture, ctemFixture, activationFixture } = vi.hoisted(
  () => {
    const honestyTrustFixture = {
      claimsMeasuredPct: 40,
      claimsMeasuredCount: 2,
      claimsTotalCount: 5,
      fixedSurvivedRevalidationPct: 50,
      fixedSurvivedCount: 1,
      fixedAttemptedCount: 2,
      deniedNeverQueuedCount: 3,
      signatureVerificationRatePct: null as number | null,
      signatureVerifiedCount: 0,
      signatureCheckedCount: 0,
      compositionNote: "Trust metrics composition note."
    };
    const ctemFixture = {
      tenantId: "11111111-1111-4111-8111-111111111111",
      generatedAt: "2026-07-14T12:00:00.000Z",
      source: "LiveTenantStateBaseline" as const,
      snapshotId: null,
      topRiskBand: "High",
      stages: [
        {
          stage: "Scope" as const,
          status: "OnTrack" as const,
          evidenceCount: 1,
          openItemCount: 0,
          trend: "Stable" as const
        },
        {
          stage: "Discover" as const,
          status: "OnTrack" as const,
          evidenceCount: 1,
          openItemCount: 0,
          trend: "Stable" as const
        },
        {
          stage: "Prioritize" as const,
          status: "NeedsAttention" as const,
          evidenceCount: 0,
          openItemCount: 1,
          trend: "Stable" as const
        },
        {
          stage: "Validate" as const,
          status: "NotStarted" as const,
          evidenceCount: 0,
          openItemCount: 0,
          trend: "Stable" as const
        },
        {
          stage: "Mobilize" as const,
          status: "NotStarted" as const,
          evidenceCount: 0,
          openItemCount: 0,
          trend: "Stable" as const
        },
        {
          stage: "Verify" as const,
          status: "NotStarted" as const,
          evidenceCount: 0,
          openItemCount: 0,
          trend: "Stable" as const
        }
      ]
    };
    const activationFixture = {
      profile: "SecurityLeader" as const,
      maturity: "Measured" as const,
      currentStage: "Validate" as const,
      completedMilestones: 6,
      totalMilestones: 9,
      milestones: [
        {
          key: "MeasuredResult" as const,
          label: "First measured result",
          stage: "Validate" as const,
          state: "Completed" as const,
          completedAt: "2026-07-14T11:00:00.000Z",
          href: "/findings",
          evidenceBasis: "Persisted measured finding"
        }
      ],
      diagnostics: [],
      nextAction: {
        label: "Continue proof loop",
        href: "/findings",
        reason: "MeasuredResult complete"
      },
      measuredAt: "2026-07-14T12:00:00.000Z"
    };
    return { honestyTrustFixture, ctemFixture, activationFixture };
  }
);

vi.mock("../lib/periscan-api-client", () => ({
  browserPeriscanApiClient: {
    getExecutiveTrends: vi.fn(async () => ({
      generatedAt: "2026-07-14T12:00:00.000Z",
      honestyTrust: honestyTrustFixture,
      metrics: [
        {
          delta: 0,
          evidenceIds: [],
          label: "Critical and high validated findings",
          metricId: "critical_high_findings",
          previousValue: null,
          trendDirection: "NotAvailable",
          unit: "findings",
          value: 2
        }
      ],
      proofDelivery: {
        evidencePacksReady: 1,
        latestReportCreatedAt: null,
        latestReportId: null,
        reportExports: 0
      },
      recommendations: [],
      remediationVelocity: {
        averageVerificationHours: null,
        closedWithoutEvidence: 1,
        fixedRemediations: 1,
        openRemediations: 0,
        readyForVerification: 0,
        reopenedRemediations: 0,
        totalRemediations: 2
      },
      tenantId: "11111111-1111-4111-8111-111111111111"
    })),
    getExecutiveTrendSeries: vi.fn(async () => ({
      generatedAt: "2026-07-14T12:00:00.000Z",
      metrics: [],
      tenantId: "11111111-1111-4111-8111-111111111111"
    })),
    getCTEMProgram: vi.fn(async () => ctemFixture),
    listAttackPaths: vi.fn(async () => []),
    listFindings: vi.fn(async () => []),
    listRemediations: vi.fn(async () => []),
    listThreatAdvisories: vi.fn(async () => []),
    getTrustSafetySummary: vi.fn(async () => ({
      marketPresence: {
        publicReferenceCount: 0,
        waveMarketPresenceGate: "Fail",
        mqMarketPresenceGate: "Fail",
        peerDiligenceGate: "Fail",
        marketPresenceEligible: false,
        banner: "Zero customer references — Wave market presence not met",
        disclaimer: "Product alone never grants market presence.",
        publicCaseStudyCount: 0,
        publicLogoCount: 0
      }
    })),
    getProductActivationState: vi.fn(async () => activationFixture)
  }
}));

afterEach(() => {
  vi.mocked(api.getCTEMProgram).mockResolvedValue(ctemFixture as never);
  vi.mocked(api.getProductActivationState).mockResolvedValue(
    activationFixture as never
  );
  vi.mocked(api.listFindings).mockResolvedValue([]);
  vi.clearAllMocks();
});

describe("computeExecutivePeriodMetrics", () => {
  it("derives period deltas from persisted points with metric-aware direction", () => {
    const honestyTrust = {
      claimsMeasuredPct: 0,
      claimsMeasuredCount: 0,
      claimsTotalCount: 0,
      fixedSurvivedRevalidationPct: 0,
      fixedSurvivedCount: 0,
      fixedAttemptedCount: 0,
      deniedNeverQueuedCount: 0,
      signatureVerificationRatePct: null as number | null,
      signatureVerifiedCount: 0,
      signatureCheckedCount: 0,
      compositionNote: "Trust metrics composition note."
    };
    const current: ExecutiveTrendSummary = {
      generatedAt: "2026-07-14T12:00:00.000Z",
      honestyTrust,
      metrics: [
        {
          delta: 0,
          evidenceIds: [],
          label: "Critical and high validated findings",
          metricId: "critical_high_findings",
          previousValue: null,
          trendDirection: "NotAvailable",
          unit: "findings",
          value: 3
        },
        {
          delta: 0,
          evidenceIds: [],
          label: "Verified fixes",
          metricId: "verified_fixes",
          previousValue: null,
          trendDirection: "NotAvailable",
          unit: "fixes",
          value: 4
        }
      ],
      proofDelivery: {
        evidencePacksReady: 0,
        latestReportCreatedAt: null,
        latestReportId: null,
        reportExports: 0
      },
      recommendations: [],
      remediationVelocity: {
        averageVerificationHours: null,
        closedWithoutEvidence: 0,
        fixedRemediations: 4,
        openRemediations: 0,
        readyForVerification: 0,
        reopenedRemediations: 0,
        totalRemediations: 4
      },
      tenantId: "11111111-1111-4111-8111-111111111111"
    };
    const series: ExecutiveTrendSeries = {
      generatedAt: current.generatedAt,
      metrics: [
        {
          label: "Critical and high validated findings",
          metricId: "critical_high_findings",
          points: [
            { capturedAt: "2026-04-01T12:00:00.000Z", value: 5 },
            { capturedAt: "2026-06-01T12:00:00.000Z", value: 4 }
          ],
          unit: "findings"
        },
        {
          label: "Verified fixes",
          metricId: "verified_fixes",
          points: [
            { capturedAt: "2026-04-01T12:00:00.000Z", value: 1 },
            { capturedAt: "2026-06-01T12:00:00.000Z", value: 2 }
          ],
          unit: "fixes"
        }
      ],
      tenantId: current.tenantId
    };

    expect(
      computeExecutivePeriodMetrics({ current, period: 90, series })
    ).toEqual([
      expect.objectContaining({
        comparisonCapturedAt: "2026-04-01T12:00:00.000Z",
        delta: -2,
        previousValue: 5,
        trendDirection: "Improved"
      }),
      expect.objectContaining({
        comparisonCapturedAt: "2026-04-01T12:00:00.000Z",
        delta: 3,
        previousValue: 1,
        trendDirection: "Improved"
      })
    ]);
  });

  it("does not fabricate a baseline when the selected period has no old point", () => {
    const current = {
      generatedAt: "2026-07-14T12:00:00.000Z",
      honestyTrust: {
        claimsMeasuredPct: 0,
        claimsMeasuredCount: 0,
        claimsTotalCount: 0,
        fixedSurvivedRevalidationPct: 0,
        fixedSurvivedCount: 0,
        fixedAttemptedCount: 0,
        deniedNeverQueuedCount: 0,
        signatureVerificationRatePct: null,
        signatureVerifiedCount: 0,
        signatureCheckedCount: 0,
        compositionNote: "Trust metrics composition note."
      },
      metrics: [
        {
          delta: 0,
          evidenceIds: [],
          label: "Open remediations",
          metricId: "open_remediations",
          previousValue: null,
          trendDirection: "NotAvailable",
          unit: "tasks",
          value: 2
        }
      ],
      proofDelivery: {
        evidencePacksReady: 0,
        latestReportCreatedAt: null,
        latestReportId: null,
        reportExports: 0
      },
      recommendations: [],
      remediationVelocity: {
        averageVerificationHours: null,
        closedWithoutEvidence: 0,
        fixedRemediations: 0,
        openRemediations: 2,
        readyForVerification: 0,
        reopenedRemediations: 0,
        totalRemediations: 2
      },
      tenantId: "11111111-1111-4111-8111-111111111111"
    } satisfies ExecutiveTrendSummary;
    const series = {
      generatedAt: current.generatedAt,
      metrics: [
        {
          label: "Open remediations",
          metricId: "open_remediations",
          points: [{ capturedAt: "2026-07-01T12:00:00.000Z", value: 3 }],
          unit: "tasks"
        }
      ],
      tenantId: current.tenantId
    } satisfies ExecutiveTrendSeries;

    expect(
      computeExecutivePeriodMetrics({ current, period: 30, series })[0]
    ).toMatchObject({
      comparisonCapturedAt: null,
      previousValue: null,
      trendDirection: "NotAvailable"
    });
  });

  it("summarizes owner/SLA discipline from findings and remediations (P04-17)", () => {
    const past = "2020-01-01T00:00:00.000Z";
    const future = "2099-01-01T00:00:00.000Z";
    const summary = computeSlaDisciplineSummary({
      findings: [
        {
          severity: "Critical",
          ownerDisplay: undefined,
          ownerId: undefined
        } as never,
        {
          severity: "High",
          ownerDisplay: "Alice",
          ownerId: "11111111-1111-4111-8111-111111111111"
        } as never,
        { severity: "Low", ownerDisplay: undefined } as never
      ],
      remediations: [
        { status: "Open", owner: null, dueAt: null } as never,
        { status: "InProgress", owner: "Bob", dueAt: past } as never,
        { status: "Open", owner: "Carol", dueAt: future } as never,
        { status: "Fixed", owner: "Dan", dueAt: past } as never
      ]
    });
    expect(summary.criticalHighUnowned).toBe(1);
    expect(summary.openWithoutOwner).toBe(1);
    expect(summary.openWithoutDue).toBe(1);
    expect(summary.overdueOpen).toBe(1);
    expect(summary.withOwnerAndDue).toBe(2);
  });
});

describe("ExecutiveOverview leadership surfaces (P03/P10)", () => {
  it("renders honesty strip, board narrative, build board pack, and pilot banner", async () => {
    render(<ExecutiveOverview />);

    expect(
      await screen.findByTestId("honesty-trust-strip")
    ).toBeInTheDocument();
    expect(screen.getByTestId("honesty-trust-strip")).toHaveTextContent(
      /Path\/hop claims Measured/i
    );
    expect(screen.getByTestId("board-narrative")).toBeInTheDocument();
    expect(screen.getByTestId("board-narrative")).toHaveTextContent(
      /Board narrative/i
    );
    expect(screen.getByTestId("print-board-narrative")).toBeInTheDocument();
    const boardPack = screen.getByTestId("build-board-pack");
    expect(boardPack).toHaveAttribute("href", "/reports?pack=board");
    expect(boardPack).toHaveTextContent(/Build board pack/i);

    await waitFor(() => {
      expect(
        screen.getByTestId("pilot-success-criteria-banner")
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("pilot-success-criteria-banner")).toHaveTextContent(
      /public customer references = 0/i
    );
    expect(screen.getByTestId("pilot-success-criteria-banner")).toHaveTextContent(
      "docs/DESIGN_PARTNER/REFERENCE_FACTORY.md"
    );
    // Pilot checklist checkmarks from real activation + honestyTrust (P03/P10).
    expect(
      screen.getByTestId("pilot-success-criteria-checklist")
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("pilot-criterion-measured-result")).toHaveAttribute(
        "data-done",
        "true"
      );
    });
    // honestyTrust fixture has measured claims + fixed survived.
    expect(screen.getByTestId("pilot-criterion-measured-paths")).toHaveAttribute(
      "data-done",
      "true"
    );
    expect(screen.getByTestId("pilot-criterion-fixed-remeasure")).toHaveAttribute(
      "data-done",
      "true"
    );
    // Zero refs → reference factory stays open; trust residuals always open until published.
    expect(screen.getByTestId("pilot-criterion-reference-factory")).toHaveAttribute(
      "data-done",
      "false"
    );
    expect(screen.getByTestId("pilot-criterion-trust-residuals")).toHaveAttribute(
      "data-done",
      "false"
    );
    // Honesty: never inflate PoR / Type II while refs = 0.
    expect(screen.getByTestId("pilot-success-criteria-banner")).toHaveTextContent(
      /honesty-capped while refs = 0/i
    );
    expect(screen.getByTestId("pilot-success-criteria-banner")).not.toHaveTextContent(
      /SOC 2 Type II (?:certified|attested)/i
    );
  });

  it("does not show CTEM 17% or Verify · 100 on an empty New tenant", async () => {
    vi.mocked(api.getProductActivationState).mockResolvedValue({
      ...activationFixture,
      maturity: "New",
      currentStage: "Connect",
      completedMilestones: 1,
      nextAction: {
        label: "Authorize scope",
        href: "/scopes",
        reason: "Nothing runs outside verified authorized scope."
      }
    } as never);
    vi.mocked(api.getCTEMProgram).mockResolvedValue({
      ...ctemFixture,
      stages: ctemFixture.stages.map((stage) => ({
        ...stage,
        evidenceCount: stage.stage === "Verify" ? 2 : 0,
        openItemCount: 0,
        status: stage.stage === "Verify" ? "OnTrack" : "NotStarted"
      }))
    } as never);

    render(<ExecutiveOverview />);

    expect(
      await screen.findAllByText(CTEM_NOT_MEASURED_YET)
    ).not.toHaveLength(0);
    expect(screen.queryByText("17%")).not.toBeInTheDocument();
    expect(screen.getByTestId("executive-overview")).not.toHaveTextContent(
      /Verify · 100/
    );
    const boardPack = screen.getByTestId("build-board-pack");
    expect(boardPack).toBeDisabled();
    expect(boardPack).not.toHaveAttribute("href");
  });

  it("does not show CTEM 33% while nextAction is Watch", async () => {
    vi.mocked(api.getProductActivationState).mockResolvedValue({
      ...activationFixture,
      maturity: "Activating",
      currentStage: "Validate",
      completedMilestones: 5,
      nextAction: {
        label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
        href: "/missions/355839a7-feb8-455f-a88e-e5a8867af2e4",
        reason: "Community validation is already in flight."
      }
    } as never);
    vi.mocked(api.listFindings).mockResolvedValue([{ findingId: "f1" }] as never);
    vi.mocked(api.getCTEMProgram).mockResolvedValue({
      ...ctemFixture,
      stages: ctemFixture.stages.map((stage) => ({
        ...stage,
        openItemCount: 0,
        status:
          stage.stage === "Scope" || stage.stage === "Verify"
            ? "OnTrack"
            : "NotStarted"
      }))
    } as never);

    render(<ExecutiveOverview />);

    expect(
      await screen.findAllByText(CTEM_RUN_IN_FLIGHT)
    ).not.toHaveLength(0);
    expect(screen.queryByText("33%")).not.toBeInTheDocument();
    expect(screen.getByTestId("executive-overview")).not.toHaveTextContent(
      /Verify · 100/
    );
    expect(screen.getByTestId("build-board-pack")).toBeDisabled();
  });

  it("does not print CTEM 33% or Verify · 100 after first measured Gitleaks", async () => {
    vi.mocked(api.getProductActivationState).mockResolvedValue({
      ...activationFixture,
      maturity: "Measured",
      currentStage: "Act",
      completedMilestones: 5,
      nextAction: {
        label: "Route the smallest fix",
        href: "/remediation",
        reason: "No measured result has been routed into remediation."
      },
      milestones: [
        {
          key: "MeasuredResult",
          label: "Measured result captured",
          stage: "Understand",
          state: "Completed",
          completedAt: "2026-07-14T11:00:00.000Z",
          href: "/findings",
          evidenceBasis: "Persisted Gitleaks finding"
        },
        {
          key: "Revalidated",
          label: "Fix re-validated",
          stage: "Verify",
          state: "Upcoming",
          completedAt: null,
          href: "/remediation",
          evidenceBasis: "No retest yet"
        }
      ]
    } as never);
    vi.mocked(api.listFindings).mockResolvedValue([
      { findingId: "f1" },
      { findingId: "f2" }
    ] as never);
    vi.mocked(api.getCTEMProgram).mockResolvedValue({
      ...ctemFixture,
      stages: ctemFixture.stages.map((stage) => ({
        ...stage,
        openItemCount: 0,
        status:
          stage.stage === "Scope" || stage.stage === "Verify"
            ? "OnTrack"
            : "NotStarted"
      }))
    } as never);

    render(<ExecutiveOverview />);

    expect(
      await screen.findByTestId("executive-overview")
    ).toBeInTheDocument();
    expect(screen.queryByText("33%")).not.toBeInTheDocument();
    expect(screen.getByTestId("executive-overview")).not.toHaveTextContent(
      /Verify · 100/
    );
    expect(
      screen.getAllByText(CTEM_FIRST_MEASURE_NOT_BOARD).length
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("build-board-pack")).toBeDisabled();
  });

  it("shows live tenant baseline provenance on the CTEM board", async () => {
    render(<ExecutiveOverview />);

    expect(
      await screen.findByTestId("executive-overview")
    ).toBeInTheDocument();
    expect(screen.getByTestId("executive-overview")).toHaveTextContent(
      /Source: live tenant baseline/
    );
    expect(screen.getByTestId("executive-overview")).not.toHaveTextContent(
      /Source: latest validation snapshot/
    );
  });

  it("shows snapshot provenance on the CTEM board", async () => {
    vi.mocked(api.getCTEMProgram).mockResolvedValue({
      ...ctemFixture,
      snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "Snapshot"
    } as never);

    render(<ExecutiveOverview />);

    expect(
      await screen.findByTestId("executive-overview")
    ).toBeInTheDocument();
    expect(screen.getByTestId("executive-overview")).toHaveTextContent(
      /Source: latest validation snapshot/
    );
    expect(screen.getByTestId("executive-overview")).not.toHaveTextContent(
      /Source: live tenant baseline/
    );
  });
});

describe("print stylesheet smoke (board projection)", () => {
  it("ships light @media print rules for board narrative", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const path = resolve(__dirname, "../../app/globals.css");
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/@media print/);
    expect(text).toMatch(/Board narrative print stylesheet/);
    expect(text).toMatch(/color-scheme:\s*light/);
    expect(text).toMatch(/\.board-narrative/);
    expect(text).toMatch(/background:\s*#ffffff/);
    // Board print hides operator Needs you / primary CTA noise.
    expect(text).toMatch(/#needs-you/);
    expect(text).toMatch(/data-print-hide="needs-you"/);
    expect(text).toMatch(/dashboard-primary-cta/);
    // honestyTrust strip must not split across pages (P10).
    expect(text).toMatch(/honesty-trust-strip[\s\S]*?page-break-inside:\s*avoid/);
  });
});
