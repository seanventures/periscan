import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{
    name: string;
    value: string;
  }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );

  if (!cookie) {
    throw new Error(
      "Expected API response to include a Periscan session cookie."
    );
  }

  return cookie.value;
}

function authCookies(cookie: string) {
  return {
    [SESSION_COOKIE_NAME]: cookie
  };
}

describe("SIEM connector acceptance workflow", () => {
  it("uses Google SecOps as an API-first control observer without live log ingestion", async () => {
    const prisma = createPrismaClient();
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
        prisma
      })
    });

    try {
      const signupResponse = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("google-secops-acceptance"),
          name: "Google SecOps Acceptance Owner",
          password: "periscan-google-secops-password",
          tenantName: "Google SecOps Acceptance Tenant"
        },
        url: "/api/v1/auth/signup"
      });

      expect(signupResponse.statusCode).toBe(201);

      const cookie = getSessionCookie(signupResponse);
      // Control-source registration is gated on the Control Validation
      // capability; grant the tenant a package that includes it.
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId: signupResponse.json().tenant.tenantId as string }
      });
      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `google-secops-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });

      expect(scopeResponse.statusCode).toBe(201);

      const verifyScopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          devModeManual: true
        },
        url: `/api/v1/scopes/${scopeResponse.json().scopeId}/verify`
      });

      expect(verifyScopeResponse.statusCode).toBe(200);

      const integrationResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          config: {
            fixtureOutcome: "Logged",
            mockMode: true
          },
          connectorKey: "google-chronicle",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(integrationResponse.statusCode).toBe(201);
      expect(integrationResponse.json()).toMatchObject({
        category: "SecurityControl",
        product: "Google Security Operations",
        status: "Connected",
        vendor: "Google"
      });

      const integrationId = integrationResponse.json().integrationId as string;
      const healthResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      const syncResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(healthResponse.json().health.status).toBe("Healthy");
      expect(syncResponse.statusCode).toBe(200);
      expect(syncResponse.json().assetCount).toBe(0);
      expect(syncResponse.json().signalCount).toBeGreaterThan(0);

      const controlSourceResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Logged"],
          integrationId,
          provider: "Google SecOps"
        },
        url: "/api/v1/control-sources"
      });

      expect(controlSourceResponse.statusCode).toBe(201);

      const controlSourceId = controlSourceResponse.json()
        .controlSourceId as string;
      const validateResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          dryRun: true,
          fixtureOutcome: "Logged",
          techniqueId: "T1071"
        },
        url: `/api/v1/control-sources/${controlSourceId}/validate`
      });

      expect(validateResponse.statusCode).toBe(200);
      expect(validateResponse.json().signals[0]).toMatchObject({
        signalSubcategory: "Logged",
        sourceType: "google_secops.udm_search.observer"
      });
      expect(validateResponse.json().run.target).toMatchObject({
        dryRun: true,
        executionMode: "DryRun"
      });

      const coverageResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/control-sources/${controlSourceId}/rule-coverage`
      });

      expect(coverageResponse.statusCode).toBe(200);
      expect(
        coverageResponse
          .json()
          .items.find(
            (item: { techniqueId: string }) => item.techniqueId === "T1071"
          )
      ).toMatchObject({
        observedBehaviors: ["Logged"],
        status: "Covered"
      });

      const advisoryResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          rawContent:
            "SIEM validation advisory references T1071 and CVE-2026-22222 after Google SecOps telemetry is configured.",
          sourceName: "Manual SIEM Advisory",
          summary:
            "Threat Center should consume Google SecOps control telemetry as a real prerequisite.",
          title: "Google SecOps advisory readiness"
        },
        url: "/api/v1/threat-advisories"
      });

      expect(advisoryResponse.statusCode).toBe(201);
      expect(
        advisoryResponse
          .json()
          .missingSignals.map(
            (signal: { signalType: string }) => signal.signalType
          )
      ).not.toContain("control_telemetry");
      expect(advisoryResponse.json().validationPlan.planItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            missionType: "ControlValidation",
            safetyLevel: "BASLite",
            status: "NeedsApproval",
            title: "Plan detection coverage validation for mapped techniques"
          })
        ])
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
