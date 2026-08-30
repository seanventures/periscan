import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

describe("Integration sync-schedule acceptance workflow", () => {
  it("schedules recurring connector sync and runs due integrations", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("sched-owner"),
          name: "Sched Owner",
          password: "periscan-sched-password",
          tenantName: "Sched Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { connectorKey: "tenable", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;
      // A freshly created integration has no recurring sync configured, and the
      // API surfaces that (not only the DB).
      expect(created.json().syncFrequency ?? null).toBeNull();
      expect(created.json().nextSyncAt ?? null).toBeNull();

      // Schedule a daily recurring sync.
      const scheduled = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { frequency: "Daily" },
        url: `/api/v1/integrations/${integrationId}/sync-schedule`
      });
      expect(scheduled.statusCode).toBe(200);
      // The set-schedule response surfaces the persisted schedule...
      expect(scheduled.json().syncFrequency).toBe("Daily");
      expect(scheduled.json().nextSyncAt).not.toBeNull();
      const afterSchedule = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      expect(afterSchedule.syncFrequency).toBe("Daily");
      expect(afterSchedule.nextSyncAt).not.toBeNull();

      // ...and so does a subsequent read of the integration list (read-back).
      const list = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/integrations"
      });
      expect(list.statusCode).toBe(200);
      const listed = (
        list.json().items as Array<{
          integrationId: string;
          nextSyncAt: string | null;
          syncFrequency: string | null;
        }>
      ).find((item) => item.integrationId === integrationId);
      expect(listed?.syncFrequency).toBe("Daily");
      expect(listed?.nextSyncAt).not.toBeNull();

      // Force the schedule due, then run due syncs.
      await prisma.integration.update({
        data: { nextSyncAt: new Date(Date.now() - 60_000) },
        where: { integrationId }
      });
      const ran = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: "/api/v1/integrations/sync-due"
      });
      expect(ran.statusCode).toBe(200);
      expect(ran.json().syncedCount).toBeGreaterThanOrEqual(1);
      expect(ran.json().integrationIds).toContain(integrationId);

      // nextSyncAt advanced into the future.
      const afterRun = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      expect(afterRun.nextSyncAt?.getTime() ?? 0).toBeGreaterThan(Date.now());
      expect(afterRun.lastSyncAt).not.toBeNull();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
