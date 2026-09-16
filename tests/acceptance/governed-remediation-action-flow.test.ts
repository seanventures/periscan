import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("governed remediation action manifest", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "remediation-action"
      ]);
      await prisma.$disconnect();
    }
  });

  it("binds an exact diff to approval, rejects stale state, applies idempotently, and rolls back", async () => {
    prisma = createPrismaClient();
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
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "remediation-action",
        "Remediation Action Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = { [SESSION_COOKIE_NAME]: cookie };
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });
      const integration = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { connectorKey: "splunk", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(integration.statusCode).toBe(201);
      const control = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Detected"],
          integrationId: integration.json().integrationId,
          provider: "Splunk"
        },
        url: "/api/v1/control-sources"
      });
      expect(control.statusCode).toBe(201);
      const controlSourceId = control.json().controlSourceId as string;
      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          recommendedAction: "Tune and re-test the missed control expectation.",
          status: "Open",
          technicalSteps: ["Preview the exact change.", "Run verification."],
          tenantId,
          verificationMethod: "Run a fresh control observation."
        }
      });
      const idempotencyKey = `control-tuning-${randomUUID()}`;
      const preview = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          actionType: "ControlExpectationTuning",
          controlSourceId,
          idempotencyKey,
          nextExpectedBehaviors: ["Detected", "Alerted"]
        },
        url: `/api/v1/remediations/${remediation.remediationId}/actions/preview`
      });
      expect(preview.statusCode).toBe(201);
      expect(preview.json()).toMatchObject({
        manifest: {
          exactDiff: {
            after: ["Alerted", "Detected"],
            before: ["Detected"],
            field: "expectedBehaviors"
          },
          rollback: { available: true },
          verification: {
            required: true,
            successDoesNotEqualFixed: true
          }
        },
        state: "AwaitingApproval"
      });
      const remediationActionId = preview.json().remediationActionId as string;
      const previewHash = preview.json().previewHash as string;
      expect(previewHash).toMatch(/^[a-f0-9]{64}$/u);

      const beforeApproval = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash },
        url: `/api/v1/remediation-actions/${remediationActionId}/execute`
      });
      expect(beforeApproval.statusCode).toBe(409);
      const wrongHash = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash: "b".repeat(64) },
        url: `/api/v1/remediation-actions/${remediationActionId}/approve`
      });
      expect(wrongHash.statusCode).toBe(409);

      const approved = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash },
        url: `/api/v1/remediation-actions/${remediationActionId}/approve`
      });
      expect(approved.statusCode).toBe(200);
      expect(approved.json().state).toBe("Approved");

      await prisma.controlSource.update({
        data: { expectedBehaviors: ["Logged"] },
        where: { controlSourceId }
      });
      const stale = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash },
        url: `/api/v1/remediation-actions/${remediationActionId}/execute`
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().code).toBe("remediation_action_stale_preview");
      await prisma.controlSource.update({
        data: { expectedBehaviors: ["Detected"] },
        where: { controlSourceId }
      });

      const applied = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash },
        url: `/api/v1/remediation-actions/${remediationActionId}/execute`
      });
      expect(applied.statusCode).toBe(200);
      expect(applied.json()).toMatchObject({
        applicationReceipt: {
          exactDiffHash: previewHash,
          externalProductMutated: false,
          nextRequiredAction: "RunFixVerification"
        },
        state: "Applied"
      });
      expect(
        await prisma.controlSource.findUniqueOrThrow({
          where: { controlSourceId }
        })
      ).toMatchObject({ expectedBehaviors: ["Alerted", "Detected"] });
      expect(
        await prisma.remediationTask.findUniqueOrThrow({
          where: { remediationId: remediation.remediationId }
        })
      ).toMatchObject({ status: "VerificationPending" });
      const appliedAgain = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash },
        url: `/api/v1/remediation-actions/${remediationActionId}/execute`
      });
      expect(appliedAgain.statusCode).toBe(200);
      expect(appliedAgain.json().state).toBe("Applied");

      const rolledBack = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash },
        url: `/api/v1/remediation-actions/${remediationActionId}/rollback`
      });
      expect(rolledBack.statusCode).toBe(200);
      expect(rolledBack.json().state).toBe("RolledBack");
      expect(
        await prisma.controlSource.findUniqueOrThrow({
          where: { controlSourceId }
        })
      ).toMatchObject({ expectedBehaviors: ["Detected"] });
      expect(
        await prisma.remediationTask.findUniqueOrThrow({
          where: { remediationId: remediation.remediationId }
        })
      ).toMatchObject({ status: "InProgress" });

      const replayedPreview = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          actionType: "ControlExpectationTuning",
          controlSourceId,
          idempotencyKey,
          nextExpectedBehaviors: ["Alerted", "Detected"]
        },
        url: `/api/v1/remediations/${remediation.remediationId}/actions/preview`
      });
      expect(replayedPreview.statusCode).toBe(201);
      expect(replayedPreview.json().remediationActionId).toBe(
        remediationActionId
      );
      expect(
        await prisma.auditEvent.count({
          where: {
            action: {
              in: [
                "remediation_action_previewed",
                "remediation_action_approved",
                "remediation_action_applied",
                "remediation_action_rolled_back"
              ]
            },
            tenantId
          }
        })
      ).toBe(4);
    } finally {
      await app.close();
    }
  });
});
