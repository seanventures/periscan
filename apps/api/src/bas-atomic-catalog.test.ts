import { describe, expect, it } from "vitest";

import {
  BasAtomicScenarioCatalogItemSchema,
  BasAtomicScenarioRunResultSchema
} from "@periscan/shared";

import { buildApp } from "./app.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_SECRET = "bas-atomic-catalog-session-secret";

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
    name: "BAS Catalog Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "bas@periscan.test",
    mfaEnabledAt: null,
    name: "BAS Owner",
    userId: USER_ID
  }
};

async function buildCatalogApp() {
  return buildApp({
    services: {
      getSessionContext: async () => ownerContext
    } as never,
    sessionSecret: SESSION_SECRET
  });
}

describe("BAS Atomic MIT scenario catalog API", () => {
  it("requires auth to list allowlisted Atomic YAML scenarios", async () => {
    const app = await buildCatalogApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/bas/scenarios"
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("lists YAML catalog rows as dry-run SPDX MIT with live execution disabled", async () => {
    const app = await buildCatalogApp();
    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const response = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: "/api/v1/bas/scenarios"
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().items as unknown[];
      expect(items.length).toBeGreaterThanOrEqual(2);
      const parsed = items.map((item) =>
        BasAtomicScenarioCatalogItemSchema.parse(item)
      );
      expect(parsed.map((item) => item.techniqueId).sort()).toEqual(
        expect.arrayContaining(["T1087", "T1595"])
      );
      expect(
        parsed.every(
          (item) =>
            item.executionMode === "dry-run" &&
            item.spdxLicenseId === "MIT" &&
            item.liveExecutionDisabled &&
            item.liveExecutionLabel === "live execution disabled"
        )
      ).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("denies live Run through policy with atomic_live_disabled and queues nothing", async () => {
    const app = await buildCatalogApp();
    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const list = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: "/api/v1/bas/scenarios"
      });
      const scenarioId = list.json().items[0].scenarioId as string;

      const response = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { executionMode: "live" },
        url: `/api/v1/bas/scenarios/${encodeURIComponent(scenarioId)}/run`
      });

      expect(response.statusCode).toBe(200);
      const body = BasAtomicScenarioRunResultSchema.parse(response.json());
      expect(body).toMatchObject({
        allowed: false,
        code: "atomic_live_disabled",
        executionMode: "live",
        jobsQueued: 0,
        liveExecutionDisabled: true,
        scenarioId
      });
      expect(body.rationale.toLowerCase()).toMatch(/qualified adapter/);
    } finally {
      await app.close();
    }
  });

  it("returns 404 for an unknown catalog scenario run", async () => {
    const app = await buildCatalogApp();
    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const response = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { executionMode: "live" },
        url: "/api/v1/bas/scenarios/atomic.not-allowlisted/run"
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("atomic_scenario_not_found");
    } finally {
      await app.close();
    }
  });
});
