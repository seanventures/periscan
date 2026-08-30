import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  COMPLIANCE_PACK_DISCLAIMER,
  computeSnapshotComplianceTrace
} from "../../packages/reports/src/compliance-catalog.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";
const FRAMEWORK = "DORAAttestation";
const CONTROL_ID = "DORA Art. 17–19 — ICT incident detection";

/**
 * Swarm S3 E2E — customer compliance evidence-support (NOT certification).
 *
 * Flow under test:
 *   1. Persist a real Validation Snapshot with measured evidence
 *   2. Derive Met / Partial / Unmet only from that evidence
 *   3. Govern owner + exception on a catalog control
 *   4. Export HTML + PDF packs that carry the canonical disclaimer
 *   5. Evidence IDs in the trace resolve via /api/v1/evidence/:id deep-links
 *
 * Forbidden: invent Met without evidence; claim certification; drop disclaimers.
 */
describe("compliance evidence-support E2E (not certification)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "compliance-e2e-",
        "Compliance E2E"
      ]);
      await prisma.$disconnect();
    }
  });

  it("snapshot → Met/Partial/Unmet → govern → export disclaimer → evidence deep-links", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "compliance-e2e-owner",
        "Compliance E2E Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;

      await prisma.tenant.update({
        data: { billingPackageKey: "ValidationSnapshot" },
        where: { tenantId }
      });

      // --- 1. Real snapshot with evidence (scope + verify + snapshot) ---
      const scope = await app.inject({
        cookies,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `compliance-e2e-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;

      const verified = await app.inject({
        cookies,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);
      expect(verified.json().verificationStatus).toBe("Verified");

      const snapshotResponse = await app.inject({
        cookies,
        method: "POST",
        payload: { audience: "Auditor", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshotResponse.statusCode).toBe(201);
      const snapshot = snapshotResponse.json();
      expect(snapshot.evidenceIds.length).toBeGreaterThan(0);
      expect(snapshot.snapshotId).toEqual(expect.any(String));

      // Integrity chain (optional continuous/integrity inputs for trace options).
      const integrity = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/evidence/verify-chain"
      });
      expect(integrity.statusCode).toBe(200);

      // --- 2. Derive Met / Partial / Unmet from the persisted snapshot only ---
      const emptyTrace = computeSnapshotComplianceTrace(
        {
          ...snapshot,
          aiAppRisks: [],
          controlObservations: [],
          remediationPriorities: [],
          topAttackPaths: []
        },
        FRAMEWORK
      );
      expect(emptyTrace).not.toBeNull();
      expect(emptyTrace!.metCount).toBe(0);
      expect(emptyTrace!.controls.every((c) => c.status === "Unmet")).toBe(
        true
      );

      const trace = computeSnapshotComplianceTrace(snapshot, FRAMEWORK, {
        evidenceIntegrity:
          integrity.json().valid === true && integrity.json().checked > 0
            ? {
                evidenceIds: snapshot.evidenceIds as string[],
                validatedAt:
                  (integrity.json().verifiedAt as string) ?? snapshot.createdAt,
                verified: true
              }
            : null
      });
      expect(trace).not.toBeNull();
      expect(trace!.framework).toBe(FRAMEWORK);
      expect(trace!.displayName).toMatch(/partial/i);
      expect(trace!.controls.length).toBeGreaterThanOrEqual(7);

      // Honesty: Met only when every required kind is satisfied; never invent Met.
      for (const control of trace!.controls) {
        if (control.status === "Met") {
          expect(control.missing).toEqual([]);
          expect(control.satisfiedBy.length).toBeGreaterThan(0);
          // Met requires supporting measured evidence IDs for the satisfied kinds.
          expect(control.evidenceIds.length).toBeGreaterThan(0);
        }
        if (control.status === "Unmet") {
          expect(control.satisfiedBy).toEqual([]);
        }
        if (control.status === "Partial") {
          expect(control.satisfiedBy.length).toBeGreaterThan(0);
          expect(control.missing.length).toBeGreaterThan(0);
        }
      }

      // With a real snapshot we expect at least one non-Unmet when control
      // observations or paths carried evidence (measured posture often does).
      const linkedControls = trace!.controls.filter(
        (c) => c.evidenceIds.length > 0
      );
      // Even if all Unmet (no matching kinds), evidence deep-link path still runs
      // against snapshot.evidenceIds below. Prefer Partial/Met when present.
      if (linkedControls.length > 0) {
        expect(
          linkedControls.every((c) => c.status !== "Unmet")
        ).toBe(true);
      }

      // --- 3. Govern owner + exception on a catalog control ---
      const govern = await app.inject({
        cookies,
        method: "POST",
        payload: {
          controlId: CONTROL_ID,
          evidenceRequest:
            "Attach next measured detection observation + integrity chain.",
          exceptionExpiresAt: new Date(
            Date.now() + 14 * 86_400_000
          ).toISOString(),
          exceptionRationale:
            "Temporary compensating monitoring while runner fleet expands.",
          framework: FRAMEWORK,
          owner: "GRC Evidence Owner",
          reviewNotes: "Swarm S3 E2E governance path.",
          signoffStatus: "InReview"
        },
        url: "/api/v1/compliance/governance"
      });
      expect(govern.statusCode).toBe(200);
      expect(govern.json().catalogVersion).toBe("periscan-2026.07.s3");
      expect(govern.json().summary.owned).toBeGreaterThanOrEqual(1);
      expect(govern.json().summary.exceptions).toBeGreaterThanOrEqual(1);
      const governed = govern
        .json()
        .controls.find(
          (c: { controlId: string }) => c.controlId === CONTROL_ID
        );
      expect(governed).toMatchObject({
        exceptionActive: true,
        owner: "GRC Evidence Owner",
        signoffStatus: "InReview"
      });

      // --- 4. Export HTML + PDF with canonical disclaimer (not certification) ---
      const reportCreate = await app.inject({
        cookies,
        method: "POST",
        payload: {
          audience: "Auditor",
          packType: FRAMEWORK,
          snapshotId: snapshot.snapshotId,
          title: `${trace!.displayName} measured control trace`
        },
        url: "/api/v1/reports"
      });
      expect(reportCreate.statusCode).toBe(201);
      const evidencePackId = reportCreate.json().evidencePackId as string;
      expect(reportCreate.json().packType).toBe(FRAMEWORK);

      const htmlExport = await app.inject({
        cookies,
        method: "POST",
        payload: { format: "html" },
        url: `/api/v1/reports/${evidencePackId}/export`
      });
      expect(htmlExport.statusCode).toBe(200);
      expect(htmlExport.body).toMatch(/not a certification/i);
      expect(htmlExport.body).toMatch(/not an audit opinion/i);
      expect(htmlExport.body).toContain("Customer evidence support only");
      expect(htmlExport.body).toContain(COMPLIANCE_PACK_DISCLAIMER);
      expect(htmlExport.body).toMatch(/Compliance Control Trace|partial/i);
      // Must not claim formal certification language.
      expect(htmlExport.body).not.toMatch(
        /this organization is certified|vendor SOC 2 Type II report for Periscan customers/i
      );
      // Control IDs from the expanded catalog appear in the pack.
      expect(htmlExport.body).toContain("DORA Art.");
      // Evidence IDs from the snapshot appear for deep-link / audit follow-up.
      const sampleEvidenceId = snapshot.evidenceIds[0] as string;
      expect(htmlExport.body).toContain(sampleEvidenceId);

      const pdfExport = await app.inject({
        cookies,
        method: "POST",
        payload: { format: "pdf" },
        url: `/api/v1/reports/${evidencePackId}/export`
      });
      expect(pdfExport.statusCode).toBe(200);
      expect(pdfExport.headers["content-type"]).toContain("application/pdf");
      expect(pdfExport.body).toContain("%PDF-1.4");
      expect(pdfExport.body).toMatch(/not a certification/i);
      expect(pdfExport.body).toMatch(/not an audit opinion/i);
      expect(pdfExport.body).toContain("Customer evidence support only");

      // Also export NIS2 + PCI packs for the same snapshot (wave-priority frameworks).
      for (const packType of ["NIS2Attestation", "PCIDSSAttestation"] as const) {
        const pack = await app.inject({
          cookies,
          method: "POST",
          payload: {
            audience: "Auditor",
            packType,
            snapshotId: snapshot.snapshotId,
            title: `${packType} evidence support`
          },
          url: "/api/v1/reports"
        });
        expect(pack.statusCode).toBe(201);
        const exported = await app.inject({
          cookies,
          method: "POST",
          payload: { format: "html" },
          url: `/api/v1/reports/${pack.json().evidencePackId}/export`
        });
        expect(exported.statusCode).toBe(200);
        expect(exported.body).toMatch(/not a certification/i);
        expect(exported.body).toMatch(/not an audit opinion/i);
        expect(exported.body).toMatch(/partial/i);
      }

      // --- 5. Evidence deep-links resolve for IDs surfaced in the pack ---
      const evidenceGet = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/evidence/${sampleEvidenceId}`
      });
      expect(evidenceGet.statusCode).toBe(200);
      expect(evidenceGet.json().evidenceId).toBe(sampleEvidenceId);

      // Trace-linked evidence IDs (if any) also resolve.
      const linkedIds = [
        ...new Set(trace!.controls.flatMap((c) => c.evidenceIds))
      ].slice(0, 5);
      for (const evidenceId of linkedIds) {
        const deep = await app.inject({
          cookies,
          method: "GET",
          url: `/api/v1/evidence/${evidenceId}`
        });
        expect(deep.statusCode).toBe(200);
        expect(deep.json().evidenceId).toBe(evidenceId);
      }

      // Tenant isolation: other tenant cannot resolve deep-links.
      const other = await testHelpers.performSignup(
        app,
        "compliance-e2e-other",
        "Compliance E2E Other"
      );
      const isolated = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: other.cookie },
        method: "GET",
        url: `/api/v1/evidence/${sampleEvidenceId}`
      });
      expect(isolated.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  }, 90_000);
});
