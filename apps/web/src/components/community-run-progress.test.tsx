import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CommunityValidationStartResult,
  ValidationMission,
  ValidationRun
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  COMMUNITY_RUN_COMPLETED_FIXED_COPY,
  COMMUNITY_RUN_REVIEW_FINDINGS_LABEL,
  CommunityRunProgress,
  communityFindingsHref
} from "./community-run-progress";

const timestamp = "2026-08-15T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const missionId = "22222222-2222-4222-8222-222222222222";
const nucleiMissionId = "33333333-3333-4333-8333-333333333333";
const scopeId = "44444444-4444-4444-8444-444444444444";
const policyDecisionId = "55555555-5555-4555-8555-555555555555";
const runId = "66666666-6666-4666-8666-666666666666";
const nucleiRunId = "77777777-7777-4777-8777-777777777777";
const failedRunId = "88888888-8888-4888-8888-888888888888";

function mission(
  overrides: Partial<ValidationMission> = {}
): ValidationMission {
  return {
    completedAt: null,
    createdAt: timestamp,
    evidenceIds: [],
    missionId,
    missionType: "ValidationSnapshot",
    policyDecisionId,
    policyProfile: "community-safe",
    requestedBy: tenantId,
    safetyLevel: "ActiveNonInvasive",
    scopeId,
    scopeIds: [scopeId],
    startedAt: timestamp,
    status: "Running",
    tenantId,
    updatedAt: timestamp,
    ...overrides
  };
}

function run(overrides: Partial<ValidationRun> = {}): ValidationRun {
  return {
    completedAt: null,
    createdAt: timestamp,
    errorSummary: null,
    evidenceIds: [],
    missionId,
    moduleId: "periscan.dns_resolution_check",
    outcome: null,
    policyDecisionId,
    runId,
    runnerId: null,
    safetyLevel: "ActiveNonInvasive",
    scopeId,
    startedAt: timestamp,
    status: "Queued",
    target: { hostname: "example.com" },
    techniqueIds: [],
    tenantId,
    updatedAt: timestamp,
    validationState: null,
    ...overrides
  };
}

function started(
  overrides: Partial<CommunityValidationStartResult> = {}
): CommunityValidationStartResult {
  return {
    editionId: "community",
    jobsQueued: 2,
    mission: mission({ status: "Queued" }),
    moduleIds: [
      "periscan.dns_resolution_check",
      "periscan.tls_certificate_check"
    ],
    nucleiMissionId: null,
    nucleiSkipReason: null,
    runs: [],
    scopeType: "Domain",
    target: { hostname: "example.com" },
    ...overrides
  };
}

