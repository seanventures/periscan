import { randomBytes } from "node:crypto";

import {
  generateServiceProviderMetadata,
  SAML,
  ValidateInResponseTo,
  type CacheItem,
  type CacheProvider,
  type Profile
} from "@node-saml/node-saml";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import type { MembershipRole, TenantSsoRoleMappingRule } from "@periscan/shared";

import { decryptSecret, encryptSecret } from "../integration-credentials.js";
import { serializeMembership, serializeUser } from "../serializers/entities.js";
import {
  serializeTenant,
  serializeTenantSsoConfig
} from "../serializers/tenant.js";
import {
  AppServiceError,
  hashSecret,
  requireRole,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import {
  parseStoredRoleMappings,
  resolveSsoMappedRole
} from "./sso-role-mapping.js";

const DEFAULT_OIDC_SCOPES = ["openid", "email", "profile"];
const DEFAULT_SAML_SCOPES = ["saml:nameid:emailAddress"];
const DEFAULT_SAML_NAME_ID_FORMAT =
  "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";
const SSO_AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueLowercase(values: string[]): string[] {
  return uniqueNormalized(values).map((value) => value.toLowerCase());
}

function normalizeUrl(value: string): string {
  return new URL(value).toString();
}

function randomOpaqueValue(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeSamlCertificate(value: string): string {
  const trimmed = value.trim();
  if (
    /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/u.test(
      trimmed
    )
  ) {
    return trimmed;
  }

  const compact = trimmed.replace(/\s+/gu, "");
  const chunks = compact.match(/.{1,64}/gu) ?? [];
  return [
    "-----BEGIN CERTIFICATE-----",
    ...chunks,
    "-----END CERTIFICATE-----"
  ].join("\n");
}

function emailDomain(email: string): string {
  return email.split("@").at(-1)?.toLowerCase() ?? "";
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function buildAuthorizationUrl(
  config: {
    authorizationEndpoint: string;
    clientId: string;
    scopes: string[];
  },
  input: {
    loginHint?: string;
    nonce: string;
    prompt?: string;
    redirectUri: string;
    state: string;
  }
): string {
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", input.state);

  if (input.loginHint) {
    url.searchParams.set("login_hint", input.loginHint);
  }

  if (input.prompt) {
    url.searchParams.set("prompt", input.prompt);
  }

  return url.toString();
}

function claimString(payload: JWTPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function claimBoolean(payload: JWTPayload, key: string): boolean | null {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
}

function sanitizedAuditMetadata(config: {
  authorizationEndpoint: string;
  clientSecretEncrypted: string | null;
  defaultMappedRole?: MembershipRole | null;
  emailDomainAllowlist: string[];
  enforced: boolean;
  issuerUrl: string;
  providerType: string;
  roleClaimName?: string | null;
  roleMappings?: unknown;
  samlIdpCertificate?: string | null;
  samlNameIdFormat?: string | null;
  scopes: string[];
  status: string;
}) {
  const roleMappings = parseStoredRoleMappings(config.roleMappings);
  return {
    authorizationEndpoint: config.authorizationEndpoint,
    clientSecretSet: Boolean(config.clientSecretEncrypted),
    defaultMappedRole: config.defaultMappedRole ?? null,
    emailDomainAllowlist: config.emailDomainAllowlist,
    enforced: config.enforced,
    issuerUrl: config.issuerUrl,
    providerType: config.providerType,
    roleClaimName: config.roleClaimName ?? null,
    roleMappingCount: roleMappings.length,
    samlIdpCertificateSet: Boolean(config.samlIdpCertificate),
    samlNameIdFormat: config.samlNameIdFormat ?? null,
    scopes: config.scopes,
    status: config.status
  };
}

function firstProfileString(profile: Profile, keys: string[]): string | null {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value)) {
      const first = value.find(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0
      );
      if (first) {
        return first;
      }
    }
  }

  return null;
}

function samlEmailFromProfile(profile: Profile): string | null {
  return (
    firstProfileString(profile, [
      "email",
      "mail",
      "urn:oid:0.9.2342.19200300.100.1.3",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "nameID"
    ])?.toLowerCase() ?? null
  );
}

function profileAsClaimBag(profile: Profile): Record<string, unknown> {
  return profile as unknown as Record<string, unknown>;
}

function normalizeRoleMappings(
  input: TenantSsoRoleMappingRule[] | undefined,
  existingRaw: unknown
): TenantSsoRoleMappingRule[] {
  if (input !== undefined) {
    const seen = new Set<string>();
    const rules: TenantSsoRoleMappingRule[] = [];
    for (const rule of input) {
      const claimValue = rule.claimValue.trim();
      const key = claimValue.toLowerCase();
      if (!claimValue || seen.has(key)) {
        continue;
      }
      seen.add(key);
      rules.push({ claimValue, role: rule.role });
    }
    return rules;
  }
  return parseStoredRoleMappings(existingRaw);
}

// Tenant SSO/OIDC management and generic authorization-code login. The flow is
// vendor-neutral: customers configure issuer/token/JWKS/authorization endpoints,
// Periscan verifies ID tokens, then creates the same session cookie as password
// login for pre-provisioned users with an existing tenant membership.
export function createSsoServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "buildTenantSsoAuthorizationUrl"
  | "completeTenantSsoLogin"
  | "disableTenantSsoConfig"
  | "getTenantSsoConfig"
  | "getTenantSsoMetadata"
  | "startTenantSsoLogin"
  | "updateTenantSsoConfig"
> {
  const { fetchImpl, prisma } = deps;

  async function writeSsoFailure(input: {
    code: string;
    reason: string;
    tenantId?: string | null;
    userId?: string | null;
  }) {
    await writeAuditEvent(prisma, {
      action: "sso.login_failed",
      actorType: input.userId ? "User" : "System",
      entityId: input.tenantId ?? null,
      entityType: "Tenant",
      metadata: {
        code: input.code,
        reason: input.reason
      },
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null
    });
  }

  async function resolveEnabledSsoConfig(input: {
    email?: string;
    tenantId?: string;
  }) {
    if (input.tenantId) {
      const config = await prisma.tenantSsoConfig.findUnique({
        where: { tenantId: input.tenantId }
      });
      if (!config || config.status !== "Enabled") {
        throw new AppServiceError(
          "Tenant SSO is not enabled.",
          400,
          "sso_not_enabled"
        );
      }
      return config;
    }

    const domain = input.email ? emailDomain(input.email) : "";
    if (!domain) {
      throw new AppServiceError(
        "Provide either tenantId or email to start SSO login.",
        400,
        "sso_tenant_required"
      );
    }

    const configs = await prisma.tenantSsoConfig.findMany({
      where: {
        emailDomainAllowlist: { has: domain },
        status: "Enabled"
      }
    });
    if (configs.length === 0) {
      throw new AppServiceError(
        "No enabled tenant SSO configuration matches that email domain.",
        404,
        "sso_tenant_not_found"
      );
    }
    if (configs.length > 1) {
      throw new AppServiceError(
        "Multiple enabled tenant SSO configurations match that email domain.",
        409,
        "sso_tenant_ambiguous"
      );
    }
    return configs[0]!;
  }

  async function exchangeAuthorizationCode(input: {
    code: string;
    config: {
      clientId: string;
      clientSecretEncrypted: string | null;
      tokenEndpoint: string | null;
    };
    redirectUri: string;
  }): Promise<{ idToken: string }> {
    if (!input.config.tokenEndpoint) {
      throw new AppServiceError(
        "Tenant SSO token endpoint is not configured.",
        400,
        "sso_token_endpoint_required"
      );
    }

    const body = new URLSearchParams({
      client_id: input.config.clientId,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri
    });
    if (input.config.clientSecretEncrypted) {
      body.set(
        "client_secret",
        decryptSecret(input.config.clientSecretEncrypted)
      );
    }

    let response: Response;
    try {
      response = await fetchImpl(input.config.tokenEndpoint, {
        body,
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });
    } catch {
      throw new AppServiceError(
        "OIDC token exchange failed.",
        401,
        "sso_token_exchange_failed"
      );
    }
    if (!response.ok) {
      throw new AppServiceError(
        "OIDC token exchange failed.",
        401,
        "sso_token_exchange_failed"
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new AppServiceError(
        "OIDC token exchange failed.",
        401,
        "sso_token_exchange_failed"
      );
    }
    const idToken = payload.id_token;
    if (typeof idToken !== "string" || idToken.length === 0) {
      throw new AppServiceError(
        "OIDC token response did not include an ID token.",
        401,
        "sso_id_token_missing"
      );
    }

    return { idToken };
  }

  async function verifyIdToken(input: {
    config: {
      clientId: string;
      issuerUrl: string;
      jwksUri: string | null;
    };
    idToken: string;
  }): Promise<JWTPayload> {
    if (!input.config.jwksUri) {
      throw new AppServiceError(
        "Tenant SSO JWKS URI is not configured.",
        400,
        "sso_jwks_uri_required"
      );
    }

    try {
      const jwks = createRemoteJWKSet(new URL(input.config.jwksUri));
      const verified = await jwtVerify(input.idToken, jwks, {
        audience: input.config.clientId,
        issuer: input.config.issuerUrl
      });

      return verified.payload;
    } catch {
      throw new AppServiceError(
        "OIDC ID token verification failed.",
        401,
        "sso_id_token_invalid"
      );
    }
  }

  function createSamlRequestCache(input: {
    expiresAt: Date;
    stateHash: string;
    tenantId: string;
  }): CacheProvider {
    return {
      async getAsync(key: string): Promise<string | null> {
        const authRequest = await prisma.tenantSsoAuthRequest.findUnique({
          where: { protocolRequestIdHash: hashSecret(key) }
        });

        if (
          !authRequest ||
          authRequest.tenantId !== input.tenantId ||
          authRequest.expiresAt.getTime() <= Date.now()
        ) {
          return null;
        }

        return authRequest.createdAt.toISOString();
      },
      async removeAsync(key: string | null): Promise<string | null> {
        if (!key) {
          return null;
        }

        await prisma.tenantSsoAuthRequest.updateMany({
          data: { protocolRequestIdHash: null },
          where: { protocolRequestIdHash: hashSecret(key) }
        });

        return key;
      },
      async saveAsync(key: string, value: string): Promise<CacheItem | null> {
        const saved = await prisma.tenantSsoAuthRequest.updateMany({
          data: { protocolRequestIdHash: hashSecret(key) },
          where: {
            consumedAt: null,
            expiresAt: { gt: new Date() },
            stateHash: input.stateHash,
            tenantId: input.tenantId
          }
        });

        if (saved.count !== 1) {
          return null;
        }

        return {
          createdAt: Date.now(),
          value
        };
      }
    };
  }

  function buildSamlClient(input: {
    cacheProvider?: CacheProvider;
    config: {
      authorizationEndpoint: string;
      clientId: string;
      issuerUrl: string;
      samlIdpCertificate: string | null;
      samlNameIdFormat: string | null;
    };
    redirectUri: string;
  }): SAML {
    if (!input.config.samlIdpCertificate) {
      throw new AppServiceError(
        "Tenant SAML IdP certificate is not configured.",
        400,
        "sso_saml_certificate_required"
      );
    }

    return new SAML({
      acceptedClockSkewMs: 120_000,
      audience: input.config.clientId,
      callbackUrl: input.redirectUri,
      cacheProvider: input.cacheProvider,
      digestAlgorithm: "sha256",
      entryPoint: input.config.authorizationEndpoint,
      idpCert: normalizeSamlCertificate(input.config.samlIdpCertificate),
      idpIssuer: input.config.issuerUrl,
      identifierFormat:
        input.config.samlNameIdFormat ?? DEFAULT_SAML_NAME_ID_FORMAT,
      issuer: input.config.clientId,
      requestIdExpirationPeriodMs: SSO_AUTH_REQUEST_TTL_MS,
      signatureAlgorithm: "sha256",
      validateInResponseTo: ValidateInResponseTo.always,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true
    });
  }

  async function verifySamlResponse(input: {
    authRequest: {
      createdAt: Date;
      expiresAt: Date;
      redirectUri: string;
      stateHash: string;
      tenantId: string;
    };
    config: {
      authorizationEndpoint: string;
      clientId: string;
      issuerUrl: string;
      samlIdpCertificate: string | null;
      samlNameIdFormat: string | null;
    };
    samlResponse: string;
  }): Promise<{ claims: Record<string, unknown>; email: string }> {
    try {
      const saml = buildSamlClient({
        cacheProvider: createSamlRequestCache({
          expiresAt: input.authRequest.expiresAt,
          stateHash: input.authRequest.stateHash,
          tenantId: input.authRequest.tenantId
        }),
        config: input.config,
        redirectUri: input.authRequest.redirectUri
      });
      const result = await saml.validatePostResponseAsync({
        SAMLResponse: input.samlResponse
      });

      if (result.loggedOut || !result.profile) {
        throw new Error("SAML response did not include a login assertion.");
      }

      const email = samlEmailFromProfile(result.profile);
      if (!email) {
        throw new AppServiceError(
          "SAML assertion did not include an email claim.",
          401,
          "sso_email_missing"
        );
      }

      return { claims: profileAsClaimBag(result.profile), email };
    } catch (error) {
      if (error instanceof AppServiceError) {
        throw error;
      }

      throw new AppServiceError(
        "SAML response verification failed.",
        401,
        "sso_saml_response_invalid"
      );
    }
  }

  async function applySsoRoleMapping(input: {
    claims: Record<string, unknown> | null | undefined;
    config: {
      defaultMappedRole: MembershipRole | null;
      roleClaimName: string | null;
      roleMappings: unknown;
    };
    membership: {
      membershipId: string;
      role: MembershipRole;
      tenantId: string;
      userId: string;
    };
    tenantId: string;
    userId: string;
  }) {
    const roleMappings = parseStoredRoleMappings(input.config.roleMappings);
    const resolved = resolveSsoMappedRole({
      claims: input.claims,
      config: {
        defaultMappedRole: input.config.defaultMappedRole,
        roleClaimName: input.config.roleClaimName,
        roleMappings
      }
    });

    if (resolved.status === "disabled") {
      return {
        membershipRole: input.membership.role,
        roleMapping: {
          matchedClaimValues: [] as string[],
          previousRole: input.membership.role,
          role: input.membership.role,
          status: "disabled" as const
        }
      };
    }

    if (resolved.status === "unmapped" || !resolved.role) {
      throw new AppServiceError(
        "SSO identity has no mapped tenant role. Ask a tenant admin to map your IdP group, or set a default mapped role.",
        403,
        "sso_role_unmapped"
      );
    }

    // Serializable so concurrent SSO logins for the last two Owners cannot
    // both observe owners=2 and demote the tenant to zero Owners. Locals live
    // inside the callback so Serializable retries re-evaluate from resolved.role.
    return prisma.$transaction(
      async (tx) => {
        let nextRole = resolved.role!;
        let skippedLastOwner = false;

        if (
          input.membership.role === "Owner" &&
          nextRole !== "Owner"
        ) {
          const owners = await tx.membership.count({
            where: {
              role: "Owner",
              tenantId: input.tenantId
            }
          });
          if (owners <= 1) {
            // Last-owner protection: refuse demotion via IdP mapping.
            nextRole = "Owner";
            skippedLastOwner = true;
          }
        }

        let membershipRole = input.membership.role;
        if (nextRole !== input.membership.role) {
          const updated = await tx.membership.update({
            data: { role: nextRole },
            where: { membershipId: input.membership.membershipId }
          });
          membershipRole = updated.role;
          await writeAuditEvent(tx, {
            action: "role.changed",
            actorType: "User",
            entityId: updated.membershipId,
            entityType: "Tenant",
            metadata: {
              matchedClaimValues: resolved.matchedClaimValues,
              previousRole: input.membership.role,
              role: updated.role,
              source: "sso_claim_mapping",
              userId: input.userId
            },
            tenantId: input.tenantId,
            userId: input.userId
          });
        }

        return {
          membershipRole,
          roleMapping: {
            matchedClaimValues: resolved.matchedClaimValues,
            previousRole: input.membership.role,
            role: membershipRole,
            skippedLastOwner,
            status: skippedLastOwner
              ? ("last_owner_protected" as const)
              : resolved.status
          }
        };
      },
      { isolationLevel: "Serializable" }
    );
  }

  return {
    async startTenantSsoLogin(input) {
      const config = await resolveEnabledSsoConfig(input);
      const redirectUri = input.redirectUri ?? config.redirectUri;
      if (!redirectUri) {
        throw new AppServiceError(
          "A redirect URI is required to start SSO login.",
          400,
          "sso_redirect_uri_required"
        );
      }

      const state = randomOpaqueValue();
      const nonce = randomOpaqueValue();
      const stateHash = hashSecret(state);
      const expiresAt = new Date(Date.now() + SSO_AUTH_REQUEST_TTL_MS);
      await prisma.tenantSsoAuthRequest.create({
        data: {
          expiresAt,
          nonceHash: hashSecret(nonce),
          prompt: input.prompt ?? null,
          redirectUri,
          requestedEmail: input.email?.toLowerCase() ?? null,
          stateHash,
          tenantId: config.tenantId
        }
      });

      let authorizationUrl: string;
      if (config.providerType === "SAML") {
        const saml = buildSamlClient({
          cacheProvider: createSamlRequestCache({
            expiresAt,
            stateHash,
            tenantId: config.tenantId
          }),
          config,
          redirectUri
        });
        authorizationUrl = await saml.getAuthorizeUrlAsync(state, undefined, {
          additionalParams: input.email ? { login_hint: input.email } : {}
        });
      } else {
        authorizationUrl = buildAuthorizationUrl(config, {
          loginHint: input.email,
          nonce,
          prompt: input.prompt,
          redirectUri,
          state
        });
      }

      await writeAuditEvent(prisma, {
        action: "sso.login_started",
        actorType: "System",
        entityId: config.tenantId,
        entityType: "Tenant",
        metadata: {
          emailProvided: Boolean(input.email),
          prompt: input.prompt ?? null,
          providerType: config.providerType,
          redirectUri
        },
        tenantId: config.tenantId,
        userId: null
      });

      return {
        authorizationUrl,
        expiresAt: expiresAt.toISOString(),
        providerType: config.providerType,
        redirectUri,
        tenantId: config.tenantId
      };
    },

    async completeTenantSsoLogin(input) {
      const stateHash = hashSecret(input.state);
      const authRequest = await prisma.tenantSsoAuthRequest.findUnique({
        include: {
          tenant: {
            include: {
              ssoConfig: true
            }
          }
        },
        where: { stateHash }
      });

      if (
        !authRequest ||
        authRequest.consumedAt ||
        authRequest.expiresAt.getTime() <= Date.now() ||
        !authRequest.tenant.ssoConfig ||
        authRequest.tenant.ssoConfig.status !== "Enabled"
      ) {
        throw new AppServiceError(
          "SSO login state is invalid or expired.",
          401,
          "sso_state_invalid"
        );
      }

      const consumed = await prisma.tenantSsoAuthRequest.updateMany({
        data: { consumedAt: new Date() },
        where: {
          consumedAt: null,
          expiresAt: { gt: new Date() },
          ssoAuthRequestId: authRequest.ssoAuthRequestId
        }
      });
      if (consumed.count !== 1) {
        throw new AppServiceError(
          "SSO login state has already been consumed.",
          401,
          "sso_state_invalid"
        );
      }

      const config = authRequest.tenant.ssoConfig;
      try {
        let email: string;
        let identityClaims: Record<string, unknown> = {};
        if (config.providerType === "SAML") {
          if (!input.samlResponse) {
            throw new AppServiceError(
              "SAML response is required for this tenant SSO callback.",
              400,
              "sso_saml_response_required"
            );
          }
          const samlResult = await verifySamlResponse({
            authRequest,
            config,
            samlResponse: input.samlResponse
          });
          email = samlResult.email;
          identityClaims = samlResult.claims;
        } else {
          if (!input.code) {
            throw new AppServiceError(
              "OIDC authorization code is required for this tenant SSO callback.",
              400,
              "sso_code_required"
            );
          }
          const token = await exchangeAuthorizationCode({
            code: input.code,
            config,
            redirectUri: authRequest.redirectUri
          });
          const claims = await verifyIdToken({
            config,
            idToken: token.idToken
          });
          identityClaims = claims as Record<string, unknown>;
          const nonce = claimString(claims, "nonce");
          if (!nonce || hashSecret(nonce) !== authRequest.nonceHash) {
            throw new AppServiceError(
              "OIDC nonce validation failed.",
              401,
              "sso_nonce_invalid"
            );
          }

          email = claimString(claims, "email")?.toLowerCase() ?? "";
          if (!email) {
            throw new AppServiceError(
              "OIDC ID token did not include an email claim.",
              401,
              "sso_email_missing"
            );
          }
          if (claimBoolean(claims, "email_verified") === false) {
            throw new AppServiceError(
              "OIDC email claim is not verified.",
              401,
              "sso_email_unverified"
            );
          }
        }

        if (!isEmailLike(email)) {
          throw new AppServiceError(
            "Tenant SSO email claim is invalid.",
            401,
            "sso_email_invalid"
          );
        }

        if (
          authRequest.requestedEmail &&
          authRequest.requestedEmail.toLowerCase() !== email
        ) {
          throw new AppServiceError(
            "Tenant SSO email claim did not match the requested login email.",
            401,
            "sso_email_mismatch"
          );
        }

        if (
          config.emailDomainAllowlist.length > 0 &&
          !config.emailDomainAllowlist.includes(emailDomain(email))
        ) {
          throw new AppServiceError(
            "Tenant SSO email domain is not allowed for this tenant.",
            403,
            "sso_domain_denied"
          );
        }

        const user = await prisma.user.findUnique({
          include: {
            memberships: {
              include: { tenant: true },
              take: 1,
              where: { tenantId: authRequest.tenantId }
            }
          },
          where: { email }
        });
        const membership = user?.memberships[0] ?? null;
        if (!user || user.status !== "Active" || !membership) {
          throw new AppServiceError(
            "No active provisioned user exists for this tenant SSO login.",
            403,
            "sso_user_not_provisioned"
          );
        }

        const savedUser = user.emailVerifiedAt
          ? user
          : await prisma.user.update({
              data: { emailVerifiedAt: new Date() },
              include: {
                memberships: {
                  include: { tenant: true },
                  take: 1,
                  where: { tenantId: authRequest.tenantId }
                }
              },
              where: { userId: user.userId }
            });
        const savedMembership = savedUser.memberships[0] ?? membership;

        const roleSync = await applySsoRoleMapping({
          claims: identityClaims,
          config: {
            defaultMappedRole: config.defaultMappedRole ?? null,
            roleClaimName: config.roleClaimName ?? null,
            roleMappings: config.roleMappings
          },
          membership: {
            membershipId: savedMembership.membershipId,
            role: savedMembership.role as MembershipRole,
            tenantId: authRequest.tenantId,
            userId: savedUser.userId
          },
          tenantId: authRequest.tenantId,
          userId: savedUser.userId
        });

        const membershipForSession =
          roleSync.membershipRole === savedMembership.role
            ? savedMembership
            : {
                ...savedMembership,
                role: roleSync.membershipRole
              };

        await writeAuditEvent(prisma, {
          action: "sso.login_completed",
          actorType: "User",
          entityId: savedUser.userId,
          entityType: "Tenant",
          metadata: {
            issuerUrl: config.issuerUrl,
            providerType: config.providerType,
            roleMapping: roleSync.roleMapping,
            tenantId: authRequest.tenantId
          },
          tenantId: authRequest.tenantId,
          userId: savedUser.userId
        });

        return {
          membership: serializeMembership(membershipForSession),
          session: {
            authMethod: "sso",
            defaultTenantId: authRequest.tenantId,
            sessionVersion: savedUser.sessionVersion,
            userId: savedUser.userId
          },
          tenant: serializeTenant(membershipForSession.tenant),
          user: serializeUser(savedUser)
        };
      } catch (error) {
        const code =
          error instanceof AppServiceError ? error.code : "sso_callback_failed";
        await writeSsoFailure({
          code,
          reason: error instanceof Error ? error.message : String(error),
          tenantId: authRequest.tenantId
        });
        throw error;
      }
    },

    async getTenantSsoConfig(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view tenant SSO configuration"
      );

      const config = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return config ? serializeTenantSsoConfig(config) : null;
    },

    async updateTenantSsoConfig(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update tenant SSO configuration"
      );

      const existing = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: context.tenant.tenantId
        }
      });
      const samlInput = input.providerType === "SAML" ? input : null;
      const oidcInput = input.providerType === "OIDC" ? input : null;
      const scopes = uniqueNormalized(
        input.scopes.length > 0
          ? input.scopes
          : samlInput
            ? DEFAULT_SAML_SCOPES
            : DEFAULT_OIDC_SCOPES
      );
      const emailDomainAllowlist = uniqueLowercase(input.emailDomainAllowlist);
      const samlIdpCertificate = samlInput
        ? samlInput.samlIdpCertificate
          ? normalizeSamlCertificate(samlInput.samlIdpCertificate)
          : existing?.providerType === "SAML"
            ? existing.samlIdpCertificate
            : null
        : null;
      if (samlInput && !samlIdpCertificate) {
        throw new AppServiceError(
          "Tenant SAML IdP certificate is required.",
          400,
          "sso_saml_certificate_required"
        );
      }
      const encryptedSecret =
        oidcInput?.clientSecret !== undefined
          ? encryptSecret(oidcInput.clientSecret)
          : oidcInput
            ? (existing?.clientSecretEncrypted ?? null)
            : null;
      const jwksUri = oidcInput?.jwksUri
        ? normalizeUrl(oidcInput.jwksUri)
        : null;
      const tokenEndpoint = oidcInput?.tokenEndpoint
        ? normalizeUrl(oidcInput.tokenEndpoint)
        : null;
      const samlNameIdFormat = samlInput ? samlInput.samlNameIdFormat : null;
      const roleMappings = normalizeRoleMappings(
        input.roleMappings,
        existing?.roleMappings
      );
      const roleClaimName =
        input.roleClaimName !== undefined
          ? input.roleClaimName
          : (existing?.roleClaimName ?? null);
      const defaultMappedRole =
        input.defaultMappedRole !== undefined
          ? input.defaultMappedRole
          : (existing?.defaultMappedRole ?? null);
      const saved = await prisma.tenantSsoConfig.upsert({
        create: {
          authorizationEndpoint: normalizeUrl(input.authorizationEndpoint),
          clientId: input.clientId.trim(),
          clientSecretEncrypted: encryptedSecret,
          createdBy: context.user.userId,
          defaultMappedRole,
          emailDomainAllowlist,
          enforced: input.enforced,
          issuerUrl: normalizeUrl(input.issuerUrl),
          jwksUri,
          providerType: input.providerType,
          redirectUri: input.redirectUri
            ? normalizeUrl(input.redirectUri)
            : null,
          roleClaimName:
            roleClaimName ??
            (roleMappings.length > 0 ? "groups" : null),
          roleMappings,
          samlIdpCertificate,
          samlNameIdFormat,
          scopes,
          status: input.enabled ? "Enabled" : "Disabled",
          tenantId: context.tenant.tenantId,
          tokenEndpoint,
          updatedBy: context.user.userId
        },
        update: {
          authorizationEndpoint: normalizeUrl(input.authorizationEndpoint),
          clientId: input.clientId.trim(),
          clientSecretEncrypted: encryptedSecret,
          defaultMappedRole,
          emailDomainAllowlist,
          enforced: input.enforced,
          issuerUrl: normalizeUrl(input.issuerUrl),
          jwksUri,
          providerType: input.providerType,
          redirectUri: input.redirectUri
            ? normalizeUrl(input.redirectUri)
            : null,
          roleClaimName:
            roleClaimName ??
            (roleMappings.length > 0
              ? (existing?.roleClaimName ?? "groups")
              : null),
          roleMappings,
          samlIdpCertificate,
          samlNameIdFormat,
          scopes,
          status: input.enabled ? "Enabled" : "Disabled",
          tokenEndpoint,
          updatedBy: context.user.userId
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "sso_config.updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: sanitizedAuditMetadata(saved),
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeTenantSsoConfig(saved);
    },

    async disableTenantSsoConfig(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "disable tenant SSO configuration"
      );

      const existing = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      if (!existing) {
        await writeAuditEvent(prisma, {
          action: "sso_config.disabled",
          actorType: "User",
          entityId: context.tenant.tenantId,
          entityType: "Tenant",
          metadata: {
            alreadyDisabled: true
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return;
      }

      const saved = await prisma.tenantSsoConfig.update({
        data: {
          status: "Disabled",
          updatedBy: context.user.userId
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "sso_config.disabled",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: sanitizedAuditMetadata(saved),
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async buildTenantSsoAuthorizationUrl(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "build tenant SSO authorization URL"
      );

      const config = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      if (!config || config.status !== "Enabled") {
        throw new AppServiceError(
          "Tenant SSO is not enabled.",
          400,
          "sso_not_enabled"
        );
      }

      if (config.providerType === "SAML") {
        throw new AppServiceError(
          "Use /api/v1/auth/sso/start for SAML so Periscan can persist request correlation.",
          400,
          "sso_saml_start_required"
        );
      }

      const redirectUri = input.redirectUri ?? config.redirectUri;
      if (!redirectUri) {
        throw new AppServiceError(
          "A redirect URI is required to build an OIDC authorization URL.",
          400,
          "sso_redirect_uri_required"
        );
      }

      const url = new URL(config.authorizationEndpoint);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("nonce", input.nonce);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", config.scopes.join(" "));
      url.searchParams.set("state", input.state);

      if (input.loginHint) {
        url.searchParams.set("login_hint", input.loginHint);
      }

      if (input.prompt) {
        url.searchParams.set("prompt", input.prompt);
      }

      return {
        authorizationUrl: url.toString(),
        nonce: input.nonce,
        providerType: config.providerType,
        redirectUri,
        scopes: config.scopes,
        state: input.state,
        tenantId: context.tenant.tenantId
      };
    },

    async getTenantSsoMetadata(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "read tenant SAML service-provider metadata"
      );

      const config = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      if (!config || config.providerType !== "SAML") {
        throw new AppServiceError(
          "Tenant SAML SSO is not configured.",
          400,
          "sso_saml_not_configured"
        );
      }

      const redirectUri = config.redirectUri;
      if (!redirectUri) {
        throw new AppServiceError(
          "A redirect URI is required to build SAML metadata.",
          400,
          "sso_redirect_uri_required"
        );
      }

      return generateServiceProviderMetadata({
        callbackUrl: redirectUri,
        identifierFormat:
          config.samlNameIdFormat ?? DEFAULT_SAML_NAME_ID_FORMAT,
        issuer: config.clientId,
        wantAssertionsSigned: true
      });
    }
  };
}
