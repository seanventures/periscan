import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTINUOUS_EASM_CHANGE_DETECTION_NOTE,
  enrichContinuousEasmDiffSummary,
  resolveContinuousEasmModuleIds
} from "@periscan/shared";

import { createScheduleServices } from "./schedules.js";
import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";

/**
 * Wave C — ContinuousValidation schedule fire queues allowlisted safe EASM
 * modules on verified Domain scopes and never claims a living map.
 */
describe("Wave C continuous EASM schedule fire", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const scheduleId = "33333333-3333-4333-8333-333333333333";
  const scopeId = "44444444-4444-4444-8444-444444444444";
  const decisionId = "55555555-5555-4555-8555-555555555555";

  const context = {
    membership: { role: "Owner" },
    tenant: { tenantId },
    user: { userId }
  } as unknown as AuthenticatedContext;

  let enqueueValidationJob: ReturnType<typeof vi.fn>;
  let validationMissionCreate: ReturnType<typeof vi.fn>;
  let validationRunCreate: ReturnType<typeof vi.fn>;
  let missionScheduleUpdate: ReturnType<typeof vi.fn>;
  let services: ReturnType<typeof createScheduleServices>;
  let createSnapshot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    enqueueValidationJob = vi.fn(async () => undefined);
    validationMissionCreate = vi.fn(async ({ data }: { data: unknown }) => ({
      missionId: "66666666-6666-4666-8666-666666666666",
      ...(data as object)
    }));
    validationRunCreate = vi.fn(
      async ({ data }: { data: { moduleId: string } }) => ({
        runId: `run-${data.moduleId}`,
        ...data
      })
    );
    missionScheduleUpdate = vi.fn(async ({ data }: { data: unknown }) => ({
      scheduleId,
      tenantId,
      createdBy: userId,
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      frequency: "Weekly",
      missionType: "ContinuousValidation",
      status: "Active",
      nextRunAt: new Date("2026-08-05T00:00:00.000Z"),
      lastRunAt: new Date("2026-07-29T12:00:00.000Z"),
      lastSnapshotId: "77777777-7777-4777-8777-777777777777",
      lastMissionId: "66666666-6666-4666-8666-666666666666",
      scopeIds: [scopeId],
      config: {},
      lastDiff: null,
      ...(data as object)
    }));

    const scheduleRow = {
      scheduleId,
      tenantId,
      createdBy: userId,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      frequency: "Weekly",
      missionType: "ContinuousValidation",
      status: "Active",
      nextRunAt: new Date("2026-07-29T00:00:00.000Z"),
      lastRunAt: null,
      lastSnapshotId: null,
      lastMissionId: null,
      scopeIds: [scopeId],
      config: {
        scheduleTiming: {
          blackoutWindows: [],
          runAtLocalTime: "09:00",
          timeZone: "UTC"
        }
      },
      lastDiff: null
    };

    const scopeRow = {
      scopeId,
      tenantId,
      scopeType: "Domain",
      value: "continuous.example.com",
      verificationStatus: "Verified",
      externalValidationProfileId: "safe-baseline",
      maxSafetyLevel: "ActiveNonInvasive",
      assetClass: "BusinessApplication",
      businessCriticality: "Moderate",
      purdueLevel: null,
      segmentName: null,
      sensitivity: "Moderate",
      tags: []
    };

    const policyDecision = {
      policyDecisionId: decisionId,
      tenantId,
      userId,
      scopeId,
      missionType: "ContinuousValidation",
      safetyLevel: "ActiveNonInvasive",
      outcome: "Allowed",
      approvalState: "NotRequired",
      executionEnvironment: "ExternalPoA",
      requestedAction: {},
      rationale: "ok",
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    createSnapshot = vi.fn(async () => ({
      snapshotId: "77777777-7777-4777-8777-777777777777",
      missionId: "88888888-8888-4888-8888-888888888888",
      topAttackPaths: [],
      audience: "Security Team",
      createdAt: "2026-07-29T12:00:00.000Z",
      tenantId
    }));

    const prisma = {
      missionSchedule: {
        findFirst: vi.fn(async () => scheduleRow),
        update: missionScheduleUpdate,
        updateMany: vi.fn(async () => ({ count: 1 }))
      },
      scope: {
        findMany: vi.fn(async () => [scopeRow])
      },
      policyDecision: {
        create: vi.fn(async ({ data }: { data: object }) => ({
          ...policyDecision,
          ...data
        })),
        findMany: vi.fn(async () => [])
      },
      validationMission: {
        create: validationMissionCreate
      },
      validationRun: {
        create: validationRunCreate,
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => ({}))
      },
      tenant: {
        findUnique: vi.fn(async () => ({
          billingPackageKey: "CoreValidation",
          destructiveValidationEnabled: false,
          offensiveValidationEnabled: false,
          tenantId,
          trialEndsAt: null,
          trialPreviousBillingPackageKey: null
        }))
      },
      tenantSetting: {
        findUnique: vi.fn(async () => null)
      },
      runner: {
        findMany: vi.fn(async () => [])
      },
      attackPath: {
        findMany: vi.fn(async () => []),
        updateMany: vi.fn(async () => ({ count: 0 }))
      },
      remediationTask: {
        findMany: vi.fn(async () => [])
      }
    };

    services = createScheduleServices({
      emitTenantWebhook: vi.fn(async () => undefined),
      missionQueue: { enqueueValidationJob },
      prisma
    } as unknown as RuntimeServiceDeps);

    // createSnapshot is on the composed AppServices; runSchedule calls this.createSnapshot
    Object.assign(services, { createSnapshot });
  });

  it("queues nuclei.external_exposure_safe for ContinuousValidation on verified Domain", async () => {
    const result = await services.runSchedule(context, scheduleId);

    expect(createSnapshot).toHaveBeenCalled();
    expect(validationMissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          missionType: "ContinuousValidation",
          safetyLevel: "ActiveNonInvasive",
          scopeId
        })
      })
    );

    const runModuleIds = validationRunCreate.mock.calls.map(
      (call) => (call[0] as { data: { moduleId: string } }).data.moduleId
    );
    expect(runModuleIds).toContain("nuclei.external_exposure_safe");
    expect(runModuleIds).toContain("periscan.dns_resolution_check");
    expect(runModuleIds).not.toContain("atomic.control_validation_safe");
    expect(enqueueValidationJob).toHaveBeenCalled();
    expect(result.diff.summary).toContain("nuclei.external_exposure_safe");
    expect(result.diff.summary).toContain(
      CONTINUOUS_EASM_CHANGE_DETECTION_NOTE
    );
    expect(result.diff.summary).not.toMatch(/living map/i);
  });

  it("respects config.moduleIds allowlist intersection", () => {
    expect(
      resolveContinuousEasmModuleIds({
        configModuleIds: ["nuclei.external_exposure_safe", "malware.pack"],
        scopeType: "Domain"
      })
    ).toEqual(["nuclei.external_exposure_safe"]);
  });

  it("keeps change-detection language honest", () => {
    const summary = enrichContinuousEasmDiffSummary({
      baseSummary: "Unchanged.",
      moduleIds: ["nuclei.external_exposure_safe"],
      missionQueued: true
    });
    expect(summary).toMatch(/Queued continuous EASM/);
    expect(summary).toContain(CONTINUOUS_EASM_CHANGE_DETECTION_NOTE);
  });
});
