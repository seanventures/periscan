import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SAML_IDP_CERTIFICATE_FIXTURE = [
  "-----BEGIN CERTIFICATE-----",
  "MIIC",
  "A".repeat(180),
  "-----END CERTIFICATE-----"
].join("\n");

describe("tenant OIDC SSO configuration acceptance flow", () => {
  it("stores OIDC config safely, enforces tenant roles, and generates authorization URLs", async () => {
    const prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });
    const ownerSecret = `sso-client-secret-${randomUUID()}`;

    try {
      const ownerSignup = await testHelpers.performSignup(
        app,
        "sso-owner",
        "SSO Acceptance Tenant"
      );
      const ownerCookie = ownerSignup.cookie;
      const tenantId = ownerSignup.response.json().tenant.tenantId as string;

      const emptyRead = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/tenants/current/sso"
      });
      expect(emptyRead.statusCode).toBe(200);
      expect(emptyRead.json()).toEqual({ config: null });

      const update = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: "https://idp.periscan.test/oauth2/authorize",
          clientId: "periscan-acceptance-client",
          clientSecret: ownerSecret,
          emailDomainAllowlist: ["Example.COM", "security.example.com"],
          enabled: true,
          enforced: false,
          issuerUrl: "https://idp.periscan.test",
          jwksUri: "https://idp.periscan.test/.well-known/jwks.json",
          providerType: "OIDC",
          redirectUri: "https://app.periscan.test/api/auth/callback/oidc",
          scopes: ["openid", "email", "profile", "groups"],
          tokenEndpoint: "https://idp.periscan.test/oauth2/token"
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(update.statusCode).toBe(200);
      expect(update.body).not.toContain(ownerSecret);
      expect(update.json()).toMatchObject({
        authorizationEndpoint: "https://idp.periscan.test/oauth2/authorize",
        clientId: "periscan-acceptance-client",
        clientSecretSet: true,
        emailDomainAllowlist: ["example.com", "security.example.com"],
        enforced: false,
        providerType: "OIDC",
        status: "Enabled",
        tenantId
      });
      expect(update.json()).not.toHaveProperty("clientSecret");
      expect(update.json()).not.toHaveProperty("clientSecretEncrypted");

      const stored = await prisma.tenantSsoConfig.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(stored.clientSecretEncrypted).toBeTruthy();
      expect(stored.clientSecretEncrypted).not.toBe(ownerSecret);
      expect(stored.clientSecretEncrypted?.startsWith("v1.")).toBe(true);
      expect(JSON.stringify(stored)).not.toContain(ownerSecret);
      const originalCiphertext = stored.clientSecretEncrypted;

      const preserveSecret = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: "https://idp.periscan.test/oauth2/authorize",
          clientId: "periscan-acceptance-client",
          emailDomainAllowlist: ["example.com"],
          enabled: true,
          enforced: false,
          issuerUrl: "https://idp.periscan.test",
          providerType: "OIDC",
          redirectUri: "https://app.periscan.test/api/auth/callback/oidc",
          scopes: ["openid", "email"]
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(preserveSecret.statusCode).toBe(200);
      expect(preserveSecret.json()).toMatchObject({
        clientSecretSet: true,
        enforced: false,
        scopes: ["openid", "email"]
      });
      const preserved = await prisma.tenantSsoConfig.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(preserved.clientSecretEncrypted).toBe(originalCiphertext);

      const authorization = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url:
          "/api/v1/tenants/current/sso/authorization-url?" +
          new URLSearchParams({
            loginHint: "admin@example.com",
            nonce: "nonce-acceptance",
            prompt: "login",
            state: "state-acceptance"
          }).toString()
      });
      expect(authorization.statusCode).toBe(200);
      const authorizationUrl = new URL(authorization.json().authorizationUrl);
      expect(authorizationUrl.origin).toBe("https://idp.periscan.test");
      expect(authorizationUrl.pathname).toBe("/oauth2/authorize");
      expect(authorizationUrl.searchParams.get("client_id")).toBe(
        "periscan-acceptance-client"
      );
      expect(authorizationUrl.searchParams.get("scope")).toBe("openid email");
      expect(authorizationUrl.searchParams.get("state")).toBe(
        "state-acceptance"
      );
      expect(authorizationUrl.searchParams.get("nonce")).toBe(
        "nonce-acceptance"
      );
      expect(authorizationUrl.searchParams.get("login_hint")).toBe(
        "admin@example.com"
      );
      expect(authorizationUrl.searchParams.get("prompt")).toBe("login");

      const otherSignup = await testHelpers.performSignup(
        app,
        "sso-other",
        "Other SSO Tenant"
      );
      const otherCookie = otherSignup.cookie;
      const otherTenantRead = await app.inject({
        cookies: testHelpers.authHeaders(otherCookie),
        method: "GET",
        url: "/api/v1/tenants/current/sso"
      });
      expect(otherTenantRead.statusCode).toBe(200);
      expect(otherTenantRead.json()).toEqual({ config: null });

      await prisma.membership.create({
        data: {
          role: "Viewer",
          tenantId,
          userId: otherSignup.response.json().user.userId as string
        }
      });
      const viewerDenied = await app.inject({
        cookies: testHelpers.authHeaders(otherCookie),
        headers: {
          "x-periscan-tenant-id": tenantId
        },
        method: "GET",
        url: "/api/v1/tenants/current/sso"
      });
      expect(viewerDenied.statusCode).toBe(403);

      const disable = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "DELETE",
        url: "/api/v1/tenants/current/sso"
      });
      expect(disable.statusCode).toBe(204);
      const disabledStored = await prisma.tenantSsoConfig.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(disabledStored.status).toBe("Disabled");

      const disabledAuthorization = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url:
          "/api/v1/tenants/current/sso/authorization-url?" +
          new URLSearchParams({
            nonce: "nonce-disabled",
            state: "state-disabled"
          }).toString()
      });
      expect(disabledAuthorization.statusCode).toBe(400);
      expect(disabledAuthorization.json().code).toBe("sso_not_enabled");

      const updatedAudit = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/audit-events?action=sso_config.updated&limit=10"
      });
      expect(updatedAudit.statusCode).toBe(200);
      expect(updatedAudit.json().items.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(updatedAudit.json())).not.toContain(ownerSecret);

      const disabledAudit = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/audit-events?action=sso_config.disabled&limit=10"
      });
      expect(disabledAudit.statusCode).toBe(200);
      expect(disabledAudit.json().items.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(disabledAudit.json())).not.toContain(ownerSecret);
    } finally {
      await app.close();
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "sso-owner",
        "sso-other"
      ]);
      await prisma.$disconnect();
    }
  });

  it("stores SAML config safely, generates metadata, and starts signed-response flow", async () => {
    const prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const ownerSignup = await testHelpers.performSignup(
        app,
        "saml-owner",
        "SAML Acceptance Tenant"
      );
      const ownerCookie = ownerSignup.cookie;
      const tenantId = ownerSignup.response.json().tenant.tenantId as string;

      const update = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: "https://idp.periscan.test/saml/sso",
          clientId: "https://api.periscan.test/saml/sp",
          emailDomainAllowlist: ["Periscan.TEST"],
          enabled: true,
          enforced: false,
          issuerUrl: "https://idp.periscan.test/saml",
          providerType: "SAML",
          redirectUri: "https://api.periscan.test/api/v1/auth/sso/callback",
          samlIdpCertificate: SAML_IDP_CERTIFICATE_FIXTURE
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(update.statusCode).toBe(200);
      expect(update.body).not.toContain(SAML_IDP_CERTIFICATE_FIXTURE);
      expect(update.json()).toMatchObject({
        clientId: "https://api.periscan.test/saml/sp",
        clientSecretSet: false,
        emailDomainAllowlist: ["periscan.test"],
        providerType: "SAML",
        samlIdpCertificateSet: true,
        samlNameIdFormat:
          "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        scopes: ["saml:nameid:emailAddress"],
        status: "Enabled",
        tenantId,
        tokenEndpoint: null
      });
      expect(update.json()).not.toHaveProperty("samlIdpCertificate");

      const stored = await prisma.tenantSsoConfig.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(stored.clientSecretEncrypted).toBeNull();
      expect(stored.jwksUri).toBeNull();
      expect(stored.tokenEndpoint).toBeNull();
      expect(stored.samlIdpCertificate).toContain("BEGIN CERTIFICATE");
      expect(stored.samlNameIdFormat).toBe(
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
      );

      const metadata = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/tenants/current/sso/metadata"
      });
      expect(metadata.statusCode).toBe(200);
      expect(metadata.headers["content-type"]).toContain(
        "application/samlmetadata+xml"
      );
      expect(metadata.body).toContain("EntityDescriptor");
      expect(metadata.body).toContain(
        'entityID="https://api.periscan.test/saml/sp"'
      );
      expect(metadata.body).toContain(
        'Location="https://api.periscan.test/api/v1/auth/sso/callback"'
      );

      const oidcOnlyAuthUrl = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url:
          "/api/v1/tenants/current/sso/authorization-url?" +
          new URLSearchParams({
            nonce: "nonce-saml-acceptance",
            state: "state-saml-acceptance"
          }).toString()
      });
      expect(oidcOnlyAuthUrl.statusCode).toBe(400);
      expect(oidcOnlyAuthUrl.json().code).toBe("sso_saml_start_required");

      const started = await app.inject({
        method: "POST",
        payload: {
          email: ownerSignup.email,
          tenantId
        },
        url: "/api/v1/auth/sso/start"
      });
      expect(started.statusCode).toBe(200);
      const startUrl = new URL(started.json().authorizationUrl);
      expect(startUrl.origin).toBe("https://idp.periscan.test");
      expect(startUrl.searchParams.get("SAMLRequest")).toBeTruthy();
      const relayState = startUrl.searchParams.get("RelayState");
      expect(relayState).toBeTruthy();

      const persistedRequest =
        await prisma.tenantSsoAuthRequest.findFirstOrThrow({
          where: { tenantId },
          orderBy: { createdAt: "desc" }
        });
      expect(persistedRequest.protocolRequestIdHash).toBeTruthy();
      expect(persistedRequest.stateHash).not.toBe(relayState);

      const invalidCallback = await app.inject({
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        payload: new URLSearchParams({
          RelayState: relayState ?? "",
          SAMLResponse: "invalid-saml-response"
        }).toString(),
        url: "/api/v1/auth/sso/callback"
      });
      expect(invalidCallback.statusCode).toBe(401);
      expect(invalidCallback.json().code).toBe("sso_saml_response_invalid");

      const updatedAudit = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/audit-events?action=sso_config.updated&limit=10"
      });
      expect(updatedAudit.statusCode).toBe(200);
      expect(JSON.stringify(updatedAudit.json())).not.toContain(
        SAML_IDP_CERTIFICATE_FIXTURE
      );
      expect(JSON.stringify(updatedAudit.json())).toContain(
        "samlIdpCertificateSet"
      );
    } finally {
      await app.close();
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["saml-owner"]);
      await prisma.$disconnect();
    }
  });
});
