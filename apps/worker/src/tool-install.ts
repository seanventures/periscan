import type { Prisma, PrismaClient } from "@prisma/client";

import {
  buildOpenSourceToolInstallPlan,
  executeOpenSourceToolInstallPlan,
  getOpenSourceToolCatalogEntryWithRuntime,
  type OpenSourceToolInstallPlan,
  type OpenSourceToolInstallResult
} from "@periscan/modules";
import {
  OpenSourceToolIdSchema,
  type OpenSourceToolId
} from "@periscan/shared";
import type { OpenSourceToolRuntime } from "@periscan/shared";

const GLOBAL_OWNER_KEY = "global";
const DEFAULT_INSTALL_JOB_LIMIT = 5;
const DEFAULT_INSTALL_WORKER_INTERVAL_MS = 60_000;

type DbClient = PrismaClient | Prisma.TransactionClient;

type InstallJobRow = {
  completedAt: Date | null;
  createdAt: Date;
  reason: string | null;
  requestedByUserId: string | null;
  runtimeKind: string | null;
  startedAt: Date | null;
  status: string;
  tenantId: string | null;
  thirdPartyToolInstallJobId: string;
  toolId: string;
};

export interface ThirdPartyToolInstallProcessorOptions {
  buildPlan?: (
    toolId: OpenSourceToolId,
    runtimeKind: OpenSourceToolRuntime | undefined,
    env: NodeJS.ProcessEnv
  ) => Promise<OpenSourceToolInstallPlan>;
  env?: NodeJS.ProcessEnv;
  executePlan?: (
    plan: OpenSourceToolInstallPlan,
    options: { execute: boolean }
  ) => Promise<OpenSourceToolInstallResult>;
  limit?: number;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveThirdPartyToolInstallWorkerEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.PERISCAN_THIRD_PARTY_TOOL_INSTALL_WORKER_ENABLED === "true")
    return true;
  if (env.PERISCAN_THIRD_PARTY_TOOL_INSTALL_WORKER_ENABLED === "false")
    return false;
  // In dev mode, auto-enable the install worker for convenience (reviewed tools only).
  // Production still requires explicit opt-in + execute flag.
  if (env.PERISCAN_DEV_MODE === "true") return true;
  return false;
}

export function resolveThirdPartyToolInstallWorkerIntervalMs(
  env: NodeJS.ProcessEnv = process.env
) {
  return parsePositiveInt(
    env.PERISCAN_THIRD_PARTY_TOOL_INSTALL_WORKER_INTERVAL_MS,
    DEFAULT_INSTALL_WORKER_INTERVAL_MS
  );
}

async function leaseQueuedJob(prisma: DbClient) {
  const job = (await prisma.thirdPartyToolInstallJob.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      action: "Install",
      status: "Queued"
    }
  })) as InstallJobRow | null;

  if (!job) {
    return null;
  }

  const leased = await prisma.thirdPartyToolInstallJob.updateMany({
    data: {
      startedAt: new Date(),
      status: "Running"
    },
    where: {
      status: "Queued",
      thirdPartyToolInstallJobId: job.thirdPartyToolInstallJobId
    }
  });

  return leased.count === 1 ? job : null;
}

async function writeInstallAudit(input: {
  job: InstallJobRow;
  metadata: Record<string, unknown>;
  prisma: DbClient;
  success: boolean;
  toolId: OpenSourceToolId | string;
}) {
  await input.prisma.auditEvent.create({
    data: {
      action: input.success
        ? "third_party_tool_installed"
        : "third_party_tool_install_failed",
      actorType: "System",
      entityId: null,
      entityType: "ThirdPartyTool",
      metadata: {
        ...input.metadata,
        jobId: input.job.thirdPartyToolInstallJobId,
        toolId: input.toolId
      },
      tenantId: input.job.tenantId,
      userId: input.job.requestedByUserId
    }
  });
}

async function markJobFailed(input: {
  job: InstallJobRow;
  output: string;
  prisma: DbClient;
  reason: string;
  toolId: OpenSourceToolId | string;
}) {
  await input.prisma.thirdPartyToolInstallJob.update({
    data: {
      completedAt: new Date(),
      outputRedacted: input.output,
      reason: input.reason,
      status: "Failed"
    },
    where: {
      thirdPartyToolInstallJobId: input.job.thirdPartyToolInstallJobId
    }
  });
  await writeInstallAudit({
    job: input.job,
    metadata: {
      reason: input.reason
    },
    prisma: input.prisma,
    success: false,
    toolId: input.toolId
  });
}

