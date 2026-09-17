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

describe("Slack workflow destination acceptance", () => {
  it("creates, redacts, syncs, sends remediation notifications, and tenant-isolates Slack through the public API", async () => {
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
        "slack-acceptance",
        "Slack Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextWebhookUrl =
        "https://hooks.slack.com/services/T000/B000/slack-secret";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "webhook",
          config: {
            channel: "#security-validation",
            connectorKey: "slack",
            username: "Periscan",
            webhookUrl: plaintextWebhookUrl
          },
          connectorKey: "slack",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "webhook",
        category: "Ticketing",
        config: {
          channel: "#security-validation",
          connectorKey: "slack",
          mockMode: true,
          username: "Periscan",
          webhookUrl: "[redacted]"
        },
        product: "Slack",
        status: "Connected",
        vendor: "Slack"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextWebhookUrl);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.webhookUrl).not.toBe(plaintextWebhookUrl);
      expect(String(storedConfig.webhookUrl)).toMatch(/^v1\./u);
      expect(storedConfig.channel).toBe("#security-validation");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextWebhookUrl);

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
      expect(JSON.stringify(synced.json())).not.toContain(plaintextWebhookUrl);

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        signalCategory: "Audit",
        signalSubcategory: "WorkflowDestination"
      });
      expect(signals[0]!.evidenceIds.length).toBeGreaterThan(0);
      expect(JSON.stringify(signals)).not.toContain(plaintextWebhookUrl);

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
            "Restrict the exposed service and rerun validation.",
          status: "Open",
          technicalSteps: [
            "Update the firewall rule",
            "Notify the channel owner",
            "Rerun the validation mission"
          ],
          tenantId,
          verificationMethod:
            "Rerun the original safe validation and verify the exposure is closed.",
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
          ticketSystem: "Slack"
        },
        ticket: {
          integrationId,
          status: "InProgress",
          system: "Slack"
        }
      });
      expect(ticket.json().ticket.ticketId).toMatch(/^PSCAN-/u);
      expect(ticket.json().ticket.evidenceSummary).toContain(evidenceId);
      expect(JSON.stringify(ticket.json())).not.toContain(plaintextWebhookUrl);

      const storedRemediation = await prisma.remediationTask.findFirstOrThrow({
        where: {
          remediationId: remediation.remediationId,
          tenantId
        }
      });
      expect(storedRemediation).toMatchObject({
        status: "InProgress",
        ticketSystem: "Slack"
      });
      expect(storedRemediation.ticketId).toMatch(/^PSCAN-/u);

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
        product: "Slack",
        status: "Connected",
        vendor: "Slack"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining(["incoming-webhook:write"])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextWebhookUrl
      );

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
        connectorKey: "slack",
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
        ticketSystem: "Slack",
        relatedPathId: null
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "slack-other",
        "Slack Other Tenant"
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
