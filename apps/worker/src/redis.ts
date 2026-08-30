import { Redis } from "ioredis";

import {
  redisConnectionOptionsFromUrl,
  resolveRedisConnectionOptionsFromEnv,
  resolveRedisUrlFromEnv,
  VALIDATION_QUEUE_NAME
} from "@periscan/shared";

export const validationQueueName = VALIDATION_QUEUE_NAME;

export function createRedisConnectionOptions(url?: string) {
  return url
    ? redisConnectionOptionsFromUrl(url)
    : resolveRedisConnectionOptionsFromEnv(process.env);
}

export function createRedisConnection(url?: string) {
  return new Redis(url ?? resolveRedisUrlFromEnv(process.env), {
    maxRetriesPerRequest: null
  });
}
