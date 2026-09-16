import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMMUNITY_EDITION_VALUE_LINE } from "@periscan/shared";

import { MissionDetail } from "./mission-detail";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const missionId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const policyDecisionId = "44444444-4444-4444-8444-444444444444";
const runId = "55555555-5555-4555-8555-555555555555";
const secondRunId = "77777777-7777-4777-8777-777777777777";
const evidenceId = "66666666-6666-4666-8666-666666666666";
const nucleiMissionId = "88888888-8888-4888-8888-888888888888";

function jsonResponse(payload: unknown) {
  return { json: async () => payload, ok: true, status: 200 };
}

function missionPayload(overrides: Record<string, unknown> = {}) {
  return {
    completedAt: timestamp,
    createdAt: timestamp,
    evidenceIds: [evidenceId],
    missionId,
    missionType: "ControlValidation",
    policyDecisionId,
    policyProfile: "enterprise-safe",
    requestedBy: tenantId,
    safetyLevel: "BASLite",
    scopeId,
    scopeIds: [scopeId],
    startedAt: timestamp,
    status: "Completed",
    tenantId,
    updatedAt: timestamp,
    ...overrides
  };
}

function runPayload(overrides: Record<string, unknown> = {}) {
  return {
    completedAt: timestamp,
    createdAt: timestamp,
    errorSummary: null,
    evidenceIds: [evidenceId],
    missionId,
    moduleId: "periscan.dns_resolution_check",
    outcome: "Control telemetry observed and retained.",
    policyDecisionId,
    runId,
    runnerId: null,
    safetyLevel: "BASLite",
    scopeId,
    startedAt: timestamp,
    status: "Completed",
    target: {},
    techniqueIds: ["T1595"],
    tenantId,
    updatedAt: timestamp,
    validationState: "Detected",
    ...overrides
  };
}

function stubMissionDetail(input: {
  companion?: {
    nucleiMissionId: string | null;
    nucleiSkipReason: string | null;
  };
  companionMissions?: Record<string, Record<string, unknown>>;
  companionRuns?: Record<string, Record<string, unknown>[]>;
  mission?: Record<string, unknown>;
  remediations?: {
    createdCount: number;
    remediationIds?: string[];
  };
  remediationsError?: string;
  runs?: Record<string, unknown>[];
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (
        url.endsWith(
          `/api/v1/community/validation-runs/${missionId}/remediations`
        )
      ) {
        if (input.remediationsError) {
          return {
            json: async () => ({ error: input.remediationsError }),
            ok: false,
            status: 400
          };
        }
        const createdCount = input.remediations?.createdCount ?? 0;
        return jsonResponse({
          createdCount,
          missionId,
          remediationIds: input.remediations?.remediationIds ?? []
        });
      }
      if (url.includes("/api/v1/community/validation-runs?missionId=")) {
        return jsonResponse(
          input.companion ?? {
            nucleiMissionId: null,
            nucleiSkipReason: null
          }
        );
      }
      if (url.endsWith(`/api/v1/missions/${missionId}`)) {
        return jsonResponse(missionPayload(input.mission));
      }
      if (url.endsWith(`/api/v1/missions/${missionId}/runs`)) {
        return jsonResponse({ items: input.runs ?? [runPayload()] });
      }
      for (const [id, mission] of Object.entries(
        input.companionMissions ?? {}
      )) {
        if (url.endsWith(`/api/v1/missions/${id}`)) {
          return jsonResponse(missionPayload({ ...mission, missionId: id }));
        }
        if (url.endsWith(`/api/v1/missions/${id}/runs`)) {
          return jsonResponse({ items: input.companionRuns?.[id] ?? [] });
        }
      }
      return {
        json: async () => ({ error: `Unhandled ${url}` }),
        ok: false,
        status: 404
      };
    }) as unknown as typeof fetch
  );
}

