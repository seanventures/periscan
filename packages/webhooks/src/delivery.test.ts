import { describe, expect, it } from "vitest";

import {
  assertSafeWebhookDeliveryUrl,
  processWebhookDelivery,
  type FetchLike
} from "./delivery.js";
import { WEBHOOK_IDEMPOTENCY_HEADER } from "./signing.js";

/** Public IP literal — post-resolve SSRF is pure IP check (no live DNS). */
const PUBLIC_HOOK_URL = "https://93.184.216.34/hook";

function makeDelivery(overrides: Record<string, unknown> = {}) {
  return {
    attempts: 0,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    deliveredAt: null,
    deliveryId: "11111111-1111-4111-8111-111111111111",
    eventType: "mission.completed",
    lastError: null,
    nextRetryAt: null,
    payload: { ok: true },
    responseStatus: null,
    status: "Pending",
    tenantId: "22222222-2222-4222-8222-222222222222",
    webhook: {
      secret: "shh",
      url: PUBLIC_HOOK_URL,
      webhookId: "33333333-3333-4333-8333-333333333333"
    },
    ...overrides
  };
}

function makePrisma(delivery: ReturnType<typeof makeDelivery>) {
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    webhookDelivery: {
      findUnique: async () => delivery,
      update: async (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return {};
      }
    }
  } as never;
  return { prisma, updates };
}

describe("processWebhookDelivery", () => {
  it("sends a stable idempotency key equal to the deliveryId", async () => {
    const { prisma } = makePrisma(makeDelivery());
    let headers: Record<string, string> = {};
    const fetchImpl: FetchLike = async (_url, init) => {
      headers = init.headers;
      return { ok: true, status: 200 };
    };

    await processWebhookDelivery(prisma, "id", { fetchImpl });

    expect(headers[WEBHOOK_IDEMPOTENCY_HEADER]).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("does not dead-letter a non-final failed attempt", async () => {
    const { prisma, updates } = makePrisma(makeDelivery({ attempts: 0 }));
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 500 });

    await expect(
      processWebhookDelivery(prisma, "id", { fetchImpl, maxAttempts: 5 })
    ).rejects.toThrow(/status 500/u);

    expect(updates[0]?.status).toBe("Failed");
    expect(updates[0]?.deadLetteredAt).toBeNull();
  });

  it("dead-letters the final failed attempt", async () => {
    // attempts=4, maxAttempts=5 → this call is the 5th (final) attempt.
    const { prisma, updates } = makePrisma(makeDelivery({ attempts: 4 }));
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 500 });

    await expect(
      processWebhookDelivery(prisma, "id", { fetchImpl, maxAttempts: 5 })
    ).rejects.toThrow(/status 500/u);

    expect(updates[0]?.status).toBe("Failed");
    expect(updates[0]?.deadLetteredAt).toBeInstanceOf(Date);
  });

  it("dead-letters on a final-attempt network error too", async () => {
    const { prisma, updates } = makePrisma(makeDelivery({ attempts: 4 }));
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };

    await expect(
      processWebhookDelivery(prisma, "id", { fetchImpl, maxAttempts: 5 })
    ).rejects.toThrow(/ECONNREFUSED/u);

    expect(updates[0]?.deadLetteredAt).toBeInstanceOf(Date);
  });

  it("fires onDeadLetter exactly once on the final failed attempt", async () => {
    const { prisma } = makePrisma(makeDelivery({ attempts: 4 }));
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 503 });
    const deadLettered: Array<{ deliveryId: string; webhookId: string }> = [];

    await expect(
      processWebhookDelivery(prisma, "id", {
        fetchImpl,
        maxAttempts: 5,
        onDeadLetter: (info) => {
          deadLettered.push({
            deliveryId: info.deliveryId,
            webhookId: info.webhookId
          });
        }
      })
    ).rejects.toThrow(/status 503/u);

    expect(deadLettered).toHaveLength(1);
    expect(deadLettered[0]?.webhookId).toBe(
      "33333333-3333-4333-8333-333333333333"
    );
  });

  it("does not fire onDeadLetter on a non-final failed attempt", async () => {
    const { prisma } = makePrisma(makeDelivery({ attempts: 0 }));
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 500 });
    let calls = 0;

    await expect(
      processWebhookDelivery(prisma, "id", {
        fetchImpl,
        maxAttempts: 5,
        onDeadLetter: () => {
          calls += 1;
        }
      })
    ).rejects.toThrow(/status 500/u);

    expect(calls).toBe(0);
  });

  it("refuses private/metadata webhook URLs at delivery time (P03-4)", async () => {
    const { prisma } = makePrisma(
      makeDelivery({
        webhook: {
          secret: "shh",
          url: "http://169.254.169.254/latest/meta-data",
          webhookId: "33333333-3333-4333-8333-333333333333"
        }
      })
    );
    let fetched = false;
    const fetchImpl: FetchLike = async () => {
      fetched = true;
      return { ok: true, status: 200 };
    };

    await expect(
      processWebhookDelivery(prisma, "id", { fetchImpl })
    ).rejects.toThrow(/https|private|disallowed|not a valid/iu);
    expect(fetched).toBe(false);
  });

  it("sends redirect:error so open redirects cannot rebind", async () => {
    const { prisma } = makePrisma(makeDelivery());
    let redirect: string | undefined;
    const fetchImpl: FetchLike = async (_url, init) => {
      redirect = init.redirect;
      return { ok: true, status: 200 };
    };

    await processWebhookDelivery(prisma, "id", { fetchImpl });
    expect(redirect).toBe("error");
  });

  it("refuses hostnames that re-resolve to private IPs at delivery (P03-5)", async () => {
    const { prisma } = makePrisma(
      makeDelivery({
        webhook: {
          secret: "shh",
          url: "https://hooks.example.com/periscan",
          webhookId: "33333333-3333-4333-8333-333333333333"
        }
      })
    );
    let fetched = false;
    const fetchImpl: FetchLike = async () => {
      fetched = true;
      return { ok: true, status: 200 };
    };
    const lookup = (async () => [
      { address: "169.254.169.254", family: 4 }
    ]) as unknown as typeof import("node:dns/promises").lookup;

    await expect(
      processWebhookDelivery(prisma, "id", { fetchImpl, lookup })
    ).rejects.toThrow(/post-resolve|private|reserved/i);
    expect(fetched).toBe(false);
  });
});

describe("assertSafeWebhookDeliveryUrl", () => {
  it("allows public https endpoints", () => {
    expect(() =>
      assertSafeWebhookDeliveryUrl("https://hooks.example.com/periscan")
    ).not.toThrow();
  });

  it("blocks metadata and private hosts", () => {
    expect(() =>
      assertSafeWebhookDeliveryUrl("https://169.254.169.254/")
    ).toThrow(/private|reserved/i);
    expect(() =>
      assertSafeWebhookDeliveryUrl("https://localhost/hook")
    ).toThrow(/disallowed/i);
  });
});
