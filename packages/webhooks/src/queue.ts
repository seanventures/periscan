import { Queue } from "bullmq";

import {
  resolveRedisConnectionOptionsFromEnv,
  WEBHOOK_DELIVERY_QUEUE_NAME
} from "@periscan/shared";

export interface WebhookDeliveryJob {
  deliveryId: string;
}

export interface WebhookDeliveryQueue {
  enqueueDelivery(job: WebhookDeliveryJob): Promise<void>;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createBullMqWebhookDeliveryQueue(): WebhookDeliveryQueue {
  const queue = new Queue<WebhookDeliveryJob>(WEBHOOK_DELIVERY_QUEUE_NAME, {
    connection: resolveRedisConnectionOptionsFromEnv(process.env)
  });
  const attempts = parsePositiveIntEnv(
    process.env.PERISCAN_WEBHOOK_MAX_ATTEMPTS,
    5
  );
  const backoffDelayMs = parsePositiveIntEnv(
    process.env.PERISCAN_WEBHOOK_BACKOFF_MS,
    10_000
  );

  return {
    async enqueueDelivery(job) {
      await queue.add("webhook-delivery", job, {
        attempts,
        backoff: {
          type: "exponential",
          delay: backoffDelayMs
        },
        jobId: job.deliveryId,
        removeOnComplete: 500,
        removeOnFail: 1000
      });
    }
  };
}
