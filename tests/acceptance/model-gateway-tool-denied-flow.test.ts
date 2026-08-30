import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * The model gateway must DENY a tool a session's policy mode does not permit —
 * the governance promise that a frontier model can never reach beyond its
 * authorized envelope. This proves a validation tool requested in a read-only
 * (ReadOnlyEvidence) session is denied (not executed), the denial is reasoned +
 * audited (ToolDenied, never ToolExecuted), and a denied request cannot execute.
 */
describe("model gateway tool denial", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "model-gateway-deny"
      ]);
      await prisma.$disconnect();
    }
  });

  it("denies a validation tool in a read-only session, audits it, and never executes", async () => {
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
        "model-gateway-deny",
        "Model Gateway Deny Tenant"
      );
      const headers = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: { scopeType: "Domain", value: "deny.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const providerResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          apiKey: "sk-byo-deny-secret",
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

      // A read-only analyst profile: no validation/active modes permitted.
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
      const policyId = policyResponse.json().modelPolicyProfileId as string;

      const sessionResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          mode: "ReadOnlyEvidence",
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: "Investigate exposures (read-only)",
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

      // request_exposure_validation requires a validation mode; in a
      // ReadOnlyEvidence session it must be DENIED, not executed.
      const toolRequest = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { reason: "Confirm the exposure is exploitable" },
          requestReason: "Attempt to validate from a read-only session",
          toolName: "request_exposure_validation"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(toolRequest.statusCode).toBe(201);
      const denied = toolRequest.json();
      expect(denied.status).toBe("Denied");
      expect(denied.denialReason).toContain("ReadOnlyEvidence");
      expect(denied.result).toBeNull();

      // The denial is audited (ToolDenied) and nothing was executed.
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

      // A denied request cannot be executed.
      const execute = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${denied.toolRequestId}/execute`
      });
      expect(execute.statusCode).toBeGreaterThanOrEqual(400);
    } finally {
      await app.close();
    }
  });
});
