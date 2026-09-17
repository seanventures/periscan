import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("durable agent workflow flight recorder", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "workflow-owner",
        "workflow-outsider"
      ]);
      await prisma.$disconnect();
    }
  });

  it("hash-chains events and only forks from checkpoints with valid inputs and history", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "workflow-owner",
        "Workflow Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const outsider = await testHelpers.performSignup(
        app,
        "workflow-outsider",
        "Unrelated Workflow Tenant"
      );
      const outsiderCookies = { [SESSION_COOKIE_NAME]: outsider.cookie };

      const definitionResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          name: "Governed validation",
          purpose: "Prove durable, policy-aware workflow replay.",
          steps: [
            {
              dependsOn: [],
              name: "Build governed context",
              stepKey: "context",
              stepKind: "Context"
            },
            {
              dependsOn: ["context"],
              name: "Evaluate policy",
              stepKey: "policy",
              stepKind: "Policy"
            }
          ],
          version: 1
        },
        url: "/api/v1/agent-workflows/definitions"
      });
      expect(definitionResponse.statusCode).toBe(201);
      const workflowDefinitionId = definitionResponse.json()
        .workflowDefinitionId as string;

      const inputManifest = {
        mode: "Assist",
        purpose: "Analyze the verified scope",
        scopeIds: []
      };
      const runResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          evidenceIds: [],
          inputManifest,
          policyDecisionIds: [],
          workflowDefinitionId
        },
        url: "/api/v1/agent-workflows/runs"
      });
      expect(runResponse.statusCode).toBe(201);
      const workflowRunId = runResponse.json().workflowRunId as string;

      const eventResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          eventType: "StepStarted",
          evidenceIds: [],
          payloadRedacted: { contextBundleRef: "context-bundle:pending" },
          stepKey: "context"
        },
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/events`
      });
      expect(eventResponse.statusCode).toBe(201);
      expect(eventResponse.json()).toMatchObject({
        eventType: "StepStarted",
        sequence: "2",
        stepKey: "context"
      });

      const forbiddenSecret = await app.inject({
        cookies,
        method: "POST",
        payload: {
          eventType: "ModelRequest",
          evidenceIds: [],
          payloadRedacted: { apiKey: "must-never-be-recorded" },
          stepKey: "context"
        },
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/events`
      });
      expect(forbiddenSecret.statusCode).toBe(400);
      expect(forbiddenSecret.json().code).toBe(
        "workflow_payload_contains_secret"
      );

      const checkpointResponse = await app.inject({
        cookies,
        method: "POST",
        payload: { reusableThroughStepKey: "context" },
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/checkpoints`
      });
      expect(checkpointResponse.statusCode).toBe(201);
      const checkpoint = checkpointResponse.json();
      expect(checkpoint.sequence).toBe("3");

      const detailResponse = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}`
      });
      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.json()).toMatchObject({
        flightRecorderValid: true,
        run: { status: "Running", workflowRunId }
      });
      expect(detailResponse.json().events).toHaveLength(3);

      const variableAnalysis = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/variable-analysis`
      });
      expect(variableAnalysis.statusCode).toBe(200);
      expect(variableAnalysis.json()).toMatchObject({
        integrityVerified: true,
        summary: {
          eventCount: 3,
          snapshotCount: 4
        },
        workflowRunId
      });
      expect(variableAnalysis.json().namespaceCounts.Input).toBeGreaterThan(0);
      expect(
        variableAnalysis.json().namespaceCounts.Transition
      ).toBeGreaterThan(0);
      expect(variableAnalysis.json().limitations.join(" ")).toContain(
        "raw prompts, responses, credentials"
      );

      const crossTenantAnalysis = await app.inject({
        cookies: outsiderCookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/variable-analysis`
      });
      expect(crossTenantAnalysis.statusCode).toBe(404);

      const evaluation = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/evaluation`
      });
      expect(evaluation.statusCode).toBe(200);
      expect(evaluation.json()).toMatchObject({
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "IncompleteStepCoverage" }),
          expect.objectContaining({ code: "RunNotCompleted" })
        ]),
        metrics: {
          evidenceGrounding: 1,
          flightRecorderIntegrity: 1,
          modelIdentityCoverage: 1,
          stepCoverage: 0.5,
          toolPolicyCoverage: 1
        },
        status: "Incomplete",
        workflowRunId
      });

      const staleReplay = await app.inject({
        cookies,
        method: "POST",
        payload: {
          inputManifest: { ...inputManifest, purpose: "Changed purpose" },
          workflowCheckpointId: checkpoint.workflowCheckpointId
        },
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/replay`
      });
      expect(staleReplay.statusCode).toBe(409);
      expect(staleReplay.json().code).toBe("agent_workflow_checkpoint_stale");

      const validReplay = await app.inject({
        cookies,
        method: "POST",
        payload: { workflowCheckpointId: checkpoint.workflowCheckpointId },
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/replay`
      });
      expect(validReplay.statusCode).toBe(201);
      expect(validReplay.json()).toMatchObject({
        forkedFromCheckpointId: checkpoint.workflowCheckpointId,
        forkedFromRunId: workflowRunId,
        reusedThroughSequence: "3",
        status: "Created"
      });

      const firstEvent = await prisma.agentWorkflowEvent.findFirstOrThrow({
        orderBy: { sequence: "asc" },
        where: { workflowRunId }
      });
      await prisma.agentWorkflowEvent.update({
        data: { payloadRedacted: { tampered: true } },
        where: { workflowEventId: firstEvent.workflowEventId }
      });

      const tamperedDetail = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}`
      });
      expect(tamperedDetail.statusCode).toBe(200);
      expect(tamperedDetail.json().flightRecorderValid).toBe(false);

      const tamperedVariableAnalysis = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/variable-analysis`
      });
      expect(tamperedVariableAnalysis.statusCode).toBe(200);
      expect(tamperedVariableAnalysis.json().integrityVerified).toBe(false);

      const tamperedEvaluation = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/evaluation`
      });
      expect(tamperedEvaluation.statusCode).toBe(200);
      expect(tamperedEvaluation.json()).toMatchObject({
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "FlightRecorderInvalid",
            severity: "Critical"
          })
        ]),
        status: "IntegrityFailure"
      });

      const behaviorAnalysis = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/agent-workflows/behavior-analysis"
      });
      expect(behaviorAnalysis.statusCode).toBe(200);
      expect(behaviorAnalysis.json()).toMatchObject({
        findings: expect.arrayContaining([
          expect.objectContaining({
            ruleId: "FlightRecorderIntegrity",
            severity: "Critical",
            workflowRunId
          })
        ]),
        methodology: expect.stringContaining("not a trained anomaly model")
      });

      const tamperedReplay = await app.inject({
        cookies,
        method: "POST",
        payload: { workflowCheckpointId: checkpoint.workflowCheckpointId },
        url: `/api/v1/agent-workflows/runs/${workflowRunId}/replay`
      });
      expect(tamperedReplay.statusCode).toBe(409);
      expect(tamperedReplay.json().code).toBe("agent_workflow_chain_invalid");
    } finally {
      await app.close();
    }
  });
});
