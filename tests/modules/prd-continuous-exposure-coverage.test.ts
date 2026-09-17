import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CTEMStageSchema,
  DueScheduleRunSummarySchema,
  MissionScheduleSchema,
  MissionTypeSchema,
  ScheduleDiffSchema,
  ValidatedFindingSchema,
  ValidationStateSchema
} from "../../packages/shared/src/domain.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import { buildScheduleDiff } from "../../apps/api/src/schedule-diff.js";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

function parseBulletsBetween(source: string, start: string, end: string) {
  return sectionBetween(source, start, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function sourcesContain(sources: readonly string[], marker: string) {
  return sources.some((source) => source.includes(marker));
}

describe("PRD Continuous Exposure Validation source coverage", () => {
  it("maps every PRD coverage bullet to a real connector, module, scope, or acceptance surface", async () => {
    const fullPrd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      fullPrd,
      "3.2 Continuous Exposure Validation",
      "3.3 Control Validation"
    );
    const coverageBullets = parseBulletsBetween(
      section,
      "Coverage",
      "Validation States"
    );
    const [
      sharedDomain,
      connectorSource,
      marketLeaderSource,
      moduleSource,
      moduleImplementation,
      traceability,
      acceptance
    ] = await Promise.all([
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/connectors/src/index.ts"),
      readRepoFile("packages/connectors/src/market-leaders.ts"),
      readRepoFile("packages/modules/src/toolchain.ts"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const implementationEvidence = [
      sharedDomain,
      connectorSource,
      marketLeaderSource,
      moduleSource,
      moduleImplementation,
      traceability,
      acceptance
    ];
    const coverageEvidence: Record<string, string[]> = {
      "AI apps": [
        "AIApplicationEndpoint",
        "ai_app.safe_validation",
        "PRD-AIProvider-ConnectorAcceptance"
      ],
      "SaaS posture": ["SaaSApplication", "SaaSPostureFinding"],
      "asset context from CAASM/ASM tools": [
        "VM/EAP/ASM/CNAPP",
        "CAASM",
        "Assetnote",
        "Axonius",
        "Armis",
        "Cortex Xpanse"
      ],
      "cloud resources": ["CloudAccount", "prowler.aws_posture", "Cloud"],
      "code and secrets": [
        "Repository",
        "gitleaks.repo_secrets",
        "SecretExposure"
      ],
      containers: [
        "trivy.container_scan",
        "ContainerImageRepository",
        "container-image-scan"
      ],
      "external assets": [
        "Domain",
        "Subdomain",
        "nuclei.external_exposure_safe"
      ],
      "identity paths": [
        "IdentityPathing",
        "bloodhound.identity_pathing",
        "Identity"
      ],
      "internal exposure": [
        "InternalNetwork",
        "runner.reachability_check",
        "Internal reachability"
      ],
      Kubernetes: ["Kubernetes", "PRD-Kubernetes-Connector"],
      "vulnerabilities from existing VM/EAP tools": [
        "VM/EAP/ASM/CNAPP",
        "Tenable",
        "Rapid7 InsightVM",
        "Qualys VMDR"
      ]
    };

    expect(coverageBullets).toEqual([
      "external assets",
      "cloud resources",
      "identity paths",
      "SaaS posture",
      "code and secrets",
      "containers",
      "Kubernetes",
      "internal exposure",
      "AI apps",
      "vulnerabilities from existing VM/EAP tools",
      "asset context from CAASM/ASM tools"
    ]);
    for (const bullet of coverageBullets) {
      const evidence = coverageEvidence[bullet];

      expect(evidence, `missing evidence map for ${bullet}`).toBeDefined();
      for (const marker of evidence ?? []) {
        expect(
          sourcesContain(implementationEvidence, marker),
          `missing ${marker} evidence for ${bullet}`
        ).toBe(true);
      }
    }
  });

  it("keeps every PRD continuous-exposure validation state in shared contracts", async () => {
    const fullPrd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      fullPrd,
      "3.2 Continuous Exposure Validation",
      "3.3 Control Validation"
    );
    const states = parseBulletsBetween(
      section,
      "Validation States",
      "Requirements"
    );
    const implementedStates = ValidationStateSchema.options.map(normalize);

    expect(states).toEqual([
      "Discovered",
      "Reachable",
      "Validated",
      "Exploitable",
      "Detected",
      "Blocked",
      "Mitigated",
      "Inconclusive",
      "Fixed",
      "Reopened"
    ]);
    for (const state of states) {
      expect(implementedStates).toContain(normalize(state));
    }
  });

  it("maps recurring schedules, drift/reopened detection, validated-risk separation, and CTEM reporting to implementation", async () => {
    const fullPrd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      fullPrd,
      "3.2 Continuous Exposure Validation",
      "3.3 Control Validation"
    );
    const requirements = parseBulletsBetween(section, "Requirements", "###");
    const ctemStages = requirements.slice(
      requirements.indexOf("scope"),
      requirements.length
    );
    const [
      appRoutes,
      scheduleService,
      systemScheduler,
      findingsService,
      findingsWorkbench,
      scheduleAcceptance,
      sweepAcceptance,
      postureAcceptance,
      rereverificationAcceptance,
      sharedDomain
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/services/schedules.ts"),
      readRepoFile("apps/api/src/system-scheduler.ts"),
      readRepoFile("apps/api/src/services/findings.ts"),
      readRepoFile("apps/web/src/components/findings-workbench.tsx"),
      readRepoFile("tests/acceptance/schedule-pause-run-flow.test.ts"),
      readRepoFile("tests/acceptance/system-validation-sweep-flow.test.ts"),
      readRepoFile("tests/acceptance/scope-posture-check-flow.test.ts"),
      readRepoFile(
        "tests/acceptance/digitalocean-fix-verification-flow.test.ts"
      ),
      readRepoFile("packages/shared/src/domain.ts")
    ]);
    const scheduleEvidence = [
      appRoutes,
      scheduleService,
      systemScheduler,
      scheduleAcceptance,
      sweepAcceptance,
      postureAcceptance,
      rereverificationAcceptance
    ];
    const validatedRiskEvidence = [
      ValidatedFindingSchema.keyof().options.join("\n"),
      findingsService,
      findingsWorkbench,
      sharedDomain
    ];

    expect(requirements).toEqual([
      "Support recurring validation schedules.",
      "Detect drift and reopened exposure.",
      "Separate theoretical findings from validated risk.",
      "Support CTEM-style reporting:",
      "scope",
      "discover",
      "prioritize",
      "validate",
      "mobilize",
      "verify"
    ]);
    expect(MissionTypeSchema.options).toContain("ContinuousValidation");
    expect(MissionScheduleSchema.keyof().options).toEqual(
      expect.arrayContaining([
        "frequency",
        "lastDiff",
        "lastRunAt",
        "lastSnapshotId",
        "missionType",
        "nextRunAt",
        "scopeIds",
        "status"
      ])
    );
    expect(DueScheduleRunSummarySchema.keyof().options).toContain("runCount");
    expect(ScheduleDiffSchema.keyof().options).toEqual(
      expect.arrayContaining([
        "addedPathIds",
        "removedPathIds",
        "reopenedPathIds",
        "riskScoreDelta",
        "status",
        "summary"
      ])
    );
    for (const marker of [
      '"/api/v1/schedules"',
      '"/api/v1/schedules/:id/run"',
      '"/api/v1/schedules/run-due"',
      "runSystemValidationSweep",
      "runDueIntegrationSyncs",
      "runDueReverifications",
      "runDuePostureChecks",
      "runDueSchedules",
      "Continuous-validation sweep",
      "verified scope",
      'status:"Active"',
      'status: "Paused"'
    ]) {
      expect(
        sourcesContain(scheduleEvidence, marker),
        `missing ${marker}`
      ).toBe(true);
    }

    const previous = createPublicDemoValidationSnapshot();
    const current = createPublicDemoValidationSnapshot();
    previous.topAttackPaths[0]!.attackPath.validationState = "Fixed";
    current.topAttackPaths[0]!.attackPath.validationState = "Validated";
    const diff = buildScheduleDiff({ current, previous });

    expect(diff.status).toBe("ReopenedRiskDetected");
    expect(diff.reopenedPathIds).toContain(
      current.topAttackPaths[0]!.attackPath.pathId
    );
    expect(
      sourcesContain(scheduleEvidence, 'validationState: "Reopened"')
    ).toBe(true);
    expect(sourcesContain(scheduleEvidence, "VerificationEvent")).toBe(true);

    for (const marker of [
      "evidenceBasis",
      "sourceMotion",
      "validationState",
      "evidenceIds",
      "State: {finding.validationState}",
      "Validation state"
    ]) {
      expect(
        sourcesContain(validatedRiskEvidence, marker),
        `missing ${marker}`
      ).toBe(true);
    }

    expect(ctemStages).toEqual([
      "scope",
      "discover",
      "prioritize",
      "validate",
      "mobilize",
      "verify"
    ]);
    expect(CTEMStageSchema.options.map(normalize)).toEqual(
      ctemStages.map(normalize)
    );
    expect(appRoutes).toContain('"/api/v1/ctem/program"');
    expect(sharedDomain).toContain("CTEMProgramSummarySchema");
  });
});
