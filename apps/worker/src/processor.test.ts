import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  encryptIntegrationConfig,
  type ProwlerAwsIntegrationRecord
} from "@periscan/connectors";
import * as modules from "@periscan/modules";
import type { ModuleOutput } from "@periscan/modules";
import type {
  EvidenceArtifact,
  SignalEnvelope,
  ValidationJobPayload,
  ValidationMission,
  ValidationRun
} from "@periscan/shared";

import {
  createMissionExecutionProcessor,
  getSignalGraphProjection,
  type LoadedValidationJob,
  type MissionExecutionStore
} from "./processor.js";

function createExecution(
  moduleId: string,
  target: Record<string, unknown>,
  safetyLevel: ValidationRun["safetyLevel"] = moduleId ===
  "nuclei.external_exposure_safe"
    ? "ActiveNonInvasive"
    : "PassiveReadOnly"
): {
  execution: LoadedValidationJob;
  payload: ValidationJobPayload;
} {
  const tenantId = randomUUID();
  const missionId = randomUUID();
  const runId = randomUUID();
  const jobId = randomUUID();

  return {
    execution: {
      job: {
        attempts: 0,
        jobId,
        missionId,
        status: "Queued",
        tenantId,
        validationRunId: runId
      },
      mission: {
        missionId,
        status: "Queued",
        tenantId
      },
      run: {
        missionId,
        moduleId,
        policyDecisionId: randomUUID(),
        runId,
        runnerId: null,
        safetyLevel,
        scopeId: randomUUID(),
        status: "Queued",
        target,
        tenantId
      }
    },
    payload: {
      jobId,
      missionId,
      runId,
      tenantId
    }
  };
}

class InMemoryMissionExecutionStore implements MissionExecutionStore {
  public readonly auditEvents: Array<Record<string, unknown>> = [];
  public readonly graphEvents: Array<Record<string, unknown>> = [];
  public mission: ValidationMission;
  public readonly persistedArtifacts: EvidenceArtifact[] = [];
  public readonly persistedSignals: SignalEnvelope[] = [];
  public readonly hopAutoApplies: Array<{
    evidenceIds: string[];
    pathEdgeId: string | null;
  }> = [];
  public tenantIntegration: ProwlerAwsIntegrationRecord | null = null;
  public run: ValidationRun;

  constructor(private readonly execution: LoadedValidationJob) {
    const timestamp = new Date().toISOString();

    this.mission = {
      completedAt: null,
      createdAt: timestamp,
      evidenceIds: [],
      missionId: execution.mission.missionId,
      missionType: "ExposureValidation",
      policyDecisionId: execution.run.policyDecisionId,
      policyProfile: null,
      requestedBy: randomUUID(),
      safetyLevel: execution.run.safetyLevel,
      scopeId: execution.run.scopeId,
      scopeIds: [execution.run.scopeId],
      startedAt: null,
      status: execution.mission.status,
      tenantId: execution.mission.tenantId,
      updatedAt: timestamp
    };
    this.run = {
      completedAt: null,
      createdAt: timestamp,
      errorSummary: null,
      evidenceIds: [],
      missionId: execution.run.missionId,
      moduleId: execution.run.moduleId,
      outcome: null,
      policyDecisionId: execution.run.policyDecisionId,
      runId: execution.run.runId,
      runnerId: execution.run.runnerId,
      safetyLevel: execution.run.safetyLevel,
      scopeId: execution.run.scopeId,
      startedAt: null,
      status: execution.run.status,
      target: execution.run.target,
      tenantId: execution.run.tenantId,
      updatedAt: timestamp,
      validationState: null
    };
  }

  async loadExecution() {
    return this.execution;
  }

  async loadTenantIntegration() {
    return this.tenantIntegration;
  }

  async markRunning() {
    const timestamp = new Date().toISOString();

    this.mission = {
      ...this.mission,
      startedAt: timestamp,
      status: "Running",
      updatedAt: timestamp
    };
    this.run = {
      ...this.run,
      startedAt: timestamp,
      status: "Running",
      updatedAt: timestamp
    };
  }

  async persistSignals(signals: SignalEnvelope[]) {
    this.persistedSignals.push(...signals);
  }

  async attachEvidenceIdsToRun(
    _execution: LoadedValidationJob,
    evidenceIds: string[]
  ) {
    this.run = {
      ...this.run,
      evidenceIds: [...new Set([...this.run.evidenceIds, ...evidenceIds])]
    };
  }

  async autoApplyHopReceipt(
    execution: LoadedValidationJob,
    _result: ModuleOutput,
    evidenceIds: string[]
  ) {
    const pathEdgeId =
      typeof execution.run.target.pathEdgeId === "string"
        ? execution.run.target.pathEdgeId
        : null;
    this.hopAutoApplies.push({ evidenceIds, pathEdgeId });
  }

