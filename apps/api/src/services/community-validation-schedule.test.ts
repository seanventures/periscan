import { beforeEach, describe, expect, it, vi } from "vitest";

import { createScheduleServices } from "./schedules.js";
import {
  AppServiceError,
  type AuthenticatedContext,
  type RuntimeServiceDeps
} from "../runtime-services.js";

/**
 * PERISCAN-509 — ValidationSnapshot schedules may opt into the Community
 * validation pack. Default (no flag) stays snapshot-only.
 */
describe("Community validation schedule fire", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const scheduleId = "33333333-3333-4333-8333-333333333333";
  const scopeId = "44444444-4444-4444-8444-444444444444";
  const secondScopeId = "99999999-9999-4999-8999-999999999999";
  const decisionId = "55555555-5555-4555-8555-555555555555";
  const communityMissionId = "66666666-6666-4666-8666-666666666666";
  const nucleiMissionId = "77777777-7777-4777-8777-777777777777";
  const snapshotId = "88888888-8888-4888-8888-888888888888";
  const snapshotMissionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  const context = {
    membership: { role: "Owner" },
    tenant: { tenantId },
    user: { userId }
  } as unknown as AuthenticatedContext;

  let services: ReturnType<typeof createScheduleServices>;
  let createSnapshot: ReturnType<typeof vi.fn>;
  let startCommunityValidation: ReturnType<typeof vi.fn>;
  let missionScheduleUpdate: ReturnType<typeof vi.fn>;
  let scheduleRow: Record<string, unknown>;
  let scopeRows: Array<Record<string, unknown>>;

  function scopeRow(id: string, value: string) {
    return {
      scopeId: id,
      tenantId,
      scopeType: "Domain",
      value,
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
  }

  function bindServices() {
    const policyDecision = {
      policyDecisionId: decisionId,
      tenantId,
      userId,
      scopeId,
      missionType: "ValidationSnapshot",
      safetyLevel: "PassiveReadOnly",
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
      snapshotId,
      missionId: snapshotMissionId,
      topAttackPaths: [],
      audience: "Security Team",
      createdAt: "2026-07-29T12:00:00.000Z",
      tenantId
    }));
    startCommunityValidation = vi.fn(async () => ({
      editionId: "community",
      jobsQueued: 1,
      mission: {
        createdAt: "2026-07-29T12:00:00.000Z",
        evidenceIds: [],
        missionId: communityMissionId,
        missionType: "ValidationSnapshot",
        policyDecisionId: decisionId,
        requestedBy: userId,
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        scopeIds: [scopeId],
        status: "Queued",
        tenantId,
        updatedAt: "2026-07-29T12:00:00.000Z"
      },
      moduleIds: ["gitleaks.repo_secrets"],
      nucleiMissionId,
      nucleiSkipReason: null,
      runs: [],
      scopeType: "Domain",
      target: { hostname: "community.example.com" }
    }));
    missionScheduleUpdate = vi.fn(async ({ data }: { data: unknown }) => ({
      scheduleId,
      tenantId,
      createdBy: userId,
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      frequency: "Weekly",
      missionType: "ValidationSnapshot",
      status: "Active",
      nextRunAt: new Date("2026-08-05T00:00:00.000Z"),
      lastRunAt: new Date("2026-07-29T12:00:00.000Z"),
      lastSnapshotId: null,
      lastMissionId: null,
      scopeIds: scheduleRow.scopeIds,
      config: {},
      lastDiff: null,
      ...(data as object)
    }));

    const prisma = {
      missionSchedule: {
        findFirst: vi.fn(async () => scheduleRow),
        update: missionScheduleUpdate,
        updateMany: vi.fn(async () => ({ count: 1 }))
      },
      scope: {
        findMany: vi.fn(async () => scopeRows)
      },
      policyDecision: {
        create: vi.fn(async ({ data }: { data: object }) => ({
          ...policyDecision,
          ...data
        })),
        findMany: vi.fn(async () => [])
      },
      validationMission: {
        create: vi.fn(async ({ data }: { data: unknown }) => ({
          missionId: snapshotMissionId,
          ...(data as object)
        }))
      },
      validationRun: {
        create: vi.fn(async ({ data }: { data: { moduleId?: string } }) => ({
          runId: `run-${data.moduleId ?? "module"}`,
          ...data
        })),
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
      missionQueue: { enqueueValidationJob: vi.fn(async () => undefined) },
      prisma
    } as unknown as RuntimeServiceDeps);

    Object.assign(services, { createSnapshot, startCommunityValidation });
  }

  beforeEach(() => {
    scheduleRow = {
      scheduleId,
      tenantId,
      createdBy: userId,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      frequency: "Weekly",
      missionType: "ValidationSnapshot",
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
    scopeRows = [scopeRow(scopeId, "community.example.com")];
    bindServices();
  });

  it("keeps snapshot composition when communityValidation is unset", async () => {
    const result = await services.runSchedule(context, scheduleId);

    expect(createSnapshot).toHaveBeenCalledOnce();
    expect(startCommunityValidation).not.toHaveBeenCalled();
    expect(result.snapshot?.snapshotId).toBe(snapshotId);
    expect(result.schedule.lastMissionId).toBe(snapshotMissionId);
  });

  it("starts the Community pack instead of composing a snapshot when flagged", async () => {
    (scheduleRow.config as Record<string, unknown>).communityValidation = true;

    const result = await services.runSchedule(context, scheduleId);

    expect(createSnapshot).not.toHaveBeenCalled();
    expect(startCommunityValidation).toHaveBeenCalledOnce();
    expect(startCommunityValidation).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        policyDecisionId: expect.any(String),
        scopeId
      })
    );
    expect(result.snapshot ?? null).toBeNull();
    expect(result.schedule.lastMissionId).toBe(communityMissionId);
    expect(result.diff.summary).toMatch(/Community validation pack/i);
    expect(result.diff.summary).toMatch(/snapshot report/i);

    const successUpdate = missionScheduleUpdate.mock.calls
      .map((call) => call[0] as { data: Record<string, unknown> })
      .find((call) => call.data.lastMissionId === communityMissionId);
    expect(successUpdate).toBeDefined();
    const persisted = successUpdate!.data.config as Record<string, unknown>;
    expect(persisted.communityValidation).toBe(true);
    expect(persisted.lastCommunityStart).toEqual(
      expect.objectContaining({
        missionIds: [communityMissionId],
        nucleiMissionIds: [nucleiMissionId]
      })
    );
  });

  it("starts Community validation for each verified scope on the schedule", async () => {
    (scheduleRow.config as Record<string, unknown>).communityValidation = true;
    scheduleRow.scopeIds = [scopeId, secondScopeId];
    scopeRows = [
      scopeRow(scopeId, "community.example.com"),
      scopeRow(secondScopeId, "other.example.com")
    ];
    const secondMissionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    startCommunityValidation.mockImplementation(
      async (_ctx: unknown, input: { scopeId: string }) => ({
        editionId: "community",
        jobsQueued: 1,
        mission: {
          createdAt: "2026-07-29T12:00:00.000Z",
          evidenceIds: [],
          missionId:
            input.scopeId === secondScopeId
              ? secondMissionId
              : communityMissionId,
          missionType: "ValidationSnapshot",
          policyDecisionId: decisionId,
          requestedBy: userId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          status: "Queued",
          tenantId,
          updatedAt: "2026-07-29T12:00:00.000Z"
        },
        moduleIds: ["web.zap_baseline"],
        nucleiMissionId: null,
        nucleiSkipReason: "Nuclei skipped in this fixture.",
        runs: [],
        scopeType: "Domain",
        target: {}
      })
    );

    const result = await services.runSchedule(context, scheduleId);

    expect(startCommunityValidation).toHaveBeenCalledTimes(2);
    expect(createSnapshot).not.toHaveBeenCalled();
    expect(result.schedule.lastMissionId).toBe(communityMissionId);
    const successUpdate = missionScheduleUpdate.mock.calls
      .map((call) => call[0] as { data: Record<string, unknown> })
      .find((call) => call.data.lastMissionId === communityMissionId);
    const persisted = successUpdate!.data.config as Record<string, unknown>;
    expect(persisted.lastCommunityStart).toEqual(
      expect.objectContaining({
        missionIds: [communityMissionId, secondMissionId]
      })
    );
  });

  it("does not fall back to snapshot when Community start fails", async () => {
    (scheduleRow.config as Record<string, unknown>).communityValidation = true;
    startCommunityValidation.mockRejectedValueOnce(
      new AppServiceError(
        "No Community edition engines apply to Domain scopes yet.",
        400,
        "community_suite_empty"
      )
    );

    await expect(
      services.runSchedule(context, scheduleId)
    ).rejects.toMatchObject({
      code: "schedule_community_validation_failed",
      statusCode: 409
    });
    expect(createSnapshot).not.toHaveBeenCalled();
    expect(startCommunityValidation).toHaveBeenCalledOnce();
  });

  it("does not treat ContinuousValidation + the flag as a Community start", async () => {
    scheduleRow.missionType = "ContinuousValidation";
    (scheduleRow.config as Record<string, unknown>).communityValidation = true;
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
      lastSnapshotId: snapshotId,
      lastMissionId: snapshotMissionId,
      scopeIds: [scopeId],
      config: {},
      lastDiff: null,
      ...(data as object)
    }));
    bindServices();
    (scheduleRow.config as Record<string, unknown>).communityValidation = true;
    scheduleRow.missionType = "ContinuousValidation";

    await services.runSchedule(context, scheduleId);

    expect(createSnapshot).toHaveBeenCalledOnce();
    expect(startCommunityValidation).not.toHaveBeenCalled();
  });
});
