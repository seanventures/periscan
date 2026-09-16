import { Queue } from "bullmq";

import {
  ModelGatewayTurnJobPayloadSchema,
  MODEL_GATEWAY_TURN_QUEUE_NAME,
  resolveRedisConnectionOptionsFromEnv,
  type ModelGatewayTurnJobPayload
} from "@periscan/shared";

export interface ModelGatewayTurnQueue {
  enqueueTurn(payload: ModelGatewayTurnJobPayload): Promise<void>;
  checkHealth?(): Promise<{ ok: boolean; detail: string; latencyMs: number }>;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createBullMqModelGatewayTurnQueue(): ModelGatewayTurnQueue {
  const connection = resolveRedisConnectionOptionsFromEnv(process.env);
  const queue = new Queue<ModelGatewayTurnJobPayload>(
    MODEL_GATEWAY_TURN_QUEUE_NAME,
    { connection }
  );
  const attempts = parsePositiveIntEnv(
    process.env.PERISCAN_MODEL_GATEWAY_TURN_MAX_ATTEMPTS,
    1
  );
  const backoffDelayMs = parsePositiveIntEnv(
    process.env.PERISCAN_MODEL_GATEWAY_TURN_BACKOFF_MS,
    5000
  );

  return {
    async enqueueTurn(payload) {
      const parsedPayload = ModelGatewayTurnJobPayloadSchema.parse(payload);

      await queue.add(parsedPayload.turnId, parsedPayload, {
        attempts,
        backoff: { delay: backoffDelayMs, type: "exponential" },
        jobId: parsedPayload.turnId,
        priority: parsedPayload.queueLane === "Priority" ? 1 : 10,
        removeOnComplete: 100,
        removeOnFail: 500
      });
    },

    async checkHealth() {
      const startedAt = Date.now();

      try {
        const client = (await queue.client) as unknown as {
          ping(): Promise<string>;
        };
        const response = await client.ping();

        return {
          detail: response === "PONG" ? "Redis reachable." : response,
          latencyMs: Date.now() - startedAt,
          ok: response === "PONG"
        };
      } catch (error) {
        return {
          detail: error instanceof Error ? error.message : "Redis ping failed.",
          latencyMs: Date.now() - startedAt,
          ok: false
        };
      }
    }
  };
}
