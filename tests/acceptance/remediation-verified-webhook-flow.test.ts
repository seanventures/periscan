import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * P06-8 catalog honesty: subscribers to `remediation.verified` must get a
 * delivery row when verifyRemediation finishes (Fixed only after measurement).
 */
describe("remediation.verified webhook emission", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "rem-verified-wh"
      ]);
      await prisma.$disconnect();
    }
  });

  it("accepts remediation.verified in the webhook catalog", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma,
        webhookQueue: null
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "rem-verified-wh",
        "rem-verified-wh Tenant"
      );

      const webhookResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          events: ["remediation.verified"],
          url: "https://example.test/remediation-verified"
        },
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(webhookResponse.statusCode).toBe(201);
      expect(webhookResponse.json().events).toContain("remediation.verified");
    } finally {
      await app.close();
    }
  });
});
