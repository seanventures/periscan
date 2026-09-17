import { createHash, randomUUID } from "node:crypto";

import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeServiceDeps } from "./runtime-services.js";
import { createAuthServices } from "./services/auth.js";

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-z0-9]/giu, "").toUpperCase();
}

describe("MFA recovery code CAS consume", () => {
  it("claims a recovery code only when updateMany reports a single unused row", async () => {
    const userId = randomUUID();
    const tenantId = randomUUID();
    const membershipId = randomUUID();
    const password = "periscan-mfa-recovery-password";
    const passwordHash = await argon2.hash(password);
    const recoveryPlaintext = "ABCD-EFGH-IJKL-MNOP";
    const codeHash = hashSecret(normalizeRecoveryCode(recoveryPlaintext));
    const now = new Date("2026-07-29T00:00:00.000Z");

    const tenant = {
      billingAccountId: null,
      createdAt: now,
      dataRegion: "us-east-1",
      name: "MFA Tenant",
      parentTenantId: null,
      tenantId,
      type: "Customer",
      updatedAt: now
    };

    const membership = {
      createdAt: now,
      experienceProfileCompletedAt: null,
      membershipId,
      primaryOutcome: null,
      productPersona: null,
      role: "Owner",
      tenant,
      tenantId,
      updatedAt: now,
      userId
    };

    const user = {
      createdAt: now,
      email: "mfa-recovery@periscan.test",
      emailVerifiedAt: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabledAt: now,
      mfaSecret: "encrypted-secret",
      name: "MFA User",
      passwordHash,
      sessionVersion: 1,
      status: "Active",
      updatedAt: now,
      userId
    };

    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const auditCreate = vi.fn().mockResolvedValue({});
    const membershipFindFirst = vi.fn().mockResolvedValue(membership);

    const services = createAuthServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      emailTransport: { send: vi.fn() },
      prisma: {
        auditEvent: { create: auditCreate },
        membership: { findFirst: membershipFindFirst },
        mfaRecoveryCode: { updateMany },
        tenantSsoConfig: { findUnique: vi.fn().mockResolvedValue(null) },
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
          update: vi.fn()
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    const first = await services.login({
      email: "mfa-recovery@periscan.test",
      password,
      recoveryCode: recoveryPlaintext
    });
    expect(first?.user.userId).toBe(userId);
    expect(updateMany).toHaveBeenCalledWith({
      data: { consumedAt: expect.any(Date) },
      where: { codeHash, consumedAt: null, userId }
    });

    await expect(
      services.login({
        email: "mfa-recovery@periscan.test",
        password,
        recoveryCode: recoveryPlaintext
      })
    ).rejects.toMatchObject({
      code: "mfa_invalid",
      statusCode: 401
    });
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});
