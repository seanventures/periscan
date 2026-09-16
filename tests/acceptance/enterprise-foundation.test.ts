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

describe("Enterprise foundation acceptance flow", () => {
  it("supports MSSP client tenants, tenant switching, branded reports, and usage meters", async () => {
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
          email: uniqueEmail("mssp-owner"),
          name: "MSSP Owner",
          password: "periscan-enterprise-password",
          tenantName: "Acceptance MSSP",
          tenantType: "MSSP"
        },
        url: "/api/v1/auth/signup"
      });

      expect(signupResponse.statusCode).toBe(201);

      const ownerCookie = getSessionCookie(signupResponse);
      const parentTenantId = signupResponse.json().tenant.tenantId as string;

      // Grant package with EvidencePacks (and others) to parent MSSP tenant for report/export flows
      await prisma.tenant.update({
        where: { tenantId: parentTenantId },
        data: { billingPackageKey: "MSSPPartner" }
      });
      const createClientResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          clientAdminEmail: uniqueEmail("client-admin"),
          clientAdminName: "Client Admin",
          name: "Acceptance Client"
        },
        url: "/api/v1/tenants/current/clients"
      });

      expect(createClientResponse.statusCode).toBe(201);
      expect(createClientResponse.json().tenant).toMatchObject({
        parentTenantId,
        type: "Client"
      });

      const clientTenantId = createClientResponse.json().tenant
        .tenantId as string;

      // Grant package with EvidencePacks to client tenant for report export
      await prisma.tenant.update({
        where: { tenantId: clientTenantId },
        data: { billingPackageKey: "ValidationSnapshot" }
      });
      const clientHeaders = {
        "x-periscan-tenant-id": clientTenantId
      };
      const childContextResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "GET",
        url: "/api/v1/tenants/current"
      });

      expect(childContextResponse.statusCode).toBe(200);
      expect(childContextResponse.json().membership.role).toBe("MSSPOwner");
      expect(childContextResponse.json().tenant.name).toBe("Acceptance Client");

      const brandingResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "PUT",
        payload: {
          logoUrl: "https://assets.periscan.test/acceptance-client.svg",
          organizationName: "Acceptance Client Security",
          primaryColor: "#0F766E",
          reportFooter: "Prepared by Acceptance Client Security.",
          supportEmail: "security@acceptance-client.test",
          whiteLabelEnabled: true
        },
        url: "/api/v1/tenants/current/branding"
      });

      expect(brandingResponse.statusCode).toBe(200);
      expect(brandingResponse.json().organizationName).toBe(
        "Acceptance Client Security"
      );

      const integrationResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "POST",
        payload: {
          connectorKey: "github",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(integrationResponse.statusCode).toBe(201);

      const scopeResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `acceptance-client-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });

      expect(scopeResponse.statusCode).toBe(201);

      const verifyScopeResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "POST",
        payload: {
          devModeManual: true
        },
        url: `/api/v1/scopes/${scopeResponse.json().scopeId}/verify`
      });

      expect(verifyScopeResponse.statusCode).toBe(200);

      const snapshotResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "POST",
        payload: {
          audience: "MSSP Client"
        },
        url: "/api/v1/snapshots"
      });

      expect(snapshotResponse.statusCode).toBe(201);

      const exportResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "POST",
        url: `/api/v1/snapshots/${snapshotResponse.json().snapshotId}/export`
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.body).toContain("Acceptance Client Security");
      expect(exportResponse.body).toContain(
        "Prepared by Acceptance Client Security."
      );

      const childUsageResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        headers: clientHeaders,
        method: "GET",
        url: "/api/v1/billing/usage"
      });
      const parentUsageResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: "/api/v1/billing/usage"
      });

      expect(childUsageResponse.statusCode).toBe(200);
      expect(parentUsageResponse.statusCode).toBe(200);
      expect(
        childUsageResponse
          .json()
          .meters.find(
            (meter: { meterName: string }) =>
              meter.meterName === "EvidencePacks"
          ).quantity
      ).toBeGreaterThan(0);
      expect(
        parentUsageResponse
          .json()
          .meters.find(
            (meter: { meterName: string }) =>
              meter.meterName === "ClientTenants"
          ).quantity
      ).toBe(1);

      const portfolioResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: "/api/v1/tenants/current/client-portfolio"
      });

      expect(portfolioResponse.statusCode).toBe(200);
      expect(portfolioResponse.json()).toMatchObject({
        parentTenant: {
          tenantId: parentTenantId,
          type: "MSSP"
        },
        totals: {
          clientTenants: 1,
          verifiedScopes: 1
        }
      });
      expect(portfolioResponse.json().clients[0]).toMatchObject({
        branding: {
          organizationName: "Acceptance Client Security",
          whiteLabelEnabled: true
        },
        coverage: {
          connectedIntegrations: 1,
          missingProofInputs: expect.any(Number),
          verifiedScopes: 1
        },
        tenant: {
          tenantId: clientTenantId
        }
      });

      const orgSignupResponse = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("org-owner"),
          name: "Org Owner",
          password: "periscan-enterprise-password",
          tenantName: "Acceptance Org"
        },
        url: "/api/v1/auth/signup"
      });
      const orgCreateClientResponse = await app.inject({
        cookies: authCookies(getSessionCookie(orgSignupResponse)),
        method: "POST",
        payload: {
          name: "Disallowed Client"
        },
        url: "/api/v1/tenants/current/clients"
      });

      expect(orgCreateClientResponse.statusCode).toBe(400);

      const orgPortfolioResponse = await app.inject({
        cookies: authCookies(getSessionCookie(orgSignupResponse)),
        method: "GET",
        url: "/api/v1/tenants/current/client-portfolio"
      });

      expect(orgPortfolioResponse.statusCode).toBe(400);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