  async persistEvidence(_execution: LoadedValidationJob, result: ModuleOutput) {
    const timestamp = new Date().toISOString();
    const artifact: EvidenceArtifact = {
      artifactType: "RawModuleOutput",
      createdAt: timestamp,
      evidenceId: randomUUID(),
      redactionStatus: "Redacted",
      relatedEntityId: this.run.runId,
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "High",
      sha256: "fixture-sha256",
      storageUri: "memory://raw-output",
      tenantId: this.run.tenantId,
      updatedAt: timestamp
    };

    this.persistedArtifacts.push(artifact);

    for (const evidence of result.evidence) {
      this.persistedArtifacts.push({
        artifactType: evidence.artifactType,
        createdAt: timestamp,
        evidenceId: randomUUID(),
        redactionStatus: evidence.redactionStatus,
        relatedEntityId: this.run.runId,
        relatedEntityType: "ValidationRun",
        sensitivityLevel: evidence.sensitivityLevel,
        sha256: "fixture-sha256",
        storageUri: `memory://${evidence.artifactType}`,
        tenantId: this.run.tenantId,
        updatedAt: timestamp
      });
    }

    return this.persistedArtifacts;
  }

  async markCompleted(_execution: LoadedValidationJob, result: ModuleOutput) {
    const timestamp = new Date().toISOString();

    this.run = {
      ...this.run,
      completedAt: timestamp,
      evidenceIds: this.persistedArtifacts.map(
        (artifact) => artifact.evidenceId
      ),
      outcome: result.outcome,
      status: "Completed",
      updatedAt: timestamp,
      validationState: result.validationState ?? null
    };
  }

  async markFailed(_execution: LoadedValidationJob, errorSummary: string) {
    const timestamp = new Date().toISOString();

    this.run = {
      ...this.run,
      completedAt: timestamp,
      errorSummary,
      outcome: "failed",
      status: "Failed",
      updatedAt: timestamp,
      validationState: null
    };
  }
  async markRunSkipped(
    _execution: LoadedValidationJob,
    reason: string
  ) {
    const timestamp = new Date().toISOString();

    this.run = {
      ...this.run,
      completedAt: timestamp,
      errorSummary: reason,
      outcome: "skipped",
      status: "Cancelled",
      updatedAt: timestamp,
      validationState: null
    };
  }

  async recordModuleExecuted(
    _execution: LoadedValidationJob,
    result: ModuleOutput
  ) {
    this.auditEvents.push({
      action: "module.executed",
      outcome: result.outcome,
      signalCount: result.signals.length
    });
  }

  async projectGraph(
    _execution: LoadedValidationJob,
    signals: SignalEnvelope[],
    evidenceArtifacts: EvidenceArtifact[]
  ) {
    this.graphEvents.push({
      evidenceArtifactCount: evidenceArtifacts.length,
      signalCount: signals.length
    });
  }

  async reconcileMissionStatus() {
    const timestamp = new Date().toISOString();

    this.mission = {
      ...this.mission,
      completedAt:
        this.run.status === "Completed" || this.run.status === "Failed"
          ? timestamp
          : null,
      status:
        this.run.status === "Completed"
          ? "Completed"
          : this.run.status === "Failed"
            ? "Failed"
            : "Running",
      updatedAt: timestamp
    };
  }
}

