import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

/**
 * AI application responses surface the provenance of their most recent
 * validation inline (latestValidation): the module that ran and the HONEST
 * outcome/validationState — a benign endpoint probe is Inconclusive, never
 * Validated. Null before the first validation; populated after, without a
 * separate history call.
 */
describe("AI application validation provenance", () => {
  it("surfaces the latest validation outcome inline on the AI app", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("ai-owner"),
          name: "AI Owner",
          password: "periscan-ai-password",
          tenantName: "AI Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);

      // AI application registration is gated on the AI Security Validation
      // capability; grant the tenant a package that includes it.
      await prisma.tenant.update({
        data: { billingPackageKey: "AISecurityValidation" },
        where: { tenantId: owner.json().tenant.tenantId as string }
      });

      // A verified domain scope the AI application can be tied to.
      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `ai-app-${randomUUID()}.example.com`
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

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          appType: "Chatbot",
          authMethod: "api-key",
          dataSourcesDescription: "Knowledge base of public product docs.",
          endpointUrl: "https://ai-app.example.com/chat",
          guardrailsDescription: "System-prompt guardrails and output filters.",
          name: "Support Assistant",
          owner: "ai-team",
          ragEnabled: true,
          scopeId,
          toolsEnabled: false
        },
        url: "/api/v1/ai-apps"
      });
      expect(created.statusCode).toBe(201);
      const aiAppId = created.json().aiAppId as string;
      // Before any validation, the provenance summary is null.
      expect(created.json().latestValidation ?? null).toBeNull();

      const beforeValidate = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/ai-apps/${aiAppId}`
      });
      expect(beforeValidate.json().latestValidation ?? null).toBeNull();

      // Run a fixture-mode validation (a benign safe check).
      const validate = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { executionMode: "Fixture" },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(validate.statusCode).toBe(200);

      // The AI app now surfaces its latest validation provenance inline.
      const afterValidate = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/ai-apps/${aiAppId}`
      });
      expect(afterValidate.statusCode).toBe(200);
      const latestValidation = afterValidate.json().latestValidation;
      expect(latestValidation).not.toBeNull();
      expect(latestValidation.moduleId).toBe("ai_app.safe_validation");
      expect(typeof latestValidation.runId).toBe("string");
      expect(typeof latestValidation.status).toBe("string");
      // Honesty: a benign safe validation is never reported as fully Validated.
      expect(latestValidation.validationState).not.toBe("Validated");

      // It matches the most recent run in history.
      const history = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/ai-apps/${aiAppId}/history`
      });
      expect(history.statusCode).toBe(200);
      const latestHistoryRun = history.json().items[0];
      expect(latestValidation.runId).toBe(latestHistoryRun.runId);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
