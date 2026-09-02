import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";
function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

const SAFE_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
};

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
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
}

describe("offensive-validation authorization flip", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["offensive-owner"]);
      await prisma.$disconnect();
    }
  });

  it("gates adversarial validation behind an authorized flip, keeps the hard floor, and audits", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "offensive-owner",
        "Offensive Tenant"
      );
      const auth = authCookies(cookie);

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          maxSafetyLevel: "AdvancedAdversarial",
          scopeType: "Domain",
          value: "offensive.example.com"
        },
        url: "/api/v1/scopes"
      });
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const preview = (action = SAFE_ACTION, adminApproval = false) =>
        app.inject({
          cookies: auth,
          method: "POST",
          payload: {
            adminApproval,
            executionEnvironment: "ControlPlane",
            missionType: "ExposureValidation",
            requestedAction: action,
            safetyLevel: "AdvancedAdversarial",
            target: { hostname: "offensive.example.com" }
          },
          url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
        });

      // Default OFF: settings report disabled; adversarial validation is denied.
      const before = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/safety-settings"
      });
      expect(before.json().offensiveValidationEnabled).toBe(false);
      expect(before.json().effectiveMaxSafetyLevel).toBe("BASLite");

      const deniedByDefault = await preview();
      expect(deniedByDefault.json().outcome).toBe("Denied");

      // Enabling requires an authorization reference.
      const missingRef = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: { enabled: true },
        url: "/api/v1/tenants/current/safety-settings/offensive-validation"
      });
      expect(missingRef.statusCode).toBe(400);

      // Authorize offensive validation with an attestation reference.
      const enable = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          authorizationReference:
            "SOW-2026-014: customer-authorized adversarial validation of owned assets",
          enabled: true
        },
        url: "/api/v1/tenants/current/safety-settings/offensive-validation"
      });
      expect(enable.statusCode).toBe(200);
      expect(enable.json().offensiveValidationEnabled).toBe(true);
      expect(enable.json().effectiveMaxSafetyLevel).toBe("AdvancedAdversarial");
      expect(enable.json().authorizedBy).toBeTruthy();

      // Now adversarial validation is permittable — still gated on admin approval.
      const nowRequiresApproval = await preview();
      expect(nowRequiresApproval.json().outcome).toBe("RequiresApproval");

      const withApproval = await preview(SAFE_ACTION, true);
      expect(withApproval.json().outcome).toBe("Allowed");

      // The hard safety floor holds even when authorized: a destructive action
      // is denied regardless of the flip.
      const destructive = await preview(
        { ...SAFE_ACTION, destructive: true },
        true
      );
      expect(destructive.json().outcome).toBe("Denied");

      // Audited.
      const auditRow = await prisma.auditEvent.findFirst({
        where: { action: "offensive_validation_changed" }
      });
      expect(auditRow).toBeTruthy();

      // Revoking returns to the denied-by-default state.
      const disable = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: { enabled: false },
        url: "/api/v1/tenants/current/safety-settings/offensive-validation"
      });
      expect(disable.json().offensiveValidationEnabled).toBe(false);
      const deniedAgain = await preview(SAFE_ACTION, true);
      expect(deniedAgain.json().outcome).toBe("Denied");
    } finally {
      await app.close();
    }
  });
});
