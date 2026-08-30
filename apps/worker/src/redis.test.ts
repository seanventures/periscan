import { afterEach, describe, expect, it } from "vitest";

import {
  createRedisConnection,
  createRedisConnectionOptions,
  validationQueueName
} from "./redis.js";

const originalRedisUrl = process.env.REDIS_URL;
const originalDeploymentEnvironment =
  process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;

describe("createRedisConnection", () => {
  afterEach(() => {
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

  it("creates a connection using the provided redis url", () => {
    const connection = createRedisConnection("redis://127.0.0.1:6380");

    expect(validationQueueName).toBe("validation-missions");
    expect(connection.options.host).toBe("127.0.0.1");
    expect(connection.options.port).toBe(6380);

    connection.disconnect();
  });

  it("keeps the local Redis fallback outside production", () => {
    delete process.env.REDIS_URL;
    delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
    const options = createRedisConnectionOptions();

    expect(options).toEqual({
      db: 0,
      host: "127.0.0.1",
      maxRetriesPerRequest: null,
      password: undefined,
      port: 6379,
      username: undefined
    });
  });

  it("refuses the local Redis fallback in production", () => {
    delete process.env.REDIS_URL;
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";

    expect(() => createRedisConnectionOptions()).toThrow(
      /refusing to use the local development Redis fallback/u
    );
  });
});
