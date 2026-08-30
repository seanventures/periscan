import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedContext, RuntimeServiceDeps } from "./runtime-services.js";
import { AppServiceError } from "./runtime-services.js";
import { createScheduleServices } from "./services/schedules.js";

describe("runSchedule nextRunAt CAS claim", () => {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const scheduleId = randomUUID();
  const scopeId = randomUUID();
  const dueNextRunAt = new Date("2026-08-01T00:00:00.000Z");

  function authContext(): AuthenticatedContext {
    return {
      membership: {
        membershipId: randomUUID(),
        role: "Admin",
        tenantId,
        userId
      },
      session: {
        sessionId: randomUUID(),
        tenantId,
        userId
      },
      tenant: {
        name: "Schedule CAS Tenant",
        slug: "schedule-cas",
        tenantId
      },
      user: {
        email: "admin@example.com",
        userId
      }
    } as AuthenticatedContext;
  }

  function dueSchedule() {
    return {
      config: {},
      createdBy: userId,
      frequency: "Daily",
      lastDiff: null,
      lastMissionId: null,
      lastRunAt: null,
      lastSnapshotId: null,
      missionType: "ValidationSnapshot",
      nextRunAt: dueNextRunAt,
      scheduleId,
      scopeIds: [scopeId],
      status: "Active",
      tenantId
    };
  }

  it("refuses a second claimer when nextRunAt CAS misses", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const services = createScheduleServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      missionQueue: {
        enqueueValidationJob: vi.fn()
      },
      prisma: {
        missionSchedule: {
          findFirst: vi.fn().mockResolvedValue(dueSchedule()),
          updateMany
        },
        scope: {
          findMany: vi.fn()
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    await expect(
      services.runSchedule(authContext(), scheduleId)
    ).rejects.toMatchObject({
      code: "schedule_already_claimed",
      statusCode: 409
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nextRunAt: dueNextRunAt,
          scheduleId,
          status: "Active",
          tenantId
        })
      })
    );
  });

  it("skips already-claimed schedules in runDueSchedules without failing the sweep", async () => {
    const runSchedule = vi
      .fn()
      .mockRejectedValueOnce(
        new AppServiceError(
          "Schedule was already claimed by another runner.",
          409,
          "schedule_already_claimed"
        )
      )
      .mockResolvedValueOnce({
        diff: { status: "NoPreviousRun" },
        schedule: dueSchedule(),
        snapshot: null
      });

    const services = createScheduleServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      missionQueue: {
        enqueueValidationJob: vi.fn()
      },
      prisma: {
        missionSchedule: {
          findMany: vi.fn().mockResolvedValue([
            dueSchedule(),
            { ...dueSchedule(), scheduleId: randomUUID() }
          ])
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    // Bind this.runSchedule for the service object under test.
    const bound = {
      ...services,
      runSchedule
    };

    const summary = await bound.runDueSchedules(authContext());
    expect(summary.runCount).toBe(1);
    expect(runSchedule).toHaveBeenCalledTimes(2);
  });
});
