import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("model gateway signed interventions", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    vi.useRealTimers();
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "model-intervention"
      ]);
      await prisma.$disconnect();
    }
  });

  it("binds a one-time review link and rejects messages, tampering, replay, supersession, and expiry", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const interventionSigningSecret = "acceptance-intervention-secret";
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        interventionSigningSecret,
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
      }),
      sessionSecret: "acceptance-session-secret"
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "model-intervention",
        "Model Intervention Tenant"
      );
      const cookies = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: "intervention.example.com"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: { devModeManual: true },
            url: `/api/v1/scopes/${scopeId}/verify`
          })
        ).statusCode
      ).toBe(200);

      const providerResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          apiKey: "sk-intervention-acceptance-secret",
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://api.openai.com/v1",
          providerName: "Intervention test provider",
          providerType: "OpenAICompatible"
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(providerResponse.statusCode).toBe(201);

      const policyResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          allowExternalValidation: true,
          allowedModes: ["SafeValidation"],
          allowedTools: ["request_exposure_validation"],
          approvalRequiredAboveLevel: "ActiveNonInvasive",
          description: "Force validation requests through a human boundary.",
          maxSafetyLevel: "ControlledValidation",
          name: "Signed intervention policy",
          sessionTimeoutMinutes: 60
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policyResponse.statusCode).toBe(201);

      const sessionResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          mode: "SafeValidation",
          modelPolicyProfileId: policyResponse.json().modelPolicyProfileId,
          modelProviderId: providerResponse.json().modelProviderId,
          purpose: "Review approval-gated exposure validation",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(sessionResponse.statusCode).toBe(201);
      const sessionId = sessionResponse.json().modelSessionId as string;
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            url: `/api/v1/model-gateway/sessions/${sessionId}/start`
          })
        ).statusCode
      ).toBe(200);

      async function createPausedRequest(label: string) {
        const response = await app.inject({
          cookies,
          method: "POST",
          payload: {
            input: { reason: `Confirm demo exposure ${label}` },
            requestReason: `Review exposure validation ${label}`,
            scopeIds: [scopeId],
            toolName: "request_exposure_validation"
          },
          url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().status).toBe("RequiresApproval");
        return response.json().toolRequestId as string;
      }

      async function issueLink(toolRequestId: string, minutes = 15) {
        const response = await app.inject({
          cookies,
          method: "POST",
          payload: { expiresInMinutes: minutes, transport: "Slack" },
          url: `/api/v1/model-gateway/tool-requests/${toolRequestId}/intervention-link`
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().rawTokenStored).toBe(false);
        const reviewUrl = new URL(response.json().reviewUrl as string);
        const fragment = new URLSearchParams(reviewUrl.hash.slice(1));
        return {
          interventionId: fragment.get("intervention") as string,
          response,
          token: fragment.get("token") as string
        };
      }

      const resumeRequestId = await createPausedRequest("resume");
      const resumeLink = await issueLink(resumeRequestId);
      expect(resumeLink.token.length).toBeGreaterThan(80);
      const persisted = await prisma.modelToolIntervention.findUniqueOrThrow({
        where: { interventionId: resumeLink.interventionId }
      });
      expect(persisted.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(JSON.stringify(persisted)).not.toContain(resumeLink.token);

      const plainMessage = await app.inject({
        cookies,
        method: "POST",
        payload: { message: "approve" },
        url: `/api/v1/model-gateway/interventions/${resumeLink.interventionId}/decision`
      });
      expect(plainMessage.statusCode).toBe(400);
      expect(plainMessage.json().code).toBe("validation_error");

      const tampered = await app.inject({
        cookies,
        method: "POST",
        payload: { token: `${resumeLink.token.slice(0, -1)}x` },
        url: `/api/v1/model-gateway/interventions/${resumeLink.interventionId}/inspect`
      });
      expect(tampered.statusCode).toBe(403);
      expect(tampered.json().code).toBe("intervention_token_invalid");

      const inspected = await app.inject({
        cookies,
        method: "POST",
        payload: { token: resumeLink.token },
        url: `/api/v1/model-gateway/interventions/${resumeLink.interventionId}/inspect`
      });
      expect(inspected.statusCode).toBe(200);
      expect(inspected.json()).toMatchObject({
        status: "Pending",
        toolRequestId: resumeRequestId,
        transport: "Slack"
      });
      expect(inspected.json()).not.toHaveProperty("token");

      const resumed = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Resume",
          reason: "The exact request, policy, and scope were reviewed.",
          reviewReference: "CAB-RESUME-1",
          token: resumeLink.token
        },
        url: `/api/v1/model-gateway/interventions/${resumeLink.interventionId}/decision`
      });
      expect(resumed.statusCode).toBe(200);
      expect(resumed.json()).toMatchObject({
        intervention: { decision: "Resume", status: "Resumed" },
        requestStatus: "Approved"
      });
      const requestAfterResume = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/model-gateway/tool-requests/${resumeRequestId}`
      });
      expect(requestAfterResume.json().status).toBe("Approved");
      expect(requestAfterResume.json().completedAt).toBeNull();

      const replay = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Cancel",
          reason: "Attempt to reuse the already consumed review link.",
          reviewReference: "CAB-REPLAY-1",
          token: resumeLink.token
        },
        url: `/api/v1/model-gateway/interventions/${resumeLink.interventionId}/decision`
      });
      expect(replay.statusCode).toBe(409);
      expect(replay.json().code).toBe("intervention_replay_denied");

      const cancelRequestId = await createPausedRequest("cancel");
      const firstCancelLink = await issueLink(cancelRequestId);
      const currentCancelLink = await issueLink(cancelRequestId);
      const superseded = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Resume",
          reason: "Attempt to use a superseded authorization envelope.",
          reviewReference: "CAB-OLD-LINK",
          token: firstCancelLink.token
        },
        url: `/api/v1/model-gateway/interventions/${firstCancelLink.interventionId}/decision`
      });
      expect(superseded.statusCode).toBe(409);
      expect(superseded.json().code).toBe("intervention_replay_denied");

      const cancelled = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Cancel",
          reason: "The requested validation is outside the approved window.",
          reviewReference: "CAB-CANCEL-1",
          token: currentCancelLink.token
        },
        url: `/api/v1/model-gateway/interventions/${currentCancelLink.interventionId}/decision`
      });
      expect(cancelled.statusCode).toBe(200);
      expect(cancelled.json().requestStatus).toBe("Cancelled");

      const expiryRequestId = await createPausedRequest("expiry");
      const expiryLink = await issueLink(expiryRequestId, 5);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 6 * 60_000);
      const expired = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Resume",
          reason: "Attempt to use the link after its bounded review window.",
          reviewReference: "CAB-EXPIRED-1",
          token: expiryLink.token
        },
        url: `/api/v1/model-gateway/interventions/${expiryLink.interventionId}/decision`
      });
      expect(expired.statusCode).toBe(410);
      expect(expired.json().code).toBe("intervention_expired");
      vi.useRealTimers();

      const queue = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/model-gateway/interventions"
      });
      expect(queue.statusCode).toBe(200);
      expect(queue.json().items.length).toBeGreaterThanOrEqual(3);
      expect(queue.json().limitations.join(" ")).toContain(
        "message is never an approval"
      );

      const audit = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/model-gateway/audit-events?modelSessionId=${sessionId}`
      });
      const eventTypes = audit
        .json()
        .items.map((event: { eventType: string }) => event.eventType);
      expect(eventTypes).toEqual(
        expect.arrayContaining([
          "InterventionLinkIssued",
          "InterventionResumed",
          "InterventionCancelled",
          "InterventionExpired",
          "InterventionRejected",
          "ToolAllowed",
          "ToolDenied"
        ])
      );
    } finally {
      vi.useRealTimers();
      await app.close();
    }
  }, 30_000);
});
