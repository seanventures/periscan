import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("shared engagement collaboration and replay", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "engagement-collab",
        "engagement-outsider"
      ]);
      await prisma.$disconnect();
    }
  });

  it("coordinates tenant members through a hash-linked replay and detects tampering", async () => {
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
      const ownerSignup = await testHelpers.performSignup(
        app,
        "engagement-collab",
        "Engagement Collaboration Tenant"
      );
      const tenantId = ownerSignup.response.json().tenant.tenantId as string;
      const ownerUserId = ownerSignup.response.json().user.userId as string;
      const auth = { [SESSION_COOKIE_NAME]: ownerSignup.cookie };
      const operator = await prisma.user.create({
        data: {
          email: `engagement-collab-operator-${randomUUID()}@example.test`,
          emailVerifiedAt: new Date(),
          name: "Morgan Operator",
          status: "Active"
        }
      });
      await prisma.membership.create({
        data: {
          role: "SecurityEngineer",
          tenantId,
          userId: operator.userId
        }
      });
      const scope = await prisma.scope.create({
        data: {
          scopeType: "Domain",
          tenantId,
          value: "collaboration.example.test",
          verificationMethod: "DNS_TXT",
          verificationStatus: "Verified",
          verifiedAt: new Date()
        }
      });
      const evidenceId = randomUUID();
      const engagement = await prisma.engagement.create({
        data: {
          evidenceIds: [evidenceId],
          generatedAt: new Date(),
          mode: "Execute",
          scopeId: scope.scopeId,
          status: "Completed",
          steps: [
            {
              evidenceIds: [evidenceId],
              moduleId: "periscan.http_health_check",
              runMode: "ServiceDirect",
              signalCount: 1,
              status: "executed"
            }
          ],
          tenantId
        }
      });

      const initialized = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          objective:
            "Coordinate the measured HTTP validation and preserve every operator decision.",
          title: "External validation review"
        },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration`
      });
      expect(initialized.statusCode).toBe(201);
      expect(initialized.json()).toMatchObject({
        collaborators: [{ role: "Lead", userId: ownerUserId }],
        integrity: { eventCount: 1, valid: true },
        workspace: { lastEventSequence: 1, status: "Open" }
      });

      const collaborator = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { role: "Operator", userId: operator.userId },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration/collaborators`
      });
      expect(collaborator.statusCode).toBe(200);
      expect(collaborator.json()).toMatchObject({
        integrity: { eventCount: 2, valid: true }
      });
      expect(collaborator.json().collaborators).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Morgan Operator",
            role: "Operator",
            userId: operator.userId
          })
        ])
      );

      const note = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          body: "HTTP response was measured. Review the linked artifact before closing.",
          eventType: "Note",
          evidenceIds: []
        },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration/events`
      });
      expect(note.statusCode).toBe(201);
      const assigned = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          assignedToUserId: operator.userId,
          eventType: "AssignmentChanged",
          evidenceIds: []
        },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration/events`
      });
      expect(assigned.json().workspace.leadUserId).toBe(operator.userId);
      const pinned = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { eventType: "EvidencePinned", evidenceIds: [evidenceId] },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration/events`
      });
      expect(pinned.statusCode).toBe(201);
      const invalidEvidence = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          eventType: "EvidencePinned",
          evidenceIds: [randomUUID()]
        },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration/events`
      });
      expect(invalidEvidence.statusCode).toBe(400);
      expect(invalidEvidence.json().code).toBe("engagement_evidence_not_owned");
      const review = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          eventType: "StatusChanged",
          evidenceIds: [],
          status: "InReview"
        },
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration/events`
      });
      expect(review.json()).toMatchObject({
        integrity: { eventCount: 6, valid: true },
        workspace: { lastEventSequence: 6, status: "InReview" }
      });
      expect(
        review
          .json()
          .events.map((event: { sequence: number }) => event.sequence)
      ).toEqual([1, 2, 3, 4, 5, 6]);

      const outsiderSignup = await testHelpers.performSignup(
        app,
        "engagement-outsider",
        "Engagement Outsider Tenant"
      );
      const outsider = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: outsiderSignup.cookie },
        method: "GET",
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration`
      });
      expect(outsider.statusCode).toBe(404);

      const workspace = await prisma.engagementWorkspace.findUniqueOrThrow({
        where: { engagementId: engagement.engagementId }
      });
      await prisma.engagementCollaborationEvent.update({
        data: { body: "tampered after the fact" },
        where: {
          engagementWorkspaceId_sequence: {
            engagementWorkspaceId: workspace.engagementWorkspaceId,
            sequence: 3
          }
        }
      });
      const tampered = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/engagements/${engagement.engagementId}/collaboration`
      });
      expect(tampered.statusCode).toBe(200);
      expect(tampered.json().collaboration.integrity).toEqual({
        brokenAtSequence: 3,
        eventCount: 6,
        valid: false
      });
      expect(
        await prisma.auditEvent.count({
          where: {
            action: {
              in: [
                "engagement_workspace_created",
                "engagement_collaborator_updated",
                "engagement_collaboration_event_added"
              ]
            },
            tenantId
          }
        })
      ).toBe(6);
    } finally {
      await app.close();
    }
  });
});
