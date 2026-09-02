import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import {
  AppServiceError,
  createRuntimeServices
} from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

describe("signed deterministic scenario compiler flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "scenario-compiler"
      ]);
      await prisma.$disconnect();
    }
  });

  it("compiles, verifies, approves, evidence-gates, and executes the exact preview hash", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({
      devMode: true,
      services
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "scenario-compiler",
        "Scenario compiler Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = authCookies(cookie);
      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `scenario-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verified = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      const compiled = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          intent:
            "Validate DNS resolution and DNS email controls, continuing only after saved evidence.",
          maximumIterations: 2,
          maximumSteps: 2,
          scopeId,
          techniqueIds: ["T1595"]
        },
        url: "/api/v1/scenarios/compile"
      });
      expect(compiled.statusCode).toBe(201);
      expect(compiled.json()).toMatchObject({
        bundle: {
          allowedScopeTypes: ["Domain"],
          bundleVersion: 1,
          legalClassification: "PassiveAuthorized",
          maximumIterations: 2,
          scopeId,
          status: "Draft",
          techniqueIds: ["T1595"]
        },
        preview: {
          branchCount: 1,
          executable: false,
          moduleCount: 2,
          nextStep: "ApproveScenarioBundle"
        }
      });
      const bundle = compiled.json().bundle as {
        compiledHash: string;
        scenarioBundleId: string;
        signature: {
          algorithm: string;
          digestSha256: string;
          keyId: string;
          signature: string;
        };
        steps: Array<{
          dependsOn: string[];
          stepId: string;
          when: { kind: string; stepId?: string };
        }>;
      };
      expect(bundle.compiledHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(bundle.signature).toMatchObject({
        algorithm: "EdDSA",
        digestSha256: bundle.compiledHash
      });
      expect(bundle.signature.signature.length).toBeGreaterThan(32);
      expect(bundle.steps[1]).toMatchObject({
        dependsOn: [bundle.steps[0]!.stepId],
        when: { kind: "PriorStep", stepId: bundle.steps[0]!.stepId }
      });

      const beforeApproval = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { compiledHash: bundle.compiledHash },
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/execute`
      });
      expect(beforeApproval.statusCode).toBe(409);
      expect(beforeApproval.json().code).toBe(
        "scenario_bundle_approval_required"
      );

      const approved = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/approve`
      });
      expect(approved.statusCode).toBe(200);
      expect(approved.json()).toMatchObject({
        compiledHash: bundle.compiledHash,
        status: "Approved"
      });

      const persisted = await prisma.scenarioBundle.findUniqueOrThrow({
        where: { scenarioBundleId: bundle.scenarioBundleId }
      });
      const originalSteps = persisted.steps as Prisma.JsonArray;
      const [firstStep, ...remainingSteps] = originalSteps;
      expect(firstStep).toBeTruthy();
      const tamperedSteps = [
        {
          ...(firstStep as Prisma.JsonObject),
          target: { tampered: true }
        },
        ...remainingSteps
      ] as Prisma.InputJsonValue;
      await prisma.scenarioBundle.update({
        data: { steps: tamperedSteps },
        where: { scenarioBundleId: bundle.scenarioBundleId }
      });
      const tampered = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { compiledHash: bundle.compiledHash },
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/execute`
      });
      expect(tampered.statusCode).toBe(409);
      expect(tampered.json().code).toBe("scenario_bundle_integrity_failed");
      await prisma.scenarioBundle.update({
        data: { steps: originalSteps as Prisma.InputJsonValue },
        where: { scenarioBundleId: bundle.scenarioBundleId }
      });

      const executed = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          compiledHash: bundle.compiledHash,
          expectedFeedbackCycleCount: 0,
          reason: "Capture fresh evidence for the first release review cycle.",
          reviewReference: "CHANGE-1001"
        },
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/execute`
      });
      expect(executed.statusCode, JSON.stringify(executed.json())).toBe(201);
      expect(executed.json()).toMatchObject({
        engagement: {
          compiledHash: bundle.compiledHash,
          feedbackCycleNumber: 1,
          scenarioBundleId: bundle.scenarioBundleId,
          status: "Completed"
        },
        bundle: {
          feedbackCycleCount: 1,
          feedbackLastStatus: "Completed"
        },
        feedback: {
          cycleNumber: 1,
          maximumIterations: 2,
          reason: "Capture fresh evidence for the first release review cycle.",
          remainingIterations: 1,
          reviewReference: "CHANGE-1001",
          status: "Completed"
        },
        integrity: {
          compiledHash: bundle.compiledHash,
          executionMatchedPreview: true
        }
      });
      const steps = executed.json().engagement.steps as Array<{
        branchDecision: {
          evidence: string[];
          matched: boolean;
          predicate: { kind: string };
        } | null;
        evidenceIds: string[];
        status: string;
        stepId: string;
      }>;
      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatchObject({ status: "executed", stepId: "step-1" });
      expect(steps[0]!.evidenceIds.length).toBeGreaterThan(0);
      expect(steps[1]).toMatchObject({
        branchDecision: {
          matched: true,
          predicate: { kind: "PriorStep" }
        },
        status: "executed",
        stepId: "step-2"
      });
      expect(steps[1]!.branchDecision?.evidence).toEqual(
        expect.arrayContaining([expect.stringContaining("step-1 evidence=")])
      );

      const staleCycle = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          compiledHash: bundle.compiledHash,
          expectedFeedbackCycleCount: 0,
          reason: "Attempt a stale decision after another cycle completed.",
          reviewReference: "CHANGE-1002"
        },
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/execute`
      });
      expect(staleCycle.statusCode).toBe(409);
      expect(staleCycle.json().code).toBe("scenario_feedback_state_changed");

      const exhausted = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          compiledHash: bundle.compiledHash,
          expectedFeedbackCycleCount: 1,
          reason: "Capture the final authorized release review evidence cycle.",
          reviewReference: "CHANGE-1003"
        },
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/execute`
      });
      expect(exhausted.statusCode).toBe(201);
      expect(exhausted.json()).toMatchObject({
        bundle: {
          feedbackCycleCount: 2,
          feedbackLastStatus: "Exhausted"
        },
        engagement: { feedbackCycleNumber: 2 },
        feedback: {
          cycleNumber: 2,
          remainingIterations: 0,
          status: "Exhausted"
        }
      });

      const beyondLimit = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          compiledHash: bundle.compiledHash,
          expectedFeedbackCycleCount: 2,
          reason: "This attempt must not expand the signed iteration limit.",
          reviewReference: "CHANGE-1004"
        },
        url: `/api/v1/scenarios/${bundle.scenarioBundleId}/execute`
      });
      expect(beyondLimit.statusCode).toBe(409);
      expect(beyondLimit.json().code).toBe("scenario_feedback_exhausted");

      const engagementId = executed.json().engagement.engagementId as string;
      const persistedEngagement = await prisma.engagement.findUniqueOrThrow({
        where: { engagementId }
      });
      expect(persistedEngagement).toMatchObject({
        compiledHash: bundle.compiledHash,
        feedbackCycleNumber: 1,
        scenarioBundleId: bundle.scenarioBundleId,
        tenantId
      });
      const exhaustedBundle = await prisma.scenarioBundle.findUniqueOrThrow({
        where: { scenarioBundleId: bundle.scenarioBundleId }
      });
      expect(exhaustedBundle).toMatchObject({
        feedbackCycleCount: 2,
        feedbackFailedCycleCount: 0,
        feedbackLastReason:
          "Capture the final authorized release review evidence cycle.",
        feedbackLastReviewReference: "CHANGE-1003",
        feedbackLastStatus: "Exhausted",
        maximumIterations: 2
      });
      await expect(
        prisma.scenarioBundle.update({
          data: { feedbackCycleCount: 3 },
          where: { scenarioBundleId: bundle.scenarioBundleId }
        })
      ).rejects.toThrow();
      expect(
        (
          await prisma.scenarioBundle.findUniqueOrThrow({
            where: { scenarioBundleId: bundle.scenarioBundleId }
          })
        ).feedbackCycleCount
      ).toBe(2);

      const stoppableCompiled = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          intent:
            "Validate DNS resolution in bounded cycles and stop after the change review closes.",
          maximumIterations: 3,
          maximumSteps: 1,
          scopeId
        },
        url: "/api/v1/scenarios/compile"
      });
      expect(stoppableCompiled.statusCode).toBe(201);
      const stoppableBundle = stoppableCompiled.json().bundle as {
        compiledHash: string;
        scenarioBundleId: string;
      };
      const stoppableApproved = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/scenarios/${stoppableBundle.scenarioBundleId}/approve`
      });
      expect(stoppableApproved.statusCode).toBe(200);
      const stoppableExecuted = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          compiledHash: stoppableBundle.compiledHash,
          expectedFeedbackCycleCount: 0,
          reason: "Capture one fresh cycle before closing the change review.",
          reviewReference: "CHANGE-2001"
        },
        url: `/api/v1/scenarios/${stoppableBundle.scenarioBundleId}/execute`
      });
      expect(stoppableExecuted.statusCode).toBe(201);

      const stopped = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          expectedFeedbackCycleCount: 1,
          reason:
            "The release review closed and no more cycles are authorized.",
          reviewReference: "CHANGE-2002"
        },
        url: `/api/v1/scenarios/${stoppableBundle.scenarioBundleId}/feedback/stop`
      });
      expect(stopped.statusCode).toBe(200);
      expect(stopped.json()).toMatchObject({
        feedbackCycleCount: 1,
        feedbackLastStatus: "Stopped",
        feedbackStopReason:
          "The release review closed and no more cycles are authorized.",
        feedbackStopReviewReference: "CHANGE-2002"
      });
      expect(stopped.json().feedbackStoppedAt).toBeTruthy();

      const afterStop = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          compiledHash: stoppableBundle.compiledHash,
          expectedFeedbackCycleCount: 1,
          reason: "This attempt must not reopen a stopped feedback loop.",
          reviewReference: "CHANGE-2003"
        },
        url: `/api/v1/scenarios/${stoppableBundle.scenarioBundleId}/execute`
      });
      expect(afterStop.statusCode).toBe(409);
      expect(afterStop.json().code).toBe("scenario_feedback_stopped");

      const repeatedStop = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          expectedFeedbackCycleCount: 1,
          reason: "A repeated stop must remain terminal and immutable.",
          reviewReference: "CHANGE-2004"
        },
        url: `/api/v1/scenarios/${stoppableBundle.scenarioBundleId}/feedback/stop`
      });
      expect(repeatedStop.statusCode).toBe(409);
      expect(repeatedStop.json().code).toBe("scenario_feedback_stopped");

      const failingCompiled = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          intent:
            "Validate a bounded cycle and retain a consumed attempt when downstream execution fails.",
          maximumIterations: 2,
          maximumSteps: 1,
          scopeId
        },
        url: "/api/v1/scenarios/compile"
      });
      expect(failingCompiled.statusCode).toBe(201);
      const failingBundle = failingCompiled.json().bundle as {
        compiledHash: string;
        scenarioBundleId: string;
      };
      const failingApproved = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/scenarios/${failingBundle.scenarioBundleId}/approve`
      });
      expect(failingApproved.statusCode).toBe(200);

      const originalRunEngagement = services.runEngagement;
      services.runEngagement = async () => {
        throw new AppServiceError(
          "Simulated downstream execution failure.",
          503,
          "simulated_feedback_failure"
        );
      };
      try {
        const failedCycle = await app.inject({
          cookies: auth,
          method: "POST",
          payload: {
            compiledHash: failingBundle.compiledHash,
            expectedFeedbackCycleCount: 0,
            reason:
              "Prove failed cycle accounting with a controlled service fault.",
            reviewReference: "CHANGE-3001"
          },
          url: `/api/v1/scenarios/${failingBundle.scenarioBundleId}/execute`
        });
        expect(failedCycle.statusCode).toBe(503);
        expect(failedCycle.json().code).toBe("simulated_feedback_failure");
      } finally {
        services.runEngagement = originalRunEngagement;
      }
      const failedCycleBundle = await prisma.scenarioBundle.findUniqueOrThrow({
        where: { scenarioBundleId: failingBundle.scenarioBundleId }
      });
      expect(failedCycleBundle).toMatchObject({
        feedbackCycleCount: 1,
        feedbackFailedCycleCount: 1,
        feedbackLastError: "Simulated downstream execution failure.",
        feedbackLastReason:
          "Prove failed cycle accounting with a controlled service fault.",
        feedbackLastReviewReference: "CHANGE-3001",
        feedbackLastStatus: "Failed"
      });

      const audits = await prisma.auditEvent.findMany({
        where: {
          action: {
            in: [
              "scenario_compiled",
              "scenario_approved",
              "scenario_executed",
              "scenario_feedback_cycle_started",
              "scenario_feedback_cycle_completed",
              "scenario_feedback_cycle_failed",
              "scenario_feedback_stopped"
            ]
          },
          tenantId
        }
      });
      const actionCounts = audits.reduce<Record<string, number>>(
        (counts, event) => ({
          ...counts,
          [event.action]: (counts[event.action] ?? 0) + 1
        }),
        {}
      );
      expect(actionCounts).toMatchObject({
        scenario_approved: 3,
        scenario_compiled: 3,
        scenario_executed: 3,
        scenario_feedback_cycle_completed: 3,
        scenario_feedback_cycle_failed: 1,
        scenario_feedback_cycle_started: 4,
        scenario_feedback_stopped: 1
      });
    } finally {
      await app.close();
    }
  });
});
