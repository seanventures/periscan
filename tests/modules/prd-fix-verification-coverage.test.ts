import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildVerificationResult,
  resolveExternalTicketClosedRemediationStatus
} from "../../apps/api/src/runtime-services.js";
import {
  buildTargetedFixVerificationPlan,
  EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS
} from "../../packages/shared/src/fix-verification.js";
import {
  RemediationStatusSchema,
  ValidationStateSchema,
  VerificationEventSchema,
  VerificationOutcomeSchema
} from "../../packages/shared/src/domain.js";

async function readRepoFile(repoPath: string) {
  return readFile(new URL(`../../${repoPath}`, import.meta.url), "utf8");
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

function parseBulletsFrom(source: string, start: string) {
  const startIndex = source.indexOf(start);

  expect(startIndex).toBeGreaterThanOrEqual(0);

  return source
    .slice(startIndex)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function previousPath(
  overrides: Partial<{
    evidenceBasis: "Heuristic" | "Measured";
    impactScore: number;
    validationState: string;
  }> = {}
) {
  return {
    confidence: 0.9,
    evidenceBasis: "Measured",
    evidenceIds: [randomUUID()],
    impactScore: 80,
    name: "Repo secret to production role",
    pathBreakers: [],
    pathEdges: [],
    pathId: randomUUID(),
    pathNodes: [],
    validationState: "Exploitable",
    ...overrides
  } as Parameters<typeof buildVerificationResult>[0]["previousPath"];
}

function currentDraft(
  overrides: Partial<{
    impactScore: number;
    validationState: string;
  }> = {}
) {
  return {
    confidence: 0.88,
    evidenceBasis: "Measured",
    evidenceIds: [randomUUID()],
    impactScore: 80,
    name: "Repo secret to production role",
    pathBreakers: [],
    pathEdges: [],
    pathId: randomUUID(),
    pathNodes: [],
    validationState: "Exploitable",
    ...overrides
  } as Parameters<typeof buildVerificationResult>[0]["currentDraft"];
}

describe("PRD section 3.6 Fix Verification coverage", () => {
  it("keeps every PRD fix-verification outcome in public status contracts", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.6 Fix Verification",
      "3.7 Evidence Packs"
    );
    const outcomes = parseBulletsBetween(section, "Outcomes", "Requirements");
    const sourceToOutcome = new Map([
      ["Fixed", "Fixed"],
      ["Partially Fixed", "PartiallyFixed"],
      ["Still Exposed", "StillExposed"],
      ["Mitigated", "Mitigated"],
      ["Inconclusive", "Inconclusive"],
      ["Reopened", "Reopened"],
      ["Closed Without Evidence", "ClosedWithoutEvidence"]
    ]);

    expect(outcomes).toEqual([...sourceToOutcome.keys()]);
    for (const outcome of sourceToOutcome.values()) {
      expect(VerificationOutcomeSchema.safeParse(outcome).success).toBe(true);
      expect(RemediationStatusSchema.safeParse(outcome).success).toBe(true);
    }
    expect(
      ValidationStateSchema.safeParse("ClosedWithoutEvidence").success
    ).toBe(true);
  });

  it("derives fixed, partial, exposed, mitigated, inconclusive, reopened, and closed-without-evidence states from proof conditions", () => {
    expect(
      buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        previousPath: previousPath()
      }).outcome
    ).toBe("Fixed");

    expect(
      buildVerificationResult({
        currentDraft: currentDraft({ impactScore: 75 }),
        executedRealRetest: true,
        previousPath: previousPath({ impactScore: 100 })
      }).outcome
    ).toBe("PartiallyFixed");

    expect(
      buildVerificationResult({
        currentDraft: currentDraft({ impactScore: 80 }),
        executedRealRetest: true,
        previousPath: previousPath({ impactScore: 80 })
      }).outcome
    ).toBe("StillExposed");

    expect(
      buildVerificationResult({
        currentDraft: currentDraft({ impactScore: 60 }),
        executedRealRetest: true,
        previousPath: previousPath({ impactScore: 100 })
      }).outcome
    ).toBe("Mitigated");

    expect(
      buildVerificationResult({
        currentDraft: null,
        executedRealRetest: false,
        previousPath: previousPath()
      }).outcome
    ).toBe("Inconclusive");

    expect(
      buildVerificationResult({
        currentDraft: currentDraft({ impactScore: 80 }),
        executedRealRetest: true,
        previousPath: previousPath({ validationState: "Fixed" })
      }).outcome
    ).toBe("Reopened");

    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "InProgress",
        verificationRequired: true
      })
    ).toBe("ClosedWithoutEvidence");
  });

  it("maps remediation/path/control/AI context to targeted retest module families", () => {
    expect(
      buildTargetedFixVerificationPlan({
        pathName: "Repo secret to production role",
        remediation: {
          recommendedAction: "Rotate leaked secret",
          verificationMethod: "Rerun repository secret validation."
        }
      })
    ).toMatchObject({
      family: "RepositorySecretToCloudPath",
      selectedModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"]
    });

    expect(
      buildTargetedFixVerificationPlan({
        pathName: "Public exposure to production",
        remediation: {
          recommendedAction: "Restrict public exposure",
          verificationMethod: "Rerun external posture validation."
        }
      }).selectedModuleIds
    ).toEqual([...EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS]);

    expect(
      buildTargetedFixVerificationPlan({
        pathName: "AI RAG authorization failure",
        remediation: {
          recommendedAction: "Restrict RAG source access",
          verificationMethod: "Rerun safe AI app validation."
        }
      })
    ).toMatchObject({
      family: "AIApplication",
      selectedModuleIds: ["ai_app.safe_validation"]
    });

    expect(
      buildTargetedFixVerificationPlan({
        pathName: "Control missed validation activity",
        remediation: {
          recommendedAction: "Tune control detection",
          verificationMethod: "Rerun control validation."
        }
      })
    ).toMatchObject({
      family: "ControlValidation",
      selectedModuleIds: ["atomic.control_validation_safe"]
    });

    expect(
      buildTargetedFixVerificationPlan({
        hasPreviousPath: true,
        remediation: {
          relatedPathId: randomUUID(),
          verificationMethod: "Recompute the evidence graph."
        }
      })
    ).toMatchObject({
      family: "AttackPathCorrelation",
      selectedModuleIds: ["periscan.fix_verification.compare"]
    });
  });

  it("maps PRD requirements to API routes, ticket tracking, evidence, graph, and report code", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.6 Fix Verification",
      "3.7 Evidence Packs"
    );
    const requirements = parseBulletsFrom(section, "Requirements");
    const appSource = await readRepoFile("apps/api/src/app.ts");
    const remediationService = await readRepoFile(
      "apps/api/src/services/remediation.ts"
    );
    const runtimeSource = await readRepoFile(
      "apps/api/src/runtime-services.ts"
    );
    const reportSource = await readRepoFile("packages/reports/src/index.ts");
    const webClientSource = await readRepoFile(
      "apps/web/src/lib/periscan-api-client.ts"
    );

    expect(requirements).toEqual([
      "Link remediation to exposure, path, or control failure.",
      "Track ticket status.",
      "Detect closed-without-verification.",
      "Trigger targeted re-test.",
      "Create verification event.",
      "Update attack path and risk score.",
      "Update evidence pack."
    ]);

    expect(appSource).toContain('"/api/v1/remediations/:id/create-ticket"');
    expect(appSource).toContain(
      '"/api/v1/remediations/:id/mark-ready-for-verification"'
    );
    expect(appSource).toContain('"/api/v1/remediations/:id/verify"');
    expect(appSource).toContain(
      '"/api/v1/remediations/:id/verification-events"'
    );
    expect(webClientSource).toContain("verifyRemediation(");
    expect(webClientSource).toContain("listVerificationEvents(");

    expect(runtimeSource).toContain("applyMockJiraWorkflowSync");
    expect(runtimeSource).toContain("autoCloseTickets");
    expect(runtimeSource).toContain(
      "resolveExternalTicketClosedRemediationStatus"
    );
    expect(runtimeSource).toContain('"ClosedWithoutEvidence"');
    expect(runtimeSource).toContain('"remediation.closed_without_evidence"');

    expect(remediationService).toContain("buildTargetedFixVerificationPlan");
    expect(remediationService).toContain("resolveFixVerificationModules");
    expect(remediationService).toContain('missionType: "FixVerification"');
    expect(remediationService).toContain("createMissionExecutionProcessor");
    expect(remediationService).toContain("verificationEvent");
    expect(remediationService).toContain("prisma.attackPath.update");
    expect(remediationService).toContain("assessAttackPathRisk");
    expect(remediationService).toContain("fix-verification-comparison");

    expect(reportSource).toContain("RemediationClosurePack");
    expect(reportSource).toContain("latestVerification");
    expect(reportSource).toContain(
      "Periscan only treats remediation as closed when verification evidence supports"
    );
    expect(reportSource).toContain("Verification Plan");
    expect(reportSource).toContain("Evidence IDs");
  });

  it("keeps verification events evidence-linked and provenance-aware", () => {
    const parsed = VerificationEventSchema.parse({
      createdAt: "2026-06-28T00:00:00.000Z",
      evidenceIds: [randomUUID(), randomUUID()],
      exposureReCorrelated: false,
      measuredRevalidation: true,
      newState: "Fixed",
      outcome: "Fixed",
      previousEvidenceBasis: "Measured",
      previousState: "Exploitable",
      remediationId: randomUUID(),
      retestMethod: "connector-resync",
      selectedModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"],
      tenantId: randomUUID(),
      updatedAt: "2026-06-28T00:00:00.000Z",
      validationRunId: randomUUID(),
      verificationId: randomUUID(),
      verifiedAt: "2026-06-28T00:00:00.000Z"
    });

    expect(parsed.evidenceIds).toHaveLength(2);
    expect(parsed.measuredRevalidation).toBe(true);
    expect(parsed.selectedModuleIds).toEqual([
      "gitleaks.repo_secrets",
      "prowler.aws_posture"
    ]);
  });
});
