import { Queue } from "bullmq";

import {
  resolveRedisConnectionOptionsFromEnv,
  ValidationJobPayloadSchema,
  VALIDATION_QUEUE_NAME,
  type ValidationJobPayload
} from "@periscan/shared";

export interface MissionQueue {
  enqueueValidationJob(payload: ValidationJobPayload): Promise<void>;
  checkHealth?(): Promise<{ ok: boolean; detail: string; latencyMs: number }>;
  // Count this tenant's not-yet-finished validation jobs (waiting/active/delayed)
  // in the shared queue, for per-tenant backpressure. Optional so lightweight
  // test doubles need not implement it.
  countTenantPending?(tenantId: string): Promise<number>;
}

// Per-tenant enqueue cap so one tenant can't monopolize the shared validation
// queue. Disabled (null) unless PERISCAN_QUEUE_MAX_PER_TENANT is set.
export function resolveQueueMaxPerTenant(
  env: NodeJS.ProcessEnv = process.env
): number | null {
  const raw = env.PERISCAN_QUEUE_MAX_PER_TENANT;
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Bounded scan cap: enough to enforce realistic per-tenant limits without an
// unbounded fetch. At extreme depths the count is approximate, which is fine for
// a backpressure guard (it only needs to know "at/over the cap").
const TENANT_PENDING_SCAN_LIMIT = 5000;

function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createBullMqMissionQueue(): MissionQueue {
  const connection = resolveRedisConnectionOptionsFromEnv(process.env);
  const queue = new Queue<ValidationJobPayload>(VALIDATION_QUEUE_NAME, {
    connection
  });
  const attempts = parsePositiveIntEnv(
    process.env.PERISCAN_QUEUE_MAX_ATTEMPTS,
    3
  );
  const backoffDelayMs = parsePositiveIntEnv(
    process.env.PERISCAN_QUEUE_BACKOFF_MS,
    5000
  );

  return {
    async enqueueValidationJob(payload) {
      const parsedPayload = ValidationJobPayloadSchema.parse(payload);

      await queue.add(parsedPayload.jobId, parsedPayload, {
        attempts,
        backoff: {
          type: "exponential",
          delay: backoffDelayMs
        },
        jobId: parsedPayload.jobId,
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
    },

    async countTenantPending(tenantId) {
      const jobs = await queue.getJobs(
        ["waiting", "active", "delayed", "prioritized"],
        0,
        TENANT_PENDING_SCAN_LIMIT
      );
      return jobs.filter((job) => job?.data?.tenantId === tenantId).length;
    }
  };
}
