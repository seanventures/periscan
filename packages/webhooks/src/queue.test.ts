import { afterEach, describe, expect, it, vi } from "vitest";

import { createBullMqWebhookDeliveryQueue } from "./queue.js";

const queueMock = vi.hoisted(() => vi.fn());

vi.mock("bullmq", () => ({
  Queue: queueMock
}));

const originalRedisUrl = process.env.REDIS_URL;
const originalDeploymentEnvironment =
  process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;

describe("webhook Redis-backed queue", () => {
  afterEach(() => {
    vi.clearAllMocks();

    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }

    if (originalDeploymentEnvironment === undefined) {
      delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
    } else {
      process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT =
        originalDeploymentEnvironment;
    }
  });

  it("refuses to create the delivery queue with a production Redis fallback", () => {
    delete process.env.REDIS_URL;
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";

    expect(() => createBullMqWebhookDeliveryQueue()).toThrow(
      /refusing to use the local development Redis fallback/u
    );
    expect(queueMock).not.toHaveBeenCalled();
  });
});