describe("CommunityRunProgress", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists live run status, validation state, and error summary", async () => {
    vi.spyOn(api, "getMission").mockResolvedValue(
      mission({ status: "Running" })
    );
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([
      run({
        moduleId: "periscan.dns_resolution_check",
        status: "Completed",
        validationState: "Reachable"
      }),
      run({
        completedAt: timestamp,
        errorSummary: "TLS handshake timed out",
        moduleId: "periscan.tls_certificate_check",
        runId: failedRunId,
        status: "Failed",
        validationState: "Inconclusive"
      })
    ]);

    render(<CommunityRunProgress communityRun={started()} />);

    const panel = await screen.findByTestId("community-run-progress");
    expect(within(panel).getByText("DNS resolution")).toBeInTheDocument();
    expect(
      within(panel).getByText("TLS certificate check")
    ).toBeInTheDocument();
    expect(within(panel).getByText("Reachable")).toBeInTheDocument();
    expect(within(panel).getByText("Inconclusive")).toBeInTheDocument();
    expect(
      within(panel).getByText("TLS handshake timed out")
    ).toBeInTheDocument();
    expect(
      within(panel).getByText("Running — engines are executing.")
    ).toBeInTheDocument();
  });

  it("links to mission detail and the Findings board", async () => {
    vi.spyOn(api, "getMission").mockResolvedValue(mission());
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([run()]);

    render(<CommunityRunProgress communityRun={started()} />);

    const panel = await screen.findByTestId("community-run-progress");
    expect(
      await within(panel).findByRole("link", { name: "Open mission" })
    ).toHaveAttribute("href", `/missions/${missionId}`);
    expect(
      within(panel).queryByRole("link", {
        name: COMMUNITY_RUN_REVIEW_FINDINGS_LABEL
      })
    ).not.toBeInTheDocument();
  });

  it("shows the module label and elapsed while a Community run is Queued or Running", async () => {
    const nowMs = Date.parse("2026-08-15T12:00:03.000Z");
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    vi.spyOn(api, "getMission").mockResolvedValue(
      mission({ status: "Running" })
    );
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([
      run({
        moduleId: "gitleaks.repo_secrets",
        startedAt: timestamp,
        status: "Running"
      })
    ]);

    render(<CommunityRunProgress communityRun={started()} />);

    const panel = await screen.findByTestId("community-run-progress");
    expect(
      await within(panel).findByText("Repository secret scan")
    ).toBeInTheDocument();
    expect(
      await within(panel).findByTestId("community-run-elapsed")
    ).toHaveTextContent("3s");
    expect(panel).not.toHaveTextContent("%");
    expect(panel).not.toHaveTextContent(/percent complete/i);
  });

  it("stays on the Watch page when Completed and offers Review findings", async () => {
    vi.spyOn(api, "getMission").mockResolvedValue(
      mission({ status: "Completed" })
    );
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([
      run({
        completedAt: timestamp,
        moduleId: "gitleaks.repo_secrets",
        status: "Completed"
      })
    ]);

    render(<CommunityRunProgress communityRun={started()} />);

    const panel = await screen.findByTestId("community-run-progress");
    expect(panel).toBeInTheDocument();
    const review = await within(panel).findByRole("link", {
      name: COMMUNITY_RUN_REVIEW_FINDINGS_LABEL
    });
    expect(review).toHaveAttribute("href", communityFindingsHref(missionId));
    expect(
      within(panel).getByTestId("community-run-completed-honesty")
    ).toHaveTextContent(COMMUNITY_RUN_COMPLETED_FIXED_COPY);
    expect(
      within(panel).queryByRole("link", { name: "Open findings" })
    ).not.toBeInTheDocument();
  });

  it("polls Nuclei as a second run group when a second mission id is present", async () => {
    vi.spyOn(api, "getMission").mockImplementation(async (id) =>
      id === nucleiMissionId
        ? mission({ missionId: nucleiMissionId, status: "Running" })
        : mission({ status: "Completed" })
    );
    vi.spyOn(api, "listMissionRuns").mockImplementation(async (id) =>
      id === nucleiMissionId
        ? [
            run({
              missionId: nucleiMissionId,
              moduleId: "nuclei.external_exposure_safe",
              runId: nucleiRunId,
              status: "Running"
            })
          ]
        : [
            run({
              moduleId: "periscan.dns_resolution_check",
              status: "Completed",
              validationState: "Reachable"
            })
          ]
    );

    render(
      <CommunityRunProgress
        communityRun={started({ nucleiMissionId, nucleiSkipReason: null })}
      />
    );

    const panel = await screen.findByTestId("community-run-progress");
    expect(
      await within(panel).findByText("Community mission")
    ).toBeInTheDocument();
    expect(
      await within(panel).findByText("Nuclei second mission")
    ).toBeInTheDocument();
    expect(
      within(panel).getByText("Nuclei safe external exposure")
    ).toBeInTheDocument();
    expect(api.getMission).toHaveBeenCalledWith(missionId);
    expect(api.getMission).toHaveBeenCalledWith(nucleiMissionId);
    expect(
      within(panel).getByRole("link", { name: "Open Nuclei mission" })
    ).toHaveAttribute("href", `/missions/${nucleiMissionId}`);
  });

  it("keeps the Nuclei skip reason when the second mission did not start", async () => {
    const skipReason =
      "Nuclei External PoA was denied (kill switch, rate, or hostname guard). The rest of the Community pack still queued.";
    vi.spyOn(api, "getMission").mockResolvedValue(
      mission({ status: "Queued" })
    );
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([run()]);

    render(
      <CommunityRunProgress
        communityRun={started({
          nucleiMissionId: null,
          nucleiSkipReason: skipReason
        })}
      />
    );

    const panel = await screen.findByTestId("community-run-progress");
    expect(
      await within(panel).findByTestId("community-run-nuclei-skipped")
    ).toHaveTextContent(skipReason);
    expect(api.getMission).toHaveBeenCalledTimes(1);
    expect(api.getMission).toHaveBeenCalledWith(missionId);
  });

  it("shows a loading skeleton until the live mission arrives", () => {
    vi.spyOn(api, "getMission").mockReturnValue(new Promise(() => undefined));
    vi.spyOn(api, "listMissionRuns").mockReturnValue(
      new Promise(() => undefined)
    );

    render(<CommunityRunProgress communityRun={started()} />);

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("shows an error state when the live mission cannot be read", async () => {
    vi.spyOn(api, "getMission").mockRejectedValue(
      new Error("Unable to read mission")
    );
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([]);

    render(<CommunityRunProgress communityRun={started()} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unable to read mission");
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("shows an empty state when the mission has no run records yet", async () => {
    vi.spyOn(api, "getMission").mockResolvedValue(
      mission({ status: "Queued" })
    );
    vi.spyOn(api, "listMissionRuns").mockResolvedValue([]);

    render(<CommunityRunProgress communityRun={started()} />);

    const panel = await screen.findByTestId("community-run-progress");
    expect(within(panel).getByText("No runs recorded yet")).toBeInTheDocument();
    expect(
      within(panel).getByText(/run records have not appeared/i)
    ).toBeInTheDocument();
  });
});
