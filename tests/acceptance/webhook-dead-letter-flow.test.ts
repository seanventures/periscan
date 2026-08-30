import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Dead-lettered webhook deliveries (a delivery permanently failed after its
 * retries are exhausted — status Failed with deadLetteredAt set) must be
 * separately surfaced for operators, distinct from deliveries that merely failed
 * and are still retrying. This proves the dead-letter read endpoint returns only
 * the permanently-failed deliveries with their failure context.
 */
describe("webhook dead-letter listing", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "webhook-deadletter"
      ]);
      await prisma.$disconnect();
    }
  });

  it("returns only permanently-failed deliveries from the dead-letter endpoint", async () => {
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
        "webhook-deadletter",
        "Webhook Dead-letter Tenant"
      );
      const headers = testHelpers.authHeaders(cookie);

      const createResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          events: ["mission.completed"],
          url: "https://example.test/periscan-deadletter"
        },
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(createResponse.statusCode).toBe(201);
      const webhook = createResponse.json();
      const webhookId = webhook.webhookId as string;
      const tenantId = webhook.tenantId as string;

      // A delivery that is permanently failed (dead-lettered): retries exhausted.
      const deadLettered = await prisma.webhookDelivery.create({
        data: {
          attempts: 5,
          deadLetteredAt: new Date(),
          eventType: "mission.completed",
          lastError: "Endpoint returned 500 after 5 attempts.",
          payload: { example: true },
          status: "Failed",
          tenantId,
          webhookId
        }
      });

      // A delivery that merely failed once and is still retrying (NOT dead).
      await prisma.webhookDelivery.create({
        data: {
          attempts: 1,
          deadLetteredAt: null,
          eventType: "mission.completed",
          lastError: "Transient timeout; will retry.",
          nextRetryAt: new Date(Date.now() + 60_000),
          payload: { example: true },
          status: "Failed",
          tenantId,
          webhookId
        }
      });

      // The dead-letter endpoint surfaces ONLY the permanently-failed delivery.
      const deadLetterList = await app.inject({
        cookies: headers,
        method: "GET",
        url: "/api/v1/tenants/current/webhook-deliveries/dead-letter"
      });
      expect(deadLetterList.statusCode).toBe(200);
      const deadItems = deadLetterList.json().items as Array<{
        deadLetteredAt: string | null;
        deliveryId: string;
        lastError: string | null;
      }>;
      expect(deadItems).toHaveLength(1);
      expect(deadItems[0]!.deliveryId).toBe(deadLettered.deliveryId);
      expect(deadItems[0]!.deadLetteredAt).not.toBeNull();
      expect(deadItems[0]!.lastError).toContain("after 5 attempts");

      // The general deliveries list still shows BOTH (the dead-letter view is a
      // strict filter, not the only surface).
      const allDeliveries = await app.inject({
        cookies: headers,
        method: "GET",
        url: "/api/v1/tenants/current/webhook-deliveries"
      });
      expect(allDeliveries.statusCode).toBe(200);
      expect(
        (allDeliveries.json().items as Array<{ webhookId: string }>).filter(
          (item) => item.webhookId === webhookId
        )
      ).toHaveLength(2);
    } finally {
      await app.close();
    }
  });
});
