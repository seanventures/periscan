import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AuditEvent,
  ModelSession,
  ValidationMission,
  ValidationRun
} from "@periscan/shared";

import { AgentSessionActivity } from "./agent-session-activity";
import { ValidationMissionActivity } from "./validation-mission-activity";

const now = new Date().toISOString();
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const providerId = "55555555-5555-4555-8555-555555555555";
const profileId = "66666666-6666-4666-8666-666666666666";
const requestId = "77777777-7777-4777-8777-777777777777";
const policyDecisionId = "88888888-8888-4888-8888-888888888888";
const evidenceId = "99999999-9999-4999-8999-999999999999";
const missionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const runId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function jsonResponse(payload: unknown) {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload)
  };
}

const session: ModelSession = {
  adapterAlias: null,
  createdAt: now,
  endedAt: null,
  expiresAt: null,
  mode: "SafeValidation",
  modelPolicyProfileId: profileId,
  modelProviderId: providerId,
  modelSessionId: sessionId,
  purpose: "Verify the exposed identity boundary",
  precisionMode: "ProviderManaged",
  requestedModel: null,
  scopeIds: [scopeId],
  startedAt: now,
  status: "Active",
  tenantId,
  updatedAt: now,
  userId
};

describe("live orchestration surfaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders real model-session tool requests, audit handoffs, and evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (
          url.endsWith(`/model-gateway/sessions/${sessionId}/tool-requests`)
        ) {
          return jsonResponse({
            items: [
              {
                approvedAt: now,
                approvedBy: userId,
                completedAt: now,
                createdAt: now,
                denialReason: null,
                inputPayloadHash: "sha256:demo",
                inputPayloadRedacted: { scopeId },
                modelSessionId: sessionId,
                policyDecisionId,
                requestReason: "Confirm the evidence-backed attack path.",
                requestedByModel: true,
                result: {
                  createdAt: now,
                  evidenceIds: [evidenceId],
                  outputPayloadRedacted: { outcome: "blocked" },
                  returnedToModel: true,
                  sensitivityLevel: "Moderate",
                  tenantId,
                  toolRequestId: requestId,
                  toolResultId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
                },
                scopeIds: [scopeId],
                status: "Completed",
                tenantId,
                toolName: "query_evidence_graph",
                toolRequestId: requestId,
                updatedAt: now
              }
            ]
          });
        }
        if (url.includes("/model-gateway/audit-events")) {
          return jsonResponse({
            items: [
              {
                createdAt: now,
                eventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                eventType: "ToolResultReturned",
                evidenceIds: [evidenceId],
                metadata: {},
                modelProviderId: providerId,
                modelSessionId: sessionId,
                policyDecisionId,
                tenantId,
                toolName: "query_evidence_graph",
                toolRequestId: requestId,
                userId
              }
            ]
          });
        }
        return jsonResponse({ items: [] });
      }) as unknown as typeof fetch
    );

    render(<AgentSessionActivity session={session} />);

    expect(
      await screen.findByRole("heading", {
        name: "Verify the exposed identity boundary"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Governed handoffs")).toBeInTheDocument();
    // Tool name appears in the request card title and audit handoff row
    expect(
      screen.getAllByText("Query Evidence Graph").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Redacted result returned")).toBeInTheDocument();
    expect(screen.getByText("1 linked receipt")).toBeInTheDocument();
  });

  it("maps a validation mission to its policy, module, evidence, and outcome records", () => {
    const mission: ValidationMission = {
      completedAt: now,
      createdAt: now,
      evidenceIds: [evidenceId],
      missionId,
      missionType: "ControlValidation",
      policyDecisionId,
      policyProfile: "enterprise-safe",
      requestedBy: userId,
      safetyLevel: "BASLite",
      scopeId,
      scopeIds: [scopeId],
      startedAt: now,
      status: "Completed",
      tenantId,
      updatedAt: now
    };
    const runs: ValidationRun[] = [
      {
        completedAt: now,
        createdAt: now,
        errorSummary: null,
        evidenceIds: [evidenceId],
        missionId,
        moduleId: "periscan.dns_resolution_check",
        outcome:
          "The authorized hostname resolved and the control response was observed.",
        policyDecisionId,
        runId,
        runnerId: null,
        safetyLevel: "BASLite",
        scopeId,
        startedAt: now,
        status: "Completed",
        target: {},
        techniqueIds: ["T1595"],
        tenantId,
        updatedAt: now,
        validationState: "Detected"
      }
    ];
    const auditEvents: AuditEvent[] = [
      {
        action: "module.executed",
        actorType: "System",
        auditEventId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        createdAt: now,
        entityId: runId,
        entityType: "ValidationRun",
        metadata: { missionId },
        tenantId,
        userId: null
      }
    ];

    render(
      <ValidationMissionActivity
        auditEvents={auditEvents}
        mission={mission}
        runs={runs}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Live validation execution" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Policy gate").length).toBeGreaterThan(0);
    const runNode = screen.getByRole("button", {
      name: /DNS resolution/
    });
    expect(runNode).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(runNode);
    expect(runNode).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("DNS resolution")).toHaveLength(2);
    expect(
      screen.getByText(
        "The authorized hostname resolved and the control response was observed."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review evidence" })
    ).toHaveAttribute("href", `/evidence?missionId=${missionId}`);
  });
});
