import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("GitHub Issues workflow destination acceptance", () => {
  it("creates, redacts, syncs, delivers remediation issues, and tenant-isolates GitHub Issues through the public API", async () => {
    const prisma = createPrismaClient();
    await probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie, response: signup } = await performSignup(
        app,
        "github-issues-acceptance",
        "GitHub Issues Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextToken = "github-issues-acceptance-token";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "pat",
          config: {
            accessToken: plaintextToken,
            connectorKey: "github-issues",
            labels: ["periscan", "security-validation"],
            repositoryFullName: "periscan-fixtures/demo-app"
          },
          connectorKey: "github-issues",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "pat",
        category: "Ticketing",
        config: {
          accessToken: "[redacted]",
          connectorKey: "github-issues",
          labels: ["periscan", "security-validation"],
          mockMode: true,
          repositoryFullName: "periscan-fixtures/demo-app"
        },
        product: "GitHub Issues",
        status: "Connected",
        vendor: "GitHub"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextToken);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.accessToken).not.toBe(plaintextToken);
      expect(String(storedConfig.accessToken)).toMatch(/^v1\./u);
      expect(storedConfig.repositoryFullName).toBe(
        "periscan-fixtures/demo-app"
      );

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextToken);

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);
      expect(synced.json()).toMatchObject({
        assetCount: 0,
        health: { status: "Healthy" },
        signalCount: 1
      });
      expect(JSON.stringify(synced.json())).not.toContain(plaintextToken);

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        signalCategory: "Remediation",
        signalSubcategory: "TicketStatus"
      });
      expect(signals[0]!.evidenceIds.length).toBeGreaterThan(0);
      expect(JSON.stringify(signals)).not.toContain(plaintextToken);

      const evidence = await prisma.evidenceArtifact.findMany({
        where: {
          relatedEntityId: integrationId,
          relatedEntityType: "Integration",
          tenantId
        }
      });
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toMatchObject({
        artifactType: "NormalizedEvidence",
        redactionStatus: "NotRequired"
      });

      const evidenceId = randomUUID();
      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [evidenceId],
          owner: "Security engineering",
          recommendedAction:
            "Rotate the exposed repository credential and rerun validation.",
          status: "Open",
          technicalSteps: [
            "Revoke the affected token",
            "Rotate downstream cloud credentials",
            "Rerun the validation mission"
          ],
          tenantId,
          verificationMethod:
            "Rerun the repository secret validation and verify the path is closed.",
          verificationRequired: true
        }
      });

      const ticket = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          integrationId
        },
        url: `/api/v1/remediations/${remediation.remediationId}/create-ticket`
      });
      expect(ticket.statusCode).toBe(200);
      expect(ticket.json()).toMatchObject({
        remediation: {
          remediationId: remediation.remediationId,
          status: "InProgress",
          ticketSystem: "GitHub Issues"
        },
        ticket: {
          integrationId,
          status: "InProgress",
          system: "GitHub Issues"
        }
      });
      expect(ticket.json().ticket.ticketId).toMatch(/^GH-/u);
      expect(ticket.json().ticket.evidenceSummary).toContain(evidenceId);
      expect(JSON.stringify(ticket.json())).not.toContain(plaintextToken);

      const storedRemediation = await prisma.remediationTask.findFirstOrThrow({
        where: {
          remediationId: remediation.remediationId,
          tenantId
        }
      });
      expect(storedRemediation).toMatchObject({
        status: "InProgress",
        ticketSystem: "GitHub Issues"
      });
      expect(storedRemediation.ticketId).toMatch(/^GH-/u);

      const trustSafety = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/trust-safety"
      });
      expect(trustSafety.statusCode).toBe(200);
      const connected = trustSafety
        .json()
        .connectedIntegrations.find(
          (item: { integrationId: string }) =>
            item.integrationId === integrationId
        );
      expect(connected).toMatchObject({
        category: "Ticketing",
        healthStatus: "Healthy",
        lastSyncAt: expect.any(String),
        product: "GitHub Issues",
        status: "Connected",
        vendor: "GitHub"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining(["metadata:read", "issues:write"])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(plaintextToken);

      const auditEvents = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          entityId: { in: [integrationId, remediation.remediationId] },
          tenantId
        }
      });
      expect(auditEvents.map((event) => event.action)).toEqual(
        expect.arrayContaining([
          "integration_connected",
          "integration_synced",
          "remediation_ticket_created"
        ])
      );
      expect(
        auditEvents.find(
          (event) =>
            event.action === "integration_synced" &&
            event.entityId === integrationId
        )?.metadata
      ).toMatchObject({
        assetCount: 0,
        connectorKey: "github-issues",
        healthStatus: "Healthy",
        signalCount: 1,
        status: "Succeeded"
      });
      expect(
        auditEvents.find(
          (event) =>
            event.action === "remediation_ticket_created" &&
            event.entityId === remediation.remediationId
        )?.metadata
      ).toMatchObject({
        integrationId,
        ticketSystem: "GitHub Issues",
        relatedPathId: null
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "github-issues-other",
        "GitHub Issues Other Tenant"
      );

      const crossTenantRead = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}`
      });
      expect(crossTenantRead.statusCode).toBe(404);

      const crossTenantTicket = await app.inject({
        cookies: authCookies(otherCookie),
        method: "POST",
        payload: {
          integrationId
        },
        url: `/api/v1/remediations/${remediation.remediationId}/create-ticket`
      });
      expect(crossTenantTicket.statusCode).toBe(404);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