describe("MissionDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects authorization, run outcome, ATT&CK context, and evidence", async () => {
    stubMissionDetail({
      runs: [runPayload({ moduleId: "semgrep.code_exploit_scan" })]
    });

    render(<MissionDetail missionId={missionId} />);

    expect(
      await screen.findByRole("heading", { name: "ControlValidation" })
    ).toBeInTheDocument();
    expect(screen.getAllByText(policyDecisionId).length).toBeGreaterThan(0);
    const runs = screen.getByText("Runs (1)").closest("section");
    expect(runs).not.toBeNull();
    expect(within(runs!).getByText("Detected")).toBeInTheDocument();
    expect(within(runs!).getByRole("link", { name: "T1595" })).toHaveAttribute(
      "href",
      "/attack-techniques?technique=T1595"
    );
    expect(
      within(runs!).getByRole("link", { name: "evidence 66666666" })
    ).toHaveAttribute("href", `/evidence?evidenceId=${evidenceId}`);
    expect(
      screen.queryByRole("button", { name: "Cancel mission" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("community-pack-banner")
    ).not.toBeInTheDocument();
  });

  it("names a completed Community pack with module titles, Nuclei second mission, and findings CTA", async () => {
    stubMissionDetail({
      runs: [
        runPayload({
          moduleId: "periscan.dns_resolution_check",
          runId
        }),
        runPayload({
          completedAt: null,
          errorSummary: null,
          evidenceIds: [],
          moduleId: "nuclei.external_exposure_safe",
          outcome: null,
          runId: secondRunId,
          status: "Queued",
          techniqueIds: [],
          validationState: null
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    expect(within(banner).getByText("Community pack")).toBeInTheDocument();
    expect(
      within(banner).getByText(COMMUNITY_EDITION_VALUE_LINE)
    ).toBeInTheDocument();
    expect(within(banner).getByText("DNS resolution")).toBeInTheDocument();
    expect(within(banner).getByText("Completed")).toBeInTheDocument();
    expect(
      within(banner).getByText("Nuclei safe external exposure")
    ).toBeInTheDocument();
    expect(within(banner).getByText("second mission")).toBeInTheDocument();
    expect(within(banner).getByText("Queued")).toBeInTheDocument();
    expect(
      within(banner).getByRole("link", { name: "Review findings" })
    ).toHaveAttribute("href", `/findings?missionId=${missionId}`);

    expect(within(banner).queryByText(/mixed/i)).not.toBeInTheDocument();
  });

  it("says honestly when a mission mixes Community and non-Community runs", async () => {
    stubMissionDetail({
      runs: [
        runPayload({
          moduleId: "gitleaks.repo_secrets",
          runId
        }),
        runPayload({
          moduleId: "caldera.advanced_adversarial",
          runId: secondRunId
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    expect(
      within(banner).getByText(
        "This mission is mixed: Community pack engines ran with modules that are not in the Community suite."
      )
    ).toBeInTheDocument();
    expect(
      within(banner).getByText("Repository secret scan")
    ).toBeInTheDocument();
    expect(
      within(banner).queryByText("caldera.advanced_adversarial")
    ).not.toBeInTheDocument();
  });

  it("shows a reconstructed Nuclei sibling as a second mission with a link", async () => {
    stubMissionDetail({
      companion: {
        nucleiMissionId,
        nucleiSkipReason: null
      },
      companionMissions: {
        [nucleiMissionId]: {
          missionId: nucleiMissionId,
          status: "Running"
        }
      },
      companionRuns: {
        [nucleiMissionId]: [
          runPayload({
            missionId: nucleiMissionId,
            moduleId: "nuclei.external_exposure_safe",
            outcome: null,
            runId: secondRunId,
            status: "Running",
            validationState: null
          })
        ]
      },
      mission: { missionType: "ValidationSnapshot" },
      runs: [
        runPayload({
          moduleId: "periscan.dns_resolution_check",
          runId
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const companion = await screen.findByTestId("community-nuclei-companion");
    expect(
      within(companion).getByText("Nuclei second mission")
    ).toBeInTheDocument();
    expect(
      within(companion).getByText("Nuclei safe external exposure")
    ).toBeInTheDocument();
    expect(within(companion).getAllByText("Running").length).toBeGreaterThan(0);
    expect(
      within(companion).getByRole("link", { name: "Open Nuclei mission" })
    ).toHaveAttribute("href", `/missions/${nucleiMissionId}`);
    expect(within(companion).queryByText(/skip/i)).not.toBeInTheDocument();
  });

  it("does not show a Nuclei sibling on mixed missions", async () => {
    stubMissionDetail({
      companion: {
        nucleiMissionId,
        nucleiSkipReason: null
      },
      runs: [
        runPayload({
          moduleId: "gitleaks.repo_secrets",
          runId
        }),
        runPayload({
          moduleId: "caldera.advanced_adversarial",
          runId: secondRunId
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    expect(
      within(banner).getByText(
        "This mission is mixed: Community pack engines ran with modules that are not in the Community suite."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("community-nuclei-companion")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open Nuclei mission" })
    ).not.toBeInTheDocument();
  });

  it("shows the Failed Community run error summary instead of a findings CTA", async () => {
    stubMissionDetail({
      mission: { status: "Failed" },
      runs: [
        runPayload({
          errorSummary: "ZAP baseline refused the unauthorized host.",
          moduleId: "web.zap_baseline",
          outcome: null,
          status: "Failed",
          validationState: null
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    expect(
      within(banner).getByText("ZAP baseline refused the unauthorized host.")
    ).toBeInTheDocument();
    expect(
      within(banner).queryByRole("link", { name: "Review findings" })
    ).not.toBeInTheDocument();
    expect(
      within(banner).queryByTestId("community-remediations-honesty")
    ).not.toBeInTheDocument();
    expect(within(banner).getByText("ZAP baseline")).toBeInTheDocument();
  });

  it("keeps Community remediations honest: Fixed still requires verification and originating evidence/path is kept when the finding has them", async () => {
    stubMissionDetail({
      remediations: {
        createdCount: 2,
        remediationIds: [
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        ]
      },
      runs: [
        runPayload({
          moduleId: "periscan.dns_resolution_check"
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    const honesty = within(banner).getByTestId("community-remediations-honesty");
    expect(honesty).toHaveTextContent("Fixed still requires a verification event");
    expect(honesty).toHaveTextContent(
      "Community remediations keep originating evidence/path when the finding has them."
    );
    expect(honesty).toHaveTextContent(
      "Findings without relatedPathIds and evidenceIds retest as compare-only and may stay Inconclusive."
    );
    expect(honesty).not.toHaveTextContent(/fingerprint-only/i);
    expect(honesty).not.toHaveTextContent(/already Fixed/i);
    expect(honesty).not.toHaveTextContent(/mark(?:ed)? Fixed/i);

    fireEvent.click(
      within(banner).getByTestId("community-create-remediations")
    );

    const note = await within(banner).findByRole("status");
    expect(note).toHaveTextContent("Opened 2 remediations.");
    expect(note).toHaveTextContent("Fixed still requires a verification event");
    expect(note).toHaveTextContent(
      "Originating evidence/path is kept when the finding has them."
    );
    expect(note).toHaveTextContent(
      "Findings without relatedPathIds and evidenceIds retest as compare-only and may stay Inconclusive."
    );
    expect(note).not.toHaveTextContent(/fingerprint-only/i);
    expect(note).not.toHaveTextContent(/already Fixed/i);
    expect(note).not.toHaveTextContent(/mark(?:ed)? Fixed/i);
  });

  it("says a single Community remediation keeps originating evidence/path and still needs a verification event", async () => {
    stubMissionDetail({
      remediations: {
        createdCount: 1,
        remediationIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
      },
      runs: [
        runPayload({
          moduleId: "periscan.dns_resolution_check"
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    fireEvent.click(
      within(banner).getByTestId("community-create-remediations")
    );

    const note = await within(banner).findByRole("status");
    expect(note).toHaveTextContent("Opened 1 remediation.");
    expect(note).toHaveTextContent("Fixed still requires a verification event");
    expect(note).toHaveTextContent(
      "Originating evidence/path is kept when the finding has them."
    );
    expect(note).toHaveTextContent(
      "Findings without relatedPathIds and evidenceIds retest as compare-only and may stay Inconclusive."
    );
    expect(note).not.toHaveTextContent(/fingerprint-only/i);
    expect(note).not.toHaveTextContent(/already Fixed/i);
  });

  it("does not imply Fixed when Community remediations stay empty", async () => {
    stubMissionDetail({
      remediations: { createdCount: 0, remediationIds: [] },
      runs: [
        runPayload({
          moduleId: "periscan.dns_resolution_check"
        })
      ]
    });

    render(<MissionDetail missionId={missionId} />);

    const banner = await screen.findByTestId("community-pack-banner");
    fireEvent.click(
      within(banner).getByTestId("community-create-remediations")
    );

    const note = await within(banner).findByRole("status");
    expect(note).toHaveTextContent(
      "No Community findings with fingerprints yet — remediations stay empty until evidence exists."
    );
    expect(note).not.toHaveTextContent("Opened");
    expect(note).not.toHaveTextContent(/status = Fixed/i);
    expect(note).not.toHaveTextContent(/already Fixed/i);
    expect(note).not.toHaveTextContent(/fingerprint-only/i);
  });
});
