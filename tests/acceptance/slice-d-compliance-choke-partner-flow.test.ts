/**
 * Continuous loop Slice D — compliance governance sign-off + multi-framework
 * export, choke honesty methodology string, partner residual honesty (#2/26/28/38/51).
 *
 * Scorecard caps (not edited by this suite):
 *  - #80 Automated Compliance Attestations: currentScore < 4
 *  - #4 Choke Point Analysis: currentScore < 4
 * Partner rows never invent live dark-web / OT speak / crowd HITL / Leading A2A.
 */
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { COMPLIANCE_PACK_DISCLAIMER } from "../../packages/reports/src/compliance-catalog.js";
import {
  buildPartnerCapabilityHonesty
} from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("Slice D compliance / choke / partner acceptance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "slice-d-comp-",
        "slice-d-choke-",
        "slice-d-partner-"
      ]);
      await prisma.$disconnect();
    }
  });

  it("deepens governance sign-off + multi-framework export without certification claims", async () => {
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
        "slice-d-comp-owner",
        "Slice D Compliance Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      await prisma.tenant.update({
        data: { billingPackageKey: "ValidationSnapshot" },
        where: { tenantId }
      });

      const summary = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/compliance/governance/summary"
      });
      expect(summary.statusCode).toBe(200);
      const summaryBody = summary.json() as {
        notCertification: boolean;
        scorecardId: number;
        honestyNote: string;
        frameworks: Array<{ framework: string; partialCatalog: boolean }>;
        totals: { frameworkCount: number; totalControls: number };
      };
      expect(summaryBody.notCertification).toBe(true);
      expect(summaryBody.scorecardId).toBe(80);
      expect(summaryBody.honestyNote).toMatch(/not.*certif|evidence-support/i);
      expect(summaryBody.frameworks.length).toBeGreaterThanOrEqual(8);
      expect(
        summaryBody.frameworks.every((f) => f.partialCatalog === true)
      ).toBe(true);
      expect(summaryBody.totals.frameworkCount).toBe(
        summaryBody.frameworks.length
      );

      // Approved without owner is rejected (Slice D deepen).
      const missingOwner = await app.inject({
        cookies,
        method: "POST",
        payload: {
          controlId: "DORA Art. 6 — ICT risk management framework",
          framework: "DORAAttestation",
          reviewNotes: "Notes without owner",
          signoffStatus: "Approved"
        },
        url: "/api/v1/compliance/governance"
      });
      expect(missingOwner.statusCode).toBe(400);

      // Batch without notCertificationAcknowledged fails when approving.
      const batchNoAck = await app.inject({
        cookies,
        method: "POST",
        payload: {
          items: [
            {
              controlId: "DORA Art. 6 — ICT risk management framework",
              framework: "DORAAttestation",
              owner: "GRC",
              reviewNotes: "Measured evidence reviewed for support pack.",
              signoffStatus: "Approved"
            }
          ],
          notCertificationAcknowledged: false
        },
        url: "/api/v1/compliance/governance/batch"
      });
      expect(batchNoAck.statusCode).toBe(400);

      const doraId = "DORA Art. 6 — ICT risk management framework";
      const nis2Id = "NIS2 Art. 21(2)(a) — Risk analysis";
      const pciId = "PCI DSS Req. 11.3 — Vulnerability testing";

      const batch = await app.inject({
        cookies,
        method: "POST",
        payload: {
          items: [
            {
              controlId: doraId,
              framework: "DORAAttestation",
              owner: "GRC Engineering",
              reviewNotes:
                "Measured exposure + integrity evidence reviewed. Support sign-off only.",
              signoffStatus: "Approved"
            },
            {
              controlId: nis2Id,
              framework: "NIS2Attestation",
              owner: "GRC Engineering",
              reviewNotes:
                "Cross-framework support review. Not a certification claim.",
              signoffStatus: "Approved"
            },
            {
              controlId: pciId,
              framework: "PCIDSSAttestation",
              owner: "GRC Engineering",
              reviewNotes: "PCI evidence-support owner assigned and approved.",
              signoffStatus: "Approved"
            }
          ],
          notCertificationAcknowledged: true
        },
        url: "/api/v1/compliance/governance/batch"
      });
      expect(batch.statusCode).toBe(200);
      const batchBody = batch.json() as {
        notCertification: boolean;
        results: Array<{ signoffStatus: string }>;
        summary: { totals: { approved: number } };
      };
      expect(batchBody.notCertification).toBe(true);
      expect(batchBody.results).toHaveLength(3);
      expect(
        batchBody.results.every((r) => r.signoffStatus === "Approved")
      ).toBe(true);
      expect(batchBody.summary.totals.approved).toBeGreaterThanOrEqual(3);

      // Snapshot for multi-framework export.
      const scope = await app.inject({
        cookies,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `slice-d-comp-${randomUUID()}.example.com`
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
      const snapshotResponse = await app.inject({
        cookies,
        method: "POST",
        payload: { audience: "Auditor", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshotResponse.statusCode).toBe(201);
      const snapshotId = snapshotResponse.json().snapshotId as string;

      const multi = await app.inject({
        cookies,
        method: "POST",
        payload: {
          audience: "Auditor",
          frameworks: [
            "DORAAttestation",
            "NIS2Attestation",
            "PCIDSSAttestation",
            "ISO27001Attestation",
            "SECAttestation"
          ],
          snapshotId,
          titlePrefix: "Slice D multi-framework"
        },
        url: "/api/v1/compliance/exports/multi-framework"
      });
      expect(multi.statusCode).toBe(201);
      const multiBody = multi.json() as {
        disclaimer: string;
        notCertification: boolean;
        scorecardId: number;
        packs: Array<{
          evidencePackId: string;
          framework: string;
          partialCatalog: boolean;
          governance: { approved: number; total: number };
        }>;
      };
      expect(multiBody.notCertification).toBe(true);
      expect(multiBody.scorecardId).toBe(80);
      expect(multiBody.disclaimer).toBe(COMPLIANCE_PACK_DISCLAIMER);
      expect(multiBody.packs).toHaveLength(5);
      expect(multiBody.packs.every((p) => p.partialCatalog)).toBe(true);
      expect(
        multiBody.packs.find((p) => p.framework === "DORAAttestation")
          ?.governance.approved
      ).toBeGreaterThanOrEqual(1);

      for (const pack of multiBody.packs.slice(0, 3)) {
        const html = await app.inject({
          cookies,
          method: "POST",
          payload: { format: "html" },
          url: `/api/v1/reports/${pack.evidencePackId}/export`
        });
        expect(html.statusCode).toBe(200);
        expect(html.body).toContain(COMPLIANCE_PACK_DISCLAIMER);
        expect(html.body).toMatch(/not a certification/i);
        expect(html.body).toMatch(/not an audit opinion/i);
        expect(html.body).not.toMatch(
          /this organization is certified|vendor SOC 2 Type II report for Periscan customers/i
        );
      }
    } finally {
      await app.close();
    }
  }, 120_000);

  it("exposes choke analysis honesty methodology string (scorecard #4 Partial)", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "slice-d-choke-owner",
        "Slice D Choke Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      // Honesty pins are required even with zero correlated paths.
      const empty = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths/choke-points"
      });
      expect(empty.statusCode).toBe(200);
      const emptyBody = empty.json() as {
        methodology: string;
        honestyNote: string;
        assumptions: string[];
        totalPaths: number;
      };
      expect(emptyBody.methodology).toBe("GreedyHittingSetApproximation");
      expect(emptyBody.honestyNote).toMatch(/GreedyHittingSetApproximation/);
      expect(emptyBody.honestyNote).toMatch(/min-cut|Leading|Partial/i);
      expect(emptyBody.honestyNote).toMatch(/scorecard #4|<4|Partial/i);
      expect(emptyBody.assumptions.join(" ")).toMatch(
        /min-cut|Leading|Partial|greedy/i
      );
      expect(emptyBody.assumptions.some((a) => /greedy/i.test(a))).toBe(true);
      expect(
        emptyBody.assumptions.some((a) =>
          /Partial until|do not market as Leading/i.test(a)
        )
      ).toBe(true);
      expect(emptyBody.methodology.toLowerCase()).not.toContain("mincut");
      expect(emptyBody.methodology.toLowerCase()).not.toContain("min-cut");
      expect(JSON.stringify(emptyBody)).not.toMatch(
        /exact global minimum cut proven|XM Cyber parity|Leading choke science shipped/i
      );

      // With correlated paths (fixture integrations), methodology pin is unchanged.
      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `slice-d-choke-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      const github = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/github/connect"
      });
      const aws = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/aws/connect"
      });
      for (const integrationId of [
        github.json().integrationId as string,
        aws.json().integrationId as string
      ]) {
        await app.inject({
          cookies: auth,
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });
      }

      const withPaths = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths/choke-points"
      });
      expect(withPaths.statusCode).toBe(200);
      const body = withPaths.json() as {
        methodology: string;
        honestyNote: string;
        assumptions: string[];
      };
      expect(body.methodology).toBe("GreedyHittingSetApproximation");
      expect(body.honestyNote).toContain("GreedyHittingSetApproximation");
      expect(body.honestyNote).toMatch(/scorecard #4|<4|Partial/i);
      expect(body.assumptions.some((a) => /min-cut|Leading/i.test(a))).toBe(
        true
      );
    } finally {
      await app.close();
    }
  }, 120_000);

  it("partner residual honesty covers dark web / OT / HITL / A2A / AgentDID", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "slice-d-partner-owner",
        "Slice D Partner Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      const response = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/partner-capabilities/honesty"
      });
      expect(response.statusCode).toBe(200);
      const honesty = response.json() as ReturnType<
        typeof buildPartnerCapabilityHonesty
      >;
      expect(honesty.scorecardIds).toEqual([2, 26, 28, 38, 51]);
      expect(honesty.partnerGatedScorecardIds).toEqual([2, 26, 28]);
      expect(honesty.honestyNote).toMatch(/never invent/i);

      for (const id of [2, 26, 28]) {
        const row = honesty.rows.find((r) => r.scorecardId === id);
        expect(row?.gate).toBe("Partner");
        expect(row?.state).toBe("ExternallyGated");
      }
      expect(
        honesty.rows.find((r) => r.scorecardId === 2)?.foreverRefuse.join(" ")
      ).toMatch(/dark-web/i);
      expect(
        honesty.rows.find((r) => r.scorecardId === 26)?.foreverRefuse.join(" ")
      ).toMatch(/Modbus|OT/i);
      expect(
        honesty.rows.find((r) => r.scorecardId === 28)?.foreverRefuse.join(" ")
      ).toMatch(/marketplace|HITL|crowd/i);

      const a2a = honesty.rows.find((r) => r.scorecardId === 38);
      expect(a2a?.state).toBe("AvailableWithHonesty");
      expect(a2a?.productSurfaces.join(" ")).toMatch(/A2A/i);
      expect(a2a?.foreverRefuse.join(" ")).toMatch(/Leading/i);

      const agentDid = honesty.rows.find((r) => r.scorecardId === 51);
      expect(agentDid?.state).toBe("AvailableWithHonesty");
      expect(agentDid?.productSurfaces.join(" ")).toMatch(/AgentDID|VC/i);

      // Cross-check safety + enterprise readiness still ExternallyGated for 2/26/28.
      const packs = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/safety-equivalent-packs"
      });
      expect(packs.statusCode).toBe(200);
      expect(packs.json().partnerGatedScorecardIds).toEqual([2, 26, 28]);

      const enterprise = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/packs/enterprise-readiness"
      });
      expect(enterprise.statusCode).toBe(200);
      const enterpriseBody = enterprise.json() as {
        packs: Array<{ key: string; state: string }>;
      };
      for (const key of ["ot-ics", "credential-exposure", "human-validation"]) {
        expect(
          enterpriseBody.packs.find((p) => p.key === key)?.state,
          key
        ).toBe("ExternallyGated");
      }
    } finally {
      await app.close();
    }
  });
});
