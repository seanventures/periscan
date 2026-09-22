import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FINDINGS_FILTER_CHIPS_390_VIEWPORT,
  FindingsHeaderMeta,
  FindingsWorkbench,
  WCAG_TARGET_SIZE_MINIMUM_PX,
  findingsCommunityMissionChipReady,
  findingsCopyLinkControlClassName,
  findingsFilterChips390ClassName,
  findingsFilterChips390LayoutOk,
  findingsFilterChips390RailClassName,
  findingsFilterChipsCoverValidatedRow,
  findingsWorkbenchHref,
  targetSizeBelowMinimumPx
} from "./findings-workbench";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const findingId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";

const user = {
  createdAt: timestamp,
  email: "owner@example.com",
  emailVerifiedAt: timestamp,
  mfaEnabledAt: null,
  name: "Risk Owner",
  status: "Active",
  updatedAt: timestamp,
  userId
};

const membership = {
  createdAt: timestamp,
  membershipId,
  role: "Owner",
  tenantId,
  updatedAt: timestamp,
  userId
};

const fingerprint =
  "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01";

const finding = {
  createdAt: timestamp,
  crossLinks: [],
  disposition: null,
  evidenceIds: [evidenceId],
  exploitability: "Validated",
  findingId,
  fingerprint,
  impact: "A public identity path reaches production data.",
  measuredInNetwork: true,
  missingSignalImpact: null,
  nonSnapPack: null,
  occurrenceCount: 3,
  firstSeenAt: "2026-07-01T00:00:00.000Z",
  lastSeenAt: timestamp,
  pathProof: {
    blastRadiusSummary: "Production records are reachable.",
    chokePoints: ["Remove the public trust"],
    claimDisplayLabel: "Partially measured hypothesis",
    entryPoint: "Public workload identity",
    fullyMeasured: false,
    intermediateSteps: ["Assume production role"],
    measuredEdgeCount: 1,
    objective: "Production data access",
    objectiveState: "Reached",
    totalEdgeCount: 2
  },
  priorityReason: {
    businessContext: "Production data store.",
    controlEffectiveness: "No compensating control observed.",
    exploitability: "Validated from a runner.",
    pathContext: "One trust hop to the objective.",
    summary: "Validated public path to production data."
  },
  priorityFormula:
    "Priority = clamp(sum of atomic path-risk contributions, 0, 100).",
  priorityScore: 96,
  riskFactors: [
    {
      contribution: 24,
      key: "validation-state",
      label: "Validation state",
      rationale: "Validated evidence raises priority.",
      value: "Validated"
    },
    {
      contribution: 72,
      key: "business-impact",
      label: "Business impact",
      rationale: "Production data raises consequence.",
      value: "Critical"
    }
  ],
  relatedAssetIds: [],
  relatedControlIds: [],
  relatedPathIds: [findingId],
  relatedRemediationIds: [],
  remediation: "Remove the public trust and revalidate.",
  rootCauseSummary: "Public workload identity trusts production role.",
  severity: "Critical",
  source: "Attack path validation",
  sourceEntityId: findingId,
  sourceEntityType: "AttackPath",
  sourceMotion: "APT",
  status: "Validated",
  tenantId,
  title: "Public workload identity reaches production",
  updatedAt: timestamp,
  validationState: "Validated",
  ownerId: undefined as string | undefined,
  ownerDisplay: undefined as string | undefined
};

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input).split("?")[0] ?? "";
    const payloads: Record<string, unknown> = {
      "/api/v1/findings": {
        items: [finding],
        page: { hasMore: false, limit: 50, offset: 0 }
      },
      "/api/v1/findings/disposition-feedback": {
        generatedAt: timestamp,
        totalFalsePositive: 0,
        totalSuppressed: 0,
        byReason: [],
        byFingerprint: [],
        bySource: []
      },
      "/api/v1/me": {
        membership,
        tenant: {
          billingAccountId: null,
          createdAt: timestamp,
          dataRegion: "us-east-1",
          name: "Demo Security",
          parentTenantId: null,
          tenantId,
          type: "Organization",
          updatedAt: timestamp
        },
        user
      },
      "/api/v1/tenants/current/members": {
        items: [{ membership, user }]
      },
      "/api/v1/remediations": { items: [], page: { hasMore: false } }
    };

    if (!(route in payloads)) {
      return {
        json: async () => ({ error: `Unhandled route ${route}` }),
        ok: false,
        status: 404
      };
    }

    return { json: async () => payloads[route], ok: true, status: 200 };
  }) as unknown as typeof fetch;
}

