import { randomUUID } from "node:crypto";

import { SignJWT, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";

import {
  DEFAULT_REPORT_SHARE_JWT_KID,
  DEFAULT_SESSION_JWT_KID,
  assertCsrfProductionConfig,
  createCsrfToken,
  createReportShareToken,
  createSessionToken,
  hashRateLimitApiKey,
  isCsrfEnforced,
  resolveInterventionSigningSecret,
  resolveReportShareJwtKeyring,
  resolveSessionJwtKeyring,
  verifyCsrfDoubleSubmit,
  verifyReportShareToken,
  verifySessionToken
} from "./security.js";

const SECRET = "test-session-secret-value";
const PREVIOUS = "test-session-secret-previous";

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

describe("session token verification", () => {
  it("round-trips a valid HS256 session token with kid", async () => {
    const claims = {
      defaultTenantId: randomUUID(),
      sessionVersion: 3,
      userId: randomUUID()
    };

    const token = await createSessionToken(claims, SECRET);
    const header = decodeProtectedHeader(token);
    expect(header.kid).toBe(DEFAULT_SESSION_JWT_KID);
    expect(header.alg).toBe("HS256");

    await expect(verifySessionToken(token, SECRET)).resolves.toEqual({
      ...claims,
      authMethod: "password"
    });
  });

  it("rejects a session token signed with a non-HS256 algorithm", async () => {
    // Forge a token with the same shared secret but a different HMAC alg
    // (HS512). With the algorithm pinned to HS256 this must be rejected even
    // though the signature is otherwise valid for the secret.
    const forged = await new SignJWT({
      defaultTenantId: randomUUID(),
      userId: randomUUID()
    })
      .setProtectedHeader({ alg: "HS512" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(encodeSecret(SECRET));

    await expect(verifySessionToken(forged, SECRET)).rejects.toThrow();
  });

  it("verifies tokens minted with the previous key during rotation", async () => {
    const keyring = resolveSessionJwtKeyring({
      PERISCAN_JWT_SECRET: SECRET,
      PERISCAN_JWT_KID: "sess-v2",
      PERISCAN_JWT_SECRET_PREVIOUS: PREVIOUS,
      PERISCAN_JWT_PREVIOUS_KID: "sess-v1"
    });

    const legacy = await createSessionToken(
      {
        defaultTenantId: randomUUID(),
        userId: randomUUID()
      },
      {
        activeKid: "sess-v1",
        secrets: { "sess-v1": PREVIOUS, "sess-v2": SECRET }
      }
    );

    await expect(verifySessionToken(legacy, keyring)).resolves.toMatchObject({
      authMethod: "password"
    });

    const current = await createSessionToken(
      {
        defaultTenantId: randomUUID(),
        userId: randomUUID()
      },
      keyring
    );
    expect(decodeProtectedHeader(current).kid).toBe("sess-v2");
    await expect(verifySessionToken(current, keyring)).resolves.toBeTruthy();
  });

  it("accepts legacy tokens without kid against a bare secret", async () => {
    const forged = await new SignJWT({
      defaultTenantId: randomUUID(),
      userId: randomUUID()
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(encodeSecret(SECRET));

    await expect(verifySessionToken(forged, SECRET)).resolves.toMatchObject({
      authMethod: "password"
    });
  });
});

describe("report share token verification", () => {
  it("round-trips a valid HS256 report share token with kid", async () => {
    const claims = {
      reportId: randomUUID(),
      reportShareId: randomUUID(),
      tenantId: randomUUID()
    };

    const token = await createReportShareToken(claims, SECRET);
    expect(decodeProtectedHeader(token).kid).toBe(DEFAULT_REPORT_SHARE_JWT_KID);

    await expect(verifyReportShareToken(token, SECRET)).resolves.toEqual(
      claims
    );
  });

  it("rejects a report share token signed with a non-HS256 algorithm", async () => {
    const forged = await new SignJWT({
      reportId: randomUUID(),
      tenantId: randomUUID(),
      type: "report-share"
    })
      .setProtectedHeader({ alg: "HS512" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(encodeSecret(SECRET));

    await expect(verifyReportShareToken(forged, SECRET)).rejects.toThrow();
  });

  it("dual-verifies report-share tokens during key rotation", async () => {
    const previousSecret = "old-report-share-secret";
    const activeSecret = "new-report-share-secret";
    const keyring = resolveReportShareJwtKeyring(
      {
        PERISCAN_REPORT_SHARE_KID: "share-v2",
        PERISCAN_REPORT_SHARE_SECRET_PREVIOUS: previousSecret,
        PERISCAN_REPORT_SHARE_PREVIOUS_KID: "share-v1"
      },
      activeSecret
    );

    const oldToken = await createReportShareToken(
      {
        reportId: randomUUID(),
        reportShareId: randomUUID(),
        tenantId: randomUUID()
      },
      {
        activeKid: "share-v1",
        secrets: { "share-v1": previousSecret }
      }
    );

    await expect(verifyReportShareToken(oldToken, keyring)).resolves.toBeTruthy();
  });
});

describe("CSRF double-submit", () => {
  it("binds the CSRF token to the session JWT via HMAC", async () => {
    const sessionJwt = await createSessionToken(
      {
        defaultTenantId: randomUUID(),
        userId: randomUUID()
      },
      SECRET
    );
    const token = createCsrfToken(sessionJwt, SECRET);
    expect(token.length).toBeGreaterThan(20);
    expect(
      verifyCsrfDoubleSubmit({
        sessionJwt,
        cookieToken: token,
        headerToken: token,
        material: SECRET
      })
    ).toBe(true);
    expect(
      verifyCsrfDoubleSubmit({
        sessionJwt,
        cookieToken: token,
        headerToken: "forged",
        material: SECRET
      })
    ).toBe(false);
  });

  it("defaults enforcement off under vitest and honors PERISCAN_CSRF_ENFORCE", () => {
    expect(isCsrfEnforced({ VITEST: "true" })).toBe(false);
    expect(isCsrfEnforced({ NODE_ENV: "test" })).toBe(false);
    expect(
      isCsrfEnforced({ NODE_ENV: "test", PERISCAN_CSRF_ENFORCE: "true" })
    ).toBe(true);
    // NODE_ENV=production alone is not the deployment gate; explicit disable still works outside deployment production.
    expect(
      isCsrfEnforced({ NODE_ENV: "production", PERISCAN_CSRF_ENFORCE: "false" })
    ).toBe(false);
    expect(isCsrfEnforced({ NODE_ENV: "production" })).toBe(true);
  });

  it("hard-ignores PERISCAN_CSRF_ENFORCE=false under deployment production (P03-16)", () => {
    expect(
      isCsrfEnforced({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_CSRF_ENFORCE: "false"
      })
    ).toBe(true);
    expect(
      isCsrfEnforced({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_CSRF_ENFORCE: "0"
      })
    ).toBe(true);
    expect(
      isCsrfEnforced({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        NODE_ENV: "test",
        VITEST: "true",
        PERISCAN_CSRF_ENFORCE: "false"
      })
    ).toBe(true);
  });

  it("refuses PERISCAN_CSRF_ENFORCE=false at production startup (P03-16)", () => {
    expect(() =>
      assertCsrfProductionConfig({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_CSRF_ENFORCE: "false"
      })
    ).toThrow(/PERISCAN_CSRF_ENFORCE=false is not allowed/u);

    expect(() =>
      assertCsrfProductionConfig({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_CSRF_ENFORCE: "0"
      })
    ).toThrow(/PERISCAN_CSRF_ENFORCE=false is not allowed/u);

    expect(() =>
      assertCsrfProductionConfig({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production"
      })
    ).not.toThrow();

    expect(() =>
      assertCsrfProductionConfig({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "development",
        PERISCAN_CSRF_ENFORCE: "false"
      })
    ).not.toThrow();
  });
});

describe("hashRateLimitApiKey (P20-8)", () => {
  it("returns a stable sha256 hex digest and never echoes the raw token", () => {
    const token = "psk_super-secret-api-key-material";
    const digest = hashRateLimitApiKey(token);
    expect(digest).toBe(
      createHash("sha256").update(token, "utf8").digest("hex")
    );
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain(token);
    expect(digest).not.toContain("psk_");
    expect(hashRateLimitApiKey(token)).toBe(digest);
    expect(hashRateLimitApiKey("psk_other")).not.toBe(digest);
  });
});

describe("resolveInterventionSigningSecret", () => {
  it("requires a dedicated secret in production", () => {
    expect(() =>
      resolveInterventionSigningSecret({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: SECRET
      })
    ).toThrow(/PERISCAN_INTERVENTION_SIGNING_SECRET/u);

    expect(
      resolveInterventionSigningSecret({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_INTERVENTION_SIGNING_SECRET: "dedicated-intervention"
      })
    ).toBe("dedicated-intervention");
  });

  it("falls back outside production", () => {
    expect(
      resolveInterventionSigningSecret(
        { PERISCAN_JWT_SECRET: SECRET },
        SECRET
      )
    ).toBe(SECRET);
  });
});
