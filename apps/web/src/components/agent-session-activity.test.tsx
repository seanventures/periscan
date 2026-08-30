import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentSessionActivity } from "./agent-session-activity";

const TIMESTAMP = "2026-07-15T12:00:00.000Z";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const TOOL_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const EVIDENCE_ID = "44444444-4444-4444-8444-444444444444";
const TOOL_RESULT_ID = "55555555-5555-4555-8555-555555555555";
const EVENT_ID = "66666666-6666-4666-8666-666666666666";

function session() {
  return {
    modelSessionId: SESSION_ID,
    tenantId: TENANT_ID,
    modelProviderId: "77777777-7777-4777-8777-777777777777",
    modelPolicyProfileId: "88888888-8888-4888-8888-888888888888",
    purpose: "Virtual analyst posture review",
    mode: "ReadOnlyEvidence",
    status: "Active",
    scopeIds: ["99999999-9999-4999-8999-999999999999"],
    safetyLevel: "PassiveReadOnly",
    createdAt: TIMESTAMP,
    startedAt: TIMESTAMP,
    pausedAt: null,
    terminatedAt: null,
    expiresAt: null,
    updatedAt: TIMESTAMP,
    createdBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    lastActivityAt: TIMESTAMP
  } as const;
}

describe("AgentSessionActivity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces toolRequestId and evidence ids when tools were used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes(`/model-gateway/sessions/${SESSION_ID}/tool-requests`)) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  toolRequestId: TOOL_REQUEST_ID,
                  tenantId: TENANT_ID,
                  modelSessionId: SESSION_ID,
                  toolName: "list_findings",
                  requestedByModel: true,
                  requestReason: "Summarize open findings",
                  inputPayloadHash: "a".repeat(64),
                  inputPayloadRedacted: {},
                  scopeIds: [],
                  policyDecisionId: null,
                  status: "Completed",
                  denialReason: null,
                  createdAt: TIMESTAMP,
                  approvedAt: TIMESTAMP,
                  approvedBy: null,
                  completedAt: TIMESTAMP,
                  updatedAt: TIMESTAMP,
                  result: {
                    toolResultId: TOOL_RESULT_ID,
                    tenantId: TENANT_ID,
                    toolRequestId: TOOL_REQUEST_ID,
                    validationRunId: null,
                    evidenceIds: [EVIDENCE_ID],
                    outputPayloadRedacted: { count: 1 },
                    sensitivityLevel: "Moderate",
                    returnedToModel: true,
                    createdAt: TIMESTAMP
                  }
                }
              ]
            }),
            { status: 200 }
          );
        }
        if (url.includes("/model-gateway/audit-events")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  eventId: EVENT_ID,
                  tenantId: TENANT_ID,
                  modelSessionId: SESSION_ID,
                  eventType: "ToolResultReturned",
                  userId: null,
                  modelProviderId: null,
                  toolName: "list_findings",
                  toolRequestId: TOOL_REQUEST_ID,
                  policyDecisionId: null,
                  evidenceIds: [EVIDENCE_ID],
                  metadata: {},
                  createdAt: TIMESTAMP
                }
              ]
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      })
    );

    render(<AgentSessionActivity session={session() as never} />);

    await waitFor(() => {
      expect(screen.getByText("Tool + evidence receipts")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Tool request receipts")).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(`tool ${TOOL_REQUEST_ID.slice(0, 8)}`))
        .length
    ).toBeGreaterThan(0);
    const evidenceLinks = screen.getAllByRole("link", {
      name: new RegExp(`evidence ${EVIDENCE_ID.slice(0, 8)}`)
    });
    expect(evidenceLinks.length).toBeGreaterThan(0);
    expect(evidenceLinks[0]).toHaveAttribute(
      "href",
      `/evidence?evidenceId=${encodeURIComponent(EVIDENCE_ID)}`
    );
    expect(
      screen.getByRole("link", { name: /Flight recorder \/ checkpoint/i })
    ).toHaveAttribute("href", "/workflows");
  });
});
