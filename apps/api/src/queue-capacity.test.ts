import { describe, expect, it, vi } from "vitest";

import { resolveQueueMaxPerTenant } from "./mission-queue.js";
import {
  AppServiceError,
  assertTenantQueueCapacity
} from "./runtime-services.js";

describe("resolveQueueMaxPerTenant", () => {
  it("is disabled unless a positive cap is configured", () => {
    expect(resolveQueueMaxPerTenant({})).toBeNull();
    expect(
      resolveQueueMaxPerTenant({ PERISCAN_QUEUE_MAX_PER_TENANT: "0" })
    ).toBeNull();
    expect(
      resolveQueueMaxPerTenant({ PERISCAN_QUEUE_MAX_PER_TENANT: "-5" })
    ).toBeNull();
    expect(
      resolveQueueMaxPerTenant({ PERISCAN_QUEUE_MAX_PER_TENANT: "nope" })
    ).toBeNull();
    expect(
      resolveQueueMaxPerTenant({ PERISCAN_QUEUE_MAX_PER_TENANT: "25" })
    ).toBe(25);
  });
});

describe("assertTenantQueueCapacity", () => {
  it("is a no-op when the limit is disabled (never counts)", async () => {
    const countPending = vi.fn(async () => 999);
    await assertTenantQueueCapacity({
      countPending,
      limit: null,
      tenantId: "t1"
    });
    expect(countPending).not.toHaveBeenCalled();
  });

  it("allows an enqueue below the cap", async () => {
    await expect(
      assertTenantQueueCapacity({
        countPending: async () => 4,
        limit: 5,
        tenantId: "t1"
      })
    ).resolves.toBeUndefined();
  });

  it("denies at/over the cap with a 429 and runs onDenied", async () => {
    const onDenied = vi.fn(async () => undefined);
    let thrown: unknown;
    try {
      await assertTenantQueueCapacity({
        countPending: async () => 5,
        limit: 5,
        onDenied,
        tenantId: "t1"
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppServiceError);
    expect((thrown as AppServiceError).statusCode).toBe(429);
    expect((thrown as AppServiceError).code).toBe("queue_tenant_limit");
    expect(onDenied).toHaveBeenCalledWith(5);
  });
});
