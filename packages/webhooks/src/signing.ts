import { createHmac } from "node:crypto";

import type { WebhookEventType } from "@periscan/shared";

import type { WebhookEventData } from "./event-payloads.js";

export const WEBHOOK_SIGNATURE_HEADER = "x-periscan-signature";
export const WEBHOOK_EVENT_HEADER = "x-periscan-event";
export const WEBHOOK_DELIVERY_HEADER = "x-periscan-delivery";
// Idempotency key: the deliveryId is stable across every retry of the same
// delivery, so receivers can safely dedupe retried deliveries by this header.
// Sent in addition to (and equal to) WEBHOOK_DELIVERY_HEADER for clarity.
export const WEBHOOK_IDEMPOTENCY_HEADER = "x-periscan-idempotency-key";

export interface WebhookEventBody {
  id: string;
  type: WebhookEventType;
  tenantId: string;
  createdAt: string;
  /**
   * Event-specific payload. Prefer the per-type Zod schemas in
   * `event-payloads.ts` / `WEBHOOK_EVENT_DATA_SCHEMAS` when parsing.
   */
  data: WebhookEventData | Record<string, unknown>;
}

export function buildWebhookBody(input: {
  deliveryId: string;
  eventType: WebhookEventType;
  tenantId: string;
  payload: WebhookEventData | Record<string, unknown>;
  createdAt?: string;
}): WebhookEventBody {
  return {
    createdAt: input.createdAt ?? new Date().toISOString(),
    data: input.payload,
    id: input.deliveryId,
    tenantId: input.tenantId,
    type: input.eventType
  };
}

export function signWebhookBody(secret: string, serializedBody: string) {
  const digest = createHmac("sha256", secret)
    .update(serializedBody)
    .digest("hex");

  return `sha256=${digest}`;
}
