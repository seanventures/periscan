import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("model gateway action-tool execution", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "model-gateway-exec"
      ]);
      await prisma.$disconnect();
    }
  });

  it("executes read-only tools and approval-gated validation tools through the real policy/mission machinery", async () => {
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
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        "model-gateway-exec",
        "Model Gateway Exec Tenant"
      );
      const headers = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: { scopeType: "Domain", value: "exec.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyResponse.statusCode).toBe(200);
      expect(verifyResponse.json().verificationStatus).toBe("Verified");

      const providerResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          apiKey: "sk-byo-exec-secret",
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

      // Policy profile that permits controlled validation but still forces
      // approval for anything above non-invasive activity.
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

      const startResponse = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${sessionId}/start`
      });
      expect(startResponse.statusCode).toBe(200);

      // Tool-call inputs are validated against the code-defined catalog before
      // persistence; hidden fixture/mock controls must not become durable
      // model gateway requests even when the API is running in dev mode.
      const requestCountBeforeInvalid = await prisma.modelToolRequest.count({
        where: { tenantId }
      });
      const invalidToolInput = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { fixtureMode: true, limit: 5 },
          requestReason: "Attempt to smuggle fixture controls",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(invalidToolInput.statusCode).toBe(422);
      expect(invalidToolInput.json().code).toBe("invalid_tool_input");
      await expect(
        prisma.modelToolRequest.count({ where: { tenantId } })
      ).resolves.toBe(requestCountBeforeInvalid);

      // 1. Read-only tool executes inline and returns a redacted result.
      const readToolResponse = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { limit: 5 },
          requestReason: "List assets to scope the work",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(readToolResponse.statusCode).toBe(201);
      const readTool = readToolResponse.json();
      expect(readTool.status).toBe("Allowed");

      const executeRead = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${readTool.toolRequestId}/execute`
      });
      expect(executeRead.statusCode).toBe(200);
      expect(executeRead.json().status).toBe("Completed");
      expect(executeRead.json().result).not.toBeNull();
      expect(executeRead.json().result.returnedToModel).toBe(false);

      // 2. Validation tool inputs can include human rationale, but any
      // accidentally pasted secret-like value is redacted in API/DB-visible
      // request payloads.
      const validationRequest = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: {
            reason:
              "Confirm the exposure is exploitable; pasted ghp_supersecrettokenvalue by mistake."
          },
          requestReason: "Validate the top exposure",
          toolName: "request_exposure_validation"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(validationRequest.statusCode).toBe(201);
      const validation = validationRequest.json();
      expect(validation.status).toBe("RequiresApproval");
      expect(JSON.stringify(validation.inputPayloadRedacted)).not.toContain(
        "ghp_supersecrettokenvalue"
      );
      const persistedValidationRequest =
        await prisma.modelToolRequest.findUniqueOrThrow({
          where: { toolRequestId: validation.toolRequestId }
        });
      expect(
        JSON.stringify(persistedValidationRequest.inputPayloadRedacted)
      ).not.toContain("ghp_supersecrettokenvalue");
      expect(
        JSON.stringify(persistedValidationRequest.inputPayloadRedacted)
      ).toContain("[REDACTED_GITHUB_TOKEN]");

      // Executing before approval is rejected.
      const prematureExecute = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${validation.toolRequestId}/execute`
      });
      expect(prematureExecute.statusCode).toBe(409);

      const approve = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${validation.toolRequestId}/approve`
      });
      expect(approve.statusCode).toBe(200);
      expect(approve.json().status).toBe("Approved");

      const executeValidation = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${validation.toolRequestId}/execute`
      });
      expect(executeValidation.statusCode).toBe(200);
      const executed = executeValidation.json();
      expect(executed.status).toBe("Completed");
      expect(executed.result.outputPayloadRedacted.outcome).toBe("Allowed");
      expect(executed.result.outputPayloadRedacted.queued).toBe(true);

      // A real, policy-decided mission was created through the existing engine.
      const missionId = executed.result.outputPayloadRedacted
        .missionId as string;
      expect(missionId).toBeTruthy();
      const mission = await prisma.validationMission.findFirst({
        where: { missionId }
      });
      expect(mission?.missionType).toBe("ExposureValidation");
      expect(mission?.policyDecisionId).toBeTruthy();

      // 3. No-fix-without-verification: fix verification only creates a
      // verification mission; it never marks anything fixed.
      const fixRequest = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { reason: "Confirm the fix actually closed the risk" },
          requestReason: "Verify the remediation",
          toolName: "request_fix_verification"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(fixRequest.statusCode).toBe(201);
      const fix = fixRequest.json();
      expect(fix.status).toBe("RequiresApproval");

      await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${fix.toolRequestId}/approve`
      });
      const executeFix = await app.inject({
        cookies: headers,
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${fix.toolRequestId}/execute`
      });
      expect(executeFix.statusCode).toBe(200);
      const fixMissionId = executeFix.json().result.outputPayloadRedacted
        .missionId as string;
      const fixMission = await prisma.validationMission.findFirst({
        where: { missionId: fixMissionId }
      });
      expect(fixMission?.missionType).toBe("FixVerification");

      // Session timeout is enforced: backdate the (still-Active) session past
      // its expiresAt and a new tool request must be rejected, with the session
      // lazily transitioned to Expired — it cannot keep executing past its
      // window just because no reaper flipped its status.
      await prisma.modelSession.update({
        data: { expiresAt: new Date(Date.now() - 60_000) },
        where: { modelSessionId: sessionId }
      });

      const expiredToolRequest = await app.inject({
        cookies: headers,
        method: "POST",
        payload: {
          input: { limit: 1 },
          requestReason: "Attempt after session expiry",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(expiredToolRequest.statusCode).toBe(409);

      // The lazy transition to Expired is visible through the session-read API
      // the UI consumes, not only in the database.
      const sessionRead = await app.inject({
        cookies: headers,
        method: "GET",
        url: `/api/v1/model-gateway/sessions/${sessionId}`
      });
      expect(sessionRead.statusCode).toBe(200);
      expect(sessionRead.json().status).toBe("Expired");

      // DB backstop: the persisted record matches the API-surfaced state.
      const expiredSession = await prisma.modelSession.findUniqueOrThrow({
        where: { modelSessionId: sessionId }
      });
      expect(expiredSession.status).toBe("Expired");
    } finally {
      await app.close();
    }
  }, 45_000);
});
