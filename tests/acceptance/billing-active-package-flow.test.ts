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

describe("Billing active-package acceptance workflow", () => {
  it("resolves a new tenant's active subscription package from its assigned key", async () => {
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
          email: uniqueEmail("billing-active-owner"),
          name: "Billing Active Owner",
          password: "periscan-billing-active-password",
          tenantName: "Billing Active Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      // A new tenant defaults to the entry-tier package.
      const active = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/active-package"
      });
      expect(active.statusCode).toBe(200);
      const pkg = active.json();
      expect(pkg.packageKey).toBe("ValidationSnapshot");
      expect(pkg.paymentProcessorStatus).toBe("NotConfigured");
      expect(Array.isArray(pkg.includedCapabilities)).toBe(true);

      // An unsubscribed tenant (null package key) resolves to null.
      await prisma.tenant.update({
        data: { billingPackageKey: null },
        where: { tenantId }
      });
      const unsubscribed = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/billing/active-package"
      });
      expect(unsubscribed.statusCode).toBe(200);
      expect(unsubscribed.json()).toBeNull();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
