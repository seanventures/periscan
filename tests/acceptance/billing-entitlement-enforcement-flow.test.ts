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

describe("Billing entitlement enforcement", () => {
  it("allows optional AI app registration in the first-sellable Snapshot package", async () => {
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
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("entitlement-owner"),
          name: "Entitlement Owner",
          password: "periscan-entitlement-password",
          tenantName: "Entitlement Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      const tenantId = owner.json().tenant.tenantId as string;

      // A verified domain scope the AI application can be tied to.
      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `entitlement-${randomUUID()}.example.com`
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

      const aiAppPayload = {
        appType: "Chatbot",
        authMethod: "api-key",
        dataSourcesDescription: "Public docs knowledge base.",
        endpointUrl: "https://entitlement-ai.example.com/chat",
        guardrailsDescription: "System-prompt guardrails.",
        name: "Entitlement Assistant",
        owner: "ai-team",
        ragEnabled: false,
        scopeId,
        toolsEnabled: false
      };

      // The default ValidationSnapshot package includes AI app registration
      // because PRD section 19 makes optional AI app registration part of the
      // first sellable MVP flow. Actual AI validation remains policy/safety
      // gated by the validation route and module engine.
      const allowed = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: aiAppPayload,
        url: "/api/v1/ai-apps"
      });
      expect(allowed.statusCode).toBe(201);
      expect(allowed.json().name).toBe("Entitlement Assistant");

      // Exercise non-snapshot schedule + run path with the package (includes ValidationRuns).
      // This covers the new requireCapability gates in runSchedule/create for Control/AI/Fix.
      const scope2 = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `entitlement-ctrl-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope2.statusCode).toBe(201);
      const scope2Id = scope2.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scope2Id}/verify`
      });

      const createCtrlSched = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          frequency: "Daily",
          missionType: "ControlValidation",
          scopeIds: [scope2Id]
        },
        url: "/api/v1/schedules"
      });
      expect(createCtrlSched.statusCode).toBe(201);
      const ctrlSchedId = createCtrlSched.json().scheduleId as string;

      const runCtrl = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/schedules/${ctrlSchedId}/run`
      });
      expect(runCtrl.statusCode).toBe(201);
      expect(runCtrl.json().snapshot?.packType).toBe("ControlValidationReport");

      const deniedAudit = await prisma.auditEvent.findFirst({
        where: {
          action: "billing_entitlement_denied",
          tenantId
        }
      });
      expect(deniedAudit).toBeNull();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("denies + audits control-source registration without the Control Validation capability", async () => {
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
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("control-entitlement-owner"),
          name: "Control Entitlement Owner",
          password: "periscan-control-entitlement-password",
          tenantName: "Control Entitlement Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      const tenantId = owner.json().tenant.tenantId as string;

      // The default ValidationSnapshot package does NOT include "Control source
      // registry" — registration is denied with 402 before any integration
      // lookup, since the entitlement guard runs first.
      const denied = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Detected"],
          integrationId: randomUUID(),
          provider: "Splunk"
        },
        url: "/api/v1/control-sources"
      });
      expect(denied.statusCode).toBe(402);
      expect(denied.json().code).toBe("entitlement_denied");

      const deniedAudit = await prisma.auditEvent.findFirst({
        where: {
          action: "billing_entitlement_denied",
          tenantId
        }
      });
      expect(deniedAudit).not.toBeNull();
      expect(
        (deniedAudit?.metadata as { requiredCapability?: string } | null)
          ?.requiredCapability
      ).toBe("Control source registry");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
