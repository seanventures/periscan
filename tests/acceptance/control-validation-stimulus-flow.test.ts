import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

describe("governed safe control-validation stimulus flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "control-stimulus"
      ]);
      await prisma.$disconnect();
    }
  });

  it("binds approval, dispatches one canary, and records only an exact-marker verdict", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "control-stimulus",
        "control-stimulus Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = authCookies(cookie);
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `stimulus-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verified = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      const integration = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          connectorKey: "splunk",
          fixtureOutcome: "Logged",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(integration.statusCode).toBe(201);
      const controlSource = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Detected", "Logged"],
          integrationId: integration.json().integrationId,
          provider: "Splunk"
        },
        url: "/api/v1/control-sources"
      });
      expect(controlSource.statusCode).toBe(201);

      const created = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          controlSourceId: controlSource.json().controlSourceId,
          scopeId,
          stimulusType: "OwnedDomainUrlCanary",
          techniqueId: "T1059",
          ttlSeconds: 600
        },
        url: "/api/v1/control-sources/stimuli"
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        policyDecision: {
          approvalState: "Pending",
          outcome: "RequiresApproval"
        },
        stimulus: {
          evidenceIds: [],
          maxRequestBytes: 1024,
          rateLimitPerMinute: 1,
          status: "RequiresApproval"
        }
      });
      expect(created.body).not.toContain("periscan-scv-");
      const stimulusId = created.json().stimulus.stimulusId as string;
      const policyDecisionId = created.json().policyDecision
        .policyDecisionId as string;

      const deniedBeforeApproval = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/control-sources/stimuli/${stimulusId}/dispatch`
      });
      expect(deniedBeforeApproval.statusCode).toBe(409);
      expect(fetchImpl).not.toHaveBeenCalled();

      const approved = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/approvals/${policyDecisionId}/approve`
      });
      expect(approved.statusCode).toBe(200);

      const dispatched = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/control-sources/stimuli/${stimulusId}/dispatch`
      });
      expect(dispatched.statusCode).toBe(200);
      expect(dispatched.json()).toMatchObject({
        dispatchReceipt: {
          method: "GET",
          responseStatus: 204,
          targetHost: scope.json().value
        },
        status: "Observing"
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [requestUrl, requestInit] = fetchImpl.mock.calls[0]!;
      expect(String(requestUrl)).toContain("/.well-known/periscan-validation/");
      expect(requestInit?.redirect).toBe("manual");

      const observed = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/control-sources/stimuli/${stimulusId}/observe`
      });
      expect(observed.statusCode).toBe(200);
      expect(observed.json()).toMatchObject({
        status: "Completed",
        verdict: {
          correlationMatched: true,
          observedOutcome: "Logged",
          verdict: "TelemetryOnly"
        }
      });
      expect(observed.body).not.toContain("periscan-scv-");

      const persisted = await prisma.validationStimulus.findUniqueOrThrow({
        include: { verdict: true },
        where: { stimulusId }
      });
      expect(persisted.correlationToken).toMatch(/^periscan-scv-/u);
      expect(persisted.evidenceIds.length).toBeGreaterThanOrEqual(2);
      expect(persisted.verdict).toMatchObject({
        correlationMatched: true,
        verdict: "TelemetryOnly"
      });
      const artifacts = await prisma.evidenceArtifact.findMany({
        where: {
          relatedEntityId: stimulusId,
          relatedEntityType: "ValidationStimulus",
          tenantId
        }
      });
      expect(artifacts.length).toBeGreaterThanOrEqual(2);
      const audits = await prisma.auditEvent.findMany({
        where: {
          action: {
            in: [
              "validation_stimulus_created",
              "validation_stimulus_dispatched",
              "validation_stimulus_observed"
            ]
          },
          tenantId
        }
      });
      expect(audits).toHaveLength(3);
    } finally {
      await app.close();
    }
  });
});
