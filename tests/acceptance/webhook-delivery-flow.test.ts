import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  WEBHOOK_SIGNATURE_HEADER,
  processWebhookDelivery,
  type FetchLike
} from "../../packages/webhooks/src/index.js";
import * as testHelpers from "./helpers.js";

describe("tenant webhook delivery flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["webhook-owner"]);
      await prisma.$disconnect();
    }
  });

  it("registers a webhook, records a delivery, and delivers a verifiable signed payload", async () => {
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
        // Disable async enqueue so the test drives delivery deterministically.
        webhookQueue: null
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "webhook-owner",
        "Webhook Tenant"
      );

      const createResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          events: ["mission.completed", "snapshot.ready"],
          url: "https://example.test/periscan-webhook"
        },
        url: "/api/v1/tenants/current/webhooks"
      });

      expect(createResponse.statusCode).toBe(201);
      const webhook = createResponse.json();
      expect(webhook.secret).toMatch(/^whsec_/);
      const secret = webhook.secret as string;

      const listResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items).toHaveLength(1);
      expect(listResponse.json().items[0]).not.toHaveProperty("secret");

      const testResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        url: `/api/v1/tenants/current/webhooks/${webhook.webhookId}/test`
      });
      expect(testResponse.statusCode).toBe(202);
      const deliveryId = testResponse.json().deliveryIds[0] as string;
      expect(deliveryId).toBeTruthy();

      // Drive delivery directly with a capturing fetch stub.
      let capturedBody = "";
      let capturedSignature = "";
      const fetchStub: FetchLike = async (_url, init) => {
        capturedBody = init.body;
        capturedSignature = init.headers[WEBHOOK_SIGNATURE_HEADER] ?? "";

        return { ok: true, status: 200 };
      };

      const result = await processWebhookDelivery(prisma, deliveryId, {
        fetchImpl: fetchStub
      });

      expect(result.delivered).toBe(true);
      expect(result.responseStatus).toBe(200);

      // The signature must verify against the customer's secret.
      const expectedSignature = `sha256=${createHmac("sha256", secret)
        .update(capturedBody)
        .digest("hex")}`;
      expect(capturedSignature).toBe(expectedSignature);

      const deliveriesResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/webhook-deliveries"
      });
      expect(deliveriesResponse.statusCode).toBe(200);
      expect(deliveriesResponse.json().items[0].status).toBe("Delivered");

      const auditResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: "/api/v1/audit-events?limit=20"
      });
      expect(auditResponse.statusCode).toBe(200);
      expect(
        auditResponse
          .json()
          .items.map((event: { action: string }) => event.action)
      ).toEqual(expect.arrayContaining(["webhook.created", "webhook.tested"]));
      const auditJson = JSON.stringify(auditResponse.json());
      expect(auditJson).not.toContain(secret);
      expect(auditJson).not.toContain("https://example.test/periscan-webhook");
    } finally {
      await app.close();
    }
  }, 30_000);
});
