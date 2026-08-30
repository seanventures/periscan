import { describe, expect, it, vi } from "vitest";

import {
  assertPrivilegedMfaStepUp,
  resolveStepUpTotpCode
} from "./mfa-step-up.js";
import { generateTotp, generateTotpSecret } from "./totp.js";
import { encryptSecret } from "./integration-credentials.js";
import type { AuthenticatedContext } from "./runtime-services.js";

function baseContext(
  overrides: Partial<AuthenticatedContext["session"]> & {
    mfaEnabledAt?: string | null;
    requireMfa?: boolean;
  } = {}
): AuthenticatedContext {
  const mfaEnabledAt =
    "mfaEnabledAt" in overrides ? overrides.mfaEnabledAt : null;
  return {
    membership: {
      membershipId: "m1",
      role: "Admin",
      tenantId: "t1",
      userId: "u1"
    },
    session: {
      authMethod: overrides.authMethod ?? "password",
      defaultTenantId: "t1",
      userId: "u1"
    },
    tenant: {
      requireMfa: overrides.requireMfa ?? false,
      tenantId: "t1"
    } as AuthenticatedContext["tenant"],
    user: {
      mfaEnabledAt,
      userId: "u1"
    } as AuthenticatedContext["user"]
  } as AuthenticatedContext;
}

describe("resolveStepUpTotpCode", () => {
  it("prefers body code over header", () => {
    expect(resolveStepUpTotpCode("111111", "222222")).toBe("111111");
    expect(resolveStepUpTotpCode(undefined, "222222")).toBe("222222");
    expect(resolveStepUpTotpCode(null, [" 333333 "])).toBe("333333");
  });
});

describe("assertPrivilegedMfaStepUp", () => {
  it("skips for API key and SSO sessions", async () => {
    const prisma = {
      user: { findUnique: vi.fn() }
    };
    await expect(
      assertPrivilegedMfaStepUp(
        prisma as never,
        baseContext({ authMethod: "api_key", mfaEnabledAt: "2020-01-01" }),
        null
      )
    ).resolves.toBeUndefined();
    await expect(
      assertPrivilegedMfaStepUp(
        prisma as never,
        baseContext({ authMethod: "sso", mfaEnabledAt: "2020-01-01" }),
        null
      )
    ).resolves.toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("skips password sessions without MFA when force-MFA is off", async () => {
    const prisma = {
      user: { findUnique: vi.fn() }
    };
    await expect(
      assertPrivilegedMfaStepUp(
        prisma as never,
        baseContext({ mfaEnabledAt: null, requireMfa: false }),
        null
      )
    ).resolves.toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("requires a valid TOTP when MFA is enrolled", async () => {
    const secret = generateTotpSecret();
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          mfaEnabledAt: new Date(),
          mfaSecret: encryptSecret(secret)
        })
      }
    };

    await expect(
      assertPrivilegedMfaStepUp(
        prisma as never,
        baseContext({ mfaEnabledAt: "2020-01-01T00:00:00.000Z" }),
        null
      )
    ).rejects.toMatchObject({ code: "mfa_step_up_required" });

    await expect(
      assertPrivilegedMfaStepUp(
        prisma as never,
        baseContext({ mfaEnabledAt: "2020-01-01T00:00:00.000Z" }),
        generateTotp(secret)
      )
    ).resolves.toBeUndefined();
  });
});
