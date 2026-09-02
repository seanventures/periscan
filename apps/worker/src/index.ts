import { Worker } from "bullmq";

import { getPrismaClient } from "@periscan/db";
import {
  MODEL_GATEWAY_TURN_QUEUE_NAME,
  WEBHOOK_DELIVERY_QUEUE_NAME
} from "@periscan/shared";
import { createWebhookDeliveryProcessor } from "@periscan/webhooks";

import { resolveWorkerFixtureTargetAllowance } from "./config.js";
import { logger } from "./logger.js";
import { createModelGatewayTurnProcessor } from "./model-gateway-turn.js";
import {
  PrismaMissionExecutionStore,
  createMissionExecutionProcessor
} from "./processor.js";
import {
  createRedisConnection,
  createRedisConnectionOptions,
  validationQueueName
} from "./redis.js";
import { runEvidenceRetentionPurge } from "./retention.js";
import {
  createThirdPartyToolInstallProcessor,
  resolveThirdPartyToolInstallWorkerEnabled,
  resolveThirdPartyToolInstallWorkerIntervalMs
} from "./tool-install.js";

const connection = createRedisConnection();
const processor = createMissionExecutionProcessor(
  new PrismaMissionExecutionStore(),
  { allowFixtureTargets: resolveWorkerFixtureTargetAllowance() }
);
const webhookPrisma = getPrismaClient();
const webhookProcessor = createWebhookDeliveryProcessor(webhookPrisma, {
  // Record a tenant-scoped audit row when a delivery is dead-lettered. Written
  // directly (the worker does not depend on the API's writeAuditEvent helper);
  // "webhook_dead_lettered" is the AuditEventAction enum value, "Tenant" the
  // RelatedEntityType (there is no Webhook entity kind).
  onDeadLetter: async (info) => {
    try {
      await webhookPrisma.auditEvent.create({
        data: {
          action: "webhook_dead_lettered",
          actorType: "System",
          entityId: info.webhookId,
          entityType: "Tenant",
          metadata: {
            deliveryId: info.deliveryId,
            eventType: info.eventType,
            lastError: info.lastError
          },
          tenantId: info.tenantId
        }
      });
    } catch (error) {
      logger.error(
        { deliveryId: info.deliveryId, err: error },
        "failed to write webhook dead-letter audit event"
      );
    }
  }
});
const modelGatewayTurnProcessor = createModelGatewayTurnProcessor();
const thirdPartyToolInstallProcessor =
  createThirdPartyToolInstallProcessor(webhookPrisma);

const concurrency = Number.parseInt(
  process.env.PERISCAN_WORKER_CONCURRENCY ?? "",
  10
);

const worker = new Worker(
  validationQueueName,
  async (job) => processor.process(job.data),
  {
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4,
    connection: createRedisConnectionOptions()
  }
);

worker.on("completed", (job) => {
  logger.info(
    { jobId: job.id, requestId: job.data?.requestId ?? null },
    "validation job completed"
  );
});

worker.on("failed", (job, error) => {
  logger.error(
    {
      attempt: job?.attemptsMade ?? 0,
      err: error,
      jobId: job?.id ?? "unknown",
      requestId: job?.data?.requestId ?? null
    },
    "validation job failed"
  );
});

worker.on("error", (error) => {
  logger.error({ err: error }, "validation worker error");
});

const webhookWorker = new Worker(
  WEBHOOK_DELIVERY_QUEUE_NAME,
  async (job) => webhookProcessor.process(job.data),
  {
    connection: createRedisConnectionOptions()
  }
);

webhookWorker.on("failed", (job, error) => {
  logger.error(
    {
      attempt: job?.attemptsMade ?? 0,
      err: error,
      jobId: job?.id ?? "unknown"
    },
    "webhook delivery failed"
  );
});

webhookWorker.on("error", (error) => {
  logger.error({ err: error }, "webhook worker error");
});

const modelGatewayTurnWorker = new Worker(
  MODEL_GATEWAY_TURN_QUEUE_NAME,
  async (job) => modelGatewayTurnProcessor.process(job.data),
  {
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4,
    connection: createRedisConnectionOptions()
  }
);

modelGatewayTurnWorker.on("failed", (job, error) => {
  logger.error(
    {
      attempt: job?.attemptsMade ?? 0,
      err: error,
      jobId: job?.id ?? "unknown"
    },
    "model gateway turn failed"
  );
});

modelGatewayTurnWorker.on("error", (error) => {
  logger.error({ err: error }, "model gateway turn worker error");
});

const retentionIntervalMs = Number.parseInt(
  process.env.PERISCAN_RETENTION_PURGE_INTERVAL_MS ?? "",
  10
);

async function purgeExpiredEvidence() {
  try {
    // runEvidenceRetentionPurge emits the structured evidence.retention.purged
    // log record (for aggregation) AND writes a first-class per-tenant
    // AuditEvent via the default Prisma-backed sink, so no additional logging or
    // audit wiring is needed here on the success path.
    await runEvidenceRetentionPurge();
  } catch (error) {
    logger.error({ err: error }, "evidence retention purge failed");
  }
}

const retentionTimer = setInterval(
  () => {
    void purgeExpiredEvidence();
  },
  Number.isFinite(retentionIntervalMs) && retentionIntervalMs > 0
    ? retentionIntervalMs
    : 24 * 60 * 60 * 1000
);

retentionTimer.unref();
void purgeExpiredEvidence();

const toolInstallWorkerEnabled = resolveThirdPartyToolInstallWorkerEnabled(
  process.env
);
const toolInstallIntervalMs = resolveThirdPartyToolInstallWorkerIntervalMs(
  process.env
);
let toolInstallProcessing = false;
async function processThirdPartyToolInstalls() {
  if (toolInstallProcessing) {
    return;
  }

  toolInstallProcessing = true;
  try {
    const processed = await thirdPartyToolInstallProcessor.processQueuedJobs();

    if (processed.length > 0) {
      logger.info(
        {
          processed
        },
        "third-party tool install jobs processed"
      );
    }
  } catch (error) {
    logger.error({ err: error }, "third-party tool install processing failed");
  } finally {
    toolInstallProcessing = false;
  }
}

const toolInstallTimer = toolInstallWorkerEnabled
  ? setInterval(() => {
      void processThirdPartyToolInstalls();
    }, toolInstallIntervalMs)
  : null;

if (toolInstallTimer) {
  toolInstallTimer.unref();
  void processThirdPartyToolInstalls();
  logger.info(
    {
      execute: process.env.PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE === "true",
      intervalMs: toolInstallIntervalMs
    },
    "third-party tool install worker enabled"
  );
}

async function shutdown(signal: string) {
  logger.info({ signal }, "draining worker before exit");

  try {
    clearInterval(retentionTimer);
    if (toolInstallTimer) {
      clearInterval(toolInstallTimer);
    }
    await worker.close();
    await webhookWorker.close();
    await modelGatewayTurnWorker.close();
    await connection.quit();
  } catch (error) {
    logger.error({ err: error }, "error during worker shutdown");
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

logger.info(
  {
    host: connection.options.host,
    port: connection.options.port,
    queue: validationQueueName
  },
  "periscan worker processing queue"
);
