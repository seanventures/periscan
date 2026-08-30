import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("remediation ticket state synchronization", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "ticket-state",
        "ticket-isolation"
      ]);
      await prisma.$disconnect();
    }
  });

  it("persists the owning integration and records external closure without claiming the risk is fixed", async () => {
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
      const owner = await testHelpers.performSignup(
        app,
        "ticket-state",
        "Ticket State Tenant"
      );
      const ownerAuth = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const integrationResponse = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        payload: {
          connectorKey: "jira",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(integrationResponse.statusCode).toBe(201);
      const integrationId = integrationResponse.json().integrationId as string;
      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          recommendedAction: "Remove the validated path and re-test it.",
          status: "Open",
          technicalSteps: ["Apply the approved change.", "Run verification."],
          tenantId,
          verificationMethod: "Fresh targeted verification"
        }
      });

      const created = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        payload: { integrationId },
        url: `/api/v1/remediations/${remediation.remediationId}/create-ticket`
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().remediation).toMatchObject({
        status: "InProgress",
        ticketIntegrationId: integrationId,
        ticketState: "Open",
        ticketStateLabel: "Created"
      });
      // Swarm S6 / P09-12: creating an ITSM ticket is never Fixed.
      expect(created.json().remediation.status).not.toBe("Fixed");
      expect(created.json().remediation.verificationRequired).toBe(true);
      const afterCreate = await prisma.remediationTask.findUniqueOrThrow({
        where: { remediationId: remediation.remediationId }
      });
      expect(afterCreate.status).toBe("InProgress");
      expect(afterCreate.status).not.toBe("Fixed");
      expect(afterCreate.verificationRequired).toBe(true);

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
      const synchronized = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediation.remediationId}/sync-ticket`
      });
      expect(synchronized.statusCode).toBe(200);
      expect(synchronized.json()).toMatchObject({
        remediation: {
          status: "ClosedWithoutEvidence",
          ticketIntegrationId: integrationId,
          ticketState: "Closed",
          ticketStateLabel: "Closed"
        },
        ticket: {
          integrationId,
          state: "Closed",
          stateLabel: "Closed"
        }
      });
      // P09-12: ticket close is never Fixed — honest state is ClosedWithoutEvidence.
      expect(synchronized.json().remediation.status).not.toBe("Fixed");
      expect(synchronized.json().remediation.status).toBe(
        "ClosedWithoutEvidence"
      );
      // Verify is still required after external close — Fixed only via verification.
      expect(synchronized.json().remediation.verificationRequired).toBe(true);

      const closedWithoutEvidenceAudit = await prisma.auditEvent.count({
        where: {
          action: "remediation_closed_without_evidence",
          entityId: remediation.remediationId,
          tenantId
        }
      });
      expect(closedWithoutEvidenceAudit).toBe(1);

      const persisted = await prisma.remediationTask.findUniqueOrThrow({
        where: { remediationId: remediation.remediationId }
      });
      expect(persisted).toMatchObject({
        status: "ClosedWithoutEvidence",
        ticketIntegrationId: integrationId,
        ticketState: "Closed",
        ticketStateLabel: "Closed"
      });
      expect(persisted.status).not.toBe("Fixed");
      expect(persisted.verificationRequired).toBe(true);
      expect(persisted.ticketSyncedAt).toBeInstanceOf(Date);
      expect(
        await prisma.auditEvent.count({
          where: {
            action: "remediation_ticket_synced",
            entityId: remediation.remediationId,
            tenantId
          }
        })
      ).toBe(1);

      // Verify still required: mark-ready-for-verification remains available;
      // external ticket close did not mint Fixed or skip the verification path.
      const markReady = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        url: `/api/v1/remediations/${remediation.remediationId}/mark-ready-for-verification`
      });
      // ClosedWithoutEvidence may transition to VerificationPending or stay
      // closed-without-evidence depending on status machine; never Fixed here.
      expect([200, 409].includes(markReady.statusCode)).toBe(true);
      if (markReady.statusCode === 200) {
        expect(markReady.json().status).not.toBe("Fixed");
        expect(markReady.json().status).toBe("VerificationPending");
      }
      const stillNotFixed = await prisma.remediationTask.findUniqueOrThrow({
        where: { remediationId: remediation.remediationId }
      });
      expect(stillNotFixed.status).not.toBe("Fixed");
      expect(stillNotFixed.verificationRequired).toBe(true);

      const other = await testHelpers.performSignup(
        app,
        "ticket-isolation",
        "Ticket Isolation Tenant"
      );
      const isolated = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: other.cookie },
        method: "POST",
        payload: { integrationId },
        url: `/api/v1/remediations/${remediation.remediationId}/sync-ticket`
      });
      expect(isolated.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
