import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { AppServiceError } from "./runtime-services.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SCOPE_ID = "33333333-3333-4333-8333-333333333333";
const SCHEDULE_ID = "44444444-4444-4444-8444-444444444444";
const SESSION_SECRET = "light-external-scan-session-secret";

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
    name: "Light Scan Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "light@periscan.test",
    mfaEnabledAt: null,
    name: "Light Owner",
    userId: USER_ID
  }
};

function unverifiedDomainScope() {
  return {
    scopeId: SCOPE_ID,
    scopeType: "Domain",
    tenantId: TENANT_ID,
    value: "example.com",
    verificationStatus: "Unverified" as const
  };
}

function verifiedDomainScope() {
  return {
    ...unverifiedDomainScope(),
    verificationStatus: "Verified" as const
  };
}

describe("POST /api/v1/light-external-scans", () => {
  it("verifies Domain via DNS TXT and does not skip with devModeManual", async () => {
    const createScope = vi.fn(async () => unverifiedDomainScope());
    const verifyScope = vi.fn(async () => verifiedDomainScope());
    const createSchedule = vi.fn(async () => ({
      scheduleId: SCHEDULE_ID
    }));
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        createScope,
        verifyScope,
        createSchedule
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const created = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          consent: true,
          domain: "example.com"
        },
        url: "/api/v1/light-external-scans"
      });

      expect(created.statusCode).toBe(201);
      expect(verifyScope).toHaveBeenCalledTimes(1);
      const verifyInput = verifyScope.mock.calls[0]?.[2] as
        | { devModeManual?: boolean }
        | undefined;
      expect(verifyInput?.devModeManual).not.toBe(true);
      expect(createSchedule).toHaveBeenCalledTimes(1);
      expect(created.json()).toMatchObject({
        scope: { scopeId: SCOPE_ID, verificationStatus: "Verified" },
        schedule: { scheduleId: SCHEDULE_ID }
      });
    } finally {
      await app.close();
    }
  });

  it("returns the verify error and does not create a schedule when DNS TXT fails", async () => {
    const createScope = vi.fn(async () => unverifiedDomainScope());
    const verifyScope = vi.fn(async () => {
      throw new AppServiceError(
        "DNS TXT verification failed. Publish _periscan.example.com with value token.",
        400,
        "dns_verification_failed"
      );
    });
    const createSchedule = vi.fn();
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        createScope,
        verifyScope,
        createSchedule
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const failed = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          consent: true,
          domain: "example.com"
        },
        url: "/api/v1/light-external-scans"
      });

      expect(failed.statusCode).toBe(400);
      expect(failed.json()).toMatchObject({
        code: "dns_verification_failed",
        error:
          "DNS TXT verification failed. Publish _periscan.example.com with value token."
      });
      expect(verifyScope).toHaveBeenCalledTimes(1);
      const verifyInput = verifyScope.mock.calls[0]?.[2] as
        | { devModeManual?: boolean }
        | undefined;
      expect(verifyInput?.devModeManual).not.toBe(true);
      expect(createSchedule).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("does not return 201 when verify leaves the Domain unverified", async () => {
    const createScope = vi.fn(async () => unverifiedDomainScope());
    const verifyScope = vi.fn(async () => unverifiedDomainScope());
    const createSchedule = vi.fn();
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        createScope,
        verifyScope,
        createSchedule
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const failed = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          consent: true,
          domain: "example.com"
        },
        url: "/api/v1/light-external-scans"
      });

      expect(failed.statusCode).not.toBe(201);
      expect(failed.statusCode).toBe(400);
      expect(createSchedule).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
