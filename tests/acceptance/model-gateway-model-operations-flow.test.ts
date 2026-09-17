import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createModelGatewayTurnProcessor } from "../../apps/worker/src/model-gateway-turn.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import type { ModelGatewayTurnJobPayload } from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

describe("model gateway managed operations", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["model-ops"]);
      await prisma.$disconnect();
    }
  });

  it("enforces fair share, routes declared adapters/precision, prunes context, and reuses only policy-safe turns", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const queued: ModelGatewayTurnJobPayload[] = [];
    const providerFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content:
                    "Evidence-grounded scope summary. ghp_supersecrettokenvalue"
                }
              }
            ],
            usage: {
              completion_tokens: 5,
              prompt_tokens: 10,
              prompt_tokens_details: { cached_tokens: 0 }
            }
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        )
    );
    vi.stubGlobal("fetch", providerFetch);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: { async enqueueValidationJob() {} },
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
        "model-ops",
        "model-ops tenant"
      );
      const cookies = testHelpers.authHeaders(cookie);
      const scope = await app.inject({
        cookies,
        method: "POST",
        payload: { scopeType: "Domain", value: "model-ops.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);

      const provider = await app.inject({
        cookies,
        method: "POST",
        payload: {
          apiKey: null,
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://model-ops.invalid/v1",
          providerName: "Managed adapter provider",
          providerType: "OpenAICompatible",
          servingCapabilities: {
            adapterAliases: [
              {
                alias: "risk-summarizer",
                model: "mock-security-model",
                status: "Active"
              }
            ],
            defaultPrecisionMode: "BF16",
            maxConcurrentTurns: 20,
            precisionModes: ["BF16", "ProviderManaged"],
            source: "ProviderDeclared",
            supportsAdapterHotSwap: true,
            supportsUsageByAdapter: true
          }
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(provider.statusCode).toBe(201);
      expect(provider.json()).toMatchObject({
        servingCapabilities: {
          defaultPrecisionMode: "BF16",
          supportsUsageByAdapter: true
        },
        servingCapabilitiesVerifiedAt: null
      });

      const policy = await app.inject({
        cookies,
        method: "POST",
        payload: {
          allowedModes: ["PlanOnly"],
          description: "Cache-safe planning only",
          name: "Model operations plan-only"
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policy.statusCode).toBe(201);

      const invalidAdapter = await app.inject({
        cookies,
        method: "POST",
        payload: {
          adapterAlias: "missing-adapter",
          mode: "PlanOnly",
          modelPolicyProfileId: policy.json().modelPolicyProfileId,
          modelProviderId: provider.json().modelProviderId,
          purpose: "Must reject an undeclared adapter",
          scopeIds: [scope.json().scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(invalidAdapter.statusCode).toBe(422);
      expect(invalidAdapter.json().code).toBe("model_adapter_unavailable");

      const session = await app.inject({
        cookies,
        method: "POST",
        payload: {
          adapterAlias: "risk-summarizer",
          mode: "PlanOnly",
          modelPolicyProfileId: policy.json().modelPolicyProfileId,
          modelProviderId: provider.json().modelProviderId,
          precisionMode: "BF16",
          purpose: "Exercise managed model operations",
          scopeIds: [scope.json().scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(session.statusCode).toBe(201);
      expect(session.json()).toMatchObject({
        adapterAlias: "risk-summarizer",
        precisionMode: "BF16",
        requestedModel: "mock-security-model"
      });
      const sessionId = session.json().modelSessionId as string;

      const start = await app.inject({
        cookies,
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${sessionId}/start`
      });
      expect(start.statusCode).toBe(200);

      const bundle = await app.inject({
        cookies,
        method: "POST",
        payload: { maxTokenEstimate: 40 },
        url: `/api/v1/model-gateway/sessions/${sessionId}/context-bundles`
      });
      expect(bundle.statusCode).toBe(201);
      expect(bundle.json()).toMatchObject({
        pruningManifest: {
          strategy: "EvidencePriorityDeterministicV1",
          tokenBudget: 40,
          version: 1
        },
        sourceTokenEstimate: 0,
        tokenBudget: 40
      });

      const finops = await app.inject({
        cookies,
        method: "PUT",
        payload: {
          concurrentTurnLimit: 1,
          enforcementEnabled: true,
          monthlyLimitMicrousd: 1_000_000_000,
          perMinuteRequestLimit: 100,
          priorityLaneEnabled: false,
          providerPricing: [
            {
              adapterAlias: "risk-summarizer",
              cachedInputMicrousdPerMillion: 0,
              inputMicrousdPerMillion: 1_000_000,
              model: "mock-security-model",
              modelProviderId: provider.json().modelProviderId,
              outputMicrousdPerMillion: 2_000_000,
              precisionMode: "BF16"
            }
          ],
          routingProviderIds: []
        },
        url: "/api/v1/model-gateway/finops"
      });
      expect(finops.statusCode).toBe(200);
      expect(finops.json().config).toMatchObject({
        concurrentTurnLimit: 1,
        priorityLaneEnabled: false
      });

      const first = await app.inject({
        cookies,
        method: "POST",
        payload: {
          prompt: "Summarize the verified scope.",
          queueLane: "Standard"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(first.statusCode).toBe(200);
      expect(queued).toHaveLength(1);
      expect(queued[0]?.queueLane).toBe("Standard");

      const fairShareBlocked = await app.inject({
        cookies,
        method: "POST",
        payload: { prompt: "A second concurrent turn." },
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(fairShareBlocked.statusCode).toBe(429);
      expect(fairShareBlocked.json().code).toBe(
        "model_gateway_tenant_concurrency_exhausted"
      );

      const processor = createModelGatewayTurnProcessor(prisma);
      const firstResult = await processor.process(queued.shift()!);
      expect(firstResult).toMatchObject({
        cacheDisposition: "Stored",
        status: "Completed"
      });
      expect(providerFetch).toHaveBeenCalledTimes(1);

      const priorityBlocked = await app.inject({
        cookies,
        method: "POST",
        payload: {
          prompt: "verified scope summarize",
          queueLane: "Priority"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(priorityBlocked.statusCode).toBe(403);
      expect(priorityBlocked.json().code).toBe(
        "model_gateway_priority_lane_disabled"
      );

      const enablePriority = await app.inject({
        cookies,
        method: "PUT",
        payload: {
          concurrentTurnLimit: 1,
          enforcementEnabled: true,
          monthlyLimitMicrousd: 1_000_000_000,
          perMinuteRequestLimit: 100,
          priorityLaneEnabled: true,
          providerPricing: finops.json().config.providerPricing,
          routingProviderIds: []
        },
        url: "/api/v1/model-gateway/finops"
      });
      expect(enablePriority.statusCode).toBe(200);

      const second = await app.inject({
        cookies,
        method: "POST",
        payload: {
          prompt: "verified scope summarize",
          queueLane: "Priority"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(second.statusCode).toBe(200);
      expect(queued[0]?.queueLane).toBe("Priority");

      const secondResult = await processor.process(queued.shift()!);
      expect(secondResult).toMatchObject({
        cacheDisposition: "Hit",
        status: "Completed"
      });
      expect(providerFetch).toHaveBeenCalledTimes(1);

      const turns = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/model-gateway/sessions/${sessionId}/turns`
      });
      expect(turns.statusCode).toBe(200);
      expect(turns.json().items).toHaveLength(2);
      expect(turns.json().items[0]).toMatchObject({
        adapterAlias: "risk-summarizer",
        cacheDisposition: "Hit",
        precisionMode: "BF16",
        pricingStatus: "LocalCacheHit",
        queueLane: "Priority",
        responseStatus: "Completed"
      });
      expect(turns.body).not.toContain("ghp_supersecrettokenvalue");
      expect(turns.body).toContain("[REDACTED_GITHUB_TOKEN]");
    } finally {
      await app.close();
    }
  });
});
