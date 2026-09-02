import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Operator-in-the-loop rejection: a tool the policy gates behind approval
 * (RequiresApproval) can be DENIED by a tenant admin — distinct from the policy
 * auto-deny of an out-of-mode tool. This proves the manual reject moves the
 * request to Denied with a reason, audits it (ToolDenied), and blocks execution.
 */
describe("model gateway approval rejection", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "model-gateway-reject"
      ]);
      await prisma.$disconnect();
    }
  });

  it("lets an admin deny an approval-gated tool request and blocks its execution", async () => {
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
        "model-gateway-reject",
        "Model Gateway Reject Tenant"
      );
      const headers = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: { scopeType: "Domain", value: "reject.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      await app.inject({
        cookies: headers,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const providerResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          apiKey: "sk-byo-reject-secret",
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://api.openai.com/v1",
          providerName: "Customer OpenAI",
          providerType: "OpenAICompatible"
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(providerResponse.statusCode).toBe(201);
      const providerId = providerResponse.json().modelProviderId as string;

      // A profile that permits validation but forces approval above
      // non-invasive activity, so a validation tool is approval-gated.
      const policyResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          allowedModes: ["SafeValidation"],
          approvalRequiredAboveLevel: "ActiveNonInvasive",
          description: "Safe validation profile",
          maxSafetyLevel: "ControlledValidation",
          name: "Safe validation"
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policyResponse.statusCode).toBe(201);
      const policyId = policyResponse.json().modelPolicyProfileId as string;

      const sessionResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          mode: "SafeValidation",
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: "Validate the exposure backlog",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(sessionResponse.statusCode).toBe(201);
      const sessionId = sessionResponse.json().modelSessionId as string;

      await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${sessionId}/start`
      });

      // A validation tool is approval-gated under this profile.
      const validationRequest = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { reason: "Confirm the exposure is exploitable" },
          requestReason: "Validate the top exposure",
          toolName: "request_exposure_validation"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(validationRequest.statusCode).toBe(201);
      const toolRequest = validationRequest.json();
      expect(toolRequest.status).toBe("RequiresApproval");

      // The admin REJECTS the approval-gated request.
      const deny = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${toolRequest.toolRequestId}/deny`
      });
      expect(deny.statusCode).toBe(200);
      expect(deny.json().status).toBe("Denied");
      expect(deny.json().denialReason).toContain("administrator");

      // Executing a denied request is rejected.
      const execute = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${toolRequest.toolRequestId}/execute`
      });
      expect(execute.statusCode).toBeGreaterThanOrEqual(400);

      // The rejection is audited (ToolDenied), and nothing executed.
      const auditResponse = await app.inject({
        cookies: headers,
        method: "GET",
        url: `/api/v1/model-gateway/audit-events?modelSessionId=${sessionId}`
      });
      expect(auditResponse.statusCode).toBe(200);
      const eventTypes = (
        auditResponse.json().items as Array<{ eventType: string }>
      ).map((event) => event.eventType);
      expect(eventTypes).toContain("ToolDenied");
      expect(eventTypes).not.toContain("ToolExecuted");
    } finally {
      await app.close();
    }
  });
});
