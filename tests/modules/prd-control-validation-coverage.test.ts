import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildControlRuleCoverageSummary } from "../../apps/api/src/runtime-services.js";
import { getConnectorCatalog } from "../../packages/connectors/src/index.js";
import { listModuleManifests } from "../../packages/modules/src/index.js";
import {
  ControlRuleCoverageSummarySchema,
  ControlSourceTypeSchema,
  DetectionRuleBehaviorSchema,
  DetectionRuleCoverageStatusSchema,
  type ControlSource,
  type SignalEnvelope
} from "../../packages/shared/src/domain.js";
import { listAttackTechniques } from "../../packages/shared/src/mitre-attack.js";
import {
  ControlValidationOutcomeSchema,
  listControlValidationScenarios
} from "../../packages/shared/src/validation-catalog.js";

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

function createControlSource(input: {
  controlSourceId: string;
  integrationId: string;
  tenantId: string;
}): ControlSource {
  const timestamp = "2026-06-01T00:00:00.000Z";

  return {
    controlSourceId: input.controlSourceId,
    controlType: "SIEM",
    createdAt: timestamp,
    expectedBehaviors: ["Logged", "Alerted", "Routed"],
    healthStatus: "Healthy",
    integrationId: input.integrationId,
    lastValidatedAt: timestamp,
    provider: "Splunk Cloud",
    telemetryStatus: "Healthy",
    tenantId: input.tenantId,
    updatedAt: timestamp
  };
}

function createControlSignal(input: {
  controlSourceId: string;
  evidenceId: string;
  integrationId: string;
  signalId: string;
  tenantId: string;
}): SignalEnvelope {
  const timestamp = "2026-06-02T00:00:00.000Z";

  return {
    confidence: 0.82,
    createdAt: timestamp,
    evidenceIds: [input.evidenceId],
    freshness: "fresh",
    rawPayloadPointer: "evidence://control-validation/redacted",
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [input.controlSourceId],
    relatedEvidenceIds: [input.evidenceId],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: "ControlObservation",
    signalId: input.signalId,
    signalSubcategory: "Logged",
    sourceIntegrationId: input.integrationId,
    sourceRunnerId: null,
    sourceType: "splunk.search.observer",
    sourceVendor: "Splunk",
    techniqueIds: ["T1071"],
    tenantId: input.tenantId,
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  };
}

