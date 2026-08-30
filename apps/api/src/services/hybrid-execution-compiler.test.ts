import { describe, expect, it, vi } from "vitest";

import {
  assemblePassiveMultiAgentPlan,
  buildConversationalMissionDraft,
  HYBRID_COMPILER_PRODUCT_STATUS,
  missionDraftToHybridCompileInput,
  selectPassiveModulesForIntent
} from "@periscan/shared";

import { createHybridExecutionCompilerServices } from "./hybrid-execution-compiler.js";
import { AppServiceError, type RuntimeServiceDeps } from "../runtime-services.js";

describe("hybrid execution compiler service contracts", () => {
  it("never claims Fully-E2E / live APT / multi-agent offense", () => {
    expect(HYBRID_COMPILER_PRODUCT_STATUS.fullyE2EMeasuredSurface).toBe(false);
    expect(HYBRID_COMPILER_PRODUCT_STATUS.liveAptAtomicSupported).toBe(false);
    expect(
      HYBRID_COMPILER_PRODUCT_STATUS.multiAgentOffensiveSwarmSupported
    ).toBe(false);
  });

  it("selects allowlisted passive modules for assembly", () => {
    const modules = selectPassiveModulesForIntent("dns tls http", 4);
    expect(modules.every((id) => id.startsWith("periscan."))).toBe(true);
    expect(modules).not.toContain("atomic.control_validation_safe");
  });

  it("builds non-executable conversational drafts", () => {
    const draft = buildConversationalMissionDraft({
      createdAt: "2026-08-01T12:00:00.000Z",
      draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      intent: "dns exposure proof",
      moduleIds: ["periscan.dns_resolution_check"],
      moduleMeta: [
        {
          moduleId: "periscan.dns_resolution_check",
          name: "DNS",
          safetyLevel: "PassiveReadOnly"
        }
      ],
      source: "FreeformIntent"
    });
    expect(draft.executable).toBe(false);
    expect(draft.honesty.conversationalOnly).toBe(true);
  });

  it("assembles passive multi-agent plans with Draft-only honesty", () => {
    const plan = assemblePassiveMultiAgentPlan({
      intent: "dns",
      missionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      moduleMeta: [
        {
          moduleId: "periscan.dns_resolution_check",
          name: "DNS",
          safetyLevel: "PassiveReadOnly"
        }
      ],
      scopeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      targetHost: "host.internal"
    });
    expect(plan.honesty.multiAgentOffensiveSwarmSupported).toBe(false);
    expect(plan.honesty.draftMissionsOnly).toBe(true);
    expect(plan.missionStatus).toBe("Draft");
    expect(plan.policyPreview.executionEnvironment).toBe("InternalRunner");
    expect(plan.missionPlan.steps[0]?.agentRole).toBe("dns_posture");
  });

  it("converts draft to hybrid compile input with draftExecutable false", () => {
    const draft = buildConversationalMissionDraft({
      createdAt: "2026-08-01T12:00:00.000Z",
      draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      intent: "dns exposure proof",
      moduleIds: ["periscan.dns_resolution_check"],
      moduleMeta: [
        {
          moduleId: "periscan.dns_resolution_check",
          name: "DNS",
          safetyLevel: "PassiveReadOnly"
        }
      ],
      scopeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      source: "FreeformIntent",
      targetHost: "host.internal"
    });
    const converted = missionDraftToHybridCompileInput(draft, {
      runnerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    });
    expect(converted.draftExecutable).toBe(false);
    expect(converted.honesty.basExecutableFromDraft).toBe(false);
    expect(converted.compileInput.moduleIds).toEqual([
      "periscan.dns_resolution_check"
    ]);
  });

  it("refuses campus-passive dns+http compile before queuing any tasks", async () => {
    const runnerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const scopeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const tenantId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const userId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const now = new Date("2026-08-02T03:00:00.000Z");

    const policyDecisionCreate = vi.fn();
    const missionCreate = vi.fn();
    const runCreate = vi.fn();
    const taskCreate = vi.fn();

    const services = createHybridExecutionCompilerServices({
      devMode: true,
      prisma: {
        policyDecision: { create: policyDecisionCreate },
        runner: {
          findFirst: vi.fn().mockResolvedValue({
            killSwitchActive: false,
            runnerId,
            segmentProfileId: "campus-passive",
            status: "Active",
            tenantId
          })
        },
        runnerTask: { create: taskCreate },
        scope: {
          findFirst: vi.fn().mockResolvedValue({
            assetClass: "Network",
            businessCriticality: "High",
            createdAt: now,
            createdBy: userId,
            externalValidationProfileId: null,
            maxSafetyLevel: "ActiveNonInvasive",
            purdueLevel: null,
            scopeId,
            scopeType: "Domain",
            segmentName: null,
            sensitivity: "High",
            tags: [],
            tenantId,
            updatedAt: now,
            value: "example.com",
            verificationMethod: "DNS",
            verificationStatus: "Verified",
            verificationToken: null,
            verifiedAt: now,
            verifiedBy: userId
          })
        },
        validationMission: { create: missionCreate },
        validationRun: { create: runCreate }
      }
    } as unknown as RuntimeServiceDeps);

    await expect(
      services.compileHybridExecution(
        {
          membership: { role: "Owner" },
          tenant: { tenantId },
          user: { userId }
        } as never,
        {
          moduleIds: [
            "periscan.dns_resolution_check",
            "periscan.http_health_check"
          ],
          port: 443,
          queueTasks: true,
          runnerId,
          scopeId,
          targetHost: "host.example.com",
          timeoutSeconds: 30
        }
      )
    ).rejects.toMatchObject({
      code: "runner_segment_module_denied",
      statusCode: 403
    } satisfies Partial<AppServiceError>);

    expect(policyDecisionCreate).not.toHaveBeenCalled();
    expect(missionCreate).not.toHaveBeenCalled();
    expect(runCreate).not.toHaveBeenCalled();
    expect(taskCreate).not.toHaveBeenCalled();
  });
});
