import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperatorRecommendation } from "@periscan/operators";

import * as api from "../lib/periscan-api-client";
import { OperatorsWorkbench } from "./operators-workbench";

vi.mock("../lib/periscan-api-client", () => ({
  browserPeriscanApiClient: {
    listOperatorProfiles: vi.fn(),
    listOperatorRecommendations: vi.fn(),
    approveOperatorRecommendation: vi.fn()
  }
}));

const client = api.browserPeriscanApiClient as unknown as {
  listOperatorProfiles: ReturnType<typeof vi.fn>;
  listOperatorRecommendations: ReturnType<typeof vi.fn>;
  approveOperatorRecommendation: ReturnType<typeof vi.fn>;
};

function proposedRecommendation(): OperatorRecommendation {
  return {
    createdAt: new Date().toISOString(),
    evidenceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    missionPlan: {
      approvalRequired: true,
      executionEnvironment: "ControlPlane",
      moduleIds: ["mod.safe"],
      missionType: "ExposureValidation",
      requestedAction: {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: false,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyLevel: "PassiveReadOnly",
      scopeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      target: { kind: "exposure" }
    },
    operatorType: "ExposureOperator",
    proposedActions: ["Revalidate verified scope with passive modules"],
    rationale: "Evidence shows an unmeasured hop on a priority path.",
    recommendationId: "rec-apply-1",
    requiredIntegrations: [],
    status: "Proposed",
    title: "Revalidate priority exposure hop",
    uncertainty: "Medium"
  } as OperatorRecommendation;
}

describe("OperatorsWorkbench apply recommendation journey", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists recommendations and applies to Draft without claiming queue", async () => {
    const rec = proposedRecommendation();
    client.listOperatorProfiles.mockResolvedValue([
      {
        capabilities: ["path_review"],
        defaultSafetyLevel: "PassiveReadOnly",
        name: "Exposure Operator",
        operatorType: "ExposureOperator",
        purpose: "Propose safe next steps",
        supportedMissionTypes: ["ExposureValidation"]
      }
    ]);
    client.listOperatorRecommendations.mockResolvedValue([rec]);
    client.approveOperatorRecommendation.mockResolvedValue({
      mission: { missionId: "mission-draft-1", status: "Draft" },
      queued: false,
      recommendation: { ...rec, status: "Approved" }
    });

    render(<OperatorsWorkbench />);

    expect(await screen.findByTestId("operators-workbench")).toBeInTheDocument();
    expect(screen.getByTestId("operator-recommendations-panel")).toBeInTheDocument();
    expect(document.body.textContent ?? "").toMatch(
      /creates a\s*Draft\s*mission only/i
    );
    expect(document.body.textContent ?? "").toMatch(/No auto-queue/i);
    expect(screen.getByText(rec.title)).toBeInTheDocument();

    const apply = screen.getByTestId("operator-recommendation-apply-rec-apply-1");
    expect(apply).toHaveTextContent("Apply recommendation");
    expect(apply).not.toHaveTextContent(/queue/i);

    fireEvent.click(apply);

    await waitFor(() =>
      expect(client.approveOperatorRecommendation).toHaveBeenCalledWith(
        "rec-apply-1"
      )
    );

    expect(
      await screen.findByTestId("operator-recommendation-applied")
    ).toHaveTextContent(/Draft mission created \(not queued\)/i);
    expect(screen.getByRole("link", { name: /Open missions/i })).toHaveAttribute(
      "href",
      "/missions"
    );
    expect(document.body.textContent ?? "").not.toMatch(
      /mission .*queued\.(?!)/i
    );
    expect(document.body.textContent ?? "").not.toMatch(
      /Approve & queue mission/i
    );
  });

  it("shows honest empty recommendations state", async () => {
    client.listOperatorProfiles.mockResolvedValue([]);
    client.listOperatorRecommendations.mockResolvedValue([]);

    render(<OperatorsWorkbench />);

    expect(
      await screen.findByText(/No recommendations yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Path-scoped next missions also appear/i)
    ).toBeInTheDocument();
  });
});
