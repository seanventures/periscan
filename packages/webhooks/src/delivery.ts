import type * as dnsPromises from "node:dns/promises";

import type { PrismaClient } from "@prisma/client";

import { assertHostnameResolvesPublic } from "@periscan/policy";
import { WebhookEventTypeSchema } from "@periscan/shared";

import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_IDEMPOTENCY_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  buildWebhookBody,
  signWebhookBody
} from "./signing.js";

// Mirrors the queue's attempts config (PERISCAN_WEBHOOK_MAX_ATTEMPTS, default 5)
// so the processor can mark a delivery dead-lettered on its final failed attempt.
function resolveWebhookMaxAttempts(
  env: NodeJS.ProcessEnv = process.env
): number {
  const parsed = Number.parseInt(env.PERISCAN_WEBHOOK_MAX_ATTEMPTS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export type FetchLike = (
  url: string,
  init: {
    body: string;
    headers: Record<string, string>;
    method: string;
    /** Prefer "error" so open redirects cannot rebind to private IPs. */
    redirect?: "error" | "follow" | "manual";
    signal?: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number }>;

export interface WebhookDeadLetterInfo {
  deliveryId: string;
  tenantId: string;
  webhookId: string;
  eventType: string;
  lastError: string;
}

export interface ProcessWebhookDeliveryOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  // Total delivery attempts before the delivery is dead-lettered. Defaults to
  // PERISCAN_WEBHOOK_MAX_ATTEMPTS so it stays in sync with the queue.
  maxAttempts?: number;
  // Best-effort hook fired exactly once when a delivery is dead-lettered (its
  // final attempt failed). The API/worker uses it to record an audit row;
  // packages/webhooks stays decoupled from the API's audit helper.
  onDeadLetter?: (info: WebhookDeadLetterInfo) => Promise<void> | void;
  /**
   * Injectable DNS lookup for delivery-time post-resolve SSRF (P03-5).
   * Production uses Node's default resolver; tests inject public/private maps.
   */
  lookup?: typeof dnsPromises.lookup;
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  responseStatus: number | null;
  error: string | null;
}

/**
 * Synchronous SSRF shape check for delivery-time defense in depth.
 * Create/update already async-resolves DNS; delivery still refuses private
 * IP literals, non-HTTPS, and known metadata hostnames before POST.
 */
export function assertSafeWebhookDeliveryUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Webhook URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use https.");
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  const blocked = new Set([
    "localhost",
    "localhost.localdomain",
    "metadata",
    "metadata.google.internal"
  ]);
  if (
    blocked.has(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error("Webhook URL targets a disallowed host.");
  }
  // IPv4 private / link-local / loopback / CGNAT / multicast
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    ) {
      throw new Error("Webhook URL targets a private or reserved IP.");
    }
  }
  if (host === "::1" || host === "::") {
    throw new Error("Webhook URL targets a private or reserved IP.");
  }
}

/**
 * Loads a delivery, signs the body with the subscription secret, POSTs it, and
 * records the outcome. Throws on failure so the queue can retry with backoff.
 */
