import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS,
  REMEDIATION_FIXED_AUTHORIZED_WRITER_FILES,
  REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS,
  assertRemediationFixedOnlyViaVerification,
  buildTargetedFixVerificationPlan,
  generateReviewableRemediationTemplates,
  isRemediationFixedAuthorizedByVerification,
  RemediationFixedWithoutVerificationError,
  resolveExternalTicketClosedRemediationStatus
} from "./fix-verification";

const SHARED_SRC_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SHARED_SRC_DIR, "../../..");

const PRODUCTION_ROOTS = ["apps", "packages"] as const;
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  "fixtures"
]);

function walkTsFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name.startsWith(".") || SKIP_DIR_NAMES.has(name)) {
      continue;
    }
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (
      !name.endsWith(".ts") &&
      !name.endsWith(".tsx")
    ) {
      continue;
    }
    // Architecture law applies to production writers, not tests/fixtures/demos.
    if (
      name.endsWith(".test.ts") ||
      name.endsWith(".test.tsx") ||
      name.endsWith(".spec.ts") ||
      name.endsWith(".spec.tsx") ||
      /[/\\]tests[/\\]/.test(full) ||
      /[/\\]__tests__[/\\]/.test(full) ||
      /[/\\]fixtures[/\\]/.test(full)
    ) {
      continue;
    }
    out.push(full);
  }
  return out;
}

function listProductionSourceFiles(): string[] {
  const files: string[] = [];
  for (const root of PRODUCTION_ROOTS) {
    walkTsFiles(join(REPO_ROOT, root), files);
  }
  return files;
}

describe("assertRemediationFixedOnlyViaVerification (P09-12 Fixed multiverse)", () => {
  it("allows Fixed only when verification outcome is Fixed with measured revalidation", () => {
    expect(
      isRemediationFixedAuthorizedByVerification({
        measuredRevalidation: true,
        nextStatus: "Fixed",
        verificationOutcome: "Fixed"
      })
    ).toBe(true);

    expect(() =>
      assertRemediationFixedOnlyViaVerification({
        measuredRevalidation: true,
        nextStatus: "Fixed",
        verificationOutcome: "Fixed"
      })
    ).not.toThrow();
  });

  it("rejects Fixed without a Fixed verification outcome", () => {
    expect(
      isRemediationFixedAuthorizedByVerification({
        measuredRevalidation: true,
        nextStatus: "Fixed",
        verificationOutcome: "StillExposed"
      })
    ).toBe(false);

    expect(() =>
      assertRemediationFixedOnlyViaVerification({
        measuredRevalidation: true,
        nextStatus: "Fixed",
        verificationOutcome: null
      })
    ).toThrow(RemediationFixedWithoutVerificationError);
  });

  it("rejects Fixed when revalidation was not measured", () => {
    expect(
      isRemediationFixedAuthorizedByVerification({
        measuredRevalidation: false,
        nextStatus: "Fixed",
        verificationOutcome: "Fixed"
      })
    ).toBe(false);

    expect(() =>
      assertRemediationFixedOnlyViaVerification({
        measuredRevalidation: false,
        nextStatus: "Fixed",
        verificationOutcome: "Fixed"
      })
    ).toThrow(/measured verification/);
  });

  it("does not gate non-Fixed statuses (ticket close, still exposed, open)", () => {
    for (const nextStatus of [
      "Open",
      "InProgress",
      "StillExposed",
      "ClosedWithoutEvidence",
      "VerificationPending",
      "Mitigated",
      "Inconclusive"
    ]) {
      expect(
        isRemediationFixedAuthorizedByVerification({
          nextStatus,
          verificationOutcome: null,
          measuredRevalidation: false
        })
      ).toBe(true);
      expect(() =>
        assertRemediationFixedOnlyViaVerification({ nextStatus })
      ).not.toThrow();
    }
  });
});

describe("resolveExternalTicketClosedRemediationStatus", () => {
  it("maps open/in-progress remediations to ClosedWithoutEvidence when verification is required", () => {
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "Open",
        verificationRequired: true
      })
    ).toBe("ClosedWithoutEvidence");
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "InProgress",
        verificationRequired: true
      })
    ).toBe("ClosedWithoutEvidence");
  });

  it("never upgrades ticket close to Fixed", () => {
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "Open",
        verificationRequired: true
      })
    ).not.toBe("Fixed");
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "InProgress",
        verificationRequired: true
      })
    ).not.toBe("Fixed");
    // Already-verified Fixed is preserved (not rewritten from ticket state).
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "Fixed",
        verificationRequired: true
      })
    ).toBe("Fixed");
  });

  it("leaves status unchanged when verification is not required", () => {
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "InProgress",
        verificationRequired: false
      })
    ).toBe("InProgress");
  });
});

