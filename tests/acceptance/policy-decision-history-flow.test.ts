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

interface PolicyDecision {
  missionType: string;
  outcome: string;
  policyDecisionId: string;
  rationale: string;
  scopeId: string;
}

/**
 * Every validation produces a policy decision; this proves that governance trail
 * is now queryable: GET /api/v1/policy-decisions returns the tenant's decision
 * history (outcome + rationale + mission type + scope), filterable by outcome /
 * missionType / scope.
 */
describe("Policy decision history", () => {
  it("surfaces the tenant policy decision trail, filterable", async () => {
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
          email: uniqueEmail("policy-owner"),
          name: "Policy Owner",
          password: "periscan-policy-password",
          tenantName: "Policy Tenant"
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

      // Before any validation, the history is empty.
      const initial = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/policy-decisions"
      });
      expect(initial.statusCode).toBe(200);
      expect(initial.json().items).toHaveLength(0);

      // A validation flow produces a persisted policy decision.
      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `policy-${randomUUID()}.example.com`
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

      const aiApp = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          appType: "Chatbot",
          authMethod: "api-key",
          dataSourcesDescription: "Public docs knowledge base.",
          endpointUrl: "https://policy-ai.example.com/chat",
          guardrailsDescription: "System-prompt guardrails.",
          name: "Policy Assistant",
          owner: "ai-team",
          ragEnabled: false,
          scopeId,
          toolsEnabled: false
        },
        url: "/api/v1/ai-apps"
      });
      expect(aiApp.statusCode).toBe(201);
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { executionMode: "Fixture" },
        url: `/api/v1/ai-apps/${aiApp.json().aiAppId}/validate`
      });

      // The governance trail now lists the decision with its rationale.
      const history = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/policy-decisions"
      });
      expect(history.statusCode).toBe(200);
      const items = history.json().items as PolicyDecision[];
      expect(items.length).toBeGreaterThan(0);
      const decision = items[0]!;
      expect(typeof decision.rationale).toBe("string");
      expect(decision.rationale.length).toBeGreaterThan(0);
      expect(decision.scopeId).toBe(scopeId);

      // Filter by the decision's own outcome — every returned item matches.
      const byOutcome = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/policy-decisions?outcome=${decision.outcome}`
      });
      expect(byOutcome.statusCode).toBe(200);
      const byOutcomeItems = byOutcome.json().items as PolicyDecision[];
      expect(byOutcomeItems.length).toBeGreaterThan(0);
      expect(
        byOutcomeItems.every((item) => item.outcome === decision.outcome)
      ).toBe(true);

      // Filtering by an unrelated scope excludes this tenant's decisions.
      const byScope = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/policy-decisions?scopeId=${randomUUID()}`
      });
      expect(byScope.statusCode).toBe(200);
      expect(byScope.json().items).toHaveLength(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