describe("FindingsWorkbench v2", () => {
  beforeEach(() => {
    // Workbench reads/writes window.location.search for saved views; reset so
    // prior tests (e.g. All view) cannot poison Active defaults.
    window.history.replaceState(null, "", "/findings");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/findings");
  });

  it("P2-FINDINGSMALL: first-hour Gitleaks chrome is the VALIDATED path·rule row + one next verb", async () => {
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      sourceEntityType: "Exposure" as const,
      sourceMotion: "EXV" as const,
      relatedPathIds: [],
      relatedRemediationIds: [],
      pathProof: null,
      location: "leaked.js:2",
      ruleId: "slack-bot-token",
      impact: "Exposure validation observed SecretExposure.",
      rootCauseSummary:
        "Exposure / SecretExposure from Gitleaks (gitleaks.repo_secrets.scan); no linked assets.",
      status: "Validated" as const,
      validationState: "Validated" as const
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    const firstHour = await screen.findByTestId("findings-first-hour");
    expect(
      within(firstHour).getByText("leaked.js:2 · slack-bot-token")
    ).toBeInTheDocument();
    expect(
      within(firstHour).getAllByText(/^Validated$/).length
    ).toBeGreaterThan(0);
    expect(within(firstHour).queryByText("EXV SecretExposure")).not.toBeInTheDocument();

    const primary = screen.getByTestId("findings-first-hour-primary");
    expect(primary).toHaveTextContent(/^Review remediations$/);
    expect(primary).toHaveAttribute("href", "/remediation");
    expect(
      screen.queryByTestId("findings-header-primary-cta")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mark Fixed/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();

    expect(within(firstHour).queryByText(/Measure path hops/i)).not.toBeInTheDocument();
    expect(within(firstHour).queryByText(/Detection-eng/i)).not.toBeInTheDocument();
    expect(within(firstHour).queryByText(/^Views$/i)).not.toBeInTheDocument();
    expect(
      within(firstHour).queryByText(/Run a Validation Snapshot/i)
    ).not.toBeInTheDocument();
    expect(within(firstHour).queryByTestId("proof-stage-strip")).not.toBeInTheDocument();
    expect(within(firstHour).queryByTestId("findings-view-active")).not.toBeInTheDocument();

    const more = screen.getByTestId("findings-more-triage");
    expect(more).not.toHaveAttribute("open");
    fireEvent.click(screen.getByTestId("findings-more-summary"));
    expect(more).toHaveAttribute("open");
    expect(
      within(more).getByRole("link", { name: /Run a Validation Snapshot/i })
    ).toHaveAttribute("href", "/missions");
    expect(
      within(more).getByRole("link", { name: /Measure path hops/i })
    ).toBeInTheDocument();
    expect(
      within(more).getByRole("status", {
        name: "Disposition feedback summary"
      })
    ).toHaveTextContent(/Detection-eng feedback/i);
    expect(within(more).getByTestId("findings-view-active")).toBeInTheDocument();
    expect(within(more).getByTestId("findings-filters-details")).toBeInTheDocument();
    expect(within(more).getByTestId("proof-stage-strip")).toBeInTheDocument();
  });

  it("P2-FINDINGSMALL: Create remediations is the first-hour verb when a Community mission has no task yet", async () => {
    const missionId = "66666666-6666-4666-8666-666666666666";
    const remediationId = "77777777-7777-4777-8777-777777777777";
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      sourceEntityType: "Exposure" as const,
      sourceMotion: "EXV" as const,
      relatedPathIds: [],
      relatedRemediationIds: [],
      pathProof: null,
      location: "leaked.js:2",
      ruleId: "slack-bot-token",
      impact: "Exposure validation observed SecretExposure.",
      status: "Validated" as const,
      validationState: "Validated" as const
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === `/api/v1/community/validation-runs/${missionId}/remediations`) {
        return {
          json: async () => ({
            createdCount: 1,
            missionId,
            remediationIds: [remediationId]
          }),
          ok: true,
          status: 200
        };
      }
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", `/findings?missionId=${missionId}`);

    render(<FindingsWorkbench />);

    const primary = await screen.findByTestId("findings-first-hour-primary");
    expect(primary).toHaveTextContent(/^Create remediations$/);
    expect(primary.tagName).toBe("BUTTON");
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("findings-more-triage")).not.toHaveAttribute("open");

    fireEvent.click(primary);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/community/validation-runs/${missionId}/remediations`,
        expect.objectContaining({ method: "POST" })
      );
      expect(screen.getByTestId("findings-first-hour-primary")).toHaveTextContent(
        /^Review remediations$/
      );
    });
    const review = screen.getByTestId("findings-first-hour-primary");
    expect(review).toHaveAttribute("href", `/remediation/${remediationId}`);
    expect(
      screen.getAllByText(/Fixed still requires a verification event/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Mark Fixed/i })
    ).not.toBeInTheDocument();
  });

  it("P2-HOMEFIXED: after measured Fixed, honesty keeps pathless Gitleaks Open", async () => {
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      relatedPathIds: [],
      relatedRemediationIds: ["99999999-9999-4999-8999-999999999999"],
      pathProof: null,
      location: "leaked.js:2",
      ruleId: "slack-bot-token",
      status: "Inconclusive" as const,
      validationState: "Validated" as const
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/findings") {
          return {
            json: async () => ({
              items: [gitleaksFinding],
              page: { hasMore: false, limit: 50, offset: 0 }
            }),
            ok: true,
            status: 200
          };
        }
        if (route === "/api/v1/remediations") {
          return {
            json: async () => ({
              items: [
                {
                  latestVerification: { outcome: "Fixed" },
                  relatedFindingFingerprint: gitleaksFinding.fingerprint,
                  status: "Fixed"
                }
              ],
              page: { hasMore: false }
            }),
            ok: true,
            status: 200
          };
        }
        return mockFetch()(input);
      }) as unknown as typeof fetch
    );

    render(<FindingsWorkbench />);

    expect(
      await screen.findByText(/Remediation Fixed after retest/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pathless Gitleaks stay Open/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Fixed still requires a verification event/i)
    ).not.toBeInTheDocument();
  });

  it("P2-FINDINGSMALL: Review remediations is the first-hour verb when the VALIDATED row already has an Open task", async () => {
    const remediationId = "99999999-9999-4999-8999-999999999999";
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      sourceEntityType: "Exposure" as const,
      sourceMotion: "EXV" as const,
      relatedPathIds: [],
      relatedRemediationIds: [remediationId],
      pathProof: null,
      location: "leaked.js:2",
      ruleId: "slack-bot-token",
      impact: "Exposure validation observed SecretExposure.",
      status: "Validated" as const,
      validationState: "Validated" as const
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    const primary = await screen.findByTestId("findings-first-hour-primary");
    expect(primary).toHaveTextContent(/^Review remediations$/);
    expect(primary).toHaveAttribute("href", `/remediation/${remediationId}`);
    expect(screen.getAllByTestId("findings-first-hour-primary")).toHaveLength(1);
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Create remediations$/i })
    ).not.toBeInTheDocument();
  });

  it("collapses Filters behind details by default on small screens (P09)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<FindingsWorkbench />);
    await screen.findByText("Public workload identity reaches production");
    const details = screen.getByTestId("findings-filters-details");
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByTestId("findings-filters-summary")).toHaveTextContent(
      "Filters"
    );
    expect(screen.getByTestId("findings-filters-body")).toBeInTheDocument();
    // Opening details is the phone path; filters remain in DOM for a11y.
    fireEvent.click(screen.getByTestId("findings-filters-summary"));
    expect(details).toHaveAttribute("open");
  });

  it("empty findings invites one Community validation action, not filter/how-queue chrome (JOBS-SIMPLE)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    const empty = await screen.findByTestId("findings-empty");
    expect(screen.getByText("No findings yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An empty queue is not a clean bill of health — run Community validation to produce evidence-backed findings."
      )
    ).toBeInTheDocument();
    const explanation = (
      empty.textContent ?? ""
    )
      .replace(/Run Community validation/gi, " ")
      .replace(/No findings yet/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(explanation.split(/(?<=\.)\s+/).filter(Boolean)).toHaveLength(1);

    const primary = screen.getByTestId("findings-empty-primary-cta");
    expect(primary).toHaveAttribute("href", "/missions");
    expect(primary).toHaveTextContent(/^Run Community validation$/);
    expect(
      screen.queryByRole("link", { name: /Connect a source/i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(empty.querySelectorAll("a")).toHaveLength(1);

    expect(screen.queryByText(/How this queue works/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("findings-filters-details")).not.toBeInTheDocument();
    expect(screen.queryByTestId("findings-view-active")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Copy view link/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Export CSV/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Export SARIF/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("findings-header-primary-cta")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("proof-stage-strip")).not.toBeInTheDocument();

    expect(empty.textContent).not.toMatch(/"runs"\s*:/);
    expect(empty.textContent).not.toMatch(/tool\.driver/);
    expect(empty.textContent).not.toMatch(/Raw scanner output/i);
    expect(empty.textContent).not.toMatch(/\/api\/v1\/findings/);
    expect(empty.textContent).not.toMatch(/\{[\s\S]*"version"[\s\S]*\}/);

    await waitFor(() => {
      expect(
        screen.queryByRole("status", {
          name: "Disposition feedback summary"
        })
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Detection-eng feedback")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Measure path hops/i })
    ).not.toBeInTheDocument();
  });

  it("keeps filter chrome when operator filters match no findings", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/findings?severity=Low");

    render(<FindingsWorkbench />);

    expect(
      await screen.findByText("No findings match these filters")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("findings-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("findings-filters-details")).toBeInTheDocument();
    expect(screen.getByTestId("findings-view-active")).toBeInTheDocument();
    expect(
      screen.queryByTestId("findings-empty-primary-cta")
    ).not.toBeInTheDocument();
  });

  it("applies ps-table compact density to the list header when findings load (UX-W7/#101)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    const { container } = render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    expect(container.querySelector(".ps-table.ps-table--compact")).not.toBeNull();
    expect(container.querySelector(".ps-table__header")).toHaveTextContent(
      /Select page/i
    );
    expect(container.querySelector(".ps-table__row")).not.toBeNull();
  });

  it("titles the workbench Findings and keeps Validated status off success-green", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Findings", level: 1 })
    ).toBeInTheDocument();
    expect(screen.queryByText("Validated Results")).not.toBeInTheDocument();

    // UX-W8: same proof-stage chip strip vocabulary as path detail.
    const strip = screen.getByTestId("proof-stage-strip");
    expect(strip).toBeInTheDocument();
    const chips = screen.getByTestId("proof-stage-chips");
    expect(chips.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Understand"
    );
    for (const stage of [
      "Connect",
      "Authorize",
      "Validate",
      "Understand",
      "Act",
      "Verify",
      "Prove"
    ]) {
      expect(chips).toHaveTextContent(stage);
    }

    await screen.findByText("Public workload identity reaches production");

    // Collapsed row shows proof (validationState) not workflow-status soup (P18-4).
    // Expand for full strip including workflow status Validated (attention tone).
    fireEvent.click(
      screen.getByRole("button", {
        name: /Public workload identity reaches production/i
      })
    );
    const statusChips = screen
      .getAllByText("Validated")
      .filter((el) => el.className.includes("text-approval"));
    expect(statusChips.length).toBeGreaterThan(0);
    for (const chip of statusChips) {
      expect(chip).not.toHaveClass("text-fixed");
    }
  });

  it("shows measured hop fraction and sourceMotion honesty on path-linked findings", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    // Collapsed row: motion tag + hop fraction honesty (partial, not invented FullyMeasured).
    expect(
      await screen.findByText(/motion APT/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1\/2 hops measured · partial/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Public workload identity reaches production/i
      })
    );

    expect(screen.getByTestId("finding-hop-fraction")).toHaveTextContent(
      "1/2 hops measured"
    );
    expect(screen.getByTestId("finding-hop-fraction")).toHaveTextContent(
      /partial — launch never upgrades certainty/i
    );
    expect(screen.getByText("motion APT")).toBeInTheDocument();
    expect(
      screen.getByText("Partially measured hypothesis")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/evidence-backed path breakers: Remove the public trust/i)
    ).toBeInTheDocument();
    const measureLinks = screen.getAllByRole("link", {
      name: /Measure path hops/i
    });
    // Expanded finding deep-link to its path hop board (header strip also links).
    const pathMeasure = measureLinks.find((el) =>
      (el.getAttribute("href") ?? "").includes("#hop-measurement")
    );
    expect(pathMeasure).toBeTruthy();
    expect(pathMeasure).toHaveAttribute(
      "href",
      `/attack-paths/${findingId}#hop-measurement`
    );
    expect(screen.queryByText(/Leading min-cut/i)).not.toBeInTheDocument();
  });

  it("never displays raw Validated validation state for path-linked partial measurement [UX-W11]", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Expand finding: Public workload identity reaches production/i
      })
    );

    const claimSafeState = await screen.findByTestId(
      "finding-claim-safe-validation-state"
    );
    // Recorded fixture validationState is Validated, but pathProof is partial —
    // claim-safe projection must show Discovered, never raw Validated certainty.
    expect(claimSafeState).toHaveTextContent("Discovered");
    expect(claimSafeState).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/claim-safe/i)
    );
    expect(claimSafeState).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/remapped from recorded Validated/i)
    );
    expect(screen.getByTestId("finding-claim-safe-remap-note")).toHaveTextContent(
      /claim-safe remap/i
    );
    expect(screen.getByTestId("finding-path-claim-label")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/claim-safe/i)
    );
    // Workflow status Validated may still appear (attention tone) — that is
    // not path certainty. Raw path certainty Validated must not be the claim-safe badge.
    expect(claimSafeState).not.toHaveTextContent("Validated");
  });

  it("collapsed row shows claim-safe Discovered, not Validated from Critical severity", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    const row = await screen.findByTestId(`finding-row-${findingId}`);
    const claimSafe = within(row).getByTestId(
      `finding-row-claim-safe-${findingId}`
    );
    expect(claimSafe).toHaveTextContent("Discovered");
    expect(claimSafe).not.toHaveTextContent("Validated");
    expect(row.textContent).not.toMatch(/Validated high-impact path/i);
  });

  it("reveals governed accepted-risk fields in the bulk workflow", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    const selection = await screen.findByLabelText(
      "Select Public workload identity reaches production"
    );
    fireEvent.click(selection);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bulk disposition"), {
      target: { value: "AcceptedRisk" }
    });

    expect(screen.getByLabelText("Risk owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Expires")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Requests remain pending until a different tenant member approves them."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    // P06-3: Escalated/Acknowledged also expose optional queue owner (not risk-only).
    fireEvent.change(screen.getByLabelText("Bulk disposition"), {
      target: { value: "Escalated" }
    });
    expect(screen.getByLabelText("Queue owner (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Expires")).not.toBeInTheDocument();
  });

  it("offers optional suppress revisit date in bulk and single disposition (P18-9)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    // Single-row disposition control (expand before bulk selection).
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );
    expect(await screen.findByText("Analyst disposition")).toBeInTheDocument();
    const dispositionSelect = screen.getByRole("combobox", {
      name: "Disposition"
    });
    fireEvent.change(dispositionSelect, { target: { value: "Suppressed" } });
    expect(screen.getByLabelText("Suppress revisit date")).toBeInTheDocument();
    expect(
      screen.getByText(/Optional revisit date snoozes noise/i)
    ).toBeInTheDocument();

    // Bulk disposition control for selected rows.
    fireEvent.click(
      screen.getByLabelText(
        "Select Public workload identity reaches production"
      )
    );
    fireEvent.change(screen.getByLabelText("Bulk disposition"), {
      target: { value: "Suppressed" }
    });
    expect(
      screen.getAllByLabelText("Suppress revisit date").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Optional revisit clears the suppress/i)
    ).toBeInTheDocument();
    // Reason required; revisit optional — Apply stays disabled without reason.
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("surfaces disposition-feedback strip with Blue shift even when totals are zero", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    const strip = await screen.findByRole("status", {
      name: "Disposition feedback summary"
    });
    expect(strip).toHaveTextContent(/FP 0 · Suppressed 0/);
    expect(strip).toHaveTextContent(/No FP\/Suppressed reason codes yet/i);
    expect(
      screen.getByRole("link", { name: /Blue shift/i })
    ).toHaveAttribute("href", "/shift");
  });

  it("surfaces disposition-feedback summary when FP/Suppressed feedback exists", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings/disposition-feedback") {
        return {
          json: async () => ({
            generatedAt: timestamp,
            totalFalsePositive: 2,
            totalSuppressed: 1,
            byReason: [
              { reasonCode: "ToolNoise", count: 2 },
              { reasonCode: "OutOfScope", count: 1 }
            ],
            byFingerprint: [],
            bySource: []
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    expect(
      await screen.findByRole("status", {
        name: "Disposition feedback summary"
      })
    ).toHaveTextContent(/FP 2 · Suppressed 1/);
    expect(screen.getByText(/ToolNoise ×2/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Blue shift/i })
    ).toHaveAttribute("href", "/shift");
  });

  it("requires reasonCode for FalsePositive single and bulk after B6", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );
    const dispositionSelect = await screen.findByRole("combobox", {
      name: "Disposition"
    });
    fireEvent.change(dispositionSelect, {
      target: { value: "FalsePositive" }
    });
    expect(
      screen.getByRole("combobox", { name: "Disposition reason code" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(
        "Select Public workload identity reaches production"
      )
    );
    fireEvent.change(screen.getByLabelText("Bulk disposition"), {
      target: { value: "FalsePositive" }
    });
    expect(
      screen.getByRole("combobox", {
        name: "Bulk disposition reason code"
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("announces bulk disposition success via role=status (UX-W3)", async () => {
    const transitioned = {
      ...finding,
      disposition: {
        approvalState: "NotRequired" as const,
        approvedAt: null,
        approvedBy: null,
        disposition: "Escalated" as const,
        expiresAt: null,
        note: null,
        ownerId: null,
        updatedAt: timestamp,
        updatedBy: userId
      }
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const route = url.split("?")[0] ?? "";
      if (route.includes("/transition") && (init?.method ?? "GET") === "POST") {
        return {
          json: async () => transitioned,
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByLabelText(
        "Select Public workload identity reaches production"
      )
    );
    fireEvent.change(screen.getByLabelText("Bulk disposition"), {
      target: { value: "Escalated" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(
      await screen.findByText("Applied Escalated to 1 finding.")
    ).toHaveAttribute("role", "status");
  });

  it("shows data-age honesty on the findings board (UX-W3)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<FindingsWorkbench />);
    await screen.findByText("Public workload identity reaches production");
    // LiveUpdatePill uses "Polled …" (not "Live" / not SIEM real-time) for ICP honesty.
    await waitFor(() => {
      const ages = screen.getAllByRole("status").filter((el) =>
        /Polled|Updated|waiting for data|refreshing/i.test(el.textContent ?? "")
      );
      expect(ages.length).toBeGreaterThan(0);
      expect(ages[0]).toHaveTextContent(/Polled/i);
      expect(ages[0]).not.toHaveTextContent(/^Live\b/i);
    });
  });

  it("exposes My queue saved view for the signed-in assignee", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    expect(
      await screen.findByRole("button", { name: "My queue" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My queue" }));

    await waitFor(() => {
      expect(window.location.search).toContain("view=my-queue");
    });
  });

  it("caps the rendered queue and pages through the remaining findings", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const route = url.split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        const offset = Number(/(?:\?|&)offset=(\d+)/.exec(url)?.[1] ?? "0");
        const pageItems = Array.from({ length: 50 }, (_, index) => {
          const n = offset + index + 1;
          return {
            ...finding,
            findingId: `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`,
            priorityScore: 100 - (n % 50),
            title: `Finding ${String(n).padStart(2, "0")}`
          };
        });
        return {
          json: async () => ({
            items: pageItems,
            page: {
              hasMore: offset === 0,
              limit: 50,
              offset
            }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    await screen.findByText("Finding 01");
    expect(screen.getByText(/Showing 1–50 of many\+/i)).toBeInTheDocument();
    expect(screen.queryByText("Finding 51")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(screen.getByText("Finding 51")).toBeInTheDocument()
    );
    expect(screen.queryByText("Finding 01")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 51–100/i)).toBeInTheDocument();
  });

  it("renders dual-pane findings workspace when a finding is selected (UX-W14 / ICP-P1-2)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    expect(screen.queryByTestId("findings-dual-pane")).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );

    const dualPane = await screen.findByTestId("findings-dual-pane");
    expect(dualPane).toBeInTheDocument();
    expect(screen.getByTestId("findings-detail-pane")).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Public workload identity reaches production"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Selected finding")).toBeInTheDocument();
    expect(screen.getByText("Analyst disposition")).toBeInTheDocument();
    // Thumb-first sticky disposition wrapper when dual-pane is open (phone lg-off).
    expect(
      screen.getByTestId("findings-mobile-disposition-sticky")
    ).toBeInTheDocument();
    // Detail pane holds disposition + path links + evidence.
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("First seen")).toBeInTheDocument();
    expect(screen.getByText("Last seen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByTestId("findings-dual-pane")).not.toBeInTheDocument();
    });
  });

  it("dual-pane keyboard: ArrowDown/Up move selection and Escape clears (ICP 5.0)", async () => {
    const findingB = {
      ...finding,
      findingId: "55555555-5555-4555-8555-555555555500",
      title: "Secondary identity lateral path",
      priorityScore: 80
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            // Sorted client-side by priority desc: finding (96) then findingB (80)
            items: [finding, findingB],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );
    const dualPane = await screen.findByTestId("findings-dual-pane");
    expect(dualPane).toBeInTheDocument();
    expect(dualPane).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowDown Escape"
    );
    expect(
      screen.getByRole("region", {
        name: "Public workload identity reaches production"
      })
    ).toHaveAttribute("aria-keyshortcuts", "ArrowUp ArrowDown Escape");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() => {
      expect(
        screen.getByRole("region", {
          name: "Secondary identity lateral path"
        })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", {
        name: "Expand finding: Secondary identity lateral path"
      })
    ).toHaveAttribute("data-selected", "true");

    fireEvent.keyDown(window, { key: "ArrowUp" });
    await waitFor(() => {
      expect(
        screen.getByRole("region", {
          name: "Public workload identity reaches production"
        })
      ).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("findings-dual-pane")).not.toBeInTheDocument();
    });
  });

  it("offers mute fingerprint default-on for FP/Suppressed and sends applyToFingerprint (ICP-P1-1)", async () => {
    const transitionBodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const route = url.split("?")[0] ?? "";
      if (route.includes("/transition") && (init?.method ?? "GET") === "POST") {
        transitionBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return {
          json: async () => ({
            ...finding,
            disposition: {
              approvalState: "NotRequired" as const,
              approvedAt: null,
              approvedBy: null,
              disposition: "FalsePositive" as const,
              expiresAt: null,
              note: "[ToolNoise]",
              ownerId: null,
              updatedAt: timestamp,
              updatedBy: userId,
              inheritedFromFingerprint: false,
              fingerprint
            }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );

    const dispositionSelect = await screen.findByRole("combobox", {
      name: "Disposition"
    });
    fireEvent.change(dispositionSelect, {
      target: { value: "FalsePositive" }
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Disposition reason code" }),
      { target: { value: "ToolNoise" } }
    );

    const mute = screen.getByTestId("mute-fingerprint-checkbox");
    expect(mute).toBeChecked();
    expect(
      screen.getByLabelText("Mute fingerprint (default on)")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(transitionBodies.length).toBeGreaterThanOrEqual(1);
    });
    expect(transitionBodies[0]).toMatchObject({
      disposition: "FalsePositive",
      reasonCode: "ToolNoise",
      applyToFingerprint: true
    });
    expect(
      await screen.findByTestId("disposition-save-status")
    ).toHaveTextContent(/Disposition saved: False positive/i);
    expect(screen.getByTestId("disposition-save-status")).toHaveTextContent(
      /Fingerprint muted/i
    );
    expect(screen.getByTestId("disposition-save-status")).toHaveAttribute(
      "role",
      "status"
    );

    // Opt out and re-save.
    fireEvent.change(dispositionSelect, {
      target: { value: "Suppressed" }
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Disposition reason code" }),
      { target: { value: "Lab" } }
    );
    fireEvent.click(mute);
    expect(mute).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(transitionBodies.length).toBeGreaterThanOrEqual(2);
    });
    expect(transitionBodies.at(-1)).toMatchObject({
      disposition: "Suppressed",
      reasonCode: "Lab",
      applyToFingerprint: false
    });
  });

  it("shows Muted via fingerprint badge when disposition is inherited (ICP-P1-1)", async () => {
    const inherited = {
      ...finding,
      disposition: {
        approvalState: "NotRequired" as const,
        approvedAt: null,
        approvedBy: null,
        disposition: "FalsePositive" as const,
        expiresAt: null,
        note: "[ToolNoise]",
        ownerId: null,
        updatedAt: timestamp,
        updatedBy: userId,
        inheritedFromFingerprint: true,
        fingerprint
      }
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [inherited],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    expect(
      await screen.findByTestId(`finding-muted-via-fp-${findingId}`)
    ).toHaveTextContent(/Muted via fingerprint/i);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );

    expect(
      await screen.findByTestId("disposition-muted-via-fingerprint")
    ).toBeInTheDocument();
    expect(screen.getByTestId("disposition-inherited-note")).toHaveTextContent(
      /inherited from a fingerprint mute/i
    );
  });

  it("makes severity chips filter and select matching (ICP-P2-2)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    // Row surfaces occurrence window when first/last seen are present.
    const seen = screen.getByTestId(`finding-seen-${findingId}`);
    expect(seen).toBeInTheDocument();
    expect(seen.getAttribute("title")).toMatch(/first 2026-07-01/);
    expect(seen.getAttribute("title")).toMatch(/last 2026-07-14/);

    const chip = screen.getByTestId("findings-severity-chip-Critical");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByTestId("findings-select-matching-severity")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("findings-select-matching-severity"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("bulk FP disposition includes mute fingerprint checkbox (ICP-P1-1)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByLabelText(
        "Select Public workload identity reaches production"
      )
    );
    fireEvent.change(screen.getByLabelText("Bulk disposition"), {
      target: { value: "FalsePositive" }
    });
    const bulkMute = screen.getByTestId("bulk-mute-fingerprint");
    expect(bulkMute).toBeChecked();
    expect(
      screen.getByText(/Fingerprint mute applies the same disposition/i)
    ).toBeInTheDocument();
  });

  it("filters the operator queue to new, un-dispositioned findings", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    fireEvent.change(screen.getByLabelText("Disposition"), {
      target: { value: "none" }
    });

    expect(
      await screen.findByText("Public workload identity reaches production")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Accepted exposure retained for governance")
    ).not.toBeInTheDocument();
  });

  it("routes a path-backed finding into an owned remediation SLA", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Public workload identity reaches production/
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Route to remediation" })
    );

    expect(screen.getByLabelText("Owner")).toHaveValue("Risk Owner");
    expect(screen.getByLabelText("Target SLA")).toHaveValue("14");
    expect(
      screen.getByRole("button", { name: "Create remediation task" })
    ).toBeEnabled();
    // Single related path: no path picker (P14-17 multi-path only).
    expect(
      screen.queryByLabelText("Select attack path for remediation")
    ).not.toBeInTheDocument();
  });

  it("exposes a path picker when multiple related paths exist (P14-17)", async () => {
    const pathA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const pathB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const multiPathFinding = {
      ...finding,
      relatedPathIds: [pathA, pathB]
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/findings") {
          return new Response(
            JSON.stringify({
              items: [multiPathFinding],
              page: { hasMore: false, limit: 50, offset: 0 }
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200
            }
          );
        }
        return mockFetch()(input);
      }) as unknown as typeof fetch
    );

    render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Public workload identity reaches production/
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Route to remediation" })
    );
    const pathPicker = screen.getByLabelText(
      "Select attack path for remediation"
    );
    expect(pathPicker).toBeInTheDocument();
    expect(pathPicker).toHaveValue(pathA);
    fireEvent.change(pathPicker, { target: { value: pathB } });
    expect(pathPicker).toHaveValue(pathB);
    expect(
      screen.getByRole("button", { name: "Create remediation task" })
    ).toBeEnabled();
  });

  it("shows the numeric priority formula and factor contributions", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Public workload identity reaches production/
      })
    );

    expect(
      screen.getByRole("region", { name: "Priority 96 scoring factors" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Priority = clamp(sum of atomic path-risk contributions, 0, 100)."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recorded contribution sum: 96 · displayed priority: 96")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Validation state contribution +24")
    ).toBeInTheDocument();
  });

  it("defaults to Active and hides FalsePositive / Suppressed noise", async () => {
    const falsePositiveId = "66666666-6666-4666-8666-666666666666";
    const suppressedId = "77777777-7777-4777-8777-777777777777";
    const falsePositive = {
      ...finding,
      findingId: falsePositiveId,
      title: "Noise false positive finding",
      priorityScore: 90,
      disposition: {
        disposition: "FalsePositive" as const,
        note: "tool noise",
        ownerId: null,
        expiresAt: null,
        approvalState: "NotRequired" as const,
        approvedAt: null,
        approvedBy: null,
        updatedAt: timestamp,
        updatedBy: userId
      }
    };
    const suppressed = {
      ...finding,
      findingId: suppressedId,
      title: "Suppressed lab finding",
      priorityScore: 88,
      disposition: {
        disposition: "Suppressed" as const,
        note: "lab only",
        ownerId: null,
        expiresAt: null,
        approvalState: "NotRequired" as const,
        approvedAt: null,
        approvedBy: null,
        updatedAt: timestamp,
        updatedBy: userId
      }
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const route = url.split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        const params = new URL(url, "http://localhost").searchParams;
        const exclude = new Set(
          (params.get("excludeDisposition") ?? "")
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        );
        const items = [finding, falsePositive, suppressed].filter((item) => {
          const disposition = item.disposition?.disposition;
          return !disposition || !exclude.has(disposition);
        });
        return {
          json: async () => ({ items }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    expect(
      screen.getByLabelText("Search findings by title, impact, or remediation")
        .className
    ).toMatch(/focus-visible:ring-2/);
    expect(screen.getByLabelText("Filter by Severity").className).toMatch(
      /focus-visible:ring-2/
    );
    const activeChip = screen.getByTestId("findings-view-active");
    expect(activeChip).toHaveAttribute("aria-pressed", "true");
    expect(activeChip).toHaveAttribute("data-selected", "true");
    // Selected state must be visually distinct (brand fill + semibold), not
    // a near-invisible 10% tint against navy (UX-W12).
    expect(activeChip.className).toMatch(
      /bg-brand\/25|font-semibold|text-brand/
    );
    expect(
      screen.getByRole("button", { name: "All" })
    ).toHaveAttribute("aria-pressed", "false");
    // UX-W6 / punch 135: Active default is clear in the filter chrome.
    expect(screen.getByTestId("findings-active-filter-note")).toHaveTextContent(
      /False positive and Suppressed/i
    );
    expect(
      screen.queryByText("Noise false positive finding")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Suppressed lab finding")
    ).not.toBeInTheDocument();

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]: [RequestInfo | URL]) => String(request))
        .filter((value: string) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some(
          (value: string) =>
            value.includes("excludeDisposition=FalsePositive%2CSuppressed") ||
            value.includes("excludeDisposition=FalsePositive,Suppressed")
        )
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(
      await screen.findByText("Noise false positive finding")
    ).toBeInTheDocument();
    expect(screen.getByText("Suppressed lab finding")).toBeInTheDocument();

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]: [RequestInfo | URL]) => String(request))
        .filter((value: string) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some(
          (value: string) =>
            value.includes("/api/v1/findings") &&
            !value.includes("excludeDisposition=")
        )
      ).toBe(true);
    });
  });

  it("forwards missionId from the URL and shows the Community mission chip", async () => {
    const missionId = "22222222-2222-4222-8222-222222222222";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [finding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    window.history.replaceState(
      null,
      "",
      `/findings?missionId=${missionId}`
    );

    render(<FindingsWorkbench />);

    expect(
      await screen.findByTestId("findings-community-mission-chip")
    ).toHaveTextContent("This Community mission");

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]: [RequestInfo | URL]) => String(request))
        .filter((value: string) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some((value: string) =>
          value.includes(`missionId=${missionId}`)
        )
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(window.location.search).toContain(`missionId=${missionId}`);
    });
  });

  it("P3-MISSIONLAND: client navigation from Home CTA keeps missionId and shows the Community-mission chip", async () => {
    const missionId = "e135b27b-272c-4c6c-ad92-b060c2e7991e";
    vi.stubGlobal("fetch", mockFetch());

    const hrefs: string[] = [];
    const nativeReplace = window.history.replaceState.bind(window.history);
    vi.spyOn(window.history, "replaceState").mockImplementation(
      (state, title, url) => {
        if (typeof url === "string") {
          hrefs.push(url);
        }
        return nativeReplace(state, title, url);
      }
    );

    // Client nav can mount /findings (Active defaults) before Next applies the
    // Home Review findings href, then replaceState from filter state.
    window.history.replaceState(null, "", "/findings");
    render(<FindingsWorkbench />);
    await screen.findByText("Public workload identity reaches production");
    hrefs.length = 0;

    window.history.replaceState(
      null,
      "",
      `/findings?missionId=${missionId}`
    );
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(
      await screen.findByTestId("findings-community-mission-chip")
    ).toHaveTextContent("This Community mission");
    expect(window.location.pathname).toBe("/findings");
    expect(window.location.search).toContain(`missionId=${missionId}`);
    expect(
      hrefs.filter(
        (href) => href.includes("/findings") && !href.includes("missionId=")
      )
    ).toEqual([]);
  });

  it("passes disposition and status filters to listFindings", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [finding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);
    await screen.findByText("Public workload identity reaches production");

    fireEvent.change(screen.getByLabelText("Disposition"), {
      target: { value: "none" }
    });

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]: [RequestInfo | URL]) => String(request))
        .filter((value: string) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some((value: string) =>
          value.includes("disposition=none")
        )
      ).toBe(true);
    });

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "Validated" }
    });

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]: [RequestInfo | URL]) => String(request))
        .filter((value: string) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some(
          (value: string) =>
            value.includes("disposition=none") &&
            value.includes("status=Validated")
        )
      ).toBe(true);
    });
  });

  it("advances server offset while page.hasMore is true", async () => {
    const pageOne = {
      ...finding,
      findingId: "44444444-4444-4444-8444-444444444441",
      title: "First page finding"
    };
    const pageTwo = {
      ...finding,
      findingId: "44444444-4444-4444-8444-444444444442",
      title: "Second page finding"
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const route = url.split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        const offset = /(?:\?|&)offset=(\d+)/.exec(url)?.[1] ?? "0";
        if (offset === "0") {
          return {
            json: async () => ({
              items: [pageOne],
              page: { hasMore: true, limit: 50, offset: 0 }
            }),
            ok: true,
            status: 200
          };
        }
        return {
          json: async () => ({
            items: [pageTwo],
            page: { hasMore: false, limit: 50, offset: 50 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);
    await screen.findByText("First page finding");
    expect(screen.getByText(/Showing 1–1 of many\+/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Second page finding");
    expect(screen.queryByText("First page finding")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 51–51/i)).toBeInTheDocument();

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]: [RequestInfo | URL]) => String(request))
        .filter((value: string) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some((value: string) => value.includes("offset=50"))
      ).toBe(true);
    });
  });

  it("surfaces occurrence count, short fingerprint, and root-cause summary", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    // UX-W6 / punch 134: mono-truncated fingerprint + occurrence when fields exist.
    expect(
      screen.getByTestId(`finding-occurrence-${findingId}`)
    ).toHaveTextContent("×3");
    const fp = screen.getByTestId(`finding-fingerprint-${findingId}`);
    expect(fp).toHaveTextContent(/^fp·a1b2c3d4e5f6$/);
    expect(fp).toHaveClass("font-mono");
    expect(fp).toHaveAttribute("title", fingerprint);
    expect(
      screen.getByText("Public workload identity trusts production role.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Public workload identity reaches production/
      })
    );
    expect(screen.getByText("Group identity")).toBeInTheDocument();
    expect(screen.getByText("Occurrences")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("treats Priority · unowned via finding.ownerId/ownerDisplay, not disposition.ownerId", async () => {
    const ownedByRemediationId = "88888888-8888-4888-8888-888888888888";
    const acceptedRiskOnlyId = "99999999-9999-4999-8999-999999999999";
    const trulyUnownedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const falsePositiveId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const route = url.split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        const params = new URL(url, "http://localhost").searchParams;
        const exclude = new Set(
          (params.get("excludeDisposition") ?? "")
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        );
        const owner = params.get("owner");
        const priorityMin = Number(params.get("priorityMin") ?? "0");
        const items = [
          {
            ...finding,
            findingId: ownedByRemediationId,
            title: "High priority with remediation owner",
            priorityScore: 95,
            ownerDisplay: "Security engineering",
            disposition: null
          },
          {
            ...finding,
            findingId: acceptedRiskOnlyId,
            title: "High priority accepted-risk disposition owner only",
            priorityScore: 92,
            // disposition.ownerId alone must NOT hide from unowned
            disposition: {
              disposition: "AcceptedRisk" as const,
              note: "temp",
              ownerId: userId,
              expiresAt: "2026-12-31T23:59:59.000Z",
              approvalState: "Pending" as const,
              approvedAt: null,
              approvedBy: null,
              updatedAt: timestamp,
              updatedBy: userId
            }
          },
          {
            ...finding,
            findingId: trulyUnownedId,
            title: "High priority truly unowned",
            priorityScore: 91,
            disposition: null
          },
          {
            ...finding,
            findingId: falsePositiveId,
            title: "High priority false positive unowned noise",
            priorityScore: 99,
            disposition: {
              disposition: "FalsePositive" as const,
              note: "noise",
              ownerId: null,
              expiresAt: null,
              approvalState: "NotRequired" as const,
              approvedAt: null,
              approvedBy: null,
              updatedAt: timestamp,
              updatedBy: userId
            }
          }
        ].filter((item) => {
          if (item.priorityScore < priorityMin) return false;
          const disposition = item.disposition?.disposition;
          if (disposition && exclude.has(disposition)) return false;
          if (owner === "unassigned") {
            if (item.ownerId || item.ownerDisplay?.trim()) return false;
          }
          return true;
        });
        return {
          json: async () => ({ items }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<FindingsWorkbench />);

    await screen.findByRole("button", { name: "Priority · unowned" });
    fireEvent.click(screen.getByRole("button", { name: "Priority · unowned" }));

    expect(
      await screen.findAllByText("High priority truly unowned")
    ).not.toHaveLength(0);
    // AcceptedRisk disposition.ownerId alone does not count as operational ownership.
    expect(
      screen.getAllByText(
        "High priority accepted-risk disposition owner only"
      ).length
    ).toBeGreaterThan(0);
    // Remediation-projected ownerDisplay removes the row from unowned.
    expect(
      screen.queryByText("High priority with remediation owner")
    ).not.toBeInTheDocument();
    // Operational priority queue excludes FP noise.
    expect(
      screen.queryByText("High priority false positive unowned noise")
    ).not.toBeInTheDocument();

    await waitFor(() => {
      const findingsCalls = fetchMock.mock.calls
        .map(([request]) => String(request))
        .filter((value) => value.includes("/api/v1/findings"));
      expect(
        findingsCalls.some(
          (value) =>
            value.includes("owner=unassigned") &&
            value.includes("priorityMin=70") &&
            (value.includes("excludeDisposition=FalsePositive%2CSuppressed") ||
              value.includes("excludeDisposition=FalsePositive,Suppressed"))
        )
      ).toBe(true);
    });
  });

  it("offers evidence-backed SARIF export that is not a certification or pentest", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    const exportSarif = screen.getByRole("button", {
      name: "Export SARIF (evidence-backed)"
    });
    expect(exportSarif).toBeEnabled();
    expect(screen.getByTestId("findings-sarif-honesty")).toHaveTextContent(
      /not a certification or pentest/i
    );
    expect(exportSarif).toHaveAttribute(
      "aria-describedby",
      "findings-sarif-honesty"
    );
    const search = screen.getByLabelText(
      "Search findings by title, impact, or remediation"
    );
    expect(search.className).toMatch(/focus-visible:ring-2/);
  });

  it("downloads GET /api/v1/findings.sarif without inventing a missionId", async () => {
    const sarifBody = JSON.stringify({ version: "2.1.0", runs: [] });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings.sarif") {
        return {
          headers: new Headers({
            "content-type": "application/sarif+json"
          }),
          ok: true,
          status: 200,
          text: async () => sarifBody
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-sarif");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    let downloadedName = "";
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    try {
      render(<FindingsWorkbench />);
      await screen.findByText("Public workload identity reaches production");
      fireEvent.click(
        screen.getByRole("button", { name: "Export SARIF (evidence-backed)" })
      );

      await waitFor(() => {
        expect(createObjectURL).toHaveBeenCalled();
      });
      const sarifCalls = fetchMock.mock.calls
        .map(([request]) => String(request))
        .filter((value) => value.split("?")[0] === "/api/v1/findings.sarif");
      expect(sarifCalls).toEqual(["/api/v1/findings.sarif"]);
      expect(downloadedName).toMatch(
        /^periscan-findings-\d{4}-\d{2}-\d{2}\.sarif$/
      );
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("forwards URL missionId on SARIF export when the queue has findings", async () => {
    const missionId = "22222222-2222-4222-8222-222222222222";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [finding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      if (route === "/api/v1/findings.sarif") {
        return {
          headers: new Headers({
            "content-type": "application/sarif+json"
          }),
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ version: "2.1.0", runs: [] })
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    window.history.replaceState(null, "", `/findings?missionId=${missionId}`);

    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-sarif");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      render(<FindingsWorkbench />);
      await screen.findByText("Public workload identity reaches production");
      const exportSarif = screen.getByRole("button", {
        name: "Export SARIF (evidence-backed)"
      });
      expect(exportSarif).toBeEnabled();
      fireEvent.click(exportSarif);

      await waitFor(() => {
        expect(createObjectURL).toHaveBeenCalled();
      });
      expect(
        fetchMock.mock.calls.some(
          ([request]) =>
            String(request) === `/api/v1/findings.sarif?missionId=${missionId}`
        )
      ).toBe(true);
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("announces SARIF export failures without claiming a download", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings.sarif") {
        return {
          json: async () => ({ error: "Unable to export findings SARIF" }),
          ok: false,
          status: 500
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const createObjectURL = vi.spyOn(URL, "createObjectURL");

    try {
      render(<FindingsWorkbench />);
      await screen.findByText("Public workload identity reaches production");
      fireEvent.click(
        screen.getByRole("button", { name: "Export SARIF (evidence-backed)" })
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Unable to export findings SARIF/i
      );
      expect(createObjectURL).not.toHaveBeenCalled();
    } finally {
      createObjectURL.mockRestore();
    }
  });

  it("shows leaked.js path and rule on the finding row, not only fingerprint (AppSec ICP P1)", async () => {
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      sourceEntityType: "Exposure" as const,
      sourceMotion: "EXV" as const,
      relatedPathIds: [],
      pathProof: null,
      location: "leaked.js",
      ruleId: "slack-app-token",
      impact: "Exposure validation observed SecretExposure.",
      rootCauseSummary:
        "Exposure / SecretExposure from Gitleaks (gitleaks.repo_secrets.scan); no linked assets.",
      status: "Validated" as const,
      validationState: "Validated" as const
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    const location = await screen.findByTestId(
      `finding-location-${gitleaksFinding.findingId}`
    );
    expect(location).toHaveTextContent("leaked.js");
    const rule = screen.getByTestId(
      `finding-rule-${gitleaksFinding.findingId}`
    );
    expect(rule).toHaveTextContent("slack-app-token");
    expect(
      screen.getByRole("button", {
        name: /Expand finding: leaked\.js · slack-app-token/i
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("EXV SecretExposure")).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`finding-fingerprint-${gitleaksFinding.findingId}`)
    ).toBeInTheDocument();
    const workbench = screen.getByTestId("findings-workbench");
    expect(workbench.textContent).not.toMatch(/tool\.driver/);
    expect(workbench.textContent).not.toMatch(/"RuleID"/);
    expect(workbench.textContent).not.toMatch(/xoxb-/);
    expect(
      screen.getByRole("button", {
        name: /Expand finding: leaked\.js · slack-app-token/i
      })
    ).not.toHaveTextContent(/^Fixed$/);
  });

  it("opens path, rule, and evidence in the detail pane when the finding row or title is clicked (AppSec ICP P1)", async () => {
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      sourceEntityType: "Exposure" as const,
      sourceMotion: "EXV" as const,
      relatedPathIds: [],
      pathProof: null,
      location: "leaked.js",
      ruleId: "slack-app-token",
      impact: "Exposure validation observed SecretExposure.",
      rootCauseSummary:
        "Exposure / SecretExposure from Gitleaks (gitleaks.repo_secrets.scan); no linked assets.",
      status: "Validated" as const,
      validationState: "Validated" as const
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    const title = await screen.findByText("leaked.js · slack-app-token");
    const row = title.closest("li");
    expect(row).not.toBeNull();
    expect(screen.queryByTestId("findings-detail-pane")).not.toBeInTheDocument();

    // ICP miss: the listitem chrome (not only the inner expand button) opens detail.
    fireEvent.click(row as HTMLElement);
    const detailFromRow = await screen.findByTestId("findings-detail-pane");
    expect(within(detailFromRow).getByText("leaked.js")).toBeInTheDocument();
    expect(
      within(detailFromRow).getByText("slack-app-token")
    ).toBeInTheDocument();
    expect(within(detailFromRow).getByText("Evidence")).toBeInTheDocument();
    expect(
      within(detailFromRow).getByRole("link", { name: /ev·55555555/i })
    ).toBeInTheDocument();
    expect(detailFromRow.textContent).not.toMatch(/tool\.driver/);
    expect(detailFromRow.textContent).not.toMatch(/"RuleID"/);
    expect(detailFromRow.textContent).not.toMatch(/xoxb-/);
    expect(detailFromRow.textContent).not.toMatch(/^Fixed$/);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByTestId("findings-detail-pane")).not.toBeInTheDocument();
    });

    fireEvent.click(await screen.findByText("leaked.js · slack-app-token"));
    const detailFromTitle = await screen.findByTestId("findings-detail-pane");
    expect(within(detailFromTitle).getByText("leaked.js")).toBeInTheDocument();
    expect(
      within(detailFromTitle).getByText("slack-app-token")
    ).toBeInTheDocument();
    expect(within(detailFromTitle).getByText("Evidence")).toBeInTheDocument();
    expect(screen.queryByText("EXV SecretExposure")).not.toBeInTheDocument();
  });

  it("opens the detail pane when Enter is pressed on the finding listitem (AppSec ICP P1)", async () => {
    const gitleaksFinding = {
      ...finding,
      findingId: "88888888-8888-4888-8888-888888888888",
      title: "EXV SecretExposure",
      source: "gitleaks.repo_secrets.scan",
      sourceEntityType: "Exposure" as const,
      sourceMotion: "EXV" as const,
      relatedPathIds: [],
      pathProof: null,
      location: "leaked.js",
      ruleId: "slack-app-token",
      impact: "Exposure validation observed SecretExposure.",
      rootCauseSummary:
        "Exposure / SecretExposure from Gitleaks (gitleaks.repo_secrets.scan); no linked assets.",
      status: "Validated" as const,
      validationState: "Validated" as const
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    const title = await screen.findByText("leaked.js · slack-app-token");
    const row = title.closest("li");
    expect(row).not.toBeNull();
    (row as HTMLElement).focus();
    fireEvent.keyDown(row as HTMLElement, { key: "Enter" });

    const detail = await screen.findByTestId("findings-detail-pane");
    expect(within(detail).getByText("leaked.js")).toBeInTheDocument();
    expect(within(detail).getByText("slack-app-token")).toBeInTheDocument();
    expect(within(detail).getByText("Evidence")).toBeInTheDocument();
    expect(detail.textContent).not.toMatch(/tool\.driver/);
    expect(detail.textContent).not.toMatch(/^Fixed$/);
  });

  it("P3-HYDRATE: after mount, Community-mission chip and LiveUpdatePill coexist; no Route the smallest fix", async () => {
    const missionId = "adba52fd-420d-4637-a93d-e3fe6b603ea2";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [finding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    window.history.replaceState(
      null,
      "",
      `/findings?missionId=${missionId}`
    );

    render(<FindingsWorkbench />);

    const chip = await screen.findByTestId("findings-community-mission-chip");
    expect(chip).toHaveTextContent("This Community mission");
    const slot = screen.getByTestId("findings-live-update-slot");
    expect(within(slot).getByRole("status")).toHaveTextContent(/Polled/i);
    expect(screen.queryByText(/Route the smallest fix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();
  });
});

describe("P3-HYDRATE findings header meta", () => {
  const missionId = "adba52fd-420d-4637-a93d-e3fe6b603ea2";

  it("does not ready the Community-mission chip before mount even when missionId is set", () => {
    expect(findingsCommunityMissionChipReady(false, missionId)).toBe(false);
    expect(findingsCommunityMissionChipReady(true, null)).toBe(false);
    expect(findingsCommunityMissionChipReady(true, missionId)).toBe(true);
  });

  it("SSR HTML keeps the LiveUpdatePill slot and omits the Community-mission chip", () => {
    const html = renderToString(
      <FindingsHeaderMeta
        missionId={missionId}
        lastUpdatedAt={null}
        refreshing={false}
      />
    );
    expect(html).toContain("findings-live-update-slot");
    expect(html).toContain("Polled");
    expect(html).not.toContain("findings-community-mission-chip");
    expect(html).not.toContain("This Community mission");
  });

  it("after mount paints the Community-mission chip without dropping the pill slot", () => {
    render(
      <FindingsHeaderMeta
        missionId={missionId}
        lastUpdatedAt={null}
        refreshing={false}
      />
    );
    expect(screen.getByTestId("findings-community-mission-chip")).toHaveTextContent(
      "This Community mission"
    );
    const slot = screen.getByTestId("findings-live-update-slot");
    expect(slot.compareDocumentPosition(screen.getByTestId("findings-community-mission-chip"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(within(slot).getByRole("status")).toHaveTextContent(
      "Polled · waiting for data"
    );
  });
});

describe("P3-MISSIONLAND findings URL sync", () => {
  const missionId = "e135b27b-272c-4c6c-ad92-b060c2e7991e";
  const defaults = {
    pathname: "/findings",
    savedView: "active",
    query: "",
    severity: "all",
    status: "all",
    disposition: "all"
  };

  it("keeps Home CTA missionId when filter state has not adopted it yet", () => {
    expect(
      findingsWorkbenchHref({
        ...defaults,
        currentSearch: `?missionId=${missionId}`,
        missionId: null
      })
    ).toBe(`/findings?missionId=${missionId}`);
  });

  it("keeps missionId from state on a clean Active landing", () => {
    expect(
      findingsWorkbenchHref({
        ...defaults,
        currentSearch: `?missionId=${missionId}`,
        missionId
      })
    ).toBe(`/findings?missionId=${missionId}`);
  });

  it("blank mission keeps the tenant /findings queue", () => {
    expect(
      findingsWorkbenchHref({
        ...defaults,
        currentSearch: "",
        missionId: null
      })
    ).toBe("/findings");
  });
});

describe("loop 14 390 Findings filter chips", () => {
  const gitleaksFinding = {
    ...finding,
    findingId: "88888888-8888-4888-8888-888888888888",
    title: "EXV SecretExposure",
    source: "gitleaks.repo_secrets.scan",
    sourceEntityType: "Exposure" as const,
    sourceMotion: "EXV" as const,
    relatedPathIds: [],
    relatedRemediationIds: [],
    pathProof: null,
    location: "leaked.js:2",
    ruleId: "slack-bot-token",
    impact: "Exposure validation observed SecretExposure.",
    rootCauseSummary:
      "Exposure / SecretExposure from Gitleaks (gitleaks.repo_secrets.scan); no linked assets.",
    status: "Validated" as const,
    validationState: "Validated" as const
  };

  beforeEach(() => {
    window.history.replaceState(null, "", "/findings");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/findings");
  });

  it("layout helper: wrap/scroll at 390 does not cover the VALIDATED row", () => {
    expect(FINDINGS_FILTER_CHIPS_390_VIEWPORT).toBe(390);
    expect(findingsFilterChips390ClassName()).toMatch(/findings-filter-chips/);
    expect(findingsFilterChips390ClassName()).toMatch(/overflow-x-auto/);
    expect(findingsFilterChips390ClassName()).toMatch(/min-w-0/);
    expect(findingsFilterChips390RailClassName()).toMatch(/flex-wrap/);
    expect(findingsFilterChips390RailClassName()).toMatch(/overflow-x-auto/);

    const row = { top: 120, right: 370, bottom: 168, left: 16 };
    const chipsBelow = { top: 180, right: 370, bottom: 240, left: 16 };
    const chipsOverlay = { top: 130, right: 370, bottom: 190, left: 16 };
    expect(findingsFilterChipsCoverValidatedRow(chipsBelow, row)).toBe(false);
    expect(findingsFilterChipsCoverValidatedRow(chipsOverlay, row)).toBe(true);

    expect(
      findingsFilterChips390LayoutOk({
        viewportWidth: 390,
        documentOverflowX: false,
        chipsCoverValidatedRow: false,
        chipsWrapOrScroll: true
      })
    ).toBe(true);
    expect(
      findingsFilterChips390LayoutOk({
        viewportWidth: 390,
        documentOverflowX: true,
        chipsCoverValidatedRow: false,
        chipsWrapOrScroll: true
      })
    ).toBe(false);
    expect(
      findingsFilterChips390LayoutOk({
        viewportWidth: 390,
        documentOverflowX: false,
        chipsCoverValidatedRow: true,
        chipsWrapOrScroll: true
      })
    ).toBe(false);
  });

  it("populated first-hour at 390: chips wrap/scroll under More and do not cover leaked.js path·rule", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/findings") {
        return {
          json: async () => ({
            items: [gitleaksFinding],
            page: { hasMore: false, limit: 50, offset: 0 }
          }),
          ok: true,
          status: 200
        };
      }
      return mockFetch()(input);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(<FindingsWorkbench />);

    expect(window.innerWidth).toBe(390);
    const firstHour = await screen.findByTestId("findings-first-hour");
    expect(
      within(firstHour).getByText("leaked.js:2 · slack-bot-token")
    ).toBeInTheDocument();
    expect(within(firstHour).queryByTestId("findings-filter-chips")).toBeNull();
    expect(screen.getAllByTestId("findings-first-hour-primary")).toHaveLength(1);
    expect(screen.queryByText(/Route the smallest fix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/High-danger/i)).not.toBeInTheDocument();

    const more = screen.getByTestId("findings-more-triage");
    expect(more).toHaveClass("order-last");
    fireEvent.click(screen.getByTestId("findings-more-summary"));

    const chips = screen.getByTestId("findings-filter-chips");
    expect(more.contains(chips)).toBe(true);
    expect(firstHour.contains(chips)).toBe(false);
    expect(chips.className).toMatch(/findings-filter-chips/);
    expect(chips.className).toMatch(/overflow-x-auto/);
    expect(chips.querySelector(".findings-filter-chips-rail")).not.toBeNull();
    expect(chips.querySelector(".findings-filter-chips-rail")?.className).toMatch(
      /flex-wrap/
    );
    expect(
      within(chips).getByTestId("findings-severity-chip-Critical")
    ).toBeInTheDocument();
    expect(within(chips).getByTestId("findings-view-active")).toBeInTheDocument();
    expect(within(chips).queryByText("Skip to content")).not.toBeInTheDocument();
    expect(within(chips).queryByText(/^Home$/)).not.toBeInTheDocument();
    expect(
      within(firstHour).getByText("leaked.js:2 · slack-bot-token")
    ).toBeInTheDocument();
    const copyView = within(chips).getByTestId("findings-copy-view-link");
    expect(copyView).toHaveTextContent("Copy view link");
    expect(copyView.className).toMatch(/min-h-6/);
    expect(copyView.className).toMatch(/min-w-6/);
    expect(copyView.className).toMatch(/sm:ml-auto/);
  });
});

describe("WCAG 2.5.8 copy-view-link target size (loop 15 residual)", () => {
  it("treats loop-15 desktop Copy view link 92.2×18 as below 24×24 CSS px", () => {
    expect(WCAG_TARGET_SIZE_MINIMUM_PX).toBe(24);
    expect(targetSizeBelowMinimumPx(92.2, 18)).toBe(true);
    expect(targetSizeBelowMinimumPx(92.2, 24)).toBe(false);
    expect(targetSizeBelowMinimumPx(24, 24)).toBe(false);
    expect(targetSizeBelowMinimumPx(23.9, 24)).toBe(true);
    expect(targetSizeBelowMinimumPx(24, 23.9)).toBe(true);
  });

  it("copy-link control class is at least 24×24 CSS px (min-h-6 min-w-6)", () => {
    const copyView = findingsCopyLinkControlClassName({ alignEndOnSm: true });
    expect(copyView).toMatch(/inline-flex/);
    expect(copyView).toMatch(/min-h-6/);
    expect(copyView).toMatch(/min-w-6/);
    expect(copyView).toMatch(/sm:ml-auto/);
    expect(copyView).not.toMatch(/min-h-4/);
    expect(copyView).not.toMatch(/min-h-5/);

    const sibling = findingsCopyLinkControlClassName();
    expect(sibling).toMatch(/min-h-6/);
    expect(sibling).toMatch(/min-w-6/);
    expect(sibling).not.toMatch(/sm:ml-auto/);
  });

  it("populated findings Copy view link uses the 24×24 copy-link class", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<FindingsWorkbench />);

    await screen.findByText("Public workload identity reaches production");
    fireEvent.click(screen.getByTestId("findings-more-summary"));

    const copyView = screen.getByTestId("findings-copy-view-link");
    expect(copyView).toHaveAttribute("type", "button");
    expect(copyView).toHaveTextContent("Copy view link");
    expect(copyView.className).toBe(
      findingsCopyLinkControlClassName({ alignEndOnSm: true })
    );
    expect(copyView.className).toMatch(/min-h-6/);
    expect(copyView.className).toMatch(/min-w-6/);
    expect(screen.queryByText(/High-danger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("findings-first-hour-primary")).toHaveLength(1);
  });
});