export async function processWebhookDelivery(
  prisma: PrismaClient,
  deliveryId: string,
  options: ProcessWebhookDeliveryOptions = {}
): Promise<WebhookDeliveryResult> {
  const fetchImpl = (options.fetchImpl ?? globalThis.fetch) as
    | FetchLike
    | undefined;

  if (!fetchImpl) {
    throw new Error("No fetch implementation available for webhook delivery.");
  }

  const delivery = await prisma.webhookDelivery.findUnique({
    include: {
      webhook: true
    },
    where: {
      deliveryId
    }
  });

  if (!delivery || !delivery.webhook) {
    // Nothing to deliver; treat as a no-op so the job does not retry forever.
    return {
      delivered: false,
      error: "delivery_not_found",
      responseStatus: null
    };
  }

  if (delivery.status === "Delivered") {
    return {
      delivered: true,
      error: null,
      responseStatus: delivery.responseStatus
    };
  }

  // P03-4: refuse unsafe shape/IP-literal targets at delivery time.
  assertSafeWebhookDeliveryUrl(delivery.webhook.url);
  // P03-5: re-resolve hostname immediately before POST to shrink DNS-rebinding
  // TOCTOU. Connect-pin to resolved addresses is deferred (no undici Agent here);
  // see apps/api/src/outbound-url-safety.ts header notes.
  const deliveryHost = new URL(delivery.webhook.url).hostname
    .toLowerCase()
    .replace(/^\[|\]$/gu, "");
  const resolved = await assertHostnameResolvesPublic(
    deliveryHost,
    options.lookup
  );
  if (!resolved.ok) {
    throw new Error(
      `Webhook URL failed post-resolve SSRF check: ${resolved.rationale}`
    );
  }

  const eventType = WebhookEventTypeSchema.parse(delivery.eventType);
  const body = buildWebhookBody({
    createdAt: delivery.createdAt.toISOString(),
    deliveryId: delivery.deliveryId,
    eventType,
    payload:
      typeof delivery.payload === "object" && delivery.payload
        ? (delivery.payload as Record<string, unknown>)
        : {},
    tenantId: delivery.tenantId
  });
  const serialized = JSON.stringify(body);
  const signature = signWebhookBody(delivery.webhook.secret, serialized);
  const timeoutMs = options.timeoutMs ?? 10_000;
  // This call is the delivery's final attempt if incrementing its counter
  // reaches the max; a failure here is terminal (dead-lettered).
  const maxAttempts = options.maxAttempts ?? resolveWebhookMaxAttempts();
  const isFinalAttempt = delivery.attempts + 1 >= maxAttempts;
  // Best-effort dead-letter notification; never let an audit hook failure mask
  // or change the delivery outcome.
  const notifyDeadLetter = async (lastError: string) => {
    if (!isFinalAttempt || !options.onDeadLetter) {
      return;
    }
    try {
      await options.onDeadLetter({
        deliveryId,
        eventType,
        lastError,
        tenantId: delivery.tenantId,
        webhookId: delivery.webhook!.webhookId
      });
    } catch {
      // swallow — the dead-letter row + lastError on the delivery remain the
      // source of truth even if the audit write fails.
    }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(delivery.webhook.url, {
      body: serialized,
      headers: {
        "content-type": "application/json",
        [WEBHOOK_DELIVERY_HEADER]: delivery.deliveryId,
        [WEBHOOK_IDEMPOTENCY_HEADER]: delivery.deliveryId,
        [WEBHOOK_EVENT_HEADER]: eventType,
        [WEBHOOK_SIGNATURE_HEADER]: signature
      },
      method: "POST",
      // Never follow redirects to private IPs after a public first hop.
      redirect: "error",
      signal: controller.signal
    });

    if (!response.ok) {
      await prisma.webhookDelivery.update({
        data: {
          attempts: {
            increment: 1
          },
          deadLetteredAt: isFinalAttempt ? new Date() : null,
          lastError: `Non-2xx response: ${response.status}`,
          responseStatus: response.status,
          status: "Failed"
        },
        where: {
          deliveryId
        }
      });

      await notifyDeadLetter(`Non-2xx response: ${response.status}`);

      throw new Error(
        `Webhook delivery ${deliveryId} received status ${response.status}.`
      );
    }

    await prisma.webhookDelivery.update({
      data: {
        attempts: {
          increment: 1
        },
        deliveredAt: new Date(),
        lastError: null,
        nextRetryAt: null,
        responseStatus: response.status,
        status: "Delivered"
      },
      where: {
        deliveryId
      }
    });

    return { delivered: true, error: null, responseStatus: response.status };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("received status")
    ) {
      await prisma.webhookDelivery.update({
        data: {
          attempts: {
            increment: 1
          },
          deadLetteredAt: isFinalAttempt ? new Date() : null,
          lastError:
            error instanceof Error ? error.message : "Webhook delivery failed.",
          status: "Failed"
        },
        where: {
          deliveryId
        }
      });

      await notifyDeadLetter(
        error instanceof Error ? error.message : "Webhook delivery failed."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createWebhookDeliveryProcessor(
  prisma: PrismaClient,
  options: ProcessWebhookDeliveryOptions = {}
) {
  return {
    async process(job: { deliveryId: string }) {
      return processWebhookDelivery(prisma, job.deliveryId, options);
    }
  };
}
