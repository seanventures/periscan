import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";
const DAY_MS = 24 * 60 * 60 * 1_000;

describe("subscription operations lifecycle", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "subscription-operations"
      ]);
      await prisma.$disconnect();
    }
  });

  it("renews, preserves grace access, recovers cancellation, snapshots usage, and ends fail-closed", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      services: createRuntimeServices({ dataRegion: "us-east-1", prisma })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "subscription-operations-owner",
        "subscription-operations Owner Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;

      const empty = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/billing/subscription"
      });
      expect(empty.statusCode).toBe(200);
      expect(empty.json()).toMatchObject({
        chainValid: true,
        paymentProcessorStatus: "NotConfigured",
        subscription: null
      });

      const created = await app.inject({
        cookies,
        method: "POST",
        payload: {
          agreementReference: "ORDER-2026-0042",
          endsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
          packageKey: "Enterprise",
          renewalLeadDays: 60,
          source: "DirectAgreement",
          supportOwnerEmail: "success@example.test"
        },
        url: "/api/v1/billing/subscription"
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        chainValid: true,
        paymentProcessorStatus: "NotConfigured",
        subscription: {
          packageKey: "Enterprise",
          renewalDecision: "Unreviewed",
          status: "Active"
        }
      });
      expect(created.json().periods).toHaveLength(1);
      expect(created.json().events[0]).toMatchObject({
        action: "Started",
        previousEventHash: null,
        sequence: 1
      });

      const duplicate = await app.inject({
        cookies,
        method: "POST",
        payload: {
          agreementReference: "ORDER-2026-0043",
          endsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
          packageKey: "Enterprise",
          source: "DirectAgreement",
          supportOwnerEmail: "success@example.test"
        },
        url: "/api/v1/billing/subscription"
      });
      expect(duplicate.statusCode).toBe(409);

      const approved = await app.inject({
        cookies,
        method: "POST",
        payload: {
          agreementReference: "RENEWAL-2027-0042",
          decision: "Approve",
          packageKey: "CoreValidation",
          reason:
            "Procurement, support ownership, and the next entitlement term were approved.",
          termMonths: 12
        },
        url: "/api/v1/billing/subscription/renewal"
      });
      expect(approved.statusCode).toBe(200);
      expect(approved.json().subscription).toMatchObject({
        renewalDecision: "Approved",
        renewalPackageKey: "CoreValidation",
        status: "Active"
      });
      expect(approved.json().periods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            packageKey: "CoreValidation",
            status: "Scheduled"
          })
        ])
      );

      const earlyReconcile = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason: "Attempting to apply the approved renewal before it is due."
        },
        url: "/api/v1/billing/subscription/reconcile"
      });
      expect(earlyReconcile.statusCode).toBe(409);

      const grace = await app.inject({
        cookies,
        method: "POST",
        payload: {
          externalReference: "PROCUREMENT-EXCEPTION-17",
          graceDays: 14,
          reason:
            "Procurement requested a bounded exception while the approved order is posted."
        },
        url: "/api/v1/billing/subscription/grace"
      });
      expect(grace.statusCode).toBe(200);
      expect(grace.json().subscription).toMatchObject({
        status: "GracePeriod"
      });
      expect(
        (
          await app.inject({
            cookies,
            method: "GET",
            url: "/api/v1/billing/active-package"
          })
        ).json()
      ).toMatchObject({ packageKey: "Enterprise" });

      const resolved = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "The approved procurement record posted and the commercial exception is closed.",
          resolutionReference: "PROCUREMENT-RESOLVED-17"
        },
        url: "/api/v1/billing/subscription/grace/resolve"
      });
      expect(resolved.statusCode).toBe(200);
      expect(resolved.json().subscription).toMatchObject({
        renewalDecision: "Approved",
        status: "Active"
      });

      const cancellation = await app.inject({
        cookies,
        method: "POST",
        payload: {
          cancellationReference: "CANCEL-REQUEST-21",
          reason:
            "The customer approved cancellation at the current term boundary only."
        },
        url: "/api/v1/billing/subscription/cancellation"
      });
      expect(cancellation.statusCode).toBe(200);
      expect(cancellation.json().subscription).toMatchObject({
        cancellationReference: "CANCEL-REQUEST-21",
        status: "NonRenewing"
      });
      expect(cancellation.json().currentPeriod.status).toBe("Open");
      expect(
        cancellation
          .json()
          .periods.some(
            (period: { status: string }) => period.status === "Scheduled"
          )
      ).toBe(false);

      const recovered = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "The customer withdrew cancellation before term reconciliation."
        },
        url: "/api/v1/billing/subscription/cancellation/revoke"
      });
      expect(recovered.statusCode).toBe(200);
      expect(recovered.json().subscription).toMatchObject({
        cancellationScheduledAt: null,
        renewalDecision: "Unreviewed",
        status: "Active"
      });

      const reapproved = await app.inject({
        cookies,
        method: "POST",
        payload: {
          agreementReference: "RENEWAL-2027-0043",
          decision: "Approve",
          packageKey: "CoreValidation",
          reason:
            "The replacement renewal agreement and support term are approved.",
          termMonths: 12
        },
        url: "/api/v1/billing/subscription/renewal"
      });
      expect(reapproved.statusCode).toBe(200);

      const lifecycleId = reapproved.json().subscription
        .subscriptionLifecycleId as string;
      const current = await prisma.subscriptionPeriod.findFirstOrThrow({
        where: { status: "Open", subscriptionLifecycleId: lifecycleId }
      });
      const scheduled = await prisma.subscriptionPeriod.findFirstOrThrow({
        where: { status: "Scheduled", subscriptionLifecycleId: lifecycleId }
      });
      const pastStart = new Date(Date.now() - 30 * DAY_MS);
      const pastBoundary = new Date(Date.now() - DAY_MS);
      await prisma.$transaction([
        prisma.subscriptionPeriod.update({
          data: { endsAt: pastBoundary, startsAt: pastStart },
          where: { subscriptionPeriodId: current.subscriptionPeriodId }
        }),
        prisma.subscriptionPeriod.update({
          data: { startsAt: pastBoundary },
          where: { subscriptionPeriodId: scheduled.subscriptionPeriodId }
        })
      ]);

      const renewed = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "Apply the due approved renewal and retain the completed usage period."
        },
        url: "/api/v1/billing/subscription/reconcile"
      });
      expect(renewed.statusCode).toBe(200);
      expect(renewed.json()).toMatchObject({
        chainValid: true,
        subscription: {
          agreementReference: "RENEWAL-2027-0043",
          packageKey: "CoreValidation",
          renewalDecision: "Unreviewed",
          status: "Active"
        }
      });
      expect(renewed.json().periods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sequence: 1,
            status: "Closed",
            usageSnapshot: expect.objectContaining({ tenantId })
          }),
          expect.objectContaining({ sequence: 2, status: "Open" })
        ])
      );
      expect(
        (
          await app.inject({
            cookies,
            method: "GET",
            url: "/api/v1/billing/active-package"
          })
        ).json()
      ).toMatchObject({ packageKey: "CoreValidation" });

      await app.inject({
        cookies,
        method: "POST",
        payload: {
          cancellationReference: "FINAL-CANCEL-22",
          reason:
            "The customer approved final cancellation at the renewed term boundary."
        },
        url: "/api/v1/billing/subscription/cancellation"
      });
      const renewedPeriod = await prisma.subscriptionPeriod.findFirstOrThrow({
        where: { status: "Open", subscriptionLifecycleId: lifecycleId }
      });
      await prisma.subscriptionPeriod.update({
        data: {
          endsAt: new Date(Date.now() - DAY_MS),
          startsAt: new Date(Date.now() - 30 * DAY_MS)
        },
        where: { subscriptionPeriodId: renewedPeriod.subscriptionPeriodId }
      });
      const ended = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "Close the due non-renewing term and remove plan entitlements fail closed."
        },
        url: "/api/v1/billing/subscription/reconcile"
      });
      expect(ended.statusCode).toBe(200);
      expect(ended.json()).toMatchObject({
        chainValid: true,
        subscription: { status: "Ended" }
      });
      expect(
        (
          await app.inject({
            cookies,
            method: "GET",
            url: "/api/v1/billing/active-package"
          })
        ).json()
      ).toBeNull();

      const eventRows = await prisma.subscriptionLifecycleEvent.findMany({
        orderBy: { sequence: "asc" },
        where: { subscriptionLifecycleId: lifecycleId }
      });
      expect(eventRows.map((event) => event.action)).toEqual(
        expect.arrayContaining([
          "Started",
          "RenewalApproved",
          "GraceStarted",
          "GraceResolved",
          "CancellationScheduled",
          "CancellationRevoked",
          "RenewalApplied",
          "Ended"
        ])
      );
      expect(
        eventRows.every((event, index) =>
          index === 0
            ? event.previousEventHash === null
            : event.previousEventHash === eventRows[index - 1]?.eventHash
        )
      ).toBe(true);

      const auditActions = (
        await prisma.auditEvent.findMany({
          select: { action: true },
          where: { tenantId }
        })
      ).map((event) => event.action);
      expect(auditActions).toEqual(
        expect.arrayContaining([
          "subscription_started",
          "subscription_renewal_decided",
          "subscription_reconciled",
          "subscription_grace_started",
          "subscription_grace_resolved",
          "subscription_cancellation_scheduled",
          "subscription_cancellation_revoked"
        ])
      );

      await prisma.subscriptionLifecycleEvent.update({
        data: { reason: "tampered lifecycle reason" },
        where: { subscriptionEventId: eventRows[1]!.subscriptionEventId }
      });
      const tampered = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/billing/subscription"
      });
      expect(tampered.statusCode).toBe(200);
      expect(tampered.json().chainValid).toBe(false);

      const outsider = await testHelpers.performSignup(
        app,
        "subscription-operations-outsider",
        "subscription-operations Outsider Tenant"
      );
      const outsiderWorkspace = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: outsider.cookie },
        method: "GET",
        url: "/api/v1/billing/subscription"
      });
      expect(outsiderWorkspace.statusCode).toBe(200);
      expect(outsiderWorkspace.json()).toMatchObject({ subscription: null });
    } finally {
      await app.close();
    }
  });
});
