import { describe, expect, it, vi } from "vitest";

import { DANGER_CATALOG, OPENAPI_ROUTE } from "@periscan/shared";

import { buildApp } from "./app.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_SECRET = "danger-catalog-session-secret";

const ownerContext = {
  membership: {
    membershipId: "88888888-8888-4888-8888-888888888888",
    role: "Owner",
    tenantId: TENANT_ID,
    userId: USER_ID
  },
  session: {
    authMethod: "password" as const,
    defaultTenantId: TENANT_ID,
    userId: USER_ID
  },
  tenant: {
    name: "Danger Catalog Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "danger@periscan.test",
    mfaEnabledAt: null,
    name: "Danger Owner",
    userId: USER_ID
  }
};

describe("GET /api/v1/bas/danger-catalog", () => {
  it("returns the High-danger operator gate from persistence without queuing work", async () => {
    const getBasDangerOperatorGate = vi.fn(async () => ({
      available: true,
      items: [...DANGER_CATALOG],
      qualified: false,
      tenantAuthorized: false
    }));
    const app = await buildApp({
      services: {
        getBasDangerOperatorGate,
        getSessionContext: async () => ownerContext
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const response = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: "/api/v1/bas/danger-catalog"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        available: true,
        qualified: false,
        tenantAuthorized: false
      });
      expect(
        (response.json().items as Array<{ moduleId: string }>).map(
          (item) => item.moduleId
        )
      ).toEqual(DANGER_CATALOG.map((entry) => entry.moduleId));
      expect(getBasDangerOperatorGate).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });

  it("requires authentication and documents getBasDangerOperatorGate", async () => {
    const app = await buildApp({
      services: {
        getBasDangerOperatorGate: vi.fn()
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const anonymous = await app.inject({
        method: "GET",
        url: "/api/v1/bas/danger-catalog"
      });
      expect(anonymous.statusCode).toBe(401);

      await app.ready();
      const document = app.swagger() as {
        paths?: Record<
          string,
          Record<
            string,
            { operationId?: string; summary?: string; tags?: string[] }
          >
        >;
      };
      const operation = document.paths?.["/api/v1/bas/danger-catalog"]?.get;
      expect(operation?.operationId).toBe("getBasDangerOperatorGate");
      expect(operation?.summary).toMatch(/high-danger/i);
      expect(operation?.tags).toEqual(
        expect.arrayContaining(["control-sources"])
      );

      const openapi = await app.inject({ method: "GET", url: OPENAPI_ROUTE });
      expect(openapi.statusCode).toBe(200);
      expect(JSON.stringify(openapi.json())).toContain(
        "getBasDangerOperatorGate"
      );
    } finally {
      await app.close();
    }
  });
});
