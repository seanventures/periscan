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

/**
 * Swarm S6 — platform E2E: outbound webhooks lifecycle.
 *
 * create → rotate secret → HMAC-signed deliver → redrive dead letter →
 * event-catalog. Secrets are one-shot on create/rotate; catalog never leaks them.
 */
describe("webhook lifecycle (create → rotate → deliver → redrive → catalog)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "webhook-lifecycle"
      ]);
      await prisma.$disconnect();
    }
  });

  it("rotates the signing secret, delivers with HMAC, and redrives a dead letter", async () => {
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
        // Deterministic delivery: drive processWebhookDelivery in-process.
        webhookQueue: null
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "webhook-lifecycle",
        "Webhook Lifecycle Tenant"
      );
      const headers = testHelpers.authHeaders(cookie);

      // 1) Event catalog is discoverable before any endpoint is registered.
      const catalog = await app.inject({
        cookies: headers,
        method: "GET",
        url: "/api/v1/tenants/current/webhooks/event-catalog"
      });
      expect(catalog.statusCode).toBe(200);
      const catalogBody = catalog.json();
      expect(catalogBody.eventTypes).toEqual(
        expect.arrayContaining([
          "mission.started",
          "mission.completed",
          "mission.failed",
          "snapshot.ready",
          "remediation.created",
          "remediation.verified",
          "finding.disposition_changed",
          "policy.denied",
          "schedule.failed"
        ])
      );
      expect(catalogBody.eventTypes).toHaveLength(9);
      expect(catalogBody.signatureFormat).toBe("sha256=<hex>");
      expect(catalogBody.headers?.signature).toBe("x-periscan-signature");
      expect(JSON.stringify(catalogBody)).not.toMatch(/whsec_/);

      // 2) Create webhook — secret returned once.
      const createResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          events: ["mission.completed", "snapshot.ready"],
          url: "https://example.com/periscan-lifecycle-webhook"
        },
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(createResponse.statusCode).toBe(201);
      const webhook = createResponse.json();
      const webhookId = webhook.webhookId as string;
      const originalSecret = webhook.secret as string;
      expect(originalSecret).toMatch(/^whsec_/);

      // 3) Rotate secret — old secret must stop verifying, new secret works.
      const rotate = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/tenants/current/webhooks/${webhookId}/rotate-secret`
      });
      expect(rotate.statusCode).toBe(200);
      const rotatedSecret = rotate.json().secret as string;
      expect(rotatedSecret).toMatch(/^whsec_/);
      expect(rotatedSecret).not.toBe(originalSecret);
      // List never re-exposes the secret.
      const list = await app.inject({
        cookies: headers,
        method: "GET",
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(list.statusCode).toBe(200);
      expect(list.json().items[0]).not.toHaveProperty("secret");
      expect(JSON.stringify(list.json())).not.toContain(rotatedSecret);

      // 4) Test delivery + process with HMAC over the rotated secret.
      const testResponse = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/tenants/current/webhooks/${webhookId}/test`
      });
      expect(testResponse.statusCode).toBe(202);
      const deliveryId = testResponse.json().deliveryIds[0] as string;
      expect(deliveryId).toBeTruthy();

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

      const expectedWithRotated = `sha256=${createHmac("sha256", rotatedSecret)
        .update(capturedBody)
        .digest("hex")}`;
      expect(capturedSignature).toBe(expectedWithRotated);

      const expectedWithOriginal = `sha256=${createHmac("sha256", originalSecret)
        .update(capturedBody)
        .digest("hex")}`;
      expect(capturedSignature).not.toBe(expectedWithOriginal);

      // 5) Dead-letter a delivery, redrive it, deliver again with same secret.
      const deadLettered = await prisma.webhookDelivery.create({
        data: {
          attempts: 5,
          deadLetteredAt: new Date(),
          eventType: "mission.completed",
          lastError: "Endpoint returned 500 after 5 attempts.",
          payload: { redrive: true, source: "swarm-s6" },
          status: "Failed",
          tenantId: webhook.tenantId as string,
          webhookId
        }
      });

      const redrive = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/tenants/current/webhook-deliveries/${deadLettered.deliveryId}/redrive`
      });
      // Redrive is async-accepted (202) — resets delivery to Pending for re-send.
      expect(redrive.statusCode).toBe(202);
      expect(redrive.json()).toMatchObject({
        deliveryId: deadLettered.deliveryId,
        status: "Pending"
      });

      const reset = await prisma.webhookDelivery.findUniqueOrThrow({
        where: { deliveryId: deadLettered.deliveryId }
      });
      expect(reset.status).toBe("Pending");
      expect(reset.deadLetteredAt).toBeNull();
      expect(reset.attempts).toBe(0);

      let redriveBody = "";
      let redriveSignature = "";
      const redriveFetch: FetchLike = async (_url, init) => {
        redriveBody = init.body;
        redriveSignature = init.headers[WEBHOOK_SIGNATURE_HEADER] ?? "";
        return { ok: true, status: 200 };
      };
      const redriveResult = await processWebhookDelivery(
        prisma,
        deadLettered.deliveryId,
        { fetchImpl: redriveFetch }
      );
      expect(redriveResult.delivered).toBe(true);
      expect(redriveSignature).toBe(
        `sha256=${createHmac("sha256", rotatedSecret)
          .update(redriveBody)
          .digest("hex")}`
      );

      // Redrive of an already-delivered delivery is refused (not re-openable).
      const notRedrivable = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/tenants/current/webhook-deliveries/${deadLettered.deliveryId}/redrive`
      });
      expect(notRedrivable.statusCode).toBe(409);
      expect(notRedrivable.json().code).toBe(
        "webhook_delivery_not_redrivable"
      );

      // Audit must not leak secrets or target URL.
      const audit = await app.inject({
        cookies: headers,
        method: "GET",
        url: "/api/v1/audit-events?limit=50"
      });
      expect(audit.statusCode).toBe(200);
      const auditJson = JSON.stringify(audit.json());
      expect(auditJson).not.toContain(originalSecret);
      expect(auditJson).not.toContain(rotatedSecret);
      expect(auditJson).not.toContain(
        "https://example.com/periscan-lifecycle-webhook"
      );
    } finally {
      await app.close();
    }
  }, 45_000);
});
