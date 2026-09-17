import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("tenant trial lifecycle", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "trial-expiry",
        "trial-convert"
      ]);
      await prisma.$disconnect();
    }
  });

  it("starts once, expires fail-closed, restores entitlements, and schedules retention", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma })
    });
    try {
      const owner = await testHelpers.performSignup(app, "trial-expiry", "Trial Expiry Tenant");
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const started = await app.inject({
        cookies,
        method: "POST",
        payload: { agreementAccepted: true, durationDays: 7, retentionDays: 21 },
        url: "/api/v1/billing/trial/start"
      });
      expect(started.statusCode).toBe(201);
      expect(started.json()).toMatchObject({
        canStart: false,
        entitlementPackageKey: "Enterprise",
        remainingDays: 7,
        retentionDays: 21,
        status: "Active"
      });
      expect(
        await prisma.tenant.findUniqueOrThrow({ where: { tenantId } })
      ).toMatchObject({ billingPackageKey: "Enterprise", trialStatus: "Active" });

      const duplicate = await app.inject({
        cookies,
        method: "POST",
        payload: { agreementAccepted: true, durationDays: 7, retentionDays: 21 },
        url: "/api/v1/billing/trial/start"
      });
      expect(duplicate.statusCode).toBe(409);

      await prisma.tenant.update({
        data: { trialEndsAt: new Date(Date.now() - 60_000) },
        where: { tenantId }
      });
      const expired = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/billing/trial"
      });
      expect(expired.statusCode).toBe(200);
      expect(expired.json()).toMatchObject({
        canStart: false,
        entitlementPackageKey: null,
        remainingDays: 0,
        retentionDays: 21,
        status: "Expired"
      });
      expect(expired.json().deletionScheduledAt).toEqual(expect.any(String));
      const persisted = await prisma.tenant.findUniqueOrThrow({ where: { tenantId } });
      expect(persisted).toMatchObject({
        billingPackageKey: "ValidationSnapshot",
        trialStatus: "Expired"
      });
      expect(persisted.trialDeletionScheduledAt).toBeInstanceOf(Date);
      expect(
        await prisma.auditEvent.count({
          where: {
            action: { in: ["trial_started", "trial_expired"] },
            tenantId
          }
        })
      ).toBe(2);
    } finally {
      await app.close();
    }
  });

  it("converts only with a recorded business approval and no payment processor claim", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma })
    });
    try {
      const owner = await testHelpers.performSignup(app, "trial-convert", "Trial Convert Tenant");
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      await app.inject({
        cookies,
        method: "POST",
        payload: { agreementAccepted: true, durationDays: 14, retentionDays: 30 },
        url: "/api/v1/billing/trial/start"
      });
      const invalid = await app.inject({
        cookies,
        method: "POST",
        payload: { approvalReference: "", packageKey: "CoreValidation" },
        url: "/api/v1/billing/trial/convert"
      });
      expect(invalid.statusCode).toBe(400);

      const converted = await app.inject({
        cookies,
        method: "POST",
        payload: {
          approvalReference: "approved-order-form-2026-0714",
          packageKey: "CoreValidation"
        },
        url: "/api/v1/billing/trial/convert"
      });
      expect(converted.statusCode).toBe(200);
      expect(converted.json()).toMatchObject({
        conversionApprovalReference: "approved-order-form-2026-0714",
        entitlementPackageKey: null,
        status: "Converted"
      });
      expect(
        await prisma.tenant.findUniqueOrThrow({ where: { tenantId } })
      ).toMatchObject({ billingPackageKey: "CoreValidation", trialStatus: "Converted" });
      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "trial_converted", tenantId }
      });
      expect(audit.metadata).toMatchObject({ paymentProcessorUsed: false });
    } finally {
      await app.close();
    }
  });
});