describe("mission execution processor", () => {
  it("projects exposure signals into exposure graph nodes", () => {
    const projection = getSignalGraphProjection({
      confidence: 0.95,
      createdAt: new Date().toISOString(),
      evidenceIds: [],
      freshness: "Fresh",
      rawPayloadPointer: "gitleaks://fixture",
      redactionStatus: "Redacted",
      relatedAssetIds: [],
      relatedControlIds: [],
      relatedEvidenceIds: [],
      relatedIdentityIds: [],
      relatedPathIds: [],
      sensitivityLevel: "High",
      signalCategory: "Exposure",
      signalId: randomUUID(),
      signalSubcategory: "SecretExposure",
      sourceIntegrationId: null,
      sourceType: "gitleaks.repo_secrets.scan",
      sourceVendor: "Gitleaks",
      tenantId: randomUUID(),
      timestampIngested: new Date().toISOString(),
      timestampObserved: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(projection.nodeType).toBe("Exposure.SecretExposure");
    expect(projection.nodeKey).toMatch(/^exposure:/);
  });

  it("processes a queued job and persists normalized signals", async () => {
    const fixtureRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../packages/modules/fixtures"
    );
    const { execution, payload } = createExecution(
      "trivy.repo_dependency_scan",
      {
        fixtureMode: true,
        fixtureReportPath: path.join(
          fixtureRoot,
          "trivy/repo-dependency-fixture.json"
        ),
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }
    );
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store, {
      allowFixtureTargets: true
    });

    const result = await processor.process(payload);

    expect(result.validationState).toBe("Validated");
    expect(result.signals[0]?.evidenceIds.length).toBeGreaterThan(0);
    expect(store.persistedArtifacts.length).toBeGreaterThan(1);
    expect(store.persistedSignals.length).toBeGreaterThan(0);
    expect(store.graphEvents).toHaveLength(1);
    expect(store.run.status).toBe("Completed");
    expect(store.mission.status).toBe("Completed");
    expect(store.auditEvents).toHaveLength(1);
  });

  it("skips cancelled jobs without reviving them as running", async () => {
    const { execution, payload } = createExecution(
      "trivy.repo_dependency_scan",
      {
        fixtureMode: true,
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }
    );
    execution.job.status = "Cancelled";
    execution.mission.status = "Cancelled";
    execution.run.status = "Cancelled";
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store, {
      allowFixtureTargets: true
    });

    const result = await processor.process(payload);

    expect(result).toMatchObject({
      outcome: "skipped",
      validationState: "Inconclusive"
    });
    expect(store.run.status).toBe("Cancelled");
    expect(store.mission.status).toBe("Cancelled");
    expect(store.run.startedAt).toBeNull();
    expect(store.persistedArtifacts).toHaveLength(0);
    expect(store.persistedSignals).toHaveLength(0);
    expect(store.graphEvents).toHaveLength(0);
    expect(store.auditEvents).toHaveLength(0);
  });

  it("fails queued fixture targets by default before module execution", async () => {
    const { execution, payload } = createExecution(
      "trivy.repo_dependency_scan",
      {
        fixtureMode: true,
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }
    );
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store);

    await expect(processor.process(payload)).rejects.toThrow(
      /fixture validation targets are disabled/i
    );
    expect(store.run.status).toBe("Failed");
    expect(store.mission.status).toBe("Failed");
    expect(store.run.startedAt).toBeNull();
    expect(store.persistedArtifacts).toHaveLength(0);
    expect(store.persistedSignals).toHaveLength(0);
    expect(store.graphEvents).toHaveLength(0);
    expect(store.auditEvents).toHaveLength(0);
  });

  it("rejects InternalRunner modules in the control-plane worker instead of fabricating results", async () => {
    const { execution, payload } = createExecution(
      "runner.reachability_check",
      {
        ports: [443],
        targetHost: "app-01.corp.example.internal",
        timeoutSeconds: 5
      },
      "ActiveNonInvasive"
    );
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store);

    await expect(processor.process(payload)).rejects.toThrow(
      /internal runner/i
    );
    expect(store.run.status).toBe("Failed");
    expect(store.persistedSignals).toHaveLength(0);
    expect(store.persistedArtifacts).toHaveLength(0);
    // The control-plane worker must never call markRunning for runner modules.
    expect(store.run.startedAt).toBeNull();
  });

  it("processes newly productized OSS modules through the worker path", async () => {
    const fixtureRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../packages/modules/fixtures"
    );
    const jobs = [
      createExecution("trivy.repo_dependency_scan", {
        fixtureMode: true,
        fixtureReportPath: path.join(
          fixtureRoot,
          "trivy/repo-dependency-fixture.json"
        ),
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }),
      createExecution("osv.repo_dependency_scan", {
        fixtureMode: true,
        fixtureReportPath: path.join(
          fixtureRoot,
          "osv/repo-advisory-fixture.json"
        ),
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }),
      createExecution("bloodhound.identity_pathing", {
        fixtureGraphPath: path.join(
          fixtureRoot,
          "bloodhound/identity-graph-fixture.json"
        ),
        graphName: "demo-identity"
      })
    ];

    for (const { execution, payload } of jobs) {
      const store = new InMemoryMissionExecutionStore(execution);
      const processor = createMissionExecutionProcessor(store, {
        allowFixtureTargets: true
      });
      const result = await processor.process(payload);

      // Graph import is not hop measurement — BloodHound stays Inconclusive.
      const expectedState =
        execution.run.moduleId === "bloodhound.identity_pathing"
          ? "Inconclusive"
          : "Validated";
      expect(
        result.validationState,
        `${execution.run.moduleId} outcome=${result.outcome}`
      ).toBe(expectedState);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(
        result.signals.every((signal) => signal.evidenceIds.length > 0)
      ).toBe(true);
      expect(store.persistedArtifacts.length).toBeGreaterThan(1);
      expect(store.persistedSignals.length).toBeGreaterThan(0);
      expect(store.graphEvents).toHaveLength(1);
      expect(store.run.status).toBe("Completed");
    }
  });

  it("auto-applies a hop receipt after hop-bound completion with evidence", async () => {
    const fixtureRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../packages/modules/fixtures"
    );
    const pathEdgeId = randomUUID();
    const { execution, payload } = createExecution(
      "trivy.repo_dependency_scan",
      {
        attackPathId: randomUUID(),
        fixtureMode: true,
        fixtureReportPath: path.join(
          fixtureRoot,
          "trivy/repo-dependency-fixture.json"
        ),
        hopKey: "edge-0",
        pathEdgeId,
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }
    );
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store, {
      allowFixtureTargets: true
    });

    const result = await processor.process(payload);

    expect(result.validationState).toBe("Validated");
    expect(store.run.status).toBe("Completed");
    expect(store.hopAutoApplies).toHaveLength(1);
    expect(store.hopAutoApplies[0]?.pathEdgeId).toBe(pathEdgeId);
    expect(store.hopAutoApplies[0]?.evidenceIds.length).toBeGreaterThan(0);
    expect(store.run.evidenceIds.length).toBeGreaterThan(0);
  });

  it("does not auto-apply a hop receipt when the job is cancelled", async () => {
    const { execution, payload } = createExecution(
      "trivy.repo_dependency_scan",
      {
        attackPathId: randomUUID(),
        fixtureMode: true,
        pathEdgeId: randomUUID(),
        repositoryName: "periscan-fixtures/demo-app",
        repositoryPath: "/tmp/demo-app"
      }
    );
    execution.job.status = "Cancelled";
    execution.mission.status = "Cancelled";
    execution.run.status = "Cancelled";
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store, {
      allowFixtureTargets: true
    });

    await processor.process(payload);

    expect(store.hopAutoApplies).toHaveLength(0);
  });

  it("marks the run and mission as failed when module execution errors", async () => {
    const { execution, payload } = createExecution("gitleaks.repo_secrets", {});
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store);

    await expect(processor.process(payload)).rejects.toThrow(/repositoryPath/i);
    expect(store.run.status).toBe("Failed");
    expect(store.mission.status).toBe("Failed");
    expect(store.persistedSignals).toHaveLength(0);
  });

  it("fails Prowler honestly when the stored AWS integration is missing", async () => {
    const awsIntegrationId = randomUUID();
    const { execution, payload } = createExecution("prowler.aws_posture", {
      awsAccountId: "123456789012",
      awsIntegrationId
    });
    const store = new InMemoryMissionExecutionStore(execution);
    const processor = createMissionExecutionProcessor(store);

    const result = await processor.process(payload);

    expect(result.outcome).toBe("tool_unavailable");
    expect(result.validationState).toBe("Inconclusive");
    expect(result.errors.join(" ")).toMatch(/not found/i);
    expect(result.evidence).toHaveLength(0);
    expect(execution.run.target).toEqual({
      awsAccountId: "123456789012",
      awsIntegrationId
    });
    expect(JSON.stringify(execution.run.target)).not.toMatch(/AWS_SECRET/i);
    expect(store.run.status).toBe("Completed");
  });

  it("injects decrypted AWS env into Prowler without persisting secrets on the target", async () => {
    const accessKey = "test-aws-access-key";
    const secretKey = "test-aws-secret-key";
    const awsIntegrationId = randomUUID();
    const { execution, payload } = createExecution("prowler.aws_posture", {
      awsAccountId: "123456789012",
      awsIntegrationId
    });
    const store = new InMemoryMissionExecutionStore(execution);
    store.tenantIntegration = {
      authType: "staticCredentials",
      config: encryptIntegrationConfig(
        {
          accessKeyId: accessKey,
          connectorKey: "aws",
          region: "us-east-1",
          secretAccessKey: secretKey
        },
        ["accessKeyId", "secretAccessKey", "sessionToken"]
      ),
      product: "AWS",
      status: "Connected",
      vendor: "AWS"
    };
    const execute = vi.spyOn(modules, "executeModuleById").mockResolvedValue({
      errors: [],
      evidence: [],
      outcome: "no_cloud_misconfiguration_observed",
      signals: [],
      summary: "Prowler identified no AWS posture issues in 123456789012.",
      validationState: "Fixed"
    });
    const processor = createMissionExecutionProcessor(store);

    try {
      await processor.process(payload);

      expect(execute).toHaveBeenCalledWith(
        "prowler.aws_posture",
        expect.objectContaining({
          inputs: {
            awsRuntimeEnv: expect.objectContaining({
              AWS_ACCESS_KEY_ID: accessKey,
              AWS_SECRET_ACCESS_KEY: secretKey
            })
          },
          integrationIds: [awsIntegrationId],
          target: {
            awsAccountId: "123456789012",
            awsIntegrationId
          }
        })
      );
      expect(execution.run.target).toEqual({
        awsAccountId: "123456789012",
        awsIntegrationId
      });
      expect(JSON.stringify(store.run.target)).not.toContain(secretKey);
    } finally {
      execute.mockRestore();
    }
  });
});
