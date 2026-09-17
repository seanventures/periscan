import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  assertRemediationFixedOnlyViaVerification,
  RemediationFixedWithoutVerificationError
} from "../../packages/shared/src/fix-verification.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S1 — Find-Fix-Verify closed loop (acceptance).
 *
 * Product path:
 *   remediation → (optional ticket) → mark-ready → verifyRemediation
 * Fixed is only written with measured revalidation (fix-verification law).
 *
 * Proves:
 * 1. Ticket close alone never mints Fixed (ClosedWithoutEvidence).
 * 2. mark-ready lands VerificationPending, never Fixed.
 * 3. No product API path sets status=Fixed without verify.
 * 4. verifyRemediation with measured revalidation can set Fixed.
 * 5. Shared chokepoint rejects Fixed without measured revalidation.
 */

const EMAIL_PREFIX = "s1-ffv";

describe("Find-Fix-Verify closed loop (Swarm S1)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [EMAIL_PREFIX]);
      await prisma.$disconnect();
    }
  }, 30_000);

  it("Fixed requires measured verify; ticket/mark-ready alone never claim Fixed", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      const hostname = `s1-ffv-${randomUUID()}.example.com`;
      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { scopeType: "Domain", value: hostname },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyScope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyScope.statusCode).toBe(200);

      // External-exposure style path so fix-verification modules retest Fixed
      // under fixtureMode (devMode) with measured revalidation.
      const entryNodeId = randomUUID();
      const impactNodeId = randomUUID();
      const path = await prisma.attackPath.create({
        data: {
          confidence: 0.9,
          entryNodeId,
          evidenceBasis: "Measured",
          evidenceIds: [],
          impactNodeId,
          impactScore: 81,
          name: "Public external TLS exposure to production workload",
          tenantId,
          validationState: "Reachable"
        }
      });
      await prisma.pathNode.createMany({
        data: [
          {
            entityId: randomUUID(),
            entityType: "Exposure",
            evidenceIds: [],
            label: "Public external service",
            pathId: path.pathId,
            pathNodeId: entryNodeId,
            sequence: 0,
            tenantId
          },
          {
            entityId: randomUUID(),
            entityType: "Asset",
            evidenceIds: [],
            label: "Production workload",
            pathId: path.pathId,
            pathNodeId: impactNodeId,
            sequence: 1,
            tenantId
          }
        ]
      });

      // --- Create remediation (Find) ---
      // Product createRemediation resolves path via correlation; seed a real task
      // row linked to the measured exposure path (same pattern as posture FFV
      // acceptance) so ticket / mark-ready / verify APIs exercise the closed loop.
      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          owner: "Security engineering",
          recommendedAction:
            "Restrict public external exposure and enforce modern TLS.",
          relatedPathId: path.pathId,
          status: "Open",
          technicalSteps: [
            "Remove public exposure",
            "Re-run measured external posture validation"
          ],
          tenantId,
          verificationMethod:
            "Rerun public external DNS, TLS, HTTP, and email posture checks.",
          verificationRequired: true
        }
      });
      const remediationId = remediation.remediationId;

      const openGet = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/remediations/${remediationId}`
      });
      expect(openGet.statusCode).toBe(200);
      expect(openGet.json().status).not.toBe("Fixed");
      expect(openGet.json().status).toBe("Open");

      // --- Optional ticket (does not claim Fixed) ---
      const jira = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { connectorKey: "jira", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(jira.statusCode).toBe(201);
      const integrationId = jira.json().integrationId as string;

      const ticket = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { integrationId },
        url: `/api/v1/remediations/${remediationId}/create-ticket`
      });
      expect(ticket.statusCode).toBe(200);
      expect(ticket.json().remediation.status).not.toBe("Fixed");
      expect(["Open", "InProgress"]).toContain(ticket.json().remediation.status);

      // External ticket close alone → ClosedWithoutEvidence, never Fixed.
      await prisma.integration.update({
        data: {
          config: {
            connectorKey: "jira",
            fixtureTicketState: "Closed",
            mockMode: true
          }
        },
        where: { integrationId }
      });
      // Re-open workflow status so sync-ticket can observe close honestly.
      await prisma.remediationTask.update({
        data: { status: "InProgress", ticketState: "Open" },
        where: { remediationId }
      });
      const closedTicket = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediationId}/sync-ticket`
      });
      expect(closedTicket.statusCode).toBe(200);
      expect(closedTicket.json().remediation.status).toBe(
        "ClosedWithoutEvidence"
      );
      expect(closedTicket.json().remediation.status).not.toBe("Fixed");

      // Return to open workflow for mark-ready / verify (ticket path is optional
      // and already proved non-Fixed).
      await prisma.remediationTask.update({
        data: {
          status: "InProgress",
          ticketState: "Open",
          ticketStateLabel: "Reopened for verification"
        },
        where: { remediationId }
      });

      // --- Mark ready (still not Fixed) ---
      const ready = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/remediations/${remediationId}/mark-ready-for-verification`
      });
      expect(ready.statusCode).toBe(200);
      expect(ready.json().status).toBe("VerificationPending");
      expect(ready.json().status).not.toBe("Fixed");

      // Shared chokepoint: Fixed without measured revalidation must throw.
      expect(() =>
        assertRemediationFixedOnlyViaVerification({
          measuredRevalidation: false,
          nextStatus: "Fixed",
          verificationOutcome: "Fixed"
        })
      ).toThrow(RemediationFixedWithoutVerificationError);
      expect(() =>
        assertRemediationFixedOnlyViaVerification({
          measuredRevalidation: true,
          nextStatus: "Fixed",
          verificationOutcome: "StillExposed"
        })
      ).toThrow(RemediationFixedWithoutVerificationError);

      // --- Verify (measured revalidation) ---
      const verify = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediationId}/verify`
      });
      expect(verify.statusCode).toBe(200);
      const body = verify.json() as {
        remediation: { status: string };
        verificationEvent: {
          measuredRevalidation: boolean;
          outcome: string;
          retestMethod: string;
        };
      };
      expect(body.verificationEvent.measuredRevalidation).toBe(true);
      // Measured retest methods: validation-module retest and/or connector-resync
      // of a Measured path. Either is real measured revalidation (not ticket close).
      expect(["validation-module", "connector-resync", "in-network-runner"]).toContain(
        body.verificationEvent.retestMethod
      );
      // External-exposure fixture retest yields Fixed when modules complete.
      expect(body.verificationEvent.outcome).toBe("Fixed");
      expect(body.remediation.status).toBe("Fixed");

      // Fixed write is only authorized with both outcome Fixed + measured revalidation.
      assertRemediationFixedOnlyViaVerification({
        measuredRevalidation: true,
        nextStatus: body.remediation.status,
        verificationOutcome: body.verificationEvent.outcome
      });

      const events = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/remediations/${remediationId}/verification-events`
      });
      expect(events.statusCode).toBe(200);
      expect(events.json().items.length).toBeGreaterThanOrEqual(1);
      const latest = events.json().items[0] as {
        measuredRevalidation: boolean;
        outcome: string;
      };
      expect(latest.outcome).toBe("Fixed");
      expect(latest.measuredRevalidation).toBe(true);

      const persisted = await prisma.remediationTask.findUniqueOrThrow({
        where: { remediationId }
      });
      expect(persisted.status).toBe("Fixed");
    } finally {
      await app.close();
    }
  }, 90_000);
});