describe("P09-3 architecture: RemediationTask Fixed writers", () => {
  it("keeps authorized writer list stable and file-derived", () => {
    expect([...REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS]).toEqual([
      "apps/api/src/services/remediation.ts:verifyRemediation",
      "apps/api/src/services/runner.ts:submitRunnerTaskResult"
    ]);
    expect([...REMEDIATION_FIXED_AUTHORIZED_WRITER_FILES]).toEqual([
      "apps/api/src/services/remediation.ts",
      "apps/api/src/services/runner.ts"
    ]);
  });

  it("requires assert chokepoint in every authorized writer file", () => {
    for (const rel of REMEDIATION_FIXED_AUTHORIZED_WRITER_FILES) {
      const abs = join(REPO_ROOT, rel);
      const source = readFileSync(abs, "utf8");
      expect(
        source.includes("assertRemediationFixedOnlyViaVerification"),
        `${rel} must call assertRemediationFixedOnlyViaVerification`
      ).toBe(true);
      expect(
        /remediationTask\.update/.test(source),
        `${rel} must update remediationTask`
      ).toBe(true);
    }

    for (const entry of REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS) {
      const [rel, symbol] = entry.split(":") as [string, string];
      const source = readFileSync(join(REPO_ROOT, rel), "utf8");
      // Symbol appears as method/function name in the authorized file.
      expect(
        source.includes(symbol),
        `${entry} symbol must exist in ${rel}`
      ).toBe(true);
    }
  });

  it("bans free RemediationTask status Fixed writes outside authorized files", () => {
    const authorized = new Set(REMEDIATION_FIXED_AUTHORIZED_WRITER_FILES);
    const definitionRel = "packages/shared/src/fix-verification.ts";
    const freeLiteralWriters: string[] = [];
    const assertCallSitesOutsideAuthorized: string[] = [];
    const dynamicStatusWithoutAssert: string[] = [];

    // Literal Fixed assignment on a remediationTask write data block.
    const literalFixedOnRemediationUpdate =
      /remediationTask\.(update|updateMany|create)\s*\(\s*\{[\s\S]{0,800}?status\s*:\s*["']Fixed["']/;
    // Dynamic status that can become Fixed (verification outcome path).
    const dynamicRemediationStatusWrite =
      /remediationTask\.(update|updateMany)\s*\(\s*\{[\s\S]{0,600}?status\s*:\s*(outcome|verificationResult\.outcome|nextStatus)\b/;

    for (const abs of listProductionSourceFiles()) {
      const rel = relative(REPO_ROOT, abs).split("\\").join("/");
      const source = readFileSync(abs, "utf8");

      if (
        source.includes("assertRemediationFixedOnlyViaVerification") &&
        !rel.endsWith("fix-verification.ts") &&
        !rel.endsWith("fix-verification.test.ts") &&
        !rel.endsWith("ontology.test.ts") &&
        !rel.endsWith("ontology-laws.test.ts") &&
        !rel.endsWith("ontology-laws.ts") &&
        !rel.endsWith("claim-deny-list.ts") &&
        !rel.endsWith("domain.ts") &&
        !authorized.has(rel)
      ) {
        // Call sites only — imports of the type/name for re-export docs are ok
        // if they do not also write remediation status Fixed. Flag bare calls.
        if (
          /assertRemediationFixedOnlyViaVerification\s*\(/.test(source) &&
          rel !== definitionRel
        ) {
          assertCallSitesOutsideAuthorized.push(rel);
        }
      }

      if (literalFixedOnRemediationUpdate.test(source) && !authorized.has(rel)) {
        freeLiteralWriters.push(rel);
      }

      if (
        dynamicRemediationStatusWrite.test(source) &&
        !source.includes("assertRemediationFixedOnlyViaVerification")
      ) {
        dynamicStatusWithoutAssert.push(rel);
      }
    }

    expect(
      freeLiteralWriters,
      `Literal RemediationTask status Fixed outside authorized writers:\n${freeLiteralWriters.join("\n")}`
    ).toEqual([]);
    expect(
      assertCallSitesOutsideAuthorized,
      `assertRemediationFixedOnlyViaVerification call sites outside authorized list:\n${assertCallSitesOutsideAuthorized.join("\n")}`
    ).toEqual([]);
    expect(
      dynamicStatusWithoutAssert,
      `remediationTask status from outcome without assert:\n${dynamicStatusWithoutAssert.join("\n")}`
    ).toEqual([]);
  });
});

describe("buildTargetedFixVerificationPlan", () => {
  it("targets repository secret paths with secrets and cloud posture modules", () => {
    expect(
      buildTargetedFixVerificationPlan({
        pathName: "Repo secret to production role",
        pathNodeLabels: ["Repository secret", "Production IAM role"],
        remediation: {
          recommendedAction: "Rotate the exposed secret.",
          relatedPathId: "path-1",
          verificationMethod: "Rerun path validation."
        }
      })
    ).toMatchObject({
      family: "RepositorySecretToCloudPath",
      selectedModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"]
    });
  });

  it("targets external exposure paths with measured DNS, TLS, HTTP, and email posture modules", () => {
    expect(
      buildTargetedFixVerificationPlan({
        pathName: "Public external service remains reachable",
        remediation: {
          recommendedAction: "Restrict internet exposure.",
          relatedPathId: "path-1",
          verificationMethod: "Rerun safe external validation."
        }
      })
    ).toMatchObject({
      family: "ExternalExposure",
      selectedModuleIds: [...EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS]
    });
  });

  it("targets AI and control remediations with their safe validation modules", () => {
    expect(
      buildTargetedFixVerificationPlan({
        pathName: "AI RAG app can retrieve unauthorized content",
        remediation: {
          recommendedAction: "Restrict RAG data source.",
          relatedPathId: "path-1",
          verificationMethod: "Rerun AI app validation."
        }
      }).selectedModuleIds
    ).toEqual(["ai_app.safe_validation"]);

    expect(
      buildTargetedFixVerificationPlan({
        pathName: "Control missed validation",
        remediation: {
          recommendedAction: "Tune missed control detection.",
          relatedPathId: "path-1",
          verificationMethod: "Rerun control validation."
        }
      }).selectedModuleIds
    ).toEqual(["atomic.control_validation_safe"]);
  });

  it("falls back to path correlation or generic comparison when no family matches", () => {
    expect(
      buildTargetedFixVerificationPlan({
        hasPreviousPath: true,
        remediation: {
          recommendedAction: "Break the path.",
          relatedPathId: "path-1",
          verificationMethod: "Compare current graph."
        }
      }).selectedModuleIds
    ).toEqual(["periscan.fix_verification.compare"]);

    expect(
      buildTargetedFixVerificationPlan({
        remediation: {
          recommendedAction: "Review remediation evidence.",
          verificationMethod: "Compare submitted evidence."
        }
      }).selectedModuleIds
    ).toEqual(["periscan.fix_verification.compare"]);
  });

  it("P06-13 prefers original measured modules over family keyword map", () => {
    const plan = buildTargetedFixVerificationPlan({
      originalModuleIds: [
        "periscan.tls_certificate_check",
        "periscan.dns_resolution_check",
        "periscan.fix_verification.compare",
        "periscan.tls_certificate_check"
      ],
      pathName: "Repo secret to production role",
      remediation: {
        recommendedAction: "Rotate the exposed secret.",
        relatedPathId: "path-1",
        verificationMethod: "Rerun path validation."
      }
    });
    expect(plan.usedOriginalModules).toBe(true);
    expect(plan.selectedModuleIds).toEqual([
      "periscan.tls_certificate_check",
      "periscan.dns_resolution_check"
    ]);
    // Family still classified from keywords for reporting, but modules are original.
    expect(plan.family).toBe("RepositorySecretToCloudPath");
  });
});

describe("generateReviewableRemediationTemplates", () => {
  it("exports context without executing a customer change", () => {
    const artifacts = generateReviewableRemediationTemplates({
      recommendedAction: "Restrict the exposed trust relationship.",
      remediationId: "11111111-1111-4111-8111-111111111111",
      technicalSteps: ["Review the exact diff.", "Run fresh verification."]
    });

    expect(artifacts).toMatchObject({
      executionMode: "ExportOnly",
      requiresReview: true
    });
    expect(artifacts.scriptBash).toContain("No remediation action was executed");
    expect(artifacts.scriptBash).toContain("exit 2");
    expect(artifacts.scriptBash).not.toMatch(/aws\s+|kubectl\s+|terraform\s+apply/iu);
    expect(artifacts.iacTerraform).not.toContain('resource "');
    expect(artifacts.autoPlaybookNote).toContain("no infrastructure");
  });
});
