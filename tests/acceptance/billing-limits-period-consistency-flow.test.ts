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

/**
 * /billing/limits and /billing/usage must agree on "missions this month": both
 * use the canonical UTC metering period. (Previously /billing/limits used a
 * local-timezone month boundary, so the two endpoints could disagree near month
 * boundaries / on non-UTC servers.) A previous-period mission is excluded.
 */
describe("Billing limits ↔ usage month consistency", () => {
  it("counts missions-this-month identically and excludes prior periods", async () => {
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
          email: uniqueEmail("limits-owner"),
          name: "Limits Owner",
          password: "periscan-limits-password",
          tenantName: "Limits Tenant"
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
          value: `limits-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;

      const baseMission = {
        evidenceIds: [],
        missionType: "ValidationSnapshot" as const,
        requestedBy: membership.userId,
        safetyLevel: "PassiveReadOnly" as const,
        scopeId,
        scopeIds: [scopeId],
        status: "Completed" as const,
        tenantId
      };
      // One mission this period, one from a previous period (~40 days ago).
      await prisma.validationMission.create({ data: baseMission });
      await prisma.validationMission.create({
        data: {
          ...baseMission,
          createdAt: new Date(Date.now() - 40 * 86_400_000)
        }
      });

      const limits = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/limits"
      });
      expect(limits.statusCode).toBe(200);
      const missionsThisMonth = limits.json().usage.missionsThisMonth as number;

      const usage = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/usage"
      });
      expect(usage.statusCode).toBe(200);
      const usageMissions = (
        usage.json().meters as Array<{ meterName: string; quantity: number }>
      ).find((meter) => meter.meterName === "ValidationMissions")!.quantity;

      // Both endpoints agree, and the previous-period mission is excluded.
      expect(missionsThisMonth).toBe(usageMissions);
      expect(missionsThisMonth).toBe(1);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
