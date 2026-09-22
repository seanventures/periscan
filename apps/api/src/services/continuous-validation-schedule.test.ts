import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTINUOUS_VALIDATION_HONESTY_NOTE,
  CONTINUOUS_VALIDATION_PRODUCT_NAME,
  computeScopeAssetHash
} from "@periscan/shared";

import { createScheduleServices } from "./schedules.js";
import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";

/**
 * Hourly / Continuous cadence: policy-approved scanning without a click
 * each time. Denied and out-of-window fires must not queue.
 */
describe("Hourly / Continuous validation schedule fire", () => {
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
  let auditEventCreate: ReturnType<typeof vi.fn>;
  let remediationUpdate: ReturnType<typeof vi.fn>;
  let services: ReturnType<typeof createScheduleServices>;
  let createSnapshot: ReturnType<typeof vi.fn>;
  let scheduleRow: Record<string, unknown>;
  let scopeRow: Record<string, unknown>;

  function bindServices() {
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
      frequency: scheduleRow.frequency,
      missionType: "ContinuousValidation",
      status: "Active",
      nextRunAt: new Date("2026-09-17T15:00:00.000Z"),
      lastRunAt: new Date("2026-09-17T14:00:00.000Z"),
      lastSnapshotId: "77777777-7777-4777-8777-777777777777",
      lastMissionId: "66666666-6666-4666-8666-666666666666",
      scopeIds: [scopeId],
      config: {},
      lastDiff: null,
      ...(data as object)
    }));
    auditEventCreate = vi.fn(async () => ({}));
    remediationUpdate = vi.fn(async () => ({ count: 0 }));

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
      createdAt: "2026-09-17T14:00:00.000Z",
      tenantId
    }));

    const prisma = {
      missionSchedule: {
        findFirst: vi.fn(async () => scheduleRow),
        findMany: vi.fn(async () => [scheduleRow]),
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
        create: auditEventCreate
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
        findMany: vi.fn(async () => []),
        update: remediationUpdate
      }
    };

    services = createScheduleServices({
      emitTenantWebhook: vi.fn(async () => undefined),
      missionQueue: { enqueueValidationJob },
      prisma
    } as unknown as RuntimeServiceDeps);

    Object.assign(services, { createSnapshot });
  }

  beforeEach(() => {
    scheduleRow = {
      scheduleId,
      tenantId,
      createdBy: userId,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      frequency: "Hourly",
      missionType: "ContinuousValidation",
      status: "Active",
      nextRunAt: new Date("2026-09-17T13:00:00.000Z"),
      lastRunAt: null,
      lastSnapshotId: null,
      lastMissionId: null,
      scopeIds: [scopeId],
      config: {
        moduleIds: [
          "gitleaks.repo_secrets",
          "nuclei.external_exposure_safe",
          "recon.dns_probe",
          "periscan.detection_marker_emit_observe",
          "atomic.control_validation_safe"
        ],
        scheduleTiming: {
          blackoutWindows: [],
          runAtLocalTime: "09:00",
          timeZone: "UTC"
        }
      },
      lastDiff: null
    };
    scopeRow = {
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
    bindServices();
  });

  it("queues Community/safe modules on an allowed Hourly fire and audits it", async () => {
    const result = await services.runSchedule(context, scheduleId);

    expect(result.jobsQueued).toBeGreaterThan(0);
    const runModuleIds = validationRunCreate.mock.calls.map(
      (call) => (call[0] as { data: { moduleId: string } }).data.moduleId
    );
    expect(runModuleIds).toEqual(
      expect.arrayContaining([
        "nuclei.external_exposure_safe",
        "recon.dns_probe"
      ])
    );
    expect(runModuleIds).not.toContain("atomic.control_validation_safe");
    expect(enqueueValidationJob).toHaveBeenCalled();
    expect(auditEventCreate).toHaveBeenCalled();
    expect(result.diff.summary).toContain(CONTINUOUS_VALIDATION_PRODUCT_NAME);
    expect(result.diff.summary).not.toMatch(
      /always-on BAS|NodeZero|autonomous pentest/i
    );
    expect(result.diff.summary).toContain(
      CONTINUOUS_VALIDATION_HONESTY_NOTE.slice(0, 32)
    );
    expect(remediationUpdate).not.toHaveBeenCalled();
  });

  it("does not queue when the fire is inside a maintenance window", async () => {
    (scheduleRow.config as Record<string, unknown>).maintenanceWindows = [
      {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        endTime: "23:59",
        startTime: "00:00"
      }
    ];

    const result = await services.runSchedule(context, scheduleId);

    expect(result.jobsQueued).toBe(0);
    expect(enqueueValidationJob).not.toHaveBeenCalled();
    expect(validationRunCreate).not.toHaveBeenCalled();
    expect(auditEventCreate).toHaveBeenCalled();
    expect(result.diff.summary).toMatch(/maintenance window|not queued/i);
  });

  it("does not queue when the tenant hourly quota is exhausted", async () => {
    (scheduleRow.config as Record<string, unknown>).continuousValidation = {
      firesInUtcDay: 1,
      quotaPerUtcDay: 1,
      quotaUtcDay: new Date().toISOString().slice(0, 10)
    };

    const result = await services.runSchedule(context, scheduleId);

    expect(result.jobsQueued).toBe(0);
    expect(enqueueValidationJob).not.toHaveBeenCalled();
    expect(result.diff.summary).toMatch(/quota/i);
  });

  it("queues the same safe modules on a Continuous drift fire when the asset hash is stale", async () => {
    scheduleRow.frequency = "Continuous";
    scheduleRow.nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
    const current = computeScopeAssetHash({
      scopeId,
      scopeType: "Domain",
      value: "continuous.example.com"
    });
    (scheduleRow.config as Record<string, unknown>).continuousValidation = {
      lastAssetHashes: { [scopeId]: "stale-hash-not-current" }
    };
    expect(current).not.toBe("stale-hash-not-current");

    const result = await services.runSchedule(context, scheduleId, {
      fireKind: "drift"
    });

    expect(result.jobsQueued).toBeGreaterThan(0);
    expect(enqueueValidationJob).toHaveBeenCalled();
    const runModuleIds = validationRunCreate.mock.calls.map(
      (call) => (call[0] as { data: { moduleId: string } }).data.moduleId
    );
    expect(runModuleIds).toContain("nuclei.external_exposure_safe");
    expect(runModuleIds).not.toContain("atomic.control_validation_safe");
  });

  it("does not queue a Continuous drift fire when lastValidatedAt is still fresh", async () => {
    scheduleRow.frequency = "Continuous";
    const current = computeScopeAssetHash({
      scopeId,
      scopeType: "Domain",
      value: "continuous.example.com"
    });
    (scheduleRow.config as Record<string, unknown>).continuousValidation = {
      lastAssetHashes: { [scopeId]: current },
      lastValidatedAtByScope: { [scopeId]: new Date().toISOString() }
    };

    const result = await services.runSchedule(context, scheduleId, {
      fireKind: "drift"
    });

    expect(result.jobsQueued).toBe(0);
    expect(enqueueValidationJob).not.toHaveBeenCalled();
  });
});
