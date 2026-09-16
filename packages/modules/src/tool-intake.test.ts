import { describe, expect, it } from "vitest";

import type { ToolIntakeManifestRequest } from "@periscan/shared";

import { evaluateToolIntakeManifest } from "./tool-intake.js";

const baseCandidate: ToolIntakeManifestRequest = {
  binaryName: null,
  canExecuteCode: false,
  canExfiltrateData: false,
  canModifyTarget: false,
  category: "Dependency",
  customerVisibleDescription:
    "Safely imports dependency vulnerability evidence for tenant-owned repositories.",
  dataSensitivity: "Moderate",
  defaultVersion: "1.2.3",
  destructivePotential: "None",
  displayName: "Example Scanner",
  dockerImage: "ghcr.io/example/scanner",
  docsUrl: "https://github.com/example/scanner",
  evidenceTypes: ["NormalizedEvidence"],
  executionMode: "ControlPlane",
  gitRepo: "https://github.com/example/scanner.git",
  intendedUse:
    "Parse approved repository manifests and produce normalized dependency advisory evidence without changing customer systems.",
  license: "Apache-2.0",
  maintainer: "Periscan Security Engineering",
  moduleId: "example.scanner_import",
  name: "Example Scanner Import",
  networkAccessRequired: false,
  npmPackage: null,
  pipPackage: null,
  proposedCapabilities: ["Dependency advisory import"],
  requiredIntegrations: ["github"],
  requiredPermissions: ["repo metadata read"],
  requiredScopes: ["Repository"],
  runMode: "ServiceDirect",
  runtimePreference: ["docker", "git"],
  safetyLevel: "PassiveReadOnly",
  sourceUrl: "https://github.com/example/scanner",
  supportedMissionTypes: ["ValidationSnapshot", "ExposureValidation"],
  toolId: "example-scanner",
  writesToTarget: false
};

describe("tool intake evaluator", () => {
  it("accepts a passive reviewed-runtime candidate for catalog review", () => {
    const report = evaluateToolIntakeManifest(baseCandidate, {
      now: new Date("2026-06-27T12:00:00.000Z")
    });

    expect(report.decision).toBe("AcceptedForCatalogReview");
    expect(report.normalizedToolId).toBe("example-scanner");
    expect(report.governance.defaultEnabled).toBe(true);
    expect(report.governance.installableRuntimes).toEqual(["docker", "git"]);
    expect(report.governance.liveExecutionAllowed).toBe(true);
    expect(report.moduleScaffold.requiredTests).toEqual(
      expect.arrayContaining(["Parser fixture test", "Evidence redaction test"])
    );
    expect(report.checks.every((check) => check.status === "Pass")).toBe(true);
  });

  it("requires changes when the proposed tool ID already exists", () => {
    const report = evaluateToolIntakeManifest({
      ...baseCandidate,
      displayName: "Gitleaks Fork",
      moduleId: "gitleaks.fork_import",
      toolId: "gitleaks"
    });

    expect(report.decision).toBe("RequiresChanges");
    expect(report.duplicateOf).toBe("gitleaks");
    expect(report.requiredActions.join("\n")).toContain("Choose a new tool ID");
  });

  it("rejects AGPL/legal-review candidates for enablement", () => {
    const report = evaluateToolIntakeManifest({
      ...baseCandidate,
      license: "AGPL-3.0"
    });

    expect(report.decision).toBe("Rejected");
    expect(report.governance.legalReviewRequired).toBe(true);
    expect(report.governance.defaultEnabled).toBe(false);
    expect(
      report.checks.find((check) => check.checkId === "license-policy")
    ).toMatchObject({
      severity: "Blocked",
      status: "Fail"
    });
  });

  it("rejects destructive or exfiltration-capable candidates", () => {
    const report = evaluateToolIntakeManifest({
      ...baseCandidate,
      canExfiltrateData: true,
      destructivePotential: "High",
      safetyLevel: "Disallowed"
    });

    expect(report.decision).toBe("Rejected");
    expect(report.governance.liveExecutionAllowed).toBe(false);
    expect(
      report.checks.find((check) => check.checkId === "safety-boundary")
    ).toMatchObject({
      severity: "Blocked",
      status: "Fail"
    });
  });

  it("requires install metadata for platform-managed runtime pulls", () => {
    const report = evaluateToolIntakeManifest({
      ...baseCandidate,
      dockerImage: null,
      gitRepo: null,
      runtimePreference: ["docker", "binary"]
    });

    expect(report.decision).toBe("RequiresChanges");
    expect(report.governance.installableRuntimes).toEqual([]);
    expect(
      report.checks.find((check) => check.checkId === "runtime-installability")
    ).toMatchObject({
      severity: "High",
      status: "Fail"
    });
  });
});
