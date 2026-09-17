import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signWithPrivateKey,
  randomUUID
} from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";
import {
  createSamlIdpFixture,
  extractSamlAuthnRequestId
} from "./helpers/saml-idp-fixture.js";

const SESSION_COOKIE_NAME = "periscan_session";

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signRs256Jwt(input: {
  kid: string;
  payload: Record<string, unknown>;
  privateKeyPem: string;
}): string {
  const encodedHeader = base64UrlJson({
    alg: "RS256",
    kid: input.kid,
    typ: "JWT"
  });
  const encodedPayload = base64UrlJson(input.payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signWithPrivateKey(
    "RSA-SHA256",
    Buffer.from(signingInput),
    input.privateKeyPem
  ).toString("base64url");

  return `${signingInput}.${signature}`;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function startOidcFixtureServer(input: {
  email: string;
  groups?: string[];
  issuer: () => string;
  nonce: () => string;
}) {
  const kid = `acceptance-${randomUUID()}`;
  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8"
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki"
    }
  });
  const publicJwk = createPublicKey(keyPair.publicKey).export({
    format: "jwk"
  }) as Record<string, unknown>;
  const tokenRequests: string[] = [];
  const server = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      if (request.url === "/jwks") {
        response.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            keys: [
              {
                ...publicJwk,
                alg: "RS256",
                kid,
                use: "sig"
              }
            ]
          })
        );
        return;
      }

      if (request.url === "/token" && request.method === "POST") {
        const body = await readBody(request);
        tokenRequests.push(body);
        const nowSeconds = Math.floor(Date.now() / 1000);
        const idToken = signRs256Jwt({
          kid,
          payload: {
            aud: "periscan-live-oidc-client",
            email: input.email,
            email_verified: true,
            exp: nowSeconds + 300,
            groups: input.groups ?? [],
            iat: nowSeconds,
            iss: input.issuer(),
            nonce: input.nonce(),
            sub: createHash("sha256")
              .update(input.email)
              .digest("hex")
              .slice(0, 32)
          },
          privateKeyPem: createPrivateKey(keyPair.privateKey).export({
            format: "pem",
            type: "pkcs8"
          }) as string
        });

        response.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            access_token: "not-used",
            expires_in: 300,
            id_token: idToken,
            token_type: "Bearer"
          })
        );
        return;
      }

      response.writeHead(404, { "content-type": "application/json" }).end(
        JSON.stringify({
          error: "not_found"
        })
      );
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    origin,
    tokenRequests
  };
}

