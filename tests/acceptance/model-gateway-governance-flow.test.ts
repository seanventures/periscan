import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("model gateway control plane", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "model-gateway-owner",
        "model-gateway-other"
      ]);
      await prisma.$disconnect();
    }
  });

  it("registers a provider, builds a session and context, runs the policy check on a tool request, and never executes a model", async () => {
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
      const { cookie } = await testHelpers.performSignup(
        app,
        "model-gateway-owner",
        "Model Gateway Tenant"
      );
      const headers = testHelpers.authHeaders(cookie);

      // Need a verified scope to bind the session to.
      const scopeResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: "app.example.com"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId;

      // 1. Register a BYO frontier-model provider with an API key.
      const providerResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          apiKey: "sk-byo-super-secret-key",
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://api.openai.com/v1",
          providerName: "Customer OpenAI",
          providerType: "OpenAICompatible"
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(providerResponse.statusCode).toBe(201);
      const provider = providerResponse.json();
      expect(provider.hasCredential).toBe(true);
      // The raw key must never be returned.
      expect(JSON.stringify(provider)).not.toContain("sk-byo-super-secret-key");

      // 2. Create a read-only/plan policy profile.
      const policyResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          allowedModes: ["PlanOnly", "ReadOnlyEvidence"],
          description: "Read-only analyst profile",
          maxSafetyLevel: "PassiveReadOnly",
          name: "Read-only analyst"
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policyResponse.statusCode).toBe(201);
      const policy = policyResponse.json();
      expect(policy.allowRawEvidence).toBe(false);

      // 3. Create and start a session.
      const sessionResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          mode: "ReadOnlyEvidence",
          modelPolicyProfileId: policy.modelPolicyProfileId,
          modelProviderId: provider.modelProviderId,
          purpose: "Investigate exposures",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(sessionResponse.statusCode).toBe(201);
      const session = sessionResponse.json();
      expect(session.status).toBe("Created");

      const startResponse = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${session.modelSessionId}/start`
      });
      expect(startResponse.statusCode).toBe(200);
      expect(startResponse.json().status).toBe("Active");

      // 4. Build a context bundle.
      const bundleResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {},
        url: `/api/v1/model-gateway/sessions/${session.modelSessionId}/context-bundles`
      });
      expect(bundleResponse.statusCode).toBe(201);
      expect(bundleResponse.json().redactionPolicy).toBe("default");

      // 5. Create a manual tool request; policy check allows a read-only tool.
      const toolRequestResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { limit: 10 },
          requestReason: "List assets to scope the investigation",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${session.modelSessionId}/tool-requests`
      });
      expect(toolRequestResponse.statusCode).toBe(201);
      const toolRequest = toolRequestResponse.json();
      // Phase 2: the request is policy-allowed but not yet executed.
      expect(toolRequest.status).toBe("Allowed");
      expect(toolRequest.result).toBeNull();

      // 6. The session timeline records the activity without any execution.
      const auditResponse = await app.inject({
        cookies: headers,
        method: "GET",
        url: `/api/v1/model-gateway/audit-events?modelSessionId=${session.modelSessionId}`
      });
      expect(auditResponse.statusCode).toBe(200);
      const eventTypes = auditResponse
        .json()
        .items.map((event: { eventType: string }) => event.eventType);
      expect(eventTypes).toContain("SessionCreated");
      expect(eventTypes).toContain("ToolRequested");
      expect(eventTypes).toContain("ToolAllowed");
      expect(eventTypes).not.toContain("ToolExecuted");

      // 7. Kill switch terminates the session and blocks pending requests.
      const killResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: { reason: "Acceptance drill" },
        url: "/api/v1/model-gateway/kill-switch"
      });
      expect(killResponse.statusCode).toBe(200);
      expect(killResponse.json().terminatedSessions).toBeGreaterThanOrEqual(1);
      // The pending "Allowed" (auto-approved, executable) tool request must be
      // counted and cancelled — not left in-flight by the kill switch.
      expect(killResponse.json().blockedToolRequests).toBeGreaterThanOrEqual(1);

      const afterKill = await app.inject({
        cookies: headers,
        method: "GET",
        url: `/api/v1/model-gateway/sessions/${session.modelSessionId}`
      });
      expect(afterKill.json().status).toBe("Terminated");

      const cancelledToolRequest = await app.inject({
        cookies: headers,
        method: "GET",
        url: `/api/v1/model-gateway/tool-requests/${toolRequest.toolRequestId}`
      });
      expect(cancelledToolRequest.statusCode).toBe(200);
      expect(cancelledToolRequest.json().status).toBe("Cancelled");
    } finally {
      await app.close();
    }
  }, 30_000);

  it("isolates model gateway resources between tenants", async () => {
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
      const owner = await testHelpers.performSignup(
        app,
        "model-gateway-owner",
        "Owner Tenant"
      );
      const other = await testHelpers.performSignup(
        app,
        "model-gateway-other",
        "Other Tenant"
      );

      const providerResponse = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "POST",
        payload: {
          apiKey: "sk-owner-key",
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://api.anthropic.com",
          providerName: "Owner Anthropic",
          providerType: "AnthropicCompatible"
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(providerResponse.statusCode).toBe(201);
      const providerId = providerResponse.json().modelProviderId;

      // The other tenant must not be able to read the owner's provider.
      const crossTenantRead = await app.inject({
        cookies: testHelpers.authHeaders(other.cookie),
        method: "GET",
        url: `/api/v1/model-gateway/providers/${providerId}`
      });
      expect(crossTenantRead.statusCode).toBe(404);

      const otherList = await app.inject({
        cookies: testHelpers.authHeaders(other.cookie),
        method: "GET",
        url: "/api/v1/model-gateway/providers"
      });
      expect(otherList.json().items).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
