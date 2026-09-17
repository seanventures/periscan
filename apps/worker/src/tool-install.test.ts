import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  OpenSourceToolInstallPlan,
  OpenSourceToolInstallResult
} from "@periscan/modules";

import { createThirdPartyToolInstallProcessor } from "./tool-install.js";

function createQueuedJob() {
  return {
    action: "Install",
    completedAt: null,
    createdAt: new Date("2026-06-27T10:00:00.000Z"),
    outputRedacted: null,
    reason: "Queued platform install.",
    requestedByUserId: randomUUID(),
    runtimeKind: "docker",
    startedAt: null,
    status: "Queued",
    tenantId: randomUUID(),
    thirdPartyToolInstallJobId: randomUUID(),
    toolId: "gitleaks",
    updatedAt: new Date("2026-06-27T10:00:00.000Z")
  };
}

function createPrismaStub(job = createQueuedJob()) {
  const jobs = new Map<string, typeof job>([
    [job.thirdPartyToolInstallJobId, { ...job }]
  ]);
  const policies: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];

  return {
    audits,
    jobs,
    policies,
    prisma: {
      auditEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          audits.push(data);
          return data;
        }
      },
      thirdPartyToolInstallJob: {
        findFirst: async () =>
          [...jobs.values()].find((item) => item.status === "Queued") ?? null,
        update: async ({
          data,
          where
        }: {
          data: Record<string, unknown>;
          where: { thirdPartyToolInstallJobId: string };
        }) => {
          const current = jobs.get(where.thirdPartyToolInstallJobId);

          if (!current) {
            throw new Error("job missing");
          }

          Object.assign(current, data);
          return current;
        },
        updateMany: async ({
          data,
          where
        }: {
          data: Record<string, unknown>;
          where: { status: string; thirdPartyToolInstallJobId: string };
        }) => {
          const current = jobs.get(where.thirdPartyToolInstallJobId);

          if (!current || current.status !== where.status) {
            return {
              count: 0
            };
          }

          Object.assign(current, data);
          return {
            count: 1
          };
        }
      },
      thirdPartyToolPolicy: {
        upsert: async ({
          create,
          update
        }: {
          create: object;
          update: object;
        }) => {
          policies.push({
            create,
            update
          });
          return create;
        }
      }
    }
  };
}

function buildTestPlan(): OpenSourceToolInstallPlan {
  return {
    args: ["pull", "ghcr.io/gitleaks/gitleaks:v8.30.0"],
    command: "docker",
    displayCommand: "docker pull ghcr.io/gitleaks/gitleaks:v8.30.0",
    installable: true,
    noOp: false,
    runtimeKind: "docker",
    tool: {
      binaryName: "gitleaks",
      category: "Secrets",
      defaultVersion: "v8.30.0",
      displayName: "Gitleaks",
      dockerImage: "ghcr.io/gitleaks/gitleaks",
      docsUrl: "https://github.com/gitleaks/gitleaks",
      gitRepo: "https://github.com/gitleaks/gitleaks.git",
      license: "MIT",
      moduleIds: ["gitleaks.repo_secrets"],
      notes: "Test tool.",
      npmPackage: null,
      phase: "Current",
      pipPackage: null,
      policyStatus: "Enabled",
      runtimePreference: ["docker"],
      toolId: "gitleaks"
    },
    toolId: "gitleaks",
    version: "v8.30.0"
  };
}

describe("third-party tool install worker", () => {
  it("processes queued install jobs through the controlled executor", async () => {
    const state = createPrismaStub();
    const result: OpenSourceToolInstallResult = {
      executed: true,
      installStatus: "Installed",
      jobStatus: "Completed",
      outputRedacted: "pulled image",
      runtimeAvailable: true,
      runtimeKind: "docker",
      runtimeReason: "Install job completed.",
      success: true
    };
    const processor = createThirdPartyToolInstallProcessor(
      state.prisma as never,
      {
        buildPlan: async () => buildTestPlan(),
        executePlan: async () => result,
        limit: 1
      }
    );

    const processed = await processor.processQueuedJobs();
    const job = [...state.jobs.values()][0]!;

    expect(processed).toEqual([
      {
        jobId: job.thirdPartyToolInstallJobId,
        status: "Completed"
      }
    ]);
    expect(job.status).toBe("Completed");
    expect(job.outputRedacted).toBe("pulled image");
    expect(state.policies[0]).toMatchObject({
      create: {
        installStatus: "Installed",
        runtimeAvailable: true,
        runtimeKind: "docker"
      }
    });
    expect(state.audits[0]).toMatchObject({
      action: "third_party_tool_installed",
      actorType: "System",
      entityType: "ThirdPartyTool"
    });
  });

  it("records disabled platform execution as a denied install job", async () => {
    const state = createPrismaStub();
    const result: OpenSourceToolInstallResult = {
      executed: false,
      installStatus: "Skipped",
      jobStatus: "Denied",
      outputRedacted: "execution disabled",
      runtimeAvailable: false,
      runtimeKind: "docker",
      runtimeReason: "Install execution disabled.",
      success: false
    };
    const processor = createThirdPartyToolInstallProcessor(
      state.prisma as never,
      {
        buildPlan: async () => buildTestPlan(),
        executePlan: async () => result,
        limit: 1
      }
    );

    await processor.processQueuedJobs();
    const job = [...state.jobs.values()][0]!;

    expect(job.status).toBe("Denied");
    expect(state.policies[0]).toMatchObject({
      create: {
        installStatus: "Skipped",
        runtimeAvailable: false
      }
    });
    expect(state.audits[0]).toMatchObject({
      action: "third_party_tool_install_failed",
      metadata: expect.objectContaining({
        executed: false,
        toolId: "gitleaks"
      })
    });
  });
});
