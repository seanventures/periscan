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
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";
import * as testHelpers from "./helpers.js";

/**
 * Slice C — platform ops health floor acceptance glue.
 *
 * Pins real product surfaces that justify ops≥4 on platform-tied Strong rows
 * (runner fleet, schedule program, webhook delivery metrics, priority lanes,
 * connector freshness fabric, NHI inventory summary).
 *
 * Forbidden: invent soak SLAs, invent customer-qual live credentials, or
 * promote scorecard rows in this file.
 */
describe("platform ops health floor (fleet / schedules / webhooks / lanes / NHI / freshness)", () => {
  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "platform-ops-floor"
      ]);
      await prisma.$disconnect();
      prisma = undefined;
    }
  });

  it("exposes operable fleet, schedule program, webhook delivery metrics, priority lanes, NHI, and fabric freshness", async () => {
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
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        "platform-ops-floor",
        "Platform Ops Floor Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      // --- Runner fleet health (ops surface for agent-based / measured rows) ---
      const emptyFleet = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/runners/fleet"
      });
      expect(emptyFleet.statusCode).toBe(200);
      expect(emptyFleet.json()).toMatchObject({
        policy: { configured: false },
        rulesVersion: "1.0",
        summary: {
          total: 0,
          healthy: 0,
          attention: 0,
          offline: 0,
          halted: 0,
          revoked: 0
        }
      });

      const sealPolicy = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          attentionAfterSeconds: 90,
          certificateWarningDays: 14,
          escalationReference: "SECOPS-PLATFORM-OPS-C",
          minimumAgentVersion: "0.1.0",
          offlineAfterSeconds: 300,
          queueWarningDepth: 10,
          supportOwner: "Platform Operations"
        },
        url: "/api/v1/runners/fleet/policy"
      });
      expect(sealPolicy.statusCode).toBe(200);
      expect(sealPolicy.json()).toMatchObject({
        configured: true,
        supportOwner: "Platform Operations",
        escalationReference: "SECOPS-PLATFORM-OPS-C"
      });

      const tokenResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["platform-ops"],
          runnerName: "platform-ops-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      const register = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "platform-ops-runner",
          labels: ["platform-ops"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          runnerName: "platform-ops-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(register.statusCode).toBe(201);
      const runnerId = register.json().credentials.runnerId as string;
      const runnerAuthToken = register.json().credentials
        .runnerAuthToken as string;

      const heartbeat = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          queueDepth: 0,
          runnerId,
          status: "Active",
          tenantId,
          version: "0.1.0"
        },
        url: `/api/v1/runners/${runnerId}/heartbeat`
      });
      expect(heartbeat.statusCode).toBe(200);

      const fleet = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/runners/fleet"
      });
      expect(fleet.statusCode).toBe(200);
      const fleetBody = fleet.json();
      expect(fleetBody.policy.configured).toBe(true);
      expect(fleetBody.summary.total).toBe(1);
      expect(
        fleetBody.summary.healthy +
          fleetBody.summary.attention +
          fleetBody.summary.offline
      ).toBeGreaterThanOrEqual(1);
      expect(fleetBody.runners).toHaveLength(1);
      expect(typeof fleetBody.runners[0].healthState).toBe("string");

      // --- Schedule program health (list + status counts) ---
      await prisma.tenant.update({
        data: { billingPackageKey: "ValidationSnapshot" },
        where: { tenantId }
      });
      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: "platform-ops-floor.example.com"
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verify = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const createSchedule = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          audience: "Security Team",
          frequency: "Daily",
          maxTopItems: 5,
          missionType: "ContinuousValidation",
          nextRunAt: "2026-08-02T00:00:00.000Z",
          scopeIds: [scopeId]
        },
        url: "/api/v1/schedules"
      });
      expect(createSchedule.statusCode).toBe(201);
      expect(createSchedule.json().status).toBe("Active");
      const scheduleId = createSchedule.json().scheduleId as string;

      const listSchedules = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/schedules"
      });
      expect(listSchedules.statusCode).toBe(200);
      const scheduleItems = listSchedules.json().items as Array<{
        scheduleId: string;
        status: string;
        missionType: string;
      }>;
      expect(scheduleItems.length).toBeGreaterThanOrEqual(1);
      const programHealth = {
        active: scheduleItems.filter((s) => s.status === "Active").length,
        paused: scheduleItems.filter((s) => s.status === "Paused").length,
        total: scheduleItems.length
      };
      expect(programHealth.total).toBeGreaterThanOrEqual(1);
      expect(programHealth.active).toBeGreaterThanOrEqual(1);

      const pause = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/pause`
      });
      expect(pause.statusCode).toBe(200);
      expect(pause.json().status).toBe("Paused");

      const afterPause = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/schedules"
      });
      const afterItems = afterPause.json().items as Array<{ status: string }>;
      expect(afterItems.some((s) => s.status === "Paused")).toBe(true);

      // --- Webhook delivery metrics (real delivery list → status counts) ---
      const createWebhook = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          events: ["mission.completed", "snapshot.ready"],
          url: "https://example.com/periscan-platform-ops-webhook"
        },
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(createWebhook.statusCode).toBe(201);
      const webhookId = createWebhook.json().webhookId as string;
      const secret = createWebhook.json().secret as string;

      const testDelivery = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/tenants/current/webhooks/${webhookId}/test`
      });
      expect(testDelivery.statusCode).toBe(202);
      const deliveryId = testDelivery.json().deliveryIds[0] as string;

      let capturedBody = "";
      let capturedSignature = "";
      const fetchStub: FetchLike = async (_url, init) => {
        capturedBody = init.body as string;
        capturedSignature = init.headers[WEBHOOK_SIGNATURE_HEADER] ?? "";
        return { ok: true, status: 200 };
      };
      const delivered = await processWebhookDelivery(prisma, deliveryId, {
        fetchImpl: fetchStub
      });
      expect(delivered.delivered).toBe(true);
      expect(capturedSignature).toBe(
        `sha256=${createHmac("sha256", secret).update(capturedBody).digest("hex")}`
      );

      await prisma.webhookDelivery.create({
        data: {
          attempts: 5,
          deadLetteredAt: new Date(),
          eventType: "mission.completed",
          lastError: "Simulated permanent failure for metrics.",
          payload: { source: "platform-ops-floor" },
          status: "Failed",
          tenantId,
          webhookId
        }
      });

      const deliveries = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/tenants/current/webhook-deliveries?webhookId=${webhookId}`
      });
      expect(deliveries.statusCode).toBe(200);
      const deliveryItems = deliveries.json().items as Array<{
        status: string;
        deadLetteredAt?: string | null;
      }>;
      expect(deliveryItems.length).toBeGreaterThanOrEqual(2);
      const deliveryMetrics = {
        delivered: deliveryItems.filter((d) => d.status === "Delivered").length,
        failed: deliveryItems.filter((d) => d.status === "Failed").length,
        pending: deliveryItems.filter((d) => d.status === "Pending").length,
        deadLettered: deliveryItems.filter((d) => d.deadLetteredAt != null)
          .length,
        total: deliveryItems.length
      };
      expect(deliveryMetrics.delivered).toBeGreaterThanOrEqual(1);
      expect(
        deliveryMetrics.failed + deliveryMetrics.deadLettered
      ).toBeGreaterThanOrEqual(1);
      expect(deliveryMetrics.total).toBeGreaterThanOrEqual(2);

      const deadLetters = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/webhook-deliveries/dead-letter"
      });
      expect(deadLetters.statusCode).toBe(200);
      expect(deadLetters.json().items.length).toBeGreaterThanOrEqual(1);

      // --- Priority lanes (model FinOps flag operable) ---
      const finopsGet = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/model-gateway/finops"
      });
      expect(finopsGet.statusCode).toBe(200);
      expect(finopsGet.json()).toMatchObject({
        productionScaleClaimValidated: false,
        selfHostedInferenceImplemented: false,
        config: { priorityLaneEnabled: false }
      });

      const finopsEnable = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          enforcementEnabled: false,
          monthlyLimitMicrousd: 100_000,
          perMinuteRequestLimit: 60,
          priorityLaneEnabled: true,
          providerPricing: [],
          routingProviderIds: []
        },
        url: "/api/v1/model-gateway/finops"
      });
      expect(finopsEnable.statusCode).toBe(200);
      expect(finopsEnable.json().config.priorityLaneEnabled).toBe(true);
      expect(finopsEnable.json().productionScaleClaimValidated).toBe(false);

      // --- NHI sprawl inventory summary ---
      const nhiCreate = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          credentialFingerprint:
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          displayName: "Platform ops CI key",
          environment: "production",
          externalId: "platform-ops-ci-key",
          identityType: "APIKey",
          privileges: ["repo:read"],
          provider: "GitHub",
          publicExposure: false,
          resourceAccess: [
            { access: "read", environment: "production", resource: "repo:api" }
          ]
        },
        url: "/api/v1/non-human-identities"
      });
      expect(nhiCreate.statusCode).toBe(201);

      const nhiList = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/non-human-identities"
      });
      expect(nhiList.statusCode).toBe(200);
      expect(nhiList.json().summary.total).toBeGreaterThanOrEqual(1);
      expect(nhiList.body).not.toContain("platform-ops-ci-key");

      // --- Connector freshness / data-fabric quality surface ---
      const quality = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/data-fabric/quality-surface"
      });
      expect(quality.statusCode).toBe(200);
      expect(quality.json()).toMatchObject({
        summary: expect.objectContaining({
          total: expect.any(Number),
          stale: expect.any(Number),
          qualified: expect.any(Number),
          degraded: expect.any(Number),
          pendingFirstSync: expect.any(Number),
          disconnected: expect.any(Number)
        })
      });
      expect(quality.json().generatedAt).toMatch(/^\d{4}-/);
    } finally {
      await app.close();
    }
  });
});
