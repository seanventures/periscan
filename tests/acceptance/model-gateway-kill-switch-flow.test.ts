import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Slice B / row 65 — durable model-gateway kill switch.
 *
 * Proves: activate persists a tenant flag, terminates sessions, cancels
 * in-flight tool requests, audits KillSwitchActivated + model.kill_switch_activated,
 * blocks new sessions and tool calls with model_gateway_kill_switch_active,
 * and clear (enabled:false) restores session creation (without resurrecting
 * terminated sessions).
 */
describe("model gateway durable kill switch", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "model-gateway-kill"
      ]);
      await prisma.$disconnect();
    }
  });

  it("stops LLM tool calls with durable flag + audit, and refuses post-kill sessions", async () => {
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
        modelGatewayTurnQueue: {
          async enqueueTurn() {
            return;
          }
        },
        prisma,
        webhookQueue: null
      })
    });

    try {
      const { cookie, response: signupResponse } =
        await testHelpers.performSignup(
          app,
          "model-gateway-kill",
          "Model Gateway Kill Tenant"
        );
      const tenantId = signupResponse.json().tenant.tenantId as string;
      const headers = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: { scopeType: "Domain", value: "kill.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const providerResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          apiKey: "sk-byo-kill-secret",
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://api.openai.com/v1",
          providerName: "Kill Switch OpenAI",
          providerType: "OpenAICompatible"
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(providerResponse.statusCode).toBe(201);
      const providerId = providerResponse.json().modelProviderId as string;

      const policyResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          allowedModes: ["PlanOnly", "ReadOnlyEvidence"],
          description: "Kill switch drill policy",
          maxSafetyLevel: "PassiveReadOnly",
          name: "Kill drill policy"
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policyResponse.statusCode).toBe(201);
      const policyId = policyResponse.json().modelPolicyProfileId as string;

      const sessionResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          mode: "ReadOnlyEvidence",
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: "Pre-kill read-only session",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(sessionResponse.statusCode).toBe(201);
      const sessionId = sessionResponse.json().modelSessionId as string;

      const startResponse = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${sessionId}/start`
      });
      expect(startResponse.statusCode).toBe(200);

      const toolBefore = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { limit: 5 },
          requestReason: "Pre-kill list",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(toolBefore.statusCode).toBe(201);
      expect(["Allowed", "RequiresApproval", "Denied"]).toContain(
        toolBefore.json().status
      );

      const kill = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          enabled: true,
          reason: "Slice B durable kill-switch drill"
        },
        url: "/api/v1/model-gateway/kill-switch"
      });
      expect(kill.statusCode).toBe(200);
      expect(kill.json()).toMatchObject({
        blockedToolRequests: expect.any(Number),
        enabled: true,
        envForceActive: false,
        reason: "Slice B durable kill-switch drill",
        terminatedSessions: expect.any(Number)
      });
      expect(kill.json().terminatedSessions).toBeGreaterThanOrEqual(1);

      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(tenant.modelGatewayKillSwitchActive).toBe(true);
      expect(tenant.modelGatewayKillSwitchReason).toBe(
        "Slice B durable kill-switch drill"
      );

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: {
          action: "model_kill_switch_activated",
          tenantId
        },
        orderBy: { createdAt: "desc" }
      });
      expect(audit.metadata).toMatchObject({
        enabled: true,
        reason: "Slice B durable kill-switch drill"
      });

      const gatewayAudit = await prisma.modelGatewayAuditEvent.findFirstOrThrow({
        where: {
          eventType: "KillSwitchActivated",
          tenantId
        },
        orderBy: { createdAt: "desc" }
      });
      expect(gatewayAudit.metadata).toMatchObject({
        enabled: true,
        reason: "Slice B durable kill-switch drill"
      });

      // Terminated session refuses tool requests (session-ended path).
      const afterKillSession = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { limit: 5 },
          requestReason: "Post-kill attempt on old session",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(afterKillSession.statusCode).toBe(409);

      // Durable flag refuses NEW session creation even after prior sessions die.
      const newSession = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          mode: "ReadOnlyEvidence",
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: "Should be blocked by durable kill switch",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(newSession.statusCode).toBe(409);
      expect(newSession.json().code).toBe("model_gateway_kill_switch_active");

      // Clear durable flag — new sessions allowed; old stay Terminated.
      const clear = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          enabled: false,
          reason: "Slice B clear kill-switch after drill"
        },
        url: "/api/v1/model-gateway/kill-switch"
      });
      expect(clear.statusCode).toBe(200);
      expect(clear.json().enabled).toBe(false);

      const tenantAfter = await prisma.tenant.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(tenantAfter.modelGatewayKillSwitchActive).toBe(false);

      const resumedSession = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          mode: "ReadOnlyEvidence",
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: "Post-clear session",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(resumedSession.statusCode).toBe(201);

      const oldSession = await app.inject({
        cookies: headers,
        method: "GET",
        url: `/api/v1/model-gateway/sessions/${sessionId}`
      });
      expect(oldSession.statusCode).toBe(200);
      expect(oldSession.json().status).toBe("Terminated");
    } finally {
      await app.close();
    }
  });
});
