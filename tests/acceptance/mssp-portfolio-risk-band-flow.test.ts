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
 * The MSSP portfolio classifies a client's attack-path severities using the
 * CANONICAL risk band (validation-adjusted score), matching the snapshot and
 * attack-path views — not a divergent raw-impactScore bucketing. A path with
 * impactScore 80 but an Exploitable validation state is High under the old raw
 * 90-threshold yet Critical canonically (+exploitability boosts the score).
 */
describe("MSSP portfolio risk-band consistency", () => {
  it("counts an exploitable path as Critical even when raw impactScore is < 90", async () => {
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
          email: uniqueEmail("band-owner"),
          name: "Band Owner",
          password: "periscan-band-password",
          tenantName: "Band MSSP",
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
          name: "Band Client"
        },
        url: "/api/v1/tenants/current/clients"
      });
      expect(client.statusCode).toBe(201);
      const clientTenantId = client.json().tenant.tenantId as string;

      // A path with raw impactScore 80 (High by raw 70–90 bucketing) but an
      // Exploitable validation state, which the canonical scorer lifts to
      // Critical.
      const entryNodeId = randomUUID();
      const impactNodeId = randomUUID();
      const path = await prisma.attackPath.create({
        data: {
          confidence: 0.85,
          entryNodeId,
          evidenceBasis: "Measured",
          evidenceIds: [],
          impactNodeId,
          impactScore: 80,
          name: "Exploitable internet-to-database path",
          tenantId: clientTenantId,
          validationState: "Exploitable"
        }
      });
      await prisma.pathNode.createMany({
        data: [
          {
            entityId: randomUUID(),
            entityType: "Asset",
            evidenceIds: [],
            label: "Internet-exposed web server",
            pathId: path.pathId,
            pathNodeId: entryNodeId,
            sequence: 0,
            tenantId: clientTenantId
          },
          {
            entityId: randomUUID(),
            entityType: "Asset",
            evidenceIds: [],
            label: "Production database",
            pathId: path.pathId,
            pathNodeId: impactNodeId,
            sequence: 1,
            tenantId: clientTenantId
          }
        ]
      });

      const portfolio = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/client-portfolio"
      });
      expect(portfolio.statusCode).toBe(200);
      const clientSummary = (
        portfolio.json().clients as Array<{
          risk: { criticalPaths: number; highPaths: number };
          tenant: { tenantId: string };
        }>
      ).find((entry) => entry.tenant.tenantId === clientTenantId);
      expect(clientSummary).toBeDefined();
      // Canonical band lifts the exploitable path to Critical (raw bucketing
      // would have left it as 0 critical / High).
      expect(clientSummary?.risk.criticalPaths).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
