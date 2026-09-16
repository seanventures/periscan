import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import type { ModelGatewayTurnJobPayload } from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

describe("model gateway FinOps and safe routing", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["finops-owner"]);
      await prisma.$disconnect();
    }
  });

  it("routes at the pre-turn checkpoint, records usage, and returns 429 after budget exhaustion", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const queued: ModelGatewayTurnJobPayload[] = [];
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
          async enqueueTurn(payload) {
            queued.push(payload);
          }
        },
        prisma,
        webhookQueue: null
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "finops-owner",
        "FinOps Tenant"
      );
      const cookies = testHelpers.authHeaders(cookie);
      const scope = await app.inject({
        cookies,
        method: "POST",
        payload: { scopeType: "Domain", value: "finops.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);

      async function createProvider(name: string) {
        const response = await app.inject({
          cookies,
          method: "POST",
          payload: {
            apiKey: `secret-${name}`,
            authMethod: "bearer",
            deploymentType: "Cloud",
            endpointUrl: `https://${name.toLowerCase()}.example/v1`,
            providerName: name,
            providerType: "OpenAICompatible"
          },
          url: "/api/v1/model-gateway/providers"
        });
        expect(response.statusCode).toBe(201);
        return response.json();
      }

      const primary = await createProvider("PrimaryModel");
      const fallback = await createProvider("FallbackModel");
      const policy = await app.inject({
        cookies,
        method: "POST",
        payload: {
          allowedModes: ["PlanOnly"],
          description: "Budgeted plan-only model policy",
          name: "Budgeted analyst"
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policy.statusCode).toBe(201);

      const finopsConfig = await app.inject({
        cookies,
        method: "PUT",
        payload: {
          enforcementEnabled: true,
          monthlyLimitMicrousd: 100_000,
          perMinuteRequestLimit: 10,
          providerPricing: [
            {
              cachedInputMicrousdPerMillion: 100_000,
              inputMicrousdPerMillion: 1_000_000,
              modelProviderId: fallback.modelProviderId,
              outputMicrousdPerMillion: 2_000_000
            }
          ],
          routingProviderIds: [fallback.modelProviderId]
        },
        url: "/api/v1/model-gateway/finops"
      });
      expect(finopsConfig.statusCode).toBe(200);
      expect(finopsConfig.json()).toMatchObject({
        productionScaleClaimValidated: false,
        selfHostedInferenceImplemented: false,
        strategyDecision: "ManagedProviders"
      });

      const sessionResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          mode: "PlanOnly",
          modelPolicyProfileId: policy.json().modelPolicyProfileId,
          modelProviderId: primary.modelProviderId,
          purpose: "Prove safe provider routing and budget enforcement",
          scopeIds: [scope.json().scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(sessionResponse.statusCode).toBe(201);
      const sessionId = sessionResponse.json().modelSessionId as string;
      const start = await app.inject({
        cookies,
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${sessionId}/start`
      });
      expect(start.statusCode).toBe(200);

      const disablePrimary = await app.inject({
        cookies,
        method: "PATCH",
        payload: { status: "Disabled" },
        url: `/api/v1/model-gateway/providers/${primary.modelProviderId}`
      });
      expect(disablePrimary.statusCode).toBe(200);

      const accepted = await app.inject({
        cookies,
        method: "POST",
        payload: { prompt: "Summarize the verified scope." },
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(accepted.statusCode).toBe(200);
      expect(queued).toHaveLength(1);

      const usage = await prisma.modelUsageEvent.findUniqueOrThrow({
        where: { turnId: accepted.json().jobId }
      });
      expect(usage).toMatchObject({
        modelProviderId: fallback.modelProviderId,
        modelSessionId: sessionId,
        status: "Enqueued"
      });
      expect(usage.routingReason).toContain("safe pre-turn checkpoint");

      await prisma.modelUsageEvent.update({
        data: {
          completedAt: new Date(),
          costMicrousd: 100_000n,
          pricingStatus: "Metered",
          status: "Completed"
        },
        where: { modelUsageEventId: usage.modelUsageEventId }
      });

      const blocked = await app.inject({
        cookies,
        method: "POST",
        payload: { prompt: "This turn must not be queued." },
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().code).toBe("model_gateway_budget_exhausted");
      expect(queued).toHaveLength(1);

      const summary = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/model-gateway/finops"
      });
      expect(summary.statusCode).toBe(200);
      expect(summary.json()).toMatchObject({
        budgetRemainingMicrousd: "0",
        currentMonthCostMicrousd: "100000",
        currentMonthRequestCount: 1,
        strategyDecision: "ManagedProviders"
      });
    } finally {
      await app.close();
    }
  });
});
