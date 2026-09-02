import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedContext, RuntimeServiceDeps } from "./runtime-services.js";
import {
  createValidationServices,
  isMissionStartable,
  STARTABLE_MISSION_STATUSES
} from "./services/validation.js";

describe("startMission startability guard", () => {
  it("only Draft and RequiresApproval missions are startable", () => {
    expect([...STARTABLE_MISSION_STATUSES].sort()).toEqual([
      "Draft",
      "RequiresApproval"
    ]);
    expect(isMissionStartable("Draft")).toBe(true);
    expect(isMissionStartable("RequiresApproval")).toBe(true);
    for (const status of [
      "Queued",
      "Running",
      "Completed",
      "Failed",
      "DeniedByPolicy",
      "Cancelled"
    ]) {
      expect(isMissionStartable(status)).toBe(false);
    }
  });

  it("refuses to restart a Completed mission before deleting runs", async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const missionId = randomUUID();
    const $transaction = vi.fn();
    const validationRunDeleteMany = vi.fn();

    const services = createValidationServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      missionQueue: {
        enqueueValidationJob: vi.fn()
      },
      prisma: {
        $transaction,
        auditEvent: {
          create: vi.fn()
        },
        tenant: {
          findUnique: vi.fn().mockResolvedValue({
            billingPackageKey: "LightExternalScan",
            tenantId,
            trialEndsAt: null,
            trialStatus: null
          })
        },
        validationMission: {
          findFirst: vi.fn().mockResolvedValue({
            missionId,
            missionType: "ControlValidation",
            policyDecisionId: randomUUID(),
            safetyLevel: "PassiveReadOnly",
            scopeId: randomUUID(),
            status: "Completed",
            tenantId
          })
        },
        validationRun: {
          deleteMany: validationRunDeleteMany
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    const context = {
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
        name: "Mission Guard Tenant",
        slug: "mission-guard",
        tenantId
      },
      user: {
        email: "admin@example.com",
        userId
      }
    } as AuthenticatedContext;

    await expect(
      services.startMission(context, missionId, {
        moduleIds: ["atomic.control_validation_safe"]
      })
    ).rejects.toMatchObject({
      code: "mission_not_startable",
      statusCode: 409
    });

    expect($transaction).not.toHaveBeenCalled();
    expect(validationRunDeleteMany).not.toHaveBeenCalled();
  });
});
