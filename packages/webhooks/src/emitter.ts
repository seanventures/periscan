import type { Prisma, PrismaClient } from "@prisma/client";

import type { WebhookEventType } from "@periscan/shared";

import type { WebhookDeliveryQueue } from "./queue.js";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface EmitWebhookEventInput {
  prisma: PrismaLike;
  queue?: WebhookDeliveryQueue | null;
  tenantId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
}

/**
 * Records a webhook delivery row for every enabled subscription and, when a queue
 * is provided, enqueues it for asynchronous signed delivery. Emission failures are
 * swallowed so business operations are never blocked by webhook fan-out.
 */
export async function emitWebhookEvent(
  input: EmitWebhookEventInput
): Promise<string[]> {
  try {
    const webhooks = await input.prisma.tenantWebhook.findMany({
      where: {
        enabled: true,
        events: {
          has: input.eventType
        },
        tenantId: input.tenantId
      }
    });

    if (webhooks.length === 0) {
      return [];
    }

    const deliveryIds: string[] = [];

    for (const webhook of webhooks) {
      const delivery = await input.prisma.webhookDelivery.create({
        data: {
          eventType: input.eventType,
          payload: input.payload as Prisma.InputJsonValue,
          status: "Pending",
          tenantId: input.tenantId,
          webhookId: webhook.webhookId
        }
      });

      deliveryIds.push(delivery.deliveryId);

      if (input.queue) {
        await input.queue.enqueueDelivery({
          deliveryId: delivery.deliveryId
        });
      }
    }

    return deliveryIds;
  } catch {
    // Webhook fan-out is best-effort and must not break the originating operation.
    return [];
  }
}
