import { OPENAPI_ROUTE } from "@periscan/shared";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { createBasContentServices } from "./services/bas-content.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";

const secret = "bas-preview-test-secret";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const context = {
  membership: {
    membershipId: "33333333-3333-4333-8333-333333333333",
    role: "Owner",
    tenantId,
    userId
  },
  session: {
    authMethod: "password" as const,
    defaultTenantId: tenantId,
    userId
  },
  tenant: { name: "BAS Tenant", requireMfa: false, tenantId, type: "Customer" },
  user: {
    email: "bas@periscan.test",
    mfaEnabledAt: null,
    name: "BAS Owner",
    userId
  }
};
const payload = {
  provider: "Caldera",
  format: "json",
  sourceRevision: "test-revision",
  content: JSON.stringify([
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Test metadata",
      technique: { attack_id: "T1082" },
      platforms: { linux: { sh: { command: "PRIVATE_COMMAND" } } }
    }
  ])
};

describe("POST /api/v1/bas/content/preview", () => {
  it.each(["anonymous", "Viewer", "Owner", "Admin"])(
    "enforces authorization for %s",
    async (role) => {
      const services = createBasContentServices();
      const preview = vi.spyOn(services, "previewBasContent");
      // Deliberately supply no DB, queue, installation or execution services.
      const app = await buildApp({
        services: {
          ...services,
          getSessionContext: async () => ({
            ...context,
            membership: { ...context.membership, role }
          })
        } as never,
        sessionSecret: secret
      });
      try {
        const cookie = await createSessionToken(context.session, secret);
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/bas/content/preview",
          ...(role === "anonymous"
            ? {}
            : { cookies: { [SESSION_COOKIE_NAME]: cookie } }),
          payload
        });
        expect(response.statusCode).toBe(
          role === "anonymous" ? 401 : role === "Viewer" ? 403 : 200
        );
        if (role === "anonymous") expect(preview).not.toHaveBeenCalled();
        if (response.statusCode === 200) {
          expect(response.json()).toMatchObject({
            executable: false,
            evidenceProduced: false,
            provenance: "UserSuppliedUnverified",
            scenarios: [{ reviewStatus: "Unreviewed", executable: false }]
          });
          expect(response.body).not.toContain("PRIVATE_COMMAND");
        }
      } finally {
        await app.close();
      }
    }
  );

  it("returns a bounded content error, rejects unknown execution fields and publishes payload schemas", async () => {
    const app = await buildApp({
      services: {
        ...createBasContentServices(),
        getSessionContext: async () => context
      } as never,
      sessionSecret: secret
    });
    try {
      const cookie = await createSessionToken(context.session, secret);
      const cookies = { [SESSION_COOKIE_NAME]: cookie };
      for (const bad of [
        { ...payload, content: "PRIVATE_SECRET" },
        { ...payload, execute: true }
      ]) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/bas/content/preview",
          cookies,
          payload: bad
        });
        expect(response.statusCode).toBe(400);
        expect(response.body).not.toContain("PRIVATE_SECRET");
      }
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/bas/content/preview",
        cookies,
        payload: { ...payload, content: "x".repeat(3 * 1024 * 1024) }
      });
      expect(response.statusCode).toBe(413);
      const openapi = await app.inject({ url: OPENAPI_ROUTE });
      expect(openapi.statusCode).toBe(200);
      const operation =
        openapi.json().paths["/api/v1/bas/content/preview"].post;
      expect(operation.requestBody).toBeDefined();
      expect(operation.responses["200"]).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
