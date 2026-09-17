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
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

describe("Autonomous engagement acceptance workflow", () => {
  it("runs governed steps over a verified scope and gates offensive steps", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("engage-owner"),
          name: "Engage Owner",
          password: "periscan-engage-password",
          tenantName: "Engage Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          maxSafetyLevel: "AdvancedAdversarial",
          scopeType: "Domain",
          value: `engage-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      // Engagement with a passive step (executes) + an offensive step WITHOUT
      // authorization (must be denied by the governance gate).
      const denied = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          mode: "Execute",
          plan: [
            { moduleId: "periscan.dns_resolution_check" },
            {
              moduleId: "web.sqli_probe",
              target: { url: "https://engage.example.com/x?id=1" }
            }
          ],
          scopeId
        },
        url: "/api/v1/engagements"
      });
      expect(denied.statusCode).toBe(201);
      const deniedBody = denied.json() as {
        status: string;
        steps: Array<{
          moduleId: string;
          status: string;
          evidenceIds: string[];
        }>;
      };
      const passiveStep = deniedBody.steps.find(
        (step) => step.moduleId === "periscan.dns_resolution_check"
      );
      const offensiveStep = deniedBody.steps.find(
        (step) => step.moduleId === "web.sqli_probe"
      );
      expect(passiveStep?.status).toBe("executed");
      expect(passiveStep?.evidenceIds.length).toBeGreaterThan(0);
      expect(offensiveStep?.status).toBe("denied");
      expect(deniedBody.status).toBe("Completed");

      // Same offensive step WITH authorization (verified scope + approval) is
      // allowed and executes (fixture mode in devMode — no live tool).
      const authorizationReference =
        "SOW-2026-ENGAGE: customer-authorized adversarial validation";
      const enabled = await app.inject({
        cookies: authCookies(cookie),
        method: "PUT",
        payload: {
          authorizationReference,
          enabled: true
        },
        url: "/api/v1/tenants/current/safety-settings/offensive-validation"
      });
      expect(enabled.statusCode).toBe(200);

      const authorized = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          approvalId: authorizationReference,
          authorizedOffensive: true,
          mode: "Execute",
          plan: [
            {
              moduleId: "web.sqli_probe",
              target: { url: "https://engage.example.com/x?id=1" }
            }
          ],
          scopeId
        },
        url: "/api/v1/engagements"
      });
      expect(authorized.statusCode).toBe(201);
      const authorizedStep = (
        authorized.json() as {
          steps: Array<{ moduleId: string; status: string }>;
        }
      ).steps.find((step) => step.moduleId === "web.sqli_probe");
      expect(authorizedStep?.status).toBe("executed");

      // PlanOnly returns the plan without executing.
      const planOnly = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          mode: "PlanOnly",
          plan: [{ moduleId: "periscan.dns_resolution_check" }],
          scopeId
        },
        url: "/api/v1/engagements"
      });
      expect(planOnly.statusCode).toBe(201);
      const planBody = planOnly.json() as {
        status: string;
        steps: Array<{ status: string; evidenceIds: string[] }>;
      };
      expect(planBody.status).toBe("Planned");
      expect(planBody.steps[0]?.status).toBe("planned");
      expect(planBody.steps[0]?.evidenceIds).toHaveLength(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
