import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL,
  COMMUNITY_FIRST_RUN_REVIEW_LABEL,
  COMMUNITY_FIRST_RUN_START_LABEL,
  COMMUNITY_FIRST_RUN_WATCH_LABEL
} from "@periscan/shared";

import type { RuntimeServiceDeps } from "../runtime-services.js";
import { createTenantServices } from "./tenant.js";

describe("product activation Community nextAction", () => {
  const tenantId = randomUUID();
  const membershipId = randomUUID();
  const userId = randomUUID();
  const missionId = randomUUID();
  const communityMissionId = randomUUID();
  const now = new Date("2026-08-15T12:00:00.000Z");

  const context = {
    membership: { membershipId, role: "Owner" as const, tenantId, userId },
    tenant: { tenantId },
    user: { userId }
  };

  const membership = {
    createdAt: now,
    experienceProfileCompletedAt: now,
    membershipId,
    primaryOutcome: "RunProofLoop",
    productPersona: "SecurityEngineer",
    updatedAt: now
  };

  const connectedSource = {
    createdAt: now,
    healthStatus: "Healthy",
    product: "GitHub",
    status: "Connected",
    updatedAt: now,
    vendor: "GitHub"
  };

  const verifiedScope = {
    updatedAt: now,
    value: "app.example.com",
    verificationStatus: "Verified",
    verifiedAt: now
  };

  const policyDecision = {
    createdAt: now,
    outcome: "Allowed"
  };

  const mission = {
    createdAt: now,
    missionId
  };

  function communityRun(input: {
    errorSummary?: string | null;
    moduleId?: string;
    status: "Queued" | "Running" | "Failed" | "Completed";
  }) {
    return {
      completedAt: input.status === "Completed" ? now : null,
      errorSummary: input.errorSummary ?? null,
      evidenceIds: [] as string[],
      missionId: communityMissionId,
      moduleId: input.moduleId ?? "gitleaks.repo_secrets",
      runId: randomUUID(),
      status: input.status,
      updatedAt: now
    };
  }

  function buildServices(input: {
    communityRun?: ReturnType<typeof communityRun> | null;
    failedRun?: ReturnType<typeof communityRun> | null;
    inFlightRun?: ReturnType<typeof communityRun> | null;
    measuredRun?: {
      completedAt: Date;
      evidenceIds: string[];
      missionId: string;
      moduleId: string;
      runId: string;
      status: "Completed";
      updatedAt: Date;
    } | null;
    mission?: { createdAt: Date; missionId: string } | null;
    source?: typeof connectedSource | null;
  }) {
    const prisma = {
      membership: {
        findUniqueOrThrow: vi.fn(async () => membership)
      },
      integration: {
        findFirst: vi.fn(async () =>
          input.source === undefined ? connectedSource : input.source
        )
      },
      scope: {
        findFirst: vi.fn(async () => verifiedScope)
      },
      policyDecision: {
        findFirst: vi.fn(async () => policyDecision)
      },
      validationMission: {
        findFirst: vi.fn(async () => input.mission ?? mission)
      },
      validationRun: {
        findFirst: vi.fn(
          async ({ where }: { where?: Record<string, unknown> }) => {
            const statusFilter = where?.status;
            const inFlightStatuses =
              statusFilter &&
              typeof statusFilter === "object" &&
              Array.isArray((statusFilter as { in?: unknown }).in)
                ? (statusFilter as { in: string[] }).in
                : null;
            if (statusFilter === "Completed") {
              return input.measuredRun ?? null;
            }
            if (statusFilter === "Failed") {
              return input.failedRun ?? null;
            }
            if (
              inFlightStatuses &&
              (inFlightStatuses.includes("Queued") ||
                inFlightStatuses.includes("Running"))
            ) {
              if (input.inFlightRun !== undefined) {
                return input.inFlightRun;
              }
              if (
                input.communityRun &&
                (input.communityRun.status === "Queued" ||
                  input.communityRun.status === "Running") &&
                (!where?.missionId ||
                  where.missionId === input.communityRun.missionId)
              ) {
                return input.communityRun;
              }
              return null;
            }
            if (where && "moduleId" in where) {
              return input.communityRun ?? null;
            }
            return null;
          }
        )
      },
      remediationTask: {
        findFirst: vi.fn(async () => null)
      },
      verificationEvent: {
        findFirst: vi.fn(async () => null)
      },
      reportShare: {
        findFirst: vi.fn(async () => null)
      },
      evidencePack: {
        findFirst: vi.fn(async () => null)
      }
    };

    return createTenantServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      prisma,
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);
  }

  it("starts Community validation when no Community mission or run exists", async () => {
    const services = buildServices({
      communityRun: null,
      mission
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(
      activation.milestones.find(
        (milestone) => milestone.key === "MeasuredResult"
      )
    ).toMatchObject({ state: "Current" });
    expect(activation.nextAction).toMatchObject({
      href: "/missions",
      label: COMMUNITY_FIRST_RUN_START_LABEL
    });
  });

  it("watches a queued Community run without marking MeasuredResult complete", async () => {
    const run = communityRun({ status: "Queued" });
    const services = buildServices({
      communityRun: run,
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );
    const measured = activation.milestones.find(
      (milestone) => milestone.key === "MeasuredResult"
    );

    expect(measured).toMatchObject({
      href: `/missions/${communityMissionId}`,
      state: "Current"
    });
    expect(activation.nextAction).toEqual({
      href: `/missions/${communityMissionId}`,
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
      reason:
        "Community validation is already in flight. Watch the mission until it captures evidence."
    });
  });

  it("watches a running Community run", async () => {
    const services = buildServices({
      communityRun: communityRun({ status: "Running" }),
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(activation.nextAction).toMatchObject({
      href: `/missions/${communityMissionId}`,
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL
    });
  });

  it("watches while a sibling Community run is still Running even if another run on the same mission has evidence", async () => {
    const runningCheckov = communityRun({
      moduleId: "checkov.iac_posture",
      status: "Running"
    });
    const measuredTrivy = {
      completedAt: now,
      evidenceIds: [randomUUID()],
      missionId: communityMissionId,
      moduleId: "trivy.repo_dependency_scan",
      runId: randomUUID(),
      status: "Completed" as const,
      updatedAt: now
    };
    const services = buildServices({
      communityRun: runningCheckov,
      measuredRun: measuredTrivy,
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );
    const measured = activation.milestones.find(
      (milestone) => milestone.key === "MeasuredResult"
    );

    expect(activation.maturity).toBe("Activating");
    expect(measured).toMatchObject({
      href: `/missions/${communityMissionId}`,
      state: "Current"
    });
    expect(measured?.completedAt).toBeNull();
    expect(activation.nextAction).toEqual({
      href: `/missions/${communityMissionId}`,
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
      reason:
        "Community validation is already in flight. Watch the mission until it captures evidence."
    });
  });

  it("watches an in-flight sibling even when the latest Community candidate already completed with evidence", async () => {
    const completedTrivy = {
      ...communityRun({
        moduleId: "trivy.repo_dependency_scan",
        status: "Completed"
      }),
      completedAt: now,
      evidenceIds: [randomUUID()]
    };
    const runningCheckov = communityRun({
      moduleId: "checkov.iac_posture",
      status: "Running"
    });
    const services = buildServices({
      communityRun: completedTrivy,
      inFlightRun: runningCheckov,
      measuredRun: {
        completedAt: now,
        evidenceIds: completedTrivy.evidenceIds,
        missionId: communityMissionId,
        moduleId: completedTrivy.moduleId,
        runId: completedTrivy.runId,
        status: "Completed",
        updatedAt: now
      },
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );
    const measured = activation.milestones.find(
      (milestone) => milestone.key === "MeasuredResult"
    );

    expect(activation.maturity).toBe("Activating");
    expect(measured).toMatchObject({
      href: `/missions/${communityMissionId}`,
      state: "Current"
    });
    expect(measured?.completedAt).toBeNull();
    expect(activation.nextAction).toEqual({
      href: `/missions/${communityMissionId}`,
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
      reason:
        "Community validation is already in flight. Watch the mission until it captures evidence."
    });
  });

  it("watches an in-flight Community mission even when SourceConnected is still empty", async () => {
    const runningCheckov = communityRun({
      moduleId: "checkov.iac_posture",
      status: "Running"
    });
    const services = buildServices({
      communityRun: runningCheckov,
      measuredRun: {
        completedAt: now,
        evidenceIds: [randomUUID()],
        missionId: communityMissionId,
        moduleId: "trivy.repo_dependency_scan",
        runId: randomUUID(),
        status: "Completed",
        updatedAt: now
      },
      mission: { createdAt: now, missionId: communityMissionId },
      source: null
    });

    const activation = await services.getProductActivationState(
      context as never
    );
    const measured = activation.milestones.find(
      (milestone) => milestone.key === "MeasuredResult"
    );
    const sourceConnected = activation.milestones.find(
      (milestone) => milestone.key === "SourceConnected"
    );

    expect(activation.maturity).toBe("Activating");
    expect(sourceConnected?.state).not.toBe("Current");
    expect(measured).toMatchObject({
      href: `/missions/${communityMissionId}`,
      state: "Current"
    });
    expect(activation.nextAction.label).toBe(COMMUNITY_FIRST_RUN_WATCH_LABEL);
    expect(activation.nextAction.label).not.toBe("Connect a source");
  });

  it("reviews a failed Community run and keeps the blocking diagnostic", async () => {
    const run = communityRun({
      errorSummary: "gitleaks exited 2",
      status: "Failed"
    });
    const services = buildServices({
      communityRun: run,
      failedRun: run,
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(activation.nextAction).toEqual({
      href: `/missions/${communityMissionId}`,
      label: COMMUNITY_FIRST_RUN_REVIEW_LABEL,
      reason: "gitleaks exited 2"
    });
    expect(activation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "latest_run_failed",
        href: `/missions/${communityMissionId}`,
        severity: "Blocking",
        title: "Latest Community validation needs recovery"
      })
    );
    expect(
      activation.milestones.find(
        (milestone) => milestone.key === "MeasuredResult"
      )?.state
    ).toBe("Current");
  });

  it("does not complete MeasuredResult from a Community run without evidence", async () => {
    const services = buildServices({
      communityRun: communityRun({ status: "Completed" }),
      measuredRun: null,
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(
      activation.milestones.find(
        (milestone) => milestone.key === "MeasuredResult"
      )?.state
    ).toBe("Current");
    expect(activation.nextAction.label).toBe(
      COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL
    );
  });

  it("keeps MeasuredResult complete only when a run has evidence", async () => {
    const runId = randomUUID();
    const services = buildServices({
      communityRun: {
        ...communityRun({ status: "Completed" }),
        evidenceIds: [randomUUID()],
        completedAt: now
      },
      measuredRun: {
        completedAt: now,
        evidenceIds: [randomUUID()],
        missionId: communityMissionId,
        moduleId: "gitleaks.repo_secrets",
        runId,
        status: "Completed",
        updatedAt: now
      },
      mission: { createdAt: now, missionId: communityMissionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(
      activation.milestones.find(
        (milestone) => milestone.key === "MeasuredResult"
      )?.state
    ).toBe("Completed");
    expect(activation.nextAction.label).not.toBe(
      COMMUNITY_FIRST_RUN_WATCH_LABEL
    );
    expect(activation.nextAction.label).not.toBe(
      COMMUNITY_FIRST_RUN_START_LABEL
    );
  });

  it("ignores a non-Community moduleId even if it is returned as a candidate", async () => {
    const services = buildServices({
      communityRun: communityRun({
        moduleId: "caldera.advanced_adversarial",
        status: "Running"
      }),
      mission: { createdAt: now, missionId }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(activation.nextAction).toMatchObject({
      href: "/missions",
      label: COMMUNITY_FIRST_RUN_START_LABEL
    });
  });
});

describe("product activation first-run diagnostic ranking", () => {
  const tenantId = randomUUID();
  const membershipId = randomUUID();
  const userId = randomUUID();
  const now = new Date("2026-08-15T12:00:00.000Z");

  const context = {
    membership: { membershipId, role: "Owner" as const, tenantId, userId },
    tenant: { tenantId },
    user: { userId }
  };

  const membership = {
    createdAt: now,
    experienceProfileCompletedAt: now,
    membershipId,
    primaryOutcome: "RunProofLoop",
    productPersona: "SecurityEngineer",
    updatedAt: now
  };

  function buildServices(input: {
    connectedSource?: {
      createdAt: Date;
      healthStatus: string;
      product: string;
      status: string;
      updatedAt: Date;
      vendor: string;
    } | null;
    latestSource?: {
      createdAt: Date;
      healthStatus: string;
      product: string;
      status: string;
      updatedAt: Date;
      vendor: string;
    } | null;
    measuredRun?: {
      completedAt: Date;
      evidenceIds: string[];
      missionId: string;
      moduleId: string;
      runId: string;
      status: "Completed";
      updatedAt: Date;
    } | null;
    mission?: { createdAt: Date; missionId: string } | null;
    verifiedScope?: {
      updatedAt: Date;
      value: string;
      verificationStatus: string;
      verifiedAt: Date;
    } | null;
  }) {
    const prisma = {
      membership: {
        findUniqueOrThrow: vi.fn(async () => membership)
      },
      integration: {
        findFirst: vi.fn(
          async ({ where }: { where?: Record<string, unknown> }) => {
            if (where?.status === "Connected") {
              return input.connectedSource ?? null;
            }
            return input.latestSource ?? input.connectedSource ?? null;
          }
        )
      },
      scope: {
        findFirst: vi.fn(
          async ({ where }: { where?: Record<string, unknown> }) => {
            if (where?.verificationStatus === "Verified") {
              return input.verifiedScope ?? null;
            }
            return input.verifiedScope ?? null;
          }
        )
      },
      policyDecision: {
        findFirst: vi.fn(async () => null)
      },
      validationMission: {
        findFirst: vi.fn(async () => input.mission ?? null)
      },
      validationRun: {
        findFirst: vi.fn(
          async ({ where }: { where?: Record<string, unknown> }) => {
            if (where?.status === "Completed") {
              return input.measuredRun ?? null;
            }
            return null;
          }
        )
      },
      remediationTask: {
        findFirst: vi.fn(async () => null)
      },
      verificationEvent: {
        findFirst: vi.fn(async () => null)
      },
      reportShare: {
        findFirst: vi.fn(async () => null)
      },
      evidencePack: {
        findFirst: vi.fn(async () => null)
      }
    };

    return createTenantServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      prisma,
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);
  }

  it("ranks no-scope Attention ahead of optional source_missing Info on a New tenant", async () => {
    const services = buildServices({});

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(activation.maturity).toBe("New");
    expect(activation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "scope_missing",
          severity: "Attention"
        }),
        expect.objectContaining({
          code: "source_missing",
          severity: "Info"
        })
      ])
    );
    const codes = activation.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes.indexOf("scope_missing")).toBeGreaterThanOrEqual(0);
    expect(codes.indexOf("source_missing")).toBeGreaterThanOrEqual(0);
    expect(codes.indexOf("scope_missing")).toBeLessThan(
      codes.indexOf("source_missing")
    );
  });

  it("keeps source_missing optional Info after a verified scope (Activating)", async () => {
    const services = buildServices({
      verifiedScope: {
        updatedAt: now,
        value: "app.example.com",
        verificationStatus: "Verified",
        verifiedAt: now
      }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(activation.maturity).toBe("Activating");
    expect(
      activation.diagnostics.find(
        (diagnostic) => diagnostic.code === "scope_missing"
      )
    ).toBeUndefined();
    expect(
      activation.diagnostics.find(
        (diagnostic) => diagnostic.code === "source_missing"
      )
    ).toMatchObject({ severity: "Info" });
  });

  it("restores source_missing Attention once the tenant is Measured", async () => {
    const services = buildServices({
      measuredRun: {
        completedAt: now,
        evidenceIds: [randomUUID()],
        missionId: randomUUID(),
        moduleId: "gitleaks.repo_secrets",
        runId: randomUUID(),
        status: "Completed",
        updatedAt: now
      },
      verifiedScope: {
        updatedAt: now,
        value: "app.example.com",
        verificationStatus: "Verified",
        verifiedAt: now
      }
    });

    const activation = await services.getProductActivationState(
      context as never
    );

    expect(activation.maturity).toBe("Measured");
    expect(
      activation.diagnostics.find(
        (diagnostic) => diagnostic.code === "source_missing"
      )
    ).toMatchObject({ severity: "Attention" });
  });
});