describe("tenant OIDC SSO login acceptance flow", () => {
  let oidcServer: Awaited<ReturnType<typeof startOidcFixtureServer>> | null =
    null;

  beforeEach(() => {
    oidcServer = null;
  });

  afterEach(async () => {
    if (oidcServer) {
      await oidcServer.close();
      oidcServer = null;
    }
  });

  it("exchanges a live OIDC code, verifies the ID token, creates a session, and enforces SSO-only login", async () => {
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
    let currentNonce = "";
    let issuer = "";
    const owner = await testHelpers.performSignup(
      app,
      "sso-login-owner",
      "SSO Login Tenant"
    );

    oidcServer = await startOidcFixtureServer({
      email: owner.email,
      issuer: () => issuer,
      nonce: () => currentNonce
    });
    issuer = `${oidcServer.origin}/`;

    try {
      const ownerCookie = owner.cookie;
      const tenantId = owner.response.json().tenant.tenantId as string;
      const clientSecret = `sso-live-secret-${randomUUID()}`;
      const update = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: `${oidcServer.origin}/authorize`,
          clientId: "periscan-live-oidc-client",
          clientSecret,
          emailDomainAllowlist: ["periscan.test"],
          enabled: true,
          enforced: true,
          issuerUrl: oidcServer.origin,
          jwksUri: `${oidcServer.origin}/jwks`,
          providerType: "OIDC",
          redirectUri: `${oidcServer.origin}/callback`,
          scopes: ["openid", "email", "profile"],
          tokenEndpoint: `${oidcServer.origin}/token`
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(update.statusCode).toBe(200);
      expect(update.body).not.toContain(clientSecret);

      const start = await app.inject({
        method: "POST",
        payload: {
          email: owner.email,
          prompt: "select_account",
          tenantId
        },
        url: "/api/v1/auth/sso/start"
      });
      expect(start.statusCode).toBe(200);
      const authorizationUrl = new URL(start.json().authorizationUrl);
      currentNonce = authorizationUrl.searchParams.get("nonce") ?? "";
      const state = authorizationUrl.searchParams.get("state") ?? "";
      expect(currentNonce).toHaveLength(43);
      expect(state).toHaveLength(43);
      expect(authorizationUrl.searchParams.get("login_hint")).toBe(owner.email);
      expect(authorizationUrl.searchParams.get("prompt")).toBe(
        "select_account"
      );

      const callback = await app.inject({
        method: "GET",
        url:
          "/api/v1/auth/sso/callback?" +
          new URLSearchParams({
            code: "authorization-code",
            state
          }).toString()
      });
      expect(callback.statusCode).toBe(200);
      expect(callback.cookies[0]?.name).toBe(SESSION_COOKIE_NAME);
      expect(callback.json()).toMatchObject({
        tenant: { tenantId },
        user: { email: owner.email }
      });
      expect(oidcServer.tokenRequests).toHaveLength(1);
      expect(oidcServer.tokenRequests[0]).toContain(
        "client_id=periscan-live-oidc-client"
      );
      expect(oidcServer.tokenRequests[0]).toContain(
        "client_secret=sso-live-secret-"
      );

      const sessionRead = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(sessionRead.statusCode).toBe(200);
      expect(sessionRead.json().user.email).toBe(owner.email);

      const replay = await app.inject({
        method: "POST",
        payload: {
          code: "authorization-code",
          state
        },
        url: "/api/v1/auth/sso/callback"
      });
      expect(replay.statusCode).toBe(401);
      expect(replay.json().code).toBe("sso_state_invalid");

      const passwordLogin = await app.inject({
        method: "POST",
        payload: {
          email: owner.email,
          password: "periscan-acceptance-password"
        },
        url: "/api/v1/auth/login"
      });
      expect(passwordLogin.statusCode).toBe(403);
      expect(passwordLogin.json().code).toBe("sso_required");

      const multiTenantUser = await testHelpers.performSignup(
        app,
        "sso-login-multi",
        "SSO Login Non-Enforced Tenant"
      );
      await prisma.membership.create({
        data: {
          role: "Viewer",
          tenantId,
          userId: multiTenantUser.response.json().user.userId as string
        }
      });
      const nonSsoPasswordLogin = await app.inject({
        method: "POST",
        payload: {
          email: multiTenantUser.email,
          password: "periscan-acceptance-password"
        },
        url: "/api/v1/auth/login"
      });
      expect(nonSsoPasswordLogin.statusCode).toBe(200);
      const deniedTenantSwitch = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: nonSsoPasswordLogin.cookies[0]!.value
        },
        headers: {
          "x-periscan-tenant-id": tenantId
        },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(deniedTenantSwitch.statusCode).toBe(401);
      expect(deniedTenantSwitch.json().code).toBe("unauthorized");

      const crossTenantOwner = await testHelpers.performSignup(
        app,
        "sso-login-cross",
        "SSO Login Cross-Enforced Tenant"
      );
      const crossTenantId = crossTenantOwner.response.json().tenant
        .tenantId as string;
      const crossUpdate = await app.inject({
        cookies: testHelpers.authHeaders(crossTenantOwner.cookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: `${oidcServer.origin}/authorize`,
          clientId: "periscan-live-oidc-client",
          clientSecret: `sso-cross-secret-${randomUUID()}`,
          emailDomainAllowlist: ["periscan.test"],
          enabled: true,
          enforced: true,
          issuerUrl: oidcServer.origin,
          jwksUri: `${oidcServer.origin}/jwks`,
          providerType: "OIDC",
          redirectUri: `${oidcServer.origin}/callback`,
          scopes: ["openid", "email", "profile"],
          tokenEndpoint: `${oidcServer.origin}/token`
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(crossUpdate.statusCode).toBe(200);
      await prisma.membership.create({
        data: {
          role: "Viewer",
          tenantId: crossTenantId,
          userId: owner.response.json().user.userId as string
        }
      });
      const deniedCrossTenantSsoSwitch = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        headers: {
          "x-periscan-tenant-id": crossTenantId
        },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(deniedCrossTenantSsoSwitch.statusCode).toBe(401);
      expect(deniedCrossTenantSsoSwitch.json().code).toBe("unauthorized");

      const loginCompletedAudit = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        method: "GET",
        url: "/api/v1/audit-events?action=sso.login_completed&limit=10"
      });
      expect(loginCompletedAudit.statusCode).toBe(200);
      expect(loginCompletedAudit.json().items.length).toBeGreaterThanOrEqual(1);

      const loginFailedAudit = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        method: "GET",
        url: "/api/v1/audit-events?action=sso.login_failed&limit=10"
      });
      expect(loginFailedAudit.statusCode).toBe(200);
      expect(loginFailedAudit.json().items.length).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
      await prisma.tenant.deleteMany({
        where: {
          name: {
            in: [
              "SSO Login Tenant",
              "SSO Login Non-Enforced Tenant",
              "SSO Login Cross-Enforced Tenant"
            ]
          }
        }
      });
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "sso-login-owner",
        "sso-login-multi"
      ]);
      await prisma.$disconnect();
    }
  });

  it("maps IdP group claims to membership roles on SSO login", async () => {
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
    let currentNonce = "";
    let issuer = "";
    const owner = await testHelpers.performSignup(
      app,
      "sso-map-owner",
      "SSO Role Map Tenant"
    );
    const engineer = await testHelpers.performSignup(
      app,
      "sso-map-engineer",
      "SSO Role Map Other Tenant"
    );
    const tenantId = owner.response.json().tenant.tenantId as string;
    const engineerUserId = engineer.response.json().user.userId as string;

    await prisma.membership.create({
      data: {
        role: "Viewer",
        tenantId,
        userId: engineerUserId
      }
    });

    oidcServer = await startOidcFixtureServer({
      email: engineer.email,
      groups: ["periscan-engineers", "all-staff"],
      issuer: () => issuer,
      nonce: () => currentNonce
    });
    issuer = `${oidcServer.origin}/`;

    try {
      const update = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: `${oidcServer.origin}/authorize`,
          clientId: "periscan-live-oidc-client",
          clientSecret: `sso-map-secret-${randomUUID()}`,
          defaultMappedRole: "Viewer",
          emailDomainAllowlist: ["periscan.test"],
          enabled: true,
          enforced: false,
          issuerUrl: oidcServer.origin,
          jwksUri: `${oidcServer.origin}/jwks`,
          providerType: "OIDC",
          redirectUri: `${oidcServer.origin}/callback`,
          roleClaimName: "groups",
          roleMappings: [
            { claimValue: "periscan-admins", role: "Admin" },
            { claimValue: "periscan-engineers", role: "SecurityEngineer" },
            { claimValue: "periscan-viewers", role: "Viewer" }
          ],
          scopes: ["openid", "email", "profile", "groups"],
          tokenEndpoint: `${oidcServer.origin}/token`
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(update.statusCode).toBe(200);
      expect(update.json()).toMatchObject({
        defaultMappedRole: "Viewer",
        roleClaimName: "groups",
        roleMappings: [
          { claimValue: "periscan-admins", role: "Admin" },
          { claimValue: "periscan-engineers", role: "SecurityEngineer" },
          { claimValue: "periscan-viewers", role: "Viewer" }
        ]
      });

      const start = await app.inject({
        method: "POST",
        payload: {
          email: engineer.email,
          tenantId
        },
        url: "/api/v1/auth/sso/start"
      });
      expect(start.statusCode).toBe(200);
      const authorizationUrl = new URL(start.json().authorizationUrl);
      currentNonce = authorizationUrl.searchParams.get("nonce") ?? "";
      const state = authorizationUrl.searchParams.get("state") ?? "";

      const callback = await app.inject({
        method: "GET",
        url:
          "/api/v1/auth/sso/callback?" +
          new URLSearchParams({
            code: "authorization-code",
            state
          }).toString()
      });
      expect(callback.statusCode).toBe(200);
      expect(callback.json().membership.role).toBe("SecurityEngineer");

      const membership = await prisma.membership.findFirstOrThrow({
        where: {
          tenantId,
          userId: engineerUserId
        }
      });
      expect(membership.role).toBe("SecurityEngineer");

      const roleAudit = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        method: "GET",
        url: "/api/v1/audit-events?action=role.changed&limit=10"
      });
      expect(roleAudit.statusCode).toBe(200);
      const roleEvents = roleAudit.json().items as Array<{
        metadata?: { source?: string; previousRole?: string; role?: string };
      }>;
      expect(
        roleEvents.some(
          (event) =>
            event.metadata?.source === "sso_claim_mapping" &&
            event.metadata?.previousRole === "Viewer" &&
            event.metadata?.role === "SecurityEngineer"
        )
      ).toBe(true);
    } finally {
      await app.close();
      await prisma.tenant.deleteMany({
        where: {
          name: {
            in: ["SSO Role Map Tenant", "SSO Role Map Other Tenant"]
          }
        }
      });
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "sso-map-owner",
        "sso-map-engineer"
      ]);
      await prisma.$disconnect();
    }
  });

  it("completes SAML configure → metadata → start → signed callback → session for a provisioned member", async () => {
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
    const idp = createSamlIdpFixture();
    const spEntityId = "https://api.periscan.test/saml/sp";
    const acsUrl = "https://api.periscan.test/api/v1/auth/sso/callback";
    const idpIssuer = "https://idp.periscan.test/saml";

    try {
      const owner = await testHelpers.performSignup(
        app,
        "saml-login-owner",
        "SAML Login Tenant"
      );
      const member = await testHelpers.performSignup(
        app,
        "saml-login-member",
        "SAML Login Other Tenant"
      );
      const tenantId = owner.response.json().tenant.tenantId as string;
      const memberUserId = member.response.json().user.userId as string;

      await prisma.membership.create({
        data: {
          role: "Viewer",
          tenantId,
          userId: memberUserId
        }
      });

      const update = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: "https://idp.periscan.test/saml/sso",
          clientId: spEntityId,
          emailDomainAllowlist: ["periscan.test"],
          enabled: true,
          enforced: false,
          issuerUrl: idpIssuer,
          providerType: "SAML",
          redirectUri: acsUrl,
          samlIdpCertificate: idp.certPem
        },
        url: "/api/v1/tenants/current/sso"
      });
      expect(update.statusCode).toBe(200);
      expect(update.json()).toMatchObject({
        providerType: "SAML",
        samlIdpCertificateSet: true,
        status: "Enabled"
      });

      const metadata = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/tenants/current/sso/metadata"
      });
      expect(metadata.statusCode).toBe(200);
      expect(metadata.body).toContain("EntityDescriptor");
      expect(metadata.body).toContain(`entityID="${spEntityId}"`);
      expect(metadata.body).toContain(`Location="${acsUrl}"`);

      const start = await app.inject({
        method: "POST",
        payload: {
          email: member.email,
          tenantId
        },
        url: "/api/v1/auth/sso/start"
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().providerType).toBe("SAML");
      const authorizationUrl = start.json().authorizationUrl as string;
      const relayState = new URL(authorizationUrl).searchParams.get(
        "RelayState"
      );
      expect(relayState).toBeTruthy();
      const inResponseTo = extractSamlAuthnRequestId(authorizationUrl);

      const samlResponse = idp.buildSignedResponseBase64({
        acsUrl,
        email: member.email,
        idpIssuer,
        inResponseTo,
        spEntityId
      });

      const callback = await app.inject({
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        payload: new URLSearchParams({
          RelayState: relayState ?? "",
          SAMLResponse: samlResponse
        }).toString(),
        url: "/api/v1/auth/sso/callback"
      });
      expect(callback.statusCode).toBe(200);
      expect(callback.cookies[0]?.name).toBe(SESSION_COOKIE_NAME);
      expect(callback.json()).toMatchObject({
        membership: { role: "Viewer" },
        tenant: { tenantId },
        user: { email: member.email }
      });
      // SSO sessions never advertise force-MFA enrollment gate on callback.
      expect(callback.json().mfaEnrollmentRequired).toBeUndefined();

      const sessionRead = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(sessionRead.statusCode).toBe(200);
      expect(sessionRead.json().user.email).toBe(member.email);
      expect(sessionRead.json().membership.role).toBe("Viewer");

      const loginCompletedAudit = await app.inject({
        cookies: {
          [SESSION_COOKIE_NAME]: callback.cookies[0]!.value
        },
        method: "GET",
        url: "/api/v1/audit-events?action=sso.login_completed&limit=10"
      });
      expect(loginCompletedAudit.statusCode).toBe(200);
      expect(loginCompletedAudit.json().items.length).toBeGreaterThanOrEqual(1);

      // Replay of the same RelayState/auth request must fail closed.
      const replay = await app.inject({
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        payload: new URLSearchParams({
          RelayState: relayState ?? "",
          SAMLResponse: samlResponse
        }).toString(),
        url: "/api/v1/auth/sso/callback"
      });
      expect(replay.statusCode).toBe(401);
      expect(replay.json().code).toBe("sso_state_invalid");
    } finally {
      await app.close();
      await prisma.tenant.deleteMany({
        where: {
          name: {
            in: ["SAML Login Tenant", "SAML Login Other Tenant"]
          }
        }
      });
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "saml-login-owner",
        "saml-login-member"
      ]);
      await prisma.$disconnect();
    }
  });

  it("force-MFA gates password product access while SSO sessions stay unrestricted", async () => {
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
    let currentNonce = "";
    let issuer = "";

    try {
      const owner = await testHelpers.performSignup(
        app,
        "sso-forcemfa-owner",
        "SSO Force MFA Tenant"
      );
      const tenantId = owner.response.json().tenant.tenantId as string;

      // Tenant force-MFA on: password owner is restricted to MFA setup path.
      const enableForceMfa = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "PUT",
        payload: { enabled: true },
        url: "/api/v1/tenants/current/security-settings/require-mfa"
      });
      expect(enableForceMfa.statusCode).toBe(200);
      expect(enableForceMfa.json()).toMatchObject({
        effectiveRequireMfa: true,
        requireMfa: true
      });

      const passwordBlocked = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/scopes"
      });
      expect(passwordBlocked.statusCode).toBe(403);
      expect(passwordBlocked.json().code).toBe("mfa_enrollment_required");

      const meAllowed = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(meAllowed.statusCode).toBe(200);
      expect(meAllowed.json().mfaEnrollmentRequired).toBe(true);

      const policyReadAllowed = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/tenants/current/security-settings/require-mfa"
      });
      expect(policyReadAllowed.statusCode).toBe(200);

      // OIDC SSO for the same provisioned member bypasses Periscan MFA (IdP owns 2FA).
      oidcServer = await startOidcFixtureServer({
        email: owner.email,
        issuer: () => issuer,
        nonce: () => currentNonce
      });
      issuer = `${oidcServer.origin}/`;

      const ssoConfig = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "PUT",
        payload: {
          authorizationEndpoint: `${oidcServer.origin}/authorize`,
          clientId: "periscan-live-oidc-client",
          clientSecret: `sso-forcemfa-secret-${randomUUID()}`,
          emailDomainAllowlist: ["periscan.test"],
          enabled: true,
          enforced: false,
          issuerUrl: oidcServer.origin,
          jwksUri: `${oidcServer.origin}/jwks`,
          providerType: "OIDC",
          redirectUri: `${oidcServer.origin}/callback`,
          scopes: ["openid", "email", "profile"],
          tokenEndpoint: `${oidcServer.origin}/token`
        },
        url: "/api/v1/tenants/current/sso"
      });
      // Password session is MFA-setup restricted — SSO config mutation is admin
      // product surface and must be blocked until enroll (fail closed).
      expect(ssoConfig.statusCode).toBe(403);
      expect(ssoConfig.json().code).toBe("mfa_enrollment_required");

      // Plant SSO config via prisma so the public SSO login path can be exercised
      // without elevating the restricted password session. issuerUrl must match
      // the ID token `iss` (API path normalizes via new URL().toString() → trailing /).
      const clientSecret = `sso-forcemfa-secret-${randomUUID()}`;
      const { encryptSecret } = await import(
        "../../apps/api/src/integration-credentials.js"
      );
      const normalizedIssuer = new URL(oidcServer.origin).toString();
      await prisma.tenantSsoConfig.upsert({
        create: {
          authorizationEndpoint: `${oidcServer.origin}/authorize`,
          clientId: "periscan-live-oidc-client",
          clientSecretEncrypted: encryptSecret(clientSecret),
          emailDomainAllowlist: ["periscan.test"],
          enforced: false,
          issuerUrl: normalizedIssuer,
          jwksUri: `${oidcServer.origin}/jwks`,
          providerType: "OIDC",
          redirectUri: `${oidcServer.origin}/callback`,
          scopes: ["openid", "email", "profile"],
          status: "Enabled",
          tenantId,
          tokenEndpoint: `${oidcServer.origin}/token`
        },
        update: {
          authorizationEndpoint: `${oidcServer.origin}/authorize`,
          clientId: "periscan-live-oidc-client",
          clientSecretEncrypted: encryptSecret(clientSecret),
          emailDomainAllowlist: ["periscan.test"],
          enforced: false,
          issuerUrl: normalizedIssuer,
          jwksUri: `${oidcServer.origin}/jwks`,
          providerType: "OIDC",
          redirectUri: `${oidcServer.origin}/callback`,
          scopes: ["openid", "email", "profile"],
          status: "Enabled",
          tokenEndpoint: `${oidcServer.origin}/token`
        },
        where: { tenantId }
      });

      const start = await app.inject({
        method: "POST",
        payload: {
          email: owner.email,
          tenantId
        },
        url: "/api/v1/auth/sso/start"
      });
      expect(start.statusCode).toBe(200);
      const authorizationUrl = new URL(start.json().authorizationUrl);
      currentNonce = authorizationUrl.searchParams.get("nonce") ?? "";
      const state = authorizationUrl.searchParams.get("state") ?? "";

      const callback = await app.inject({
        method: "GET",
        url:
          "/api/v1/auth/sso/callback?" +
          new URLSearchParams({
            code: "authorization-code",
            state
          }).toString()
      });
      expect(callback.statusCode).toBe(200);
      expect(callback.json().mfaEnrollmentRequired).toBeUndefined();
      const ssoCookie = callback.cookies[0]!.value;

      // SSO session: product routes work without Periscan TOTP enrollment.
      const scopesViaSso = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: ssoCookie },
        method: "GET",
        url: "/api/v1/scopes"
      });
      expect(scopesViaSso.statusCode).toBe(200);

      const meViaSso = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: ssoCookie },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(meViaSso.statusCode).toBe(200);
      expect(meViaSso.json().mfaEnrollmentRequired).toBeUndefined();
    } finally {
      await app.close();
      await prisma.tenant.deleteMany({
        where: { name: "SSO Force MFA Tenant" }
      });
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "sso-forcemfa-owner"
      ]);
      await prisma.$disconnect();
    }
  });
});
