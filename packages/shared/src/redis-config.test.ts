import { describe, expect, it } from "vitest";

import {
  LOCAL_REDIS_URL,
  redisConnectionOptionsFromUrl,
  resolveRedisConnectionOptionsFromEnv,
  resolveRedisUrlFromEnv
} from "./redis-config.js";

describe("Redis configuration", () => {
  it("keeps the local fallback outside production", () => {
    expect(resolveRedisUrlFromEnv({})).toBe(LOCAL_REDIS_URL);
    expect(resolveRedisConnectionOptionsFromEnv({})).toEqual({
      db: 0,
      host: "127.0.0.1",
      maxRetriesPerRequest: null,
      password: undefined,
      port: 6379,
      username: undefined
    });
  });

  it("requires explicit REDIS_URL in production", () => {
    expect(() =>
      resolveRedisUrlFromEnv({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production"
      })
    ).toThrow(/refusing to use the local development Redis fallback/u);
  });

  it("parses configured Redis URLs", () => {
    expect(
      redisConnectionOptionsFromUrl(
        "rediss://queue-user:secret@redis.example.com:6380/2"
      )
    ).toEqual({
      db: 2,
      host: "redis.example.com",
      maxRetriesPerRequest: null,
      password: "secret",
      port: 6380,
      username: "queue-user"
    });
  });

  it("rejects unsupported protocols", () => {
    expect(() =>
      redisConnectionOptionsFromUrl("http://redis.example.com")
    ).toThrow(/redis:\/\/ or rediss:\/\//u);
  });
});
