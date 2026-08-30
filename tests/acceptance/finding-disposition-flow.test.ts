import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
    devMode: true,
    services: createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob() {
          return;
        }
      },
      prisma
    })
  });
}

describe("finding disposition flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["disposition"]);
      await prisma.$disconnect();
    }
  });

  it("sets, persists, audits, and clears an analyst disposition", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "disposition",
        "Disposition Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const ownerId = response.json().user.userId as string;
      const auth = authCookies(cookie);

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { scopeType: "Domain", value: "disposition.example.com" },
        url: "/api/v1/scopes"
      });
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      // Fixture posture-check with an expired TLS cert → a measured exposure that
      // surfaces as a validated finding.
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionMode: "Fixture",
          fixtures: {
            "periscan.tls_certificate_check": {
              fixtureCertificate: {
                issuer: "CN=Real CA,O=CA",
                subject: "CN=disposition.example.com,O=Acme",
                validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
                validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
              }
            }
          }
        },
        url: `/api/v1/scopes/${scopeId}/posture-check`
      });

      const findings = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/findings"
      });
      const items = findings.json().items as Array<{
        findingId: string;
        status: string;
        disposition: unknown;
      }>;
      expect(items.length).toBeGreaterThan(0);
      const target = items[0]!;
      expect(target.disposition).toBeNull();

      // Set an AcceptedRisk disposition.
      const set = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          disposition: "AcceptedRisk",
          expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
          note: "Compensating control in place",
          ownerId
        },
        url: `/api/v1/findings/${target.findingId}/transition`
      });
      expect(set.statusCode).toBe(200);
      const setBody = set.json();
      expect(setBody.disposition.disposition).toBe("AcceptedRisk");
      expect(setBody.disposition.note).toBe("Compensating control in place");
      // Disposition must NOT change the derived status.
      expect(setBody.status).toBe(target.status);

      // Persisted: re-reading the finding shows the disposition.
      const reread = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/findings/${target.findingId}`
      });
      expect(reread.json().disposition.disposition).toBe("AcceptedRisk");

      // Audited.
      const auditRow = await prisma.auditEvent.findFirst({
        where: { action: "finding_disposition_changed", tenantId }
      });
      expect(auditRow).toBeTruthy();

      // Clear it → back to purely derived.
      const clear = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { disposition: null },
        url: `/api/v1/findings/${target.findingId}/transition`
      });
      expect(clear.statusCode).toBe(200);
      expect(clear.json().disposition).toBeNull();

      const afterClear = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/findings/${target.findingId}`
      });
      expect(afterClear.json().disposition).toBeNull();

      // Unknown finding id → 404.
      const missing = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { disposition: "Suppressed" },
        url: `/api/v1/findings/${randomUUID()}/transition`
      });
      expect(missing.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  }, 30_000);
});
