import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentWorkflowStudio } from "./agent-workflow-studio";

const TIMESTAMP = "2026-07-15T12:00:00.000Z";
const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

describe("AgentWorkflowStudio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists durable runs so checkpoint replay is discoverable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/agent-workflows/runs") && !url.includes("/events")) {
          return json({
            items: [
              {
                createdAt: TIMESTAMP,
                createdBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                definitionVersion: 1,
                endedAt: null,
                evidenceIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
                evidenceManifestHash: "a".repeat(64),
                forkedFromCheckpointId: null,
                forkedFromRunId: null,
                inputHash: "b".repeat(64),
                inputManifest: { purpose: "Review" },
                modelSessionId: SESSION_ID,
                policyDecisionIds: [],
                policySnapshotHash: "c".repeat(64),
                reusedThroughSequence: null,
                startedAt: TIMESTAMP,
                status: "Running",
                tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                workflowDefinitionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
                workflowRunId: RUN_ID
              }
            ]
          });
        }
        if (url.includes(`/agent-workflows/runs/${RUN_ID}/evaluation`)) {
          return json({
            findings: [],
            metrics: {
              evidenceGrounding: 1,
              modelIdentityCoverage: 1,
              stepCoverage: 1,
              toolPolicyCoverage: 1
            },
            score: 100,
            status: "Ready",
            workflowRunId: RUN_ID
          });
        }
        if (url.includes(`/agent-workflows/runs/${RUN_ID}`)) {
          return json({
            checkpoints: [],
            definition: {
              createdAt: TIMESTAMP,
              createdBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              definitionHash: "d".repeat(64),
              name: "Governed validation workflow",
              purpose: "Proof",
              steps: [
                {
                  dependsOn: [],
                  name: "Context",
                  stepKey: "context",
                  stepKind: "Context"
                }
              ],
              tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              version: 1,
              workflowDefinitionId: "ffffffff-ffff-4fff-8fff-ffffffffffff"
            },
            events: [],
            flightRecorderValid: true,
            run: {
              createdAt: TIMESTAMP,
              createdBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              definitionVersion: 1,
              endedAt: null,
              evidenceIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
              evidenceManifestHash: "a".repeat(64),
              forkedFromCheckpointId: null,
              forkedFromRunId: null,
              inputHash: "b".repeat(64),
              inputManifest: { purpose: "Review" },
              modelSessionId: SESSION_ID,
              policyDecisionIds: [],
              policySnapshotHash: "c".repeat(64),
              reusedThroughSequence: null,
              startedAt: TIMESTAMP,
              status: "Running",
              tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              workflowDefinitionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              workflowRunId: RUN_ID
            }
          });
        }
        // Empty bootstrap collections for providers/policies/scopes/tools/sessions.
        return json({ items: [] });
      })
    );

    render(<AgentWorkflowStudio />);

    await waitFor(() => {
      expect(
        screen.getByText("Durable flight recorder catalog")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Workflow runs for flight recorder")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open flight recorder|Viewing recorder/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open the durable flight recorder/i })
    ).toHaveAttribute("href", "#flight-recorder-catalog");
  });
});
