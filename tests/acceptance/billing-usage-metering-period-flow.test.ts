import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

function meterQuantity(body: unknown, meterName: string): number {
  const meters = (
    body as { meters: Array<{ meterName: string; quantity: number }> }
  ).meters;
  return meters.find((meter) => meter.meterName === meterName)!.quantity;
}

/**
 * Consumption meters bill per metering period (the current calendar month), so
 * activity from a previous period must NOT be counted — otherwise monthly usage
 * accumulates forever and over-bills. Inventory meters stay as current totals.
 */
describe("Billing usage metering period", () => {
  it("counts only current-period consumption, not all-time activity", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("billing-owner"),
          name: "Billing Owner",
          password: "periscan-billing-password",
          tenantName: "Billing Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      const tenantId = owner.json().tenant.tenantId as string;
      const membership = await prisma.membership.findFirstOrThrow({
        where: { tenantId }
      });

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `billing-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;

      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ValidationSnapshot",
          requestedBy: membership.userId,
          safetyLevel: "PassiveReadOnly",
          scopeId,
          scopeIds: [scopeId],
          status: "Completed",
          tenantId
        }
      });

      const runData = {
        evidenceIds: [],
        missionId: mission.missionId,
        moduleId: "periscan.acceptance.billing",
        safetyLevel: "PassiveReadOnly" as const,
        scopeId,
        status: "Completed" as const,
        target: {},
        techniqueIds: [],
        tenantId
      };

      const baseline = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/usage"
      });
      expect(baseline.statusCode).toBe(200);
      const baselineRuns = meterQuantity(baseline.json(), "ValidationRuns");

      // A run from a previous metering period (created ~40 days ago).
      await prisma.validationRun.create({
        data: { ...runData, createdAt: new Date(Date.now() - 40 * 86_400_000) }
      });

      const afterBackdated = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/usage"
      });
      // The previous-period run is NOT billed this period.
      expect(meterQuantity(afterBackdated.json(), "ValidationRuns")).toBe(
        baselineRuns
      );

      // A run in the current period IS billed.
      await prisma.validationRun.create({ data: runData });

      const afterCurrent = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/usage"
      });
      expect(meterQuantity(afterCurrent.json(), "ValidationRuns")).toBe(
        baselineRuns + 1
      );

      // The declared metering period is the current calendar month (UTC).
      const periodStart = new Date(
        afterCurrent.json().meteringPeriodStart as string
      );
      const nowUtc = new Date();
      expect(periodStart.getUTCFullYear()).toBe(nowUtc.getUTCFullYear());
      expect(periodStart.getUTCMonth()).toBe(nowUtc.getUTCMonth());
      expect(periodStart.getUTCDate()).toBe(1);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
