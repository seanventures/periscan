// @ts-nocheck
import { WEBHOOK_EVENT_TYPES } from "@periscan/shared";
import {
  listWebhookEventDataSummaries,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_IDEMPOTENCY_HEADER,
  WEBHOOK_SIGNATURE_HEADER
} from "@periscan/webhooks";

import { assertSafeOutboundHttpsUrl } from "../outbound-url-safety.js";
import {
  AppServiceError,
  createOpaqueToken,
  requireWebhookAdminAccess,
  serializeWebhook,
  serializeWebhookDelivery,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

// Tenant outbound-webhook service group (D1 Phase 2 closure decomposition).
// Uses `prisma` + `webhookQueue` from the shared deps.
export function createWebhookServices(
  deps: RuntimeServiceDeps
): Partial<AppServices> {
  const { prisma, webhookQueue } = deps;

  return {
    async listWebhooks(context) {
      requireWebhookAdminAccess(context, "list webhooks");

      const webhooks = await prisma.tenantWebhook.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return webhooks.map(serializeWebhook);
    },

    /**
     * P20-5 / O13 / ICP-P1-8: discoverable event types + signing headers +
     * progressive data field summaries for receivers. No secrets.
     */
    async getWebhookEventCatalog(context) {
      requireWebhookAdminAccess(context, "read webhook event catalog");

      return {
        bodyFields: ["id", "type", "tenantId", "createdAt", "data"],
        eventDataSummaries: listWebhookEventDataSummaries(),
        eventTypes: [...WEBHOOK_EVENT_TYPES],
        headers: {
          delivery: WEBHOOK_DELIVERY_HEADER,
          event: WEBHOOK_EVENT_HEADER,
          idempotencyKey: WEBHOOK_IDEMPOTENCY_HEADER,
          signature: WEBHOOK_SIGNATURE_HEADER
        },
        productPath: "ApiAvailable",
        signatureFormat: "sha256=<hex>"
      };
    },

    async createWebhook(context, input) {
      requireWebhookAdminAccess(context, "create a webhook");

      // P03-4: refuse private/metadata/internal webhook targets at create time.
      await assertSafeOutboundHttpsUrl(input.url, {
        code: "unsafe_webhook_url",
        label: "Webhook URL"
      });

      const secret = createOpaqueToken("whsec_");
      const created = await prisma.tenantWebhook.create({
        data: {
          createdBy: context.user.userId,
          enabled: input.enabled ?? true,
          events: input.events,
          secret,
          tenantId: context.tenant.tenantId,
          url: input.url
        }
      });

      await writeAuditEvent(prisma, {
        action: "webhook.created",
        actorType: "User",
        entityId: created.webhookId,
        entityType: "TenantWebhook",
        metadata: {
          enabled: created.enabled,
          eventCount: created.events.length,
          events: created.events
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        ...serializeWebhook(created),
        secret
      };
    },

    async updateWebhook(context, webhookId, input) {
      requireWebhookAdminAccess(context, "update a webhook");

      const existing = await prisma.tenantWebhook.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          webhookId
        }
      });

      if (!existing) {
        throw new AppServiceError("Webhook not found.", 404, "not_found");
      }

      if (input.url !== undefined && input.url !== existing.url) {
        await assertSafeOutboundHttpsUrl(input.url, {
          code: "unsafe_webhook_url",
          label: "Webhook URL"
        });
      }

      const updated = await prisma.tenantWebhook.update({
        data: {
          enabled: input.enabled ?? existing.enabled,
          events: input.events ?? existing.events,
          url: input.url ?? existing.url
        },
        where: {
          webhookId
        }
      });

      await writeAuditEvent(prisma, {
        action: "webhook.updated",
        actorType: "User",
        entityId: updated.webhookId,
        entityType: "TenantWebhook",
        metadata: {
          enabled: updated.enabled,
          eventCount: updated.events.length,
          events: updated.events
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeWebhook(updated);
    },

    async deleteWebhook(context, webhookId) {
      requireWebhookAdminAccess(context, "delete a webhook");

      const existing = await prisma.tenantWebhook.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          webhookId
        }
      });

      if (!existing) {
        throw new AppServiceError("Webhook not found.", 404, "not_found");
      }

      await prisma.tenantWebhook.delete({
        where: {
          webhookId
        }
      });

      await writeAuditEvent(prisma, {
        action: "webhook.deleted",
        actorType: "User",
        entityId: existing.webhookId,
        entityType: "TenantWebhook",
        metadata: {
          enabled: existing.enabled,
          eventCount: existing.events.length,
          events: existing.events
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async testWebhook(context, webhookId) {
      requireWebhookAdminAccess(context, "send a test webhook");

      // Invalid / non-UUID ids must be invisible (404), never Prisma 500.
      if (
        typeof webhookId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          webhookId
        )
      ) {
        throw new AppServiceError("Webhook not found.", 404, "not_found");
      }

      const webhook = await prisma.tenantWebhook.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          webhookId
        }
      });

      if (!webhook) {
        throw new AppServiceError("Webhook not found.", 404, "not_found");
      }

      const delivery = await prisma.webhookDelivery.create({
        data: {
          eventType: webhook.events[0] ?? "mission.completed",
          payload: {
            message: "Periscan test webhook delivery.",
            test: true
          },
          status: "Pending",
          tenantId: context.tenant.tenantId,
          webhookId: webhook.webhookId
        }
      });

      if (webhookQueue) {
        await webhookQueue.enqueueDelivery({
          deliveryId: delivery.deliveryId
        });
      }

      await writeAuditEvent(prisma, {
        action: "webhook.tested",
        actorType: "User",
        entityId: webhook.webhookId,
        entityType: "TenantWebhook",
        metadata: {
          deliveryIds: [delivery.deliveryId],
          eventType: delivery.eventType
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        deliveryIds: [delivery.deliveryId]
      };
    },

    async rotateWebhookSecret(context, webhookId) {
      requireWebhookAdminAccess(context, "rotate a webhook secret");

      const existing = await prisma.tenantWebhook.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          webhookId
        }
      });

      if (!existing) {
        throw new AppServiceError("Webhook not found.", 404, "not_found");
      }

      const secret = createOpaqueToken("whsec_");
      const updated = await prisma.tenantWebhook.update({
        data: { secret },
        where: { webhookId }
      });

      await writeAuditEvent(prisma, {
        action: "webhook.updated",
        actorType: "User",
        entityId: updated.webhookId,
        entityType: "TenantWebhook",
        metadata: {
          secretRotated: true
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        ...serializeWebhook(updated),
        secret
      };
    },

    async redriveWebhookDelivery(context, deliveryId) {
      requireWebhookAdminAccess(context, "redrive a webhook delivery");

      const delivery = await prisma.webhookDelivery.findFirst({
        where: {
          deliveryId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!delivery) {
        throw new AppServiceError(
          "Webhook delivery not found.",
          404,
          "not_found"
        );
      }

      if (!delivery.deadLetteredAt && delivery.status !== "Failed") {
        throw new AppServiceError(
          "Only failed or dead-lettered deliveries can be redriven.",
          409,
          "webhook_delivery_not_redrivable"
        );
      }

      const reset = await prisma.webhookDelivery.update({
        data: {
          attempts: 0,
          deadLetteredAt: null,
          lastError: null,
          nextRetryAt: new Date(),
          responseStatus: null,
          status: "Pending"
        },
        where: { deliveryId }
      });

      if (webhookQueue) {
        await webhookQueue.enqueueDelivery({
          deliveryId: reset.deliveryId
        });
      }

      await writeAuditEvent(prisma, {
        action: "webhook.tested",
        actorType: "User",
        entityId: reset.webhookId,
        entityType: "TenantWebhook",
        metadata: {
          deliveryIds: [reset.deliveryId],
          redriven: true,
          eventType: reset.eventType
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        deliveryId: reset.deliveryId,
        status: reset.status
      };
    },

    async listWebhookDeliveries(context, webhookId) {
      requireWebhookAdminAccess(context, "list webhook deliveries");

      const deliveries = await prisma.webhookDelivery.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          tenantId: context.tenant.tenantId,
          webhookId: webhookId ?? undefined
        }
      });

      return deliveries.map(serializeWebhookDelivery);
    },

    async listDeadLetteredWebhookDeliveries(context) {
      requireWebhookAdminAccess(
        context,
        "list dead-lettered webhook deliveries"
      );

      // Permanently-failed deliveries (retries exhausted) for operator triage.
      const deliveries = await prisma.webhookDelivery.findMany({
        orderBy: {
          deadLetteredAt: "desc"
        },
        take: 100,
        where: {
          deadLetteredAt: { not: null },
          tenantId: context.tenant.tenantId
        }
      });

      return deliveries.map(serializeWebhookDelivery);
    }
  };
}
