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

const EMAIL_SECURITY_CONNECTORS = [
  {
    connectorKey: "proofpoint",
    expectedSourceType: "proofpoint_tap.observer",
    fixtureOutcome: "Blocked",
    provider: "Proofpoint TAP"
  },
  {
    connectorKey: "mimecast",
    expectedSourceType: "mimecast.observer",
    fixtureOutcome: "Detected",
    provider: "Mimecast"
  },
  {
    connectorKey: "abnormal-security",
    expectedSourceType: "abnormal_security.observer",
    fixtureOutcome: "Blocked",
    provider: "Abnormal Security"
  }
] as const;

describe("Email-security connector acceptance workflow", () => {
  it("syncs Proofpoint, Mimecast, and Abnormal signals through API-backed control and Threat Center surfaces", async () => {
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
          email: uniqueEmail("email-security-acceptance"),
          name: "Email Security Acceptance Owner",
          password: "periscan-email-security-password",
          tenantName: "Email Security Acceptance Tenant"
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
          value: `email-security-${randomUUID()}.example.com`
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

      for (const connector of EMAIL_SECURITY_CONNECTORS) {
        const createIntegrationResponse = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            config: {
              fixtureOutcome: connector.fixtureOutcome,
              mockMode: true
            },
            connectorKey: connector.connectorKey,
            mockMode: true
          },
          url: "/api/v1/integrations"
        });

        expect(createIntegrationResponse.statusCode).toBe(201);
        expect(createIntegrationResponse.json()).toMatchObject({
          category: "SecurityControl",
          status: "Connected"
        });

        const integrationId = createIntegrationResponse.json()
          .integrationId as string;
        const syncResponse = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });

        expect(syncResponse.statusCode).toBe(200);
        expect(syncResponse.json().assetCount).toBeGreaterThan(0);
        expect(syncResponse.json().signalCount).toBeGreaterThan(0);

        const controlSourceResponse = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            controlType: "EmailSecurity",
            expectedBehaviors: ["Detected", "Blocked"],
            integrationId,
            provider: connector.provider
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
            fixtureOutcome: connector.fixtureOutcome,
            techniqueId: "T1071"
          },
          url: `/api/v1/control-sources/${controlSourceId}/validate`
        });

        expect(validateResponse.statusCode).toBe(200);
        expect(validateResponse.json().signals[0]).toMatchObject({
          sourceType: connector.expectedSourceType
        });
        expect(validateResponse.json().signals[0].signalSubcategory).toBe(
          connector.fixtureOutcome
        );
        expect(validateResponse.json().run.moduleId).toBe(
          "atomic.control_validation_safe"
        );
        expect(validateResponse.json().run.target).toMatchObject({
          dryRun: true,
          executionMode: "DryRun"
        });

        const historyResponse = await app.inject({
          cookies: authCookies(cookie),
          method: "GET",
          url: `/api/v1/control-sources/${controlSourceId}/history`
        });

        expect(historyResponse.statusCode).toBe(200);
        expect(historyResponse.json().items).toHaveLength(1);
      }

      const coverageResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/control-sources/rule-coverage"
      });

      expect(coverageResponse.statusCode).toBe(200);
      expect(coverageResponse.json().totalTechniques).toBeGreaterThan(0);
      expect(coverageResponse.json().items.length).toBeGreaterThan(0);
      const t1071CoverageItems = coverageResponse
        .json()
        .items.filter(
          (item: { techniqueId: string }) => item.techniqueId === "T1071"
        );

      expect(t1071CoverageItems).toHaveLength(EMAIL_SECURITY_CONNECTORS.length);
      expect(
        t1071CoverageItems.map((item: { status: string }) => item.status)
      ).toEqual(expect.arrayContaining(["Blocked", "Covered"]));
      expect(
        t1071CoverageItems.every(
          (item: { signalIds: string[] }) => item.signalIds.length > 0
        )
      ).toBe(true);

      const advisoryResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          rawContent:
            "Email-security advisory references T1071 and CVE-2026-11111 after email-security control telemetry is configured.",
          sourceName: "Manual Email Advisory",
          summary:
            "Threat Center should consume configured email-security control telemetry as a real prerequisite.",
          title: "Email-security advisory readiness"
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
  }, 30_000);
});
