import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

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
      prisma
    })
  });
}

describe("control source tuning flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["control-tune"]);
      await prisma.$disconnect();
    }
  });

  it("updates a control source's expected behaviors and rejects unknown ids", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "control-tune",
        "Control Tune Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = authCookies(cookie);

      // Control-source registration requires the Control Validation capability.
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });

      const integration = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          authType: "apiToken",
          config: {
            apiKey: "tune-secret",
            baseUrl: "https://api.xdr.example.com",
            xdrAuthId: "7"
          },
          connectorKey: "palo-cortex-xdr",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(integration.statusCode).toBe(201);
      const integrationId = integration.json().integrationId as string;

      const created = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          controlType: "XDR",
          expectedBehaviors: ["Detected"],
          integrationId,
          provider: "Palo Alto Networks Cortex XDR"
        },
        url: "/api/v1/control-sources"
      });
      expect(created.statusCode).toBe(201);
      const controlSourceId = created.json().controlSourceId as string;

      // Tune: broaden the expected behaviors.
      const tuned = await app.inject({
        cookies: auth,
        method: "PATCH",
        payload: { expectedBehaviors: ["Detected", "Blocked", "Alerted"] },
        url: `/api/v1/control-sources/${controlSourceId}`
      });
      expect(tuned.statusCode).toBe(200);
      expect(tuned.json().expectedBehaviors).toEqual([
        "Detected",
        "Blocked",
        "Alerted"
      ]);

      // Persisted, not just echoed.
      const reread = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/control-sources/${controlSourceId}`
      });
      expect(reread.json().expectedBehaviors).toEqual([
        "Detected",
        "Blocked",
        "Alerted"
      ]);

      // Unknown id → 404.
      const missing = await app.inject({
        cookies: auth,
        method: "PATCH",
        payload: { expectedBehaviors: ["Detected"] },
        url: `/api/v1/control-sources/${randomUUID()}`
      });
      expect(missing.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