async function updateToolPolicyFromResult(input: {
  job: InstallJobRow;
  plan: OpenSourceToolInstallPlan;
  prisma: DbClient;
  result: OpenSourceToolInstallResult;
}) {
  const ownerKey = input.job.tenantId ?? GLOBAL_OWNER_KEY;
  const entry = await getOpenSourceToolCatalogEntryWithRuntime(
    input.plan.toolId
  );
  const allowedRuntimes =
    entry?.tool.runtimePreference ?? input.plan.tool.runtimePreference;
  const legalReviewStatus =
    input.plan.tool.policyStatus === "RequiresLegalReview"
      ? "RequiresLegalReview"
      : "Approved";
  const governanceStatus =
    input.plan.tool.policyStatus === "RequiresLegalReview"
      ? "LegalReviewRequired"
      : "Enabled";

  await input.prisma.thirdPartyToolPolicy.upsert({
    create: {
      allowedRuntimes,
      disabledReason:
        governanceStatus === "LegalReviewRequired"
          ? "This tool requires legal review before tenant enablement."
          : null,
      enabled: governanceStatus === "Enabled",
      installStatus: input.result.installStatus,
      installedAt:
        input.result.installStatus === "Installed" ? new Date() : null,
      installedVersion:
        input.result.installStatus === "Installed" ? input.plan.version : null,
      lastCheckedAt: new Date(),
      legalReviewStatus,
      ownerKey,
      pinnedGitRef: input.plan.tool.gitRepo ? input.plan.version : null,
      pinnedImageRef: input.plan.tool.dockerImage
        ? `${input.plan.tool.dockerImage}:${input.plan.version}`
        : null,
      pinnedVersion: input.plan.version,
      runtimeAvailable: input.result.runtimeAvailable,
      runtimeKind: input.result.runtimeKind,
      runtimeReason: input.result.runtimeReason,
      status: governanceStatus,
      tenantId: input.job.tenantId,
      toolId: input.plan.toolId
    },
    update: {
      installStatus: input.result.installStatus,
      installedAt:
        input.result.installStatus === "Installed" ? new Date() : undefined,
      installedVersion:
        input.result.installStatus === "Installed"
          ? input.plan.version
          : undefined,
      lastCheckedAt: new Date(),
      runtimeAvailable: input.result.runtimeAvailable,
      runtimeKind: input.result.runtimeKind,
      runtimeReason: input.result.runtimeReason
    },
    where: {
      ownerKey_toolId: {
        ownerKey,
        toolId: input.plan.toolId
      }
    }
  });
}

export function createThirdPartyToolInstallProcessor(
  prisma: DbClient,
  options: ThirdPartyToolInstallProcessorOptions = {}
) {
  const env = options.env ?? process.env;
  const limit = options.limit ?? DEFAULT_INSTALL_JOB_LIMIT;
  const buildPlan = options.buildPlan ?? buildOpenSourceToolInstallPlan;
  const executePlan = options.executePlan ?? executeOpenSourceToolInstallPlan;

  return {
    async processJob(job: InstallJobRow) {
      const toolIdResult = OpenSourceToolIdSchema.safeParse(job.toolId);

      if (!toolIdResult.success) {
        await markJobFailed({
          job,
          output: "Install job references an unknown or unsupported tool ID.",
          prisma,
          reason: "unknown_tool",
          toolId: job.toolId
        });
        return {
          jobId: job.thirdPartyToolInstallJobId,
          status: "Failed" as const
        };
      }

      const runtimeKind = job.runtimeKind as OpenSourceToolRuntime | null;
      const plan = await buildPlan(
        toolIdResult.data,
        runtimeKind ?? undefined,
        env
      );
      const result = await executePlan(plan, {
        execute:
          env.PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE === "true" ||
          env.PERISCAN_DEV_MODE === "true"
      });

      await updateToolPolicyFromResult({
        job,
        plan,
        prisma,
        result
      });
      await prisma.thirdPartyToolInstallJob.update({
        data: {
          completedAt: new Date(),
          outputRedacted: result.outputRedacted,
          reason: result.runtimeReason,
          status: result.jobStatus
        },
        where: {
          thirdPartyToolInstallJobId: job.thirdPartyToolInstallJobId
        }
      });
      await writeInstallAudit({
        job,
        metadata: {
          executed: result.executed,
          runtimeKind: result.runtimeKind,
          runtimeReason: result.runtimeReason
        },
        prisma,
        success: result.success,
        toolId: toolIdResult.data
      });

      return {
        jobId: job.thirdPartyToolInstallJobId,
        status: result.jobStatus
      };
    },

    async processQueuedJobs() {
      const processed: Array<{ jobId: string; status: string }> = [];

      for (let index = 0; index < limit; index += 1) {
        const job = await leaseQueuedJob(prisma);

        if (!job) {
          break;
        }

        try {
          processed.push(await this.processJob(job));
        } catch (error) {
          await markJobFailed({
            job,
            output:
              error instanceof Error ? error.message : "Tool install failed.",
            prisma,
            reason: "tool_install_processor_error",
            toolId: job.toolId
          });
          processed.push({
            jobId: job.thirdPartyToolInstallJobId,
            status: "Failed"
          });
        }
      }

      return processed;
    }
  };
}
