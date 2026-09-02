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

async function signupTenant(
  app: Awaited<ReturnType<typeof buildApp>>,
  prefix: string
) {
  const signup = await app.inject({
    method: "POST",
    payload: {
      email: uniqueEmail(prefix),
      name: `${prefix} Owner`,
      password: "periscan-engage-password",
      tenantName: `${prefix} Tenant`
    },
    url: "/api/v1/auth/signup"
  });
  expect(signup.statusCode).toBe(201);
  return getSessionCookie(signup);
}

describe("Engagement persistence acceptance workflow", () => {
  it("persists a run, reads it back tenant-scoped, and audits both", async () => {
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
      const cookie = await signupTenant(app, "engage-persist");

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `persist-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      // Run an engagement (passive step executes in fixture mode).
      const run = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          mode: "Execute",
          plan: [{ moduleId: "periscan.dns_resolution_check" }],
          scopeId
        },
        url: "/api/v1/engagements"
      });
      expect(run.statusCode).toBe(201);
      const runBody = run.json() as {
        engagementId: string;
        status: string;
        steps: Array<{ moduleId: string; status: string }>;
      };
      const engagementId = runBody.engagementId;
      expect(runBody.status).toBe("Completed");

      // The engagement persists and reads back identically.
      const read = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/engagements/${engagementId}`
      });
      expect(read.statusCode).toBe(200);
      const readBody = read.json() as {
        engagementId: string;
        scopeId: string;
        status: string;
        steps: Array<{ moduleId: string; status: string }>;
      };
      expect(readBody.engagementId).toBe(engagementId);
      expect(readBody.scopeId).toBe(scopeId);
      expect(readBody.status).toBe("Completed");
      expect(readBody.steps[0]?.moduleId).toBe("periscan.dns_resolution_check");
      expect(readBody.steps[0]?.status).toBe("executed");

      // A persisted row exists for this tenant.
      const persisted = await prisma.engagement.findUnique({
        where: { engagementId }
      });
      expect(persisted).not.toBeNull();

      // Both the run and the read are audited as first-class events.
      const runAudit = await prisma.auditEvent.findFirst({
        where: { action: "engagement_run", entityId: engagementId }
      });
      const readAudit = await prisma.auditEvent.findFirst({
        where: { action: "engagement_read", entityId: engagementId }
      });
      expect(runAudit).not.toBeNull();
      expect(readAudit).not.toBeNull();

      // The list endpoint returns the persisted engagement, tenant-scoped.
      const list = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/engagements"
      });
      expect(list.statusCode).toBe(200);
      const listBody = list.json() as {
        items: Array<{ engagementId: string; status: string }>;
      };
      expect(
        listBody.items.some((item) => item.engagementId === engagementId)
      ).toBe(true);

      // Unknown id → 404.
      const missing = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/engagements/${randomUUID()}`
      });
      expect(missing.statusCode).toBe(404);

      // Cross-tenant isolation: a different tenant cannot read or list it.
      const otherCookie = await signupTenant(app, "engage-other");
      const crossTenant = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/engagements/${engagementId}`
      });
      expect(crossTenant.statusCode).toBe(404);

      const crossList = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: "/api/v1/engagements"
      });
      expect(crossList.statusCode).toBe(200);
      const crossListBody = crossList.json() as {
        items: Array<{ engagementId: string }>;
      };
      expect(
        crossListBody.items.some((item) => item.engagementId === engagementId)
      ).toBe(false);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