describe("PRD Control Validation source coverage", () => {
  it("maps every PRD control type to a control-source contract, connector observer, or workflow surface", async () => {
    const fullPrd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      fullPrd,
      "3.3 Control Validation",
      "3.4 Attack-Path Validation"
    );
    const controls = parseBulletsBetween(section, "Controls", "Outcomes");
    const connectorCatalog = JSON.stringify(getConnectorCatalog());
    const moduleCatalog = JSON.stringify(listModuleManifests());
    const [
      sharedDomain,
      connectors,
      marketLeaders,
      runtimeServices,
      appRoutes
    ] = await Promise.all([
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/connectors/src/index.ts"),
      readRepoFile("packages/connectors/src/market-leaders.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("apps/api/src/app.ts")
    ]);
    const implementationEvidence = [
      ControlSourceTypeSchema.options.join("\n"),
      connectorCatalog,
      moduleCatalog,
      sharedDomain,
      connectors,
      marketLeaders,
      runtimeServices,
      appRoutes
    ].join("\n");
    const evidenceByControl: Record<string, string[]> = {
      EDR: ["EDR", "CrowdStrike", "SentinelOne", "Microsoft Defender XDR"],
      MDR: ["MDR", "MDR"],
      MFA: ["MFA", "mfa"],
      SIEM: ["SIEM", "Splunk", "Microsoft Sentinel", "Google SecOps"],
      SOAR: ["SOAR", "SOAR/ITSM", "Swimlane"],
      WAF: ["WAF", "Cloudflare", "AWS WAF", "Azure Front Door"],
      XDR: ["XDR", "CrowdStrike", "Microsoft Defender XDR"],
      "AI guardrails": ["AIGuardrail", "Lakera Guard", "AIGuardrail"],
      "cloud guardrails": ["CloudGuardrail", "CloudGuardrail"],
      "email security": ["EmailSecurity", "Microsoft Defender for Office 365"],
      firewall: ["Firewall", "Fortinet", "Palo Alto"],
      "logging platforms": ["SIEM", "Log Search", "Logged"],
      "ticketing / response workflows": [
        "Ticketing",
        "WorkflowDestination",
        "Routed",
        "SOAR/ITSM"
      ]
    };

    expect(controls).toEqual([
      "EDR",
      "XDR",
      "SIEM",
      "SOAR",
      "MDR",
      "WAF",
      "firewall",
      "email security",
      "MFA",
      "cloud guardrails",
      "AI guardrails",
      "logging platforms",
      "ticketing / response workflows"
    ]);
    for (const control of controls) {
      const evidence = evidenceByControl[control];

      expect(evidence, `missing evidence map for ${control}`).toBeDefined();
      for (const marker of evidence ?? []) {
        expect(
          implementationEvidence.includes(marker),
          `missing ${marker} evidence for ${control}`
        ).toBe(true);
      }
    }
  });

  it("keeps every PRD control outcome in public validation and detection-rule contracts", async () => {
    const fullPrd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      fullPrd,
      "3.3 Control Validation",
      "3.4 Attack-Path Validation"
    );
    const outcomes = parseBulletsBetween(section, "Outcomes", "Requirements");
    const normalizedValidationOutcomes =
      ControlValidationOutcomeSchema.options.map(normalize);
    const normalizedDetectionBehaviors =
      DetectionRuleBehaviorSchema.options.map(normalize);

    expect(outcomes).toEqual([
      "Detected",
      "Blocked",
      "Logged",
      "Alerted",
      "Routed",
      "Missed",
      "No Evidence",
      "Needs Tuning"
    ]);
    for (const outcome of outcomes) {
      expect(normalizedValidationOutcomes).toContain(normalize(outcome));
      expect(normalizedDetectionBehaviors).toContain(normalize(outcome));
    }
  });

  it("maps PRD requirements to ATT&CK scenarios, dry-run Atomic content, tuning guidance, evidence, and history APIs", async () => {
    const fullPrd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      fullPrd,
      "3.3 Control Validation",
      "3.4 Attack-Path Validation"
    );
    const requirements = parseBulletsBetween(
      section,
      "Requirements",
      "Atomic Red Team"
    );
    const [
      validationCatalog,
      moduleSource,
      runtimeServices,
      appRoutes,
      reportsSource,
      validationOps,
      appTests,
      acceptanceTests
    ] = await Promise.all([
      readRepoFile("packages/shared/src/validation-catalog.ts"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("apps/web/src/components/validation-ops-dashboard.tsx"),
      readRepoFile("apps/api/src/app.test.ts"),
      readRepoFile("tests/acceptance/connector-telemetry-coverage-flow.test.ts")
    ]);
    const combined = [
      validationCatalog,
      moduleSource,
      runtimeServices,
      appRoutes,
      reportsSource,
      validationOps,
      appTests,
      acceptanceTests
    ].join("\n");
    const scenarios = listControlValidationScenarios();
    const attackTechniqueIds = new Set(
      listAttackTechniques().map((technique) => technique.techniqueId)
    );
    const scenarioBehaviors = new Set(
      scenarios.flatMap((scenario) => scenario.expectedBehaviors)
    );

    expect(requirements).toEqual([
      "Validate whether controls detect, block, log, alert, and route.",
      "Map scenarios to MITRE ATT&CK where applicable.",
      "Provide control tuning recommendations.",
      "Support before/after control trend reporting.",
      "Support evidence for control validation."
    ]);
    expect([...scenarioBehaviors].map(normalize)).toEqual(
      expect.arrayContaining(
        ["Detected", "Blocked", "Logged", "Alerted", "Routed"].map(normalize)
      )
    );
    expect(scenarios.every((scenario) => scenario.dryRunOnlyByDefault)).toBe(
      true
    );
    expect(
      scenarios.every(
        (scenario) => scenario.moduleId === "atomic.control_validation_safe"
      )
    ).toBe(true);
    expect(
      scenarios.every((scenario) =>
        attackTechniqueIds.has(scenario.techniqueId)
      )
    ).toBe(true);
    expect(combined).toContain("MITRE ATT&CK");
    expect(combined).toContain("atomic.control_validation_safe");
    expect(combined).toContain("Atomic live execution is disabled");
    expect(combined).toContain("ruleCoverageRecommendation");
    expect(combined).toContain("Tune alert routing");
    expect(combined).toContain("/api/v1/control-sources/:id/history");
    expect(combined).toContain("/api/v1/control-sources/rule-coverage");
    expect(combined).toContain("evidenceIds");
    expect(DetectionRuleCoverageStatusSchema.options).toEqual(
      expect.arrayContaining([
        "Covered",
        "Blocked",
        "LoggedOnly",
        "Missed",
        "NoEvidence",
        "NeedsTuning",
        "Stale",
        "NotTested"
      ])
    );
  });

  it("supports before/after control trend inputs from repeatable coverage summaries without inventing proof", () => {
    const tenantId = randomUUID();
    const controlSourceId = randomUUID();
    const integrationId = randomUUID();
    const evidenceId = randomUUID();
    const controlSource = createControlSource({
      controlSourceId,
      integrationId,
      tenantId
    });
    const before = buildControlRuleCoverageSummary({
      controlSources: [controlSource],
      generatedAt: "2026-06-01T00:00:00.000Z",
      signals: [],
      tenantId
    });
    const after = buildControlRuleCoverageSummary({
      controlSources: [controlSource],
      generatedAt: "2026-06-02T01:00:00.000Z",
      signals: [
        createControlSignal({
          controlSourceId,
          evidenceId,
          integrationId,
          signalId: randomUUID(),
          tenantId
        })
      ],
      tenantId
    });
    const beforeT1071 = before.items.find(
      (item) => item.techniqueId === "T1071"
    );
    const afterT1071 = after.items.find((item) => item.techniqueId === "T1071");

    expect(ControlRuleCoverageSummarySchema.parse(before).generatedAt).toBe(
      "2026-06-01T00:00:00.000Z"
    );
    expect(ControlRuleCoverageSummarySchema.parse(after).generatedAt).toBe(
      "2026-06-02T01:00:00.000Z"
    );
    expect(beforeT1071).toMatchObject({
      effectivenessState: "NotTested",
      evidenceIds: [],
      observedBehaviors: [],
      status: "NotTested"
    });
    expect(afterT1071).toMatchObject({
      // Canonical Slice 5 denominator: LoggedOnly coverage → TelemetryOnly.
      effectivenessState: "TelemetryOnly",
      evidenceIds: [evidenceId],
      observedBehaviors: ["Logged"],
      observedSources: ["Splunk"],
      status: "LoggedOnly"
    });
    expect(afterT1071?.recommendation).toContain("Tune alert routing");
    expect(after.loggedOnlyTechniques).toBeGreaterThan(
      before.loggedOnlyTechniques
    );
    expect(afterT1071?.status).not.toBe("Covered");
    expect(afterT1071?.effectivenessState).not.toBe("Detected");
  });
});
