import { randomUUID } from "node:crypto";

import { createRuntimeServices } from "../apps/api/src/runtime-services.js";
import { getPrismaClient } from "../packages/db/src/client.js";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_SCOPE_VALUE,
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  DEMO_USER_ID,
  getDemoBootstrapDefinition,
  resetDemoTenantScenario
} from "../packages/db/src/demo.js";
import { ensureDemoIdentity } from "../packages/db/src/seed.js";

async function main() {
  const prisma = getPrismaClient();

  try {
    await ensureDemoIdentity();

    await resetDemoTenantScenario(prisma, DEMO_TENANT_ID);

    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob() {
          return;
        }
      },
      prisma
    });
    const auth = await services.login({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    });

    if (!auth) {
      throw new Error("Unable to authenticate the demo user after seeding.");
    }

    const context = await services.getSessionContext(
      auth.session,
      auth.tenant.tenantId
    );

    if (!context) {
      throw new Error("Unable to resolve the demo tenant context.");
    }

    const definition = getDemoBootstrapDefinition();
    const scope = await services.createScope(context, definition.scope);
    const verifiedScope = await services.verifyScope(context, scope.scopeId, {
      devModeManual: true
    });
    const demoRunnerIds = {
      east: "31000000-0000-4000-8000-000000000001",
      plant: "31000000-0000-4000-8000-000000000002",
      legacy: "31000000-0000-4000-8000-000000000003"
    } as const;
    const fleetSeededAt = new Date();
    const runnerCapabilities = {
      supportsArtifactUpload: true,
      supportsHttpConnectProxy: true,
      supportsLocalReachability: true,
      supportsLongPoll: true,
      supportsWebSocket: false
    };
    const runnerNetworkProfile = {
      additionalEgressNotes:
        "DEMO — outbound-only control-plane access; no inbound listener.",
      dnsResolutionRequired: true,
      explicitProxyUrl: null,
      gatewayHostnames: ["app.periscan.com"],
      httpConnectProxySupported: true,
      outboundHttpsPorts: [443]
    };
    const demoRunners = await Promise.all([
      prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "1".repeat(64),
          capabilities: runnerCapabilities,
          certificateExpiresAt: new Date(
            fleetSeededAt.getTime() + 120 * 24 * 60 * 60 * 1_000
          ),
          certificateSha256: "a".repeat(64),
          createdBy: DEMO_USER_ID,
          deploymentMode: "Docker",
          hostname: "east-validation.demo.internal",
          labels: ["demo", "production-like", "east-datacenter"],
          lastSeenAt: new Date(fleetSeededAt.getTime() - 18_000),
          name: "DEMO — East datacenter",
          networkProfile: runnerNetworkProfile,
          os: "linux",
          runnerId: demoRunnerIds.east,
          status: "Active",
          tenantId: DEMO_TENANT_ID,
          transportMode: "LongPollHttps",
          version: "0.1.0"
        }
      }),
      prisma.runner.create({
        data: {
          arch: "arm64",
          authTokenHash: "2".repeat(64),
          capabilities: runnerCapabilities,
          certificateExpiresAt: new Date(
            fleetSeededAt.getTime() + 7 * 24 * 60 * 60 * 1_000
          ),
          certificateSha256: "b".repeat(64),
          createdBy: DEMO_USER_ID,
          deploymentMode: "Kubernetes",
          hostname: "plant-7-edge.demo.internal",
          labels: ["demo", "ot-edge", "plant-7"],
          lastSeenAt: new Date(fleetSeededAt.getTime() - 125_000),
          name: "DEMO — Plant 7 edge",
          networkProfile: runnerNetworkProfile,
          os: "linux",
          runnerId: demoRunnerIds.plant,
          status: "Degraded",
          tenantId: DEMO_TENANT_ID,
          transportMode: "LongPollHttps",
          version: "0.0.9"
        }
      }),
      prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "3".repeat(64),
          capabilities: runnerCapabilities,
          certificateExpiresAt: null,
          certificateSha256: null,
          createdBy: DEMO_USER_ID,
          // P10-3: WindowsService packaging is Planned — do not seed as live mode.
          deploymentMode: "Docker",
          hostname: "legacy-segment.demo.internal",
          labels: ["demo", "legacy-segment"],
          lastSeenAt: new Date(fleetSeededAt.getTime() - 12 * 60 * 1_000),
          name: "DEMO — Legacy segment",
          networkProfile: runnerNetworkProfile,
          os: "linux",
          runnerId: demoRunnerIds.legacy,
          status: "Offline",
          tenantId: DEMO_TENANT_ID,
          transportMode: "LongPollHttps",
          version: "0.1.0"
        }
      })
    ]);
    await prisma.runnerFleetPolicy.create({
      data: {
        attentionAfterSeconds: 3_600,
        certificateWarningDays: 14,
        escalationReference: "DEMO-RUNNER-OPS-001",
        minimumAgentVersion: "0.1.0",
        offlineAfterSeconds: 86_400,
        queueWarningDepth: 10,
        supportOwner: "DEMO Security Operations",
        tenantId: DEMO_TENANT_ID,
        updatedBy: DEMO_USER_ID
      }
    });
    await prisma.runnerHeartbeatSample.createMany({
      data: [
        ...Array.from({ length: 18 }, (_, index) => {
          const receivedAt = new Date(
            fleetSeededAt.getTime() - (17 - index) * 60_000 - 18_000
          );
          return {
            activeTaskId: null,
            certificateExpiresAt: new Date(
              fleetSeededAt.getTime() + 120 * 24 * 60 * 60 * 1_000
            ),
            lastTaskCompletedAt: new Date(fleetSeededAt.getTime() - 6 * 60_000),
            observedAt: new Date(receivedAt.getTime() - 750),
            queueDepth: index % 6 === 0 ? 2 : index % 4 === 0 ? 1 : 0,
            receivedAt,
            runnerId: demoRunnerIds.east,
            status: "Active" as const,
            tenantId: DEMO_TENANT_ID,
            version: "0.1.0"
          };
        }),
        ...Array.from({ length: 8 }, (_, index) => {
          const receivedAt = new Date(
            fleetSeededAt.getTime() - (7 - index) * 60_000 - 125_000
          );
          return {
            activeTaskId: null,
            certificateExpiresAt: new Date(
              fleetSeededAt.getTime() + 7 * 24 * 60 * 60 * 1_000
            ),
            lastTaskCompletedAt: new Date(
              fleetSeededAt.getTime() - 30 * 60_000
            ),
            observedAt: new Date(receivedAt.getTime() - 1_500),
            queueDepth: 8 + index,
            receivedAt,
            runnerId: demoRunnerIds.plant,
            status: "Degraded" as const,
            tenantId: DEMO_TENANT_ID,
            version: "0.0.9"
          };
        }),
        {
          activeTaskId: null,
          certificateExpiresAt: null,
          lastTaskCompletedAt: null,
          observedAt: new Date(
            fleetSeededAt.getTime() - 12 * 60 * 1_000 - 2_000
          ),
          queueDepth: 0,
          receivedAt: new Date(fleetSeededAt.getTime() - 12 * 60 * 1_000),
          runnerId: demoRunnerIds.legacy,
          status: "Offline",
          tenantId: DEMO_TENANT_ID,
          version: "0.1.0"
        }
      ]
    });
    const demoFeedbackScenario = await services.compileScenario(context, {
      intent:
        "DEMO — validate DNS resolution and email controls, then continue only when the prior step produced fresh evidence.",
      maximumIterations: 3,
      maximumSteps: 2,
      scopeId: verifiedScope.scopeId,
      techniqueIds: ["T1595"]
    });
    const approvedDemoFeedbackScenario = await services.approveScenarioBundle(
      context,
      demoFeedbackScenario.bundle.scenarioBundleId
    );
    const demoTeeAssurance = await services.createTeeAssuranceRequirement(
      context,
      {
        authorizationReason:
          "DEMO — define the reviewed hardware trust boundary without manufacturing an attestation.",
        escalationReference: "DEMO-TEE-RUNBOOK-001",
        evidenceMediaType: "application/eat-collection; profile=sevsnp",
        expectedMeasurement: null,
        expectedRegion: null,
        maxAttestationAgeMinutes: 10,
        policyReference: "DEMO-CONFIDENTIAL-COMPUTE-POLICY-001",
        provider: "AMDSEVSNP",
        qualificationValidityMinutes: 60,
        requireDebugDisabled: false,
        requireSecureBoot: false,
        scopeId: verifiedScope.scopeId,
        supportOwner: "DEMO Confidential Compute SRE",
        verifierType: "Veraison",
        workloadId: "demo-confidential-validation-worker"
      }
    );
    const createdIntegrations = [];

    for (const connector of definition.connectors) {
      createdIntegrations.push(
        await services.createIntegration(context, connector)
      );
    }

    const syncedIntegrations = [];

    for (const integration of createdIntegrations.filter(
      (item) => item.config?.connectorKey !== "jira"
    )) {
      syncedIntegrations.push(
        await services.syncIntegration(context, integration.integrationId)
      );
    }

    await prisma.tenant.update({
      data: {
        billingPackageKey: "AISecurityValidation"
      },
      where: {
        tenantId: DEMO_TENANT_ID
      }
    });
    const aiApplication = await services.createAIApplication(context, {
      appType: "RAG",
      authMethod: "Demo test account",
      dataSourcesDescription:
        "Sample support knowledge base and runbook index.",
      endpointUrl: `https://ai.${DEMO_SCOPE_VALUE}/chat`,
      guardrailsDescription:
        "Tenant policy guardrails plus retrieval authorization filters.",
      name: "Demo Support Copilot",
      owner: "AI platform",
      ragEnabled: true,
      scopeId: verifiedScope.scopeId,
      toolsEnabled: true
    });
    const aiValidation = await services.validateAIApplication(
      context,
      aiApplication.aiAppId,
      {
        executionMode: "Fixture",
        fixtureOutcome: "UnauthorizedRetrievalObserved",
        validationCategory: "RAGAuthorization"
      }
    );

    await prisma.tenant.update({
      data: {
        billingPackageKey: "ControlValidation"
      },
      where: {
        tenantId: DEMO_TENANT_ID
      }
    });
    const splunkIntegration = createdIntegrations.find(
      (integration) => integration.config?.connectorKey === "splunk"
    );
    const controlSource = splunkIntegration
      ? await services.createControlSource(context, {
          controlType: "SIEM",
          expectedBehaviors: ["Logged", "Alerted", "Routed"],
          integrationId: splunkIntegration.integrationId,
          provider: "Splunk"
        })
      : null;
    const controlValidation = controlSource
      ? await services.validateControlSource(
          context,
          controlSource.controlSourceId,
          {
            dryRun: true,
            executionMode: "DryRun",
            fixtureOutcome: "Missed",
            techniqueId: "T1595"
          }
        )
      : null;

    const attackPaths = await services.listAttackPaths(context);
    const createdRemediations = [];

    for (const assessment of attackPaths.slice(0, 2)) {
      createdRemediations.push(
        await services.createRemediation(context, {
          owner: "Security engineering",
          pathId: assessment.attackPath.pathId
        })
      );
    }

    const jiraIntegration = createdIntegrations.find(
      (integration) => integration.config?.connectorKey === "jira"
    );

    if (jiraIntegration) {
      for (const remediation of createdRemediations) {
        await services.createRemediationTicket(
          context,
          remediation.remediationId,
          {
            integrationId: jiraIntegration.integrationId
          }
        );
      }

      await services.syncIntegration(context, jiraIntegration.integrationId);
    }

    const snapshot = await services.createSnapshot(context, {
      audience: "Security Team",
      maxTopItems: 5
    });
    const verificationResults = [];

    for (const remediation of createdRemediations) {
      const readyForVerification =
        await services.markRemediationReadyForVerification(
          context,
          remediation.remediationId
        );
      const verificationResult = await services.verifyRemediation(
        context,
        remediation.remediationId
      );

      verificationResults.push({
        readyForVerification,
        verificationResult
      });
    }

    const demoEvidence = await prisma.evidenceArtifact.findMany({
      orderBy: { createdAt: "asc" },
      select: { evidenceId: true },
      take: 3,
      where: { tenantId: DEMO_TENANT_ID }
    });
    async function seedRunnerActivity(input: {
      errorSummary?: string;
      evidenceIds: string[];
      minutesAgo: number;
      moduleId: string;
      runnerId: string;
      status: "Completed" | "Failed" | "Queued";
    }) {
      const issuedAt = new Date(Date.now() - input.minutesAgo * 60_000);
      const terminal = input.status !== "Queued";
      const completedAt = terminal
        ? new Date(issuedAt.getTime() + 8_000)
        : null;
      const mission = await prisma.validationMission.create({
        data: {
          completedAt,
          evidenceIds: input.evidenceIds,
          missionType: "ExposureValidation",
          requestedBy: DEMO_USER_ID,
          safetyLevel: "ActiveNonInvasive",
          scopeId: verifiedScope.scopeId,
          scopeIds: [verifiedScope.scopeId],
          startedAt: issuedAt,
          status:
            input.status === "Completed"
              ? "Completed"
              : input.status === "Failed"
                ? "Failed"
                : "Running",
          tenantId: DEMO_TENANT_ID
        }
      });
      const run = await prisma.validationRun.create({
        data: {
          completedAt,
          errorSummary: input.errorSummary ?? null,
          evidenceIds: input.evidenceIds,
          missionId: mission.missionId,
          moduleId: input.moduleId,
          outcome:
            input.status === "Completed"
              ? "DEMO — expected internal service behavior observed"
              : null,
          runnerId: input.runnerId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: verifiedScope.scopeId,
          startedAt: issuedAt,
          status:
            input.status === "Completed"
              ? "Completed"
              : input.status === "Failed"
                ? "Failed"
                : "Running",
          target: { hostname: DEMO_SCOPE_VALUE },
          tenantId: DEMO_TENANT_ID,
          validationState:
            input.status === "Completed"
              ? "Reachable"
              : input.status === "Failed"
                ? "Inconclusive"
                : null
        }
      });
      const taskId = randomUUID();
      const expiresAt = new Date(
        Math.max(Date.now() + 5 * 60_000, issuedAt.getTime() + 10 * 60_000)
      );
      const target = { hostname: DEMO_SCOPE_VALUE, port: 443 };
      const inputs = {
        demo: true,
        executionBoundary: "SeededDemonstration",
        hostname: DEMO_SCOPE_VALUE,
        port: 443
      };
      const scopeConstraints = {
        approvedCidrs: [],
        approvedDnsSuffixes: [DEMO_SCOPE_VALUE],
        approvedHostnames: [DEMO_SCOPE_VALUE],
        approvedPorts: [443],
        forbidInternetEgress: true
      };
      const envelope = {
        artifactUpload: {
          artifactUploadUrl: `https://app.periscan.com/api/v1/runners/${input.runnerId}/tasks/${taskId}/artifacts`,
          maxArtifactBytes: 1_048_576,
          resultCallbackUrl: `https://app.periscan.com/api/v1/runners/${input.runnerId}/tasks/${taskId}/result`
        },
        executionEnvironment: "InternalRunner",
        expiresAt: expiresAt.toISOString(),
        inputs,
        issuedAt: issuedAt.toISOString(),
        missionId: mission.missionId,
        moduleId: input.moduleId,
        runId: run.runId,
        runnerId: input.runnerId,
        safetyLevel: "ActiveNonInvasive",
        scopeConstraints,
        scopeId: verifiedScope.scopeId,
        signature: {
          algorithm: "EdDSA",
          digestSha256: "d".repeat(64),
          keyId: "demo-task-signing-key",
          nonce: taskId,
          signature: "DEMO_SIGNATURE_NOT_LIVE"
        },
        target,
        taskId,
        tenantId: DEMO_TENANT_ID
      };
      return prisma.runnerTask.create({
        data: {
          completedAt,
          envelope,
          errorSummary: input.errorSummary ?? null,
          expiresAt,
          inputPayloadHash: "c".repeat(64),
          inputs,
          issuedAt,
          leasedAt: terminal ? new Date(issuedAt.getTime() + 1_000) : null,
          localAuditHash: terminal ? "e".repeat(64) : null,
          missionId: mission.missionId,
          moduleId: input.moduleId,
          moduleVersion: "demo-seed-v1",
          nonce: taskId,
          ...(terminal
            ? {
                normalizedOutput: {
                  demo: true,
                  outcome:
                    input.status === "Completed" ? "observed" : "inconclusive"
                },
                result: {
                  demo: true,
                  status: input.status,
                  summary:
                    input.status === "Completed"
                      ? "Expected internal service behavior observed."
                      : input.errorSummary
                }
              }
            : {}),
          redactedEvidenceIds: input.evidenceIds,
          runId: run.runId,
          runnerId: input.runnerId,
          safetyLevel: "ActiveNonInvasive",
          scopeConstraints,
          scopeId: verifiedScope.scopeId,
          status: input.status,
          target,
          taskId,
          taskType: "DemoInternalMeasurement",
          tenantId: DEMO_TENANT_ID
        }
      });
    }
    const demoRunnerTasks = await Promise.all([
      seedRunnerActivity({
        evidenceIds: demoEvidence[0] ? [demoEvidence[0].evidenceId] : [],
        minutesAgo: 6,
        moduleId: "periscan.http_health_check",
        runnerId: demoRunnerIds.east,
        status: "Completed"
      }),
      seedRunnerActivity({
        errorSummary:
          "DEMO — target maintenance window closed before a measured response was returned.",
        evidenceIds: [],
        minutesAgo: 28,
        moduleId: "periscan.tls_protocol_audit",
        runnerId: demoRunnerIds.plant,
        status: "Failed"
      }),
      seedRunnerActivity({
        evidenceIds: [],
        minutesAgo: 2,
        moduleId: "periscan.dns_resolution_check",
        runnerId: demoRunnerIds.plant,
        status: "Queued"
      })
    ]);
    const workflowEvidenceIds = demoEvidence.map((item) => item.evidenceId);
    const demoModelProvider = await services.createModelProvider(context, {
      allowedUseCases: ["Seeded recorder demonstration"],
      authMethod: "none — demo recorder",
      dataResidency: "demo-only",
      deploymentType: "Cloud",
      endpointUrl: "https://demo-recorder.invalid/v1",
      providerName: "DEMO — recorder only, no inference",
      providerType: "Other"
    });
    const demoModelPolicy = await services.createModelPolicyProfile(context, {
      allowExternalValidation: false,
      allowInternalValidation: false,
      allowRawEvidence: false,
      allowRunnerTasks: false,
      allowSensitiveContext: false,
      allowTicketCreation: false,
      allowedDataClasses: ["DemoReference"],
      allowedModes: ["PlanOnly"],
      allowedTools: [],
      approvalRequiredAboveLevel: "ActiveNonInvasive",
      blockedTools: [],
      description:
        "Demo-only redacted recorder policy. It performs no live inference or tool execution.",
      maxSafetyLevel: "PassiveReadOnly",
      name: "DEMO — redacted recorder policy",
      redactionPolicy: "demo-reference-only",
      sessionTimeoutMinutes: 60
    });
    const demoModelSession = await services.createModelSession(context, {
      mode: "PlanOnly",
      modelPolicyProfileId: demoModelPolicy.modelPolicyProfileId,
      modelProviderId: demoModelProvider.modelProviderId,
      purpose:
        "DEMO — inspect persisted variable history; no live model inference is performed.",
      requestedModel: "demo-static-recorder-v1",
      scopeIds: [verifiedScope.scopeId]
    });
    await services.startModelSession(context, demoModelSession.modelSessionId);
    const demoWorkflowDefinition = await services.createAgentWorkflowDefinition(
      context,
      {
        name: "DEMO — evidence review recorder",
        purpose:
          "Demonstrate historical variable comparison over redacted persisted workflow state.",
        steps: [
          {
            dependsOn: [],
            name: "Build redacted context",
            stepKey: "context",
            stepKind: "Context"
          },
          {
            dependsOn: ["context"],
            name: "Evaluate demo policy",
            stepKey: "policy",
            stepKind: "Policy"
          },
          {
            dependsOn: ["policy"],
            name: "Record model-shaped fixture",
            stepKey: "model",
            stepKind: "Model"
          },
          {
            dependsOn: ["model"],
            name: "Bind demo evidence references",
            stepKey: "evidence",
            stepKind: "Evidence"
          },
          {
            dependsOn: ["evidence"],
            name: "Complete reviewed branch",
            stepKey: "transition",
            stepKind: "Transition"
          }
        ],
        version: 1
      }
    );
    const demoWorkflowRun = await services.createAgentWorkflowRun(context, {
      evidenceIds: workflowEvidenceIds,
      inputManifest: {
        demo: true,
        executionBoundary: "FixtureNoNetwork",
        mode: "PlanOnly",
        purpose: "Compare redacted workflow variables across recorded moments.",
        reviewReference: "DEMO-WORKFLOW-VARIABLES-001",
        scopeRefs: [`scope:${verifiedScope.scopeId}`],
        storedPromptText: false,
        storedResponseText: false
      },
      modelSessionId: demoModelSession.modelSessionId,
      policyDecisionIds: [],
      workflowDefinitionId: demoWorkflowDefinition.workflowDefinitionId
    });
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        eventType: "StepStarted",
        evidenceIds: [],
        payloadRedacted: {
          contextSourceRefs: [`scope:${verifiedScope.scopeId}`],
          redactionPolicy: "demo-reference-only",
          retainedItemCount: 1,
          storedPromptText: false
        },
        stepKey: "context"
      }
    );
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        eventType: "PolicyDecision",
        evidenceIds: [],
        payloadRedacted: {
          decision: "Allowed",
          executionBoundary: "FixtureNoNetwork",
          policyProfileRef: `model-policy:${demoModelPolicy.modelPolicyProfileId}`
        },
        stepKey: "policy"
      }
    );
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        costMicrousd: 120,
        eventType: "ModelRequest",
        evidenceIds: workflowEvidenceIds,
        latencyMs: 14,
        modelProvider: "DEMO fixture — no inference",
        modelVersion: "demo-static-recorder-v1",
        payloadRedacted: {
          contextReferenceCount: workflowEvidenceIds.length,
          executionBoundary: "FixtureNoNetwork",
          routeReason: "Seeded variable-analysis demonstration"
        },
        stepKey: "model"
      }
    );
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        costMicrousd: 880,
        eventType: "ModelResponse",
        evidenceIds: workflowEvidenceIds,
        latencyMs: 284,
        modelProvider: "DEMO fixture — no inference",
        modelVersion: "demo-static-recorder-v1",
        payloadRedacted: {
          analysisRef: "demo:workflow-variable-analysis:v1",
          evidenceGrounded: true,
          findingCount: 2,
          responseStored: false,
          status: "Completed"
        },
        stepKey: "model"
      }
    );
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        eventType: "EvidenceAttached",
        evidenceIds: workflowEvidenceIds,
        payloadRedacted: {
          attachedCount: workflowEvidenceIds.length,
          proofRefs: workflowEvidenceIds.map((id) => `evidence:${id}`)
        },
        stepKey: "evidence"
      }
    );
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        eventType: "Transition",
        evidenceIds: workflowEvidenceIds,
        payloadRedacted: {
          branch: "evidence_complete",
          next: "complete",
          reason: "All seeded demo evidence references are bound."
        },
        stepKey: "transition"
      }
    );
    await services.createAgentWorkflowCheckpoint(
      context,
      demoWorkflowRun.workflowRunId,
      { reusableThroughStepKey: "evidence" }
    );
    await services.appendAgentWorkflowEvent(
      context,
      demoWorkflowRun.workflowRunId,
      {
        eventType: "RunCompleted",
        evidenceIds: workflowEvidenceIds,
        payloadRedacted: {
          completion: "Demo recorder exercise complete",
          liveInferencePerformed: false
        },
        stepKey: "transition"
      }
    );
    await services.terminateModelSession(
      context,
      demoModelSession.modelSessionId
    );

    const demoInterventionPolicy = await services.createModelPolicyProfile(
      context,
      {
        allowExternalValidation: true,
        allowInternalValidation: false,
        allowRawEvidence: false,
        allowRunnerTasks: false,
        allowSensitiveContext: false,
        allowTicketCreation: false,
        allowedDataClasses: ["DemoReference"],
        allowedModes: ["SafeValidation"],
        allowedTools: ["request_exposure_validation"],
        approvalRequiredAboveLevel: "ActiveNonInvasive",
        blockedTools: [],
        description:
          "Demo-only intervention policy. The request is paused for review and never auto-executes.",
        maxSafetyLevel: "ControlledValidation",
        name: "DEMO — human intervention boundary",
        redactionPolicy: "demo-reference-only",
        sessionTimeoutMinutes: 1440
      }
    );
    const demoInterventionSession = await services.createModelSession(context, {
      mode: "SafeValidation",
      modelPolicyProfileId: demoInterventionPolicy.modelPolicyProfileId,
      modelProviderId: demoModelProvider.modelProviderId,
      purpose:
        "DEMO — review a policy-paused exposure validation; no validation is executed by the demo seed.",
      requestedModel: "demo-static-intervention-v1",
      scopeIds: [verifiedScope.scopeId]
    });
    await services.startModelSession(
      context,
      demoInterventionSession.modelSessionId
    );
    const demoPausedRequest = await services.createModelToolRequest(
      context,
      demoInterventionSession.modelSessionId,
      {
        input: {
          reason:
            "DEMO only — prepare a safe validation plan for the top exposure; do not execute during seeding."
        },
        requestReason:
          "DEMO — confirm the highest-risk exposure with a safe validation plan.",
        scopeIds: [verifiedScope.scopeId],
        toolName: "request_exposure_validation"
      }
    );
    if (demoPausedRequest.status !== "RequiresApproval") {
      throw new Error(
        `Expected the demo intervention request to pause, received ${demoPausedRequest.status}.`
      );
    }

    const remediations = await services.listRemediations(context);
    const asyncOperationsWorkspace = await services.updateAsyncOperationsPolicy(
      context,
      {
        escalationChannel: "#security-operations",
        queueAgeTargetSeconds: 900,
        reviewReference: "DEMO-OPS-RUNBOOK-001",
        runnerLeaseWarningSeconds: 600,
        runningTimeoutSeconds: 1800,
        supportOwner: "Security Operations"
      }
    );
    const recoveryExerciseMission = await prisma.validationMission.create({
      data: {
        completedAt: new Date(),
        evidenceIds: [],
        missionType: "ValidationSnapshot",
        requestedBy: DEMO_USER_ID,
        safetyLevel: "ActiveNonInvasive",
        scopeId: verifiedScope.scopeId,
        scopeIds: [verifiedScope.scopeId],
        status: "Failed",
        tenantId: DEMO_TENANT_ID
      }
    });
    const recoveryExerciseRun = await prisma.validationRun.create({
      data: {
        completedAt: new Date(),
        errorSummary:
          "Demo recovery exercise: the worker stopped before a terminal result was received.",
        evidenceIds: [],
        missionId: recoveryExerciseMission.missionId,
        moduleId: "periscan.http_health_check",
        safetyLevel: "ActiveNonInvasive",
        scopeId: verifiedScope.scopeId,
        status: "Failed",
        target: { hostname: DEMO_SCOPE_VALUE },
        tenantId: DEMO_TENANT_ID
      }
    });
    const recoveryExerciseJob = await prisma.job.create({
      data: {
        attempts: 2,
        completedAt: new Date(),
        errorMessage:
          "Demo recovery exercise: the worker stopped before a terminal result was received.",
        missionId: recoveryExerciseMission.missionId,
        payload: {
          demo: true,
          moduleId: "periscan.http_health_check",
          purpose: "Exercise the policy-gated recovery-draft workflow."
        },
        queueName: "validation-demo-recovery",
        startedAt: new Date(Date.now() - 45 * 60 * 1_000),
        status: "Failed",
        tenantId: DEMO_TENANT_ID,
        validationRunId: recoveryExerciseRun.runId
      }
    });

    console.log(
      JSON.stringify(
        {
          aiApplication: {
            aiAppId: aiApplication.aiAppId,
            latestRunId: aiValidation.run.runId,
            validationState: aiValidation.run.validationState
          },
          attackPathCount: attackPaths.length,
          asyncOperations: {
            health: asyncOperationsWorkspace.summary.health,
            recoveryExerciseJobId: recoveryExerciseJob.jobId,
            reviewReference:
              asyncOperationsWorkspace.policy?.reviewReference ?? null
          },
          controlSource: controlSource
            ? {
                controlSourceId: controlSource.controlSourceId,
                latestRunId: controlValidation?.run.runId,
                validationState: controlValidation?.run.validationState
              }
            : null,
          demoEmail: DEMO_EMAIL,
          demoPassword: DEMO_PASSWORD,
          demoScope: DEMO_SCOPE_VALUE,
          demoTenantId: DEMO_TENANT_ID,
          demoTenantName: DEMO_TENANT_NAME,
          integrations: createdIntegrations.map((integration) => ({
            connectorKey: integration.config?.connectorKey,
            integrationId: integration.integrationId,
            status: integration.status
          })),
          runnerFleet: {
            path: "/runners",
            runnerCount: demoRunners.length,
            runnerNames: demoRunners.map((runner) => runner.name),
            seededTaskCount: demoRunnerTasks.length
          },
          modelIntervention: {
            executionPerformed: false,
            path: "/model-gateway",
            status: demoPausedRequest.status,
            toolRequestId: demoPausedRequest.toolRequestId
          },
          remediations: remediations.map((remediation) => ({
            latestVerificationOutcome:
              remediation.latestVerification?.outcome ?? null,
            recommendedAction: remediation.recommendedAction,
            remediationId: remediation.remediationId,
            status: remediation.status,
            ticketId: remediation.ticketId
          })),
          scopeId: verifiedScope.scopeId,
          scenarioFeedback: {
            cycleCount: approvedDemoFeedbackScenario.feedbackCycleCount,
            executionPerformed: false,
            maximumIterations: approvedDemoFeedbackScenario.maximumIterations,
            path: "/engagements",
            scenarioBundleId: approvedDemoFeedbackScenario.scenarioBundleId,
            status: approvedDemoFeedbackScenario.status
          },
          teeAssurance: {
            attestationCreated: false,
            path: "/workflows",
            status: demoTeeAssurance.status,
            teeAssuranceRequirementId:
              demoTeeAssurance.teeAssuranceRequirementId,
            workloadId: demoTeeAssurance.workloadId
          },
          snapshotId: snapshot.snapshotId,
          snapshotReportPath: `/snapshots/${snapshot.snapshotId}`,
          workflowVariableAnalysis: {
            path: "/workflows",
            reviewReference: "DEMO-WORKFLOW-VARIABLES-001",
            workflowRunId: demoWorkflowRun.workflowRunId
          },
          syncedIntegrations: syncedIntegrations.map((result) => ({
            assetCount: result.assetCount,
            connectorKey: result.integration.config?.connectorKey,
            signalCount: result.signalCount
          })),
          verifications: verificationResults.map((item) => ({
            outcome: item.verificationResult.verificationEvent.outcome,
            readyStatus: item.readyForVerification.status,
            remediationId: item.verificationResult.remediation.remediationId,
            runId: item.verificationResult.run.runId
          }))
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    process.exit(1);
  });
