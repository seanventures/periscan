import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import {
  createCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME
} from "./security.js";

const SESSION_SECRET = "csrf-idempotency-session-secret";

describe("CSRF double-submit enforcement (forced)", () => {
  const previousEnforce = process.env.PERISCAN_CSRF_ENFORCE;

  beforeEach(() => {
    process.env.PERISCAN_CSRF_ENFORCE = "true";
  });

  afterEach(() => {
    if (previousEnforce === undefined) {
      delete process.env.PERISCAN_CSRF_ENFORCE;
    } else {
      process.env.PERISCAN_CSRF_ENFORCE = previousEnforce;
    }
  });

  it("rejects cookie-auth mutations without a matching CSRF header", async () => {
    const app = await buildApp({
      sessionSecret: SESSION_SECRET,
      services: {
        // Minimal stub surface used by signup + a protected mutation path.
        signup: async () => ({
          membership: {
            membershipId: randomUUID(),
            role: "Owner",
            tenantId: randomUUID(),
            userId: randomUUID()
          },
          session: {
            authMethod: "password" as const,
            defaultTenantId: randomUUID(),
            userId: randomUUID()
          },
          tenant: {
            name: "CSRF Tenant",
            tenantId: randomUUID(),
            type: "Customer"
          },
          user: {
            email: "csrf@periscan.test",
            mfaEnabledAt: null,
            name: "CSRF User",
            userId: randomUUID()
          }
        }),
        getSessionContext: async (session: {
          authMethod: "password" | "api_key" | "sso" | "system";
          defaultTenantId: string;
          userId: string;
        }) => ({
          membership: {
            membershipId: randomUUID(),
            role: "Owner",
            tenantId: session.defaultTenantId,
            userId: session.userId
          },
          session,
          tenant: {
            name: "CSRF Tenant",
            requireMfa: false,
            tenantId: session.defaultTenantId,
            type: "Customer"
          },
          user: {
            email: "csrf@periscan.test",
            mfaEnabledAt: null,
            name: "CSRF User",
            userId: session.userId
          }
        }),
        createScope: async () => {
          throw new Error("createScope should not run without CSRF");
        }
      } as never
    });

    try {
      const signup = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "csrf@periscan.test",
          name: "CSRF User",
          password: "csrf-password-long-enough",
          tenantName: "CSRF Tenant"
        }
      });
      expect(signup.statusCode).toBe(201);
      const sessionJwt = signup.cookies.find(
        (cookie) => cookie.name === SESSION_COOKIE_NAME
      )!.value;
      const csrfCookie = signup.cookies.find(
        (cookie) => cookie.name === CSRF_COOKIE_NAME
      )!.value;
      expect(csrfCookie).toBe(createCsrfToken(sessionJwt, SESSION_SECRET));

      const scopePayload = {
        scopeType: "Domain",
        value: "example.com"
      };

      const rejected = await app.inject({
        method: "POST",
        url: "/api/v1/scopes",
        cookies: {
          [SESSION_COOKIE_NAME]: sessionJwt,
          [CSRF_COOKIE_NAME]: csrfCookie
        },
        payload: scopePayload
      });
      expect(rejected.statusCode).toBe(403);
      expect(rejected.json().code).toBe("csrf_rejected");

      const accepted = await app.inject({
        method: "POST",
        url: "/api/v1/scopes",
        cookies: {
          [SESSION_COOKIE_NAME]: sessionJwt,
          [CSRF_COOKIE_NAME]: csrfCookie
        },
        headers: {
          [CSRF_HEADER_NAME]: csrfCookie
        },
        payload: scopePayload
      });
      // Auth + CSRF pass; createScope stub throws → 500 is fine (proves CSRF gate opened).
      expect(accepted.statusCode).not.toBe(403);
    } finally {
      await app.close();
    }
  });

  it("does not require CSRF for Bearer API key mutations", async () => {
    const app = await buildApp({
      sessionSecret: SESSION_SECRET,
      services: {
        authenticateApiKey: async () => ({
          membership: {
            membershipId: randomUUID(),
            role: "Owner",
            tenantId: randomUUID(),
            userId: randomUUID()
          },
          session: {
            authMethod: "api_key" as const,
            defaultTenantId: randomUUID(),
            userId: randomUUID()
          },
          tenant: {
            name: "API Key Tenant",
            requireMfa: false,
            tenantId: randomUUID(),
            type: "Customer"
          },
          user: {
            email: "key@periscan.test",
            mfaEnabledAt: null,
            name: "Key User",
            userId: randomUUID()
          }
        }),
        createScope: async (
          _ctx: unknown,
          input: { scopeType: string; value: string }
        ) => ({
          scopeId: randomUUID(),
          ...input,
          status: "Draft",
          verificationState: "Unverified"
        })
      } as never
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/scopes",
        headers: {
          authorization: "Bearer psk_test_key_value"
        },
        payload: {
          scopeType: "Domain",
          value: "api-key.example.com"
        }
      });
      expect(response.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });
});

describe("Idempotency-Key on createMission", () => {
  it("replays the first createMission response for the same key+body", async () => {
    let createCount = 0;
    const missionId = randomUUID();
    const tenantId = randomUUID();
    const userId = randomUUID();

    const app = await buildApp({
      sessionSecret: SESSION_SECRET,
      services: {
        authenticateApiKey: async () => ({
          membership: {
            membershipId: randomUUID(),
            role: "Owner",
            tenantId,
            userId
          },
          session: {
            authMethod: "api_key" as const,
            defaultTenantId: tenantId,
            userId
          },
          tenant: {
            name: "Idempo Tenant",
            requireMfa: false,
            tenantId,
            type: "Customer"
          },
          user: {
            email: "idempo@periscan.test",
            mfaEnabledAt: null,
            name: "Idempo",
            userId
          }
        }),
        createMission: async () => {
          createCount += 1;
          return {
            missionId,
            status: "Draft",
            tenantId
          };
        }
      } as never
    });

    try {
      const payload = {
        missionType: "ExposureValidation",
        safetyLevel: "PassiveReadOnly",
        scopeId: randomUUID()
      };
      const headers = {
        authorization: "Bearer psk_idempo_key",
        "idempotency-key": "mission-proof-1"
      };

      const first = await app.inject({
        method: "POST",
        url: "/api/v1/missions",
        headers,
        payload
      });
      expect(first.statusCode).toBe(201);
      expect(first.json().missionId).toBe(missionId);

      const second = await app.inject({
        method: "POST",
        url: "/api/v1/missions",
        headers,
        payload
      });
      expect(second.statusCode).toBe(201);
      expect(second.json().missionId).toBe(missionId);
      expect(second.headers["idempotency-replayed"]).toBe("true");
      expect(createCount).toBe(1);

      const conflict = await app.inject({
        method: "POST",
        url: "/api/v1/missions",
        headers,
        payload: { ...payload, scopeId: randomUUID() }
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().code).toBe("idempotency_key_conflict");
      expect(createCount).toBe(1);
    } finally {
      await app.close();
    }
  });
});
