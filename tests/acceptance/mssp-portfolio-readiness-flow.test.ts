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
 * MSSP client readiness reflects LIFETIME validation activity, not the current
 * billing period. A client that validated in a previous period must not be
 * demoted to "NeedsValidation" just because the billing meter reset this month.
 */
describe("MSSP client portfolio readiness", () => {
  it("does not demote a previously-validated client to NeedsValidation", async () => {
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
          email: uniqueEmail("mssp-owner"),
          name: "MSSP Owner",
          password: "periscan-mssp-password",
          tenantName: "Portfolio MSSP",
          tenantType: "MSSP"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);

      const client = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          clientAdminEmail: uniqueEmail("client-admin"),
          clientAdminName: "Client Admin",
          name: "Portfolio Client"
        },
        url: "/api/v1/tenants/current/clients"
      });
      expect(client.statusCode).toBe(201);
      const clientTenantId = client.json().tenant.tenantId as string;
      const clientHeaders = { "x-periscan-tenant-id": clientTenantId };

      // Client is onboarded: a connected integration + a verified scope.
      const integration = await app.inject({
        cookies: authCookies(cookie),
        headers: clientHeaders,
        method: "POST",
        payload: { connectorKey: "github", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(integration.statusCode).toBe(201);

      const scope = await app.inject({
        cookies: authCookies(cookie),
        headers: clientHeaders,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `portfolio-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        headers: clientHeaders,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const clientMembership = await prisma.membership.findFirstOrThrow({
        where: { tenantId: clientTenantId }
      });

      // A validation run from a PREVIOUS billing period (created ~40 days ago)
      // and NONE in the current period.
      const mission = await prisma.validationMission.create({
        data: {
          createdAt: new Date(Date.now() - 40 * 86_400_000),
          evidenceIds: [],
          missionType: "ValidationSnapshot",
          requestedBy: clientMembership.userId,
          safetyLevel: "PassiveReadOnly",
          scopeId,
          scopeIds: [scopeId],
          status: "Completed",
          tenantId: clientTenantId
        }
      });
      await prisma.validationRun.create({
        data: {
          createdAt: new Date(Date.now() - 40 * 86_400_000),
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: "periscan.acceptance.portfolio",
          safetyLevel: "PassiveReadOnly",
          scopeId,
          status: "Completed",
          target: {},
          techniqueIds: [],
          tenantId: clientTenantId
        }
      });

      const portfolio = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/client-portfolio"
      });
      expect(portfolio.statusCode).toBe(200);
      const clientSummary = (
        portfolio.json().clients as Array<{
          readinessStatus: string;
          tenant: { tenantId: string };
        }>
      ).find((entry) => entry.tenant.tenantId === clientTenantId);
      expect(clientSummary).toBeDefined();
      // Lifetime validation activity exists, so the client is past onboarding —
      // never "NeedsValidation" / "NeedsScope" / "NeedsIntegration".
      expect(clientSummary?.readinessStatus).not.toBe("NeedsValidation");
      expect(["Active", "Attention"]).toContain(clientSummary?.readinessStatus);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
