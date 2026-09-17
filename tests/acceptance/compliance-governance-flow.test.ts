import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";
const FRAMEWORK = "DORAAttestation";
const CONTROL_ID = "DORA Art. 6 — ICT risk management framework";

describe("compliance control governance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["compliance-owner", "compliance-other"]);
      await prisma.$disconnect();
    }
  });

  it("versions the catalog and persists owner, request, exception, sign-off, history, and isolation", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma })
    });
    try {
      const owner = await testHelpers.performSignup(app, "compliance-owner", "Compliance Owner Tenant");
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const initial = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/compliance/governance?framework=${FRAMEWORK}`
      });
      expect(initial.statusCode).toBe(200);
      // Swarm S3 expanded DORA representative catalog (still partial — not program-complete).
      const doraControlCount =
        initial.json().summary.total as number;
      expect(doraControlCount).toBeGreaterThanOrEqual(7);
      expect(initial.json()).toMatchObject({
        catalogVersion: "periscan-2026.07.s3",
        framework: FRAMEWORK,
        summary: { approved: 0, owned: 0, total: doraControlCount }
      });
      expect(initial.json().controls).toHaveLength(doraControlCount);

      const malformedException = await app.inject({
        cookies,
        method: "POST",
        payload: {
          controlId: CONTROL_ID,
          exceptionRationale: "Temporary compensating control",
          framework: FRAMEWORK,
          signoffStatus: "InReview"
        },
        url: "/api/v1/compliance/governance"
      });
      expect(malformedException.statusCode).toBe(400);

      const exceptionExpiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const reviewed = await app.inject({
        cookies,
        method: "POST",
        payload: {
          controlId: CONTROL_ID,
          evidenceRequest: "Attach the next measured exposure snapshot and integrity result.",
          exceptionExpiresAt,
          exceptionRationale: "Compensating monitoring while the runner is deployed.",
          framework: FRAMEWORK,
          owner: "GRC Engineering",
          reviewNotes: "Owner assigned; waiting on fresh evidence.",
          signoffStatus: "InReview"
        },
        url: "/api/v1/compliance/governance"
      });
      expect(reviewed.statusCode).toBe(200);
      expect(reviewed.json().summary).toMatchObject({ exceptions: 1, inReview: 1, owned: 1 });
      expect(reviewed.json().controls[0]).toMatchObject({
        catalogVersion: "periscan-2026.07.s3",
        exceptionActive: true,
        owner: "GRC Engineering",
        signoffStatus: "InReview"
      });

      const approved = await app.inject({
        cookies,
        method: "POST",
        payload: {
          controlId: CONTROL_ID,
          evidenceRequest: "Attach the next measured exposure snapshot and integrity result.",
          // Explicit null clears the prior exception (omit would preserve it).
          exceptionExpiresAt: null,
          exceptionRationale: null,
          framework: FRAMEWORK,
          owner: "GRC Engineering",
          reviewNotes: "Fresh measured evidence reviewed; exception removed and support approved.",
          signoffStatus: "Approved"
        },
        url: "/api/v1/compliance/governance"
      });
      expect(approved.statusCode).toBe(200);
      expect(approved.json().summary).toMatchObject({ approved: 1, exceptions: 0 });
      expect(approved.json().controls[0].signedOffAt).toEqual(expect.any(String));
      const signedOffAt = approved.json().controls[0].signedOffAt as string;

      // Owner-only update must not silently downgrade Approved→Draft or wipe sign-off.
      const ownerOnly = await app.inject({
        cookies,
        method: "POST",
        payload: {
          controlId: CONTROL_ID,
          framework: FRAMEWORK,
          owner: "GRC Leadership"
        },
        url: "/api/v1/compliance/governance"
      });
      expect(ownerOnly.statusCode).toBe(200);
      expect(ownerOnly.json().controls[0]).toMatchObject({
        owner: "GRC Leadership",
        reviewNotes:
          "Fresh measured evidence reviewed; exception removed and support approved.",
        signedOffAt,
        signoffStatus: "Approved"
      });
      expect(ownerOnly.json().summary).toMatchObject({ approved: 1, exceptions: 0 });

      const history = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/compliance/governance/history?framework=${FRAMEWORK}&controlId=${encodeURIComponent(CONTROL_ID)}`
      });
      expect(history.statusCode).toBe(200);
      expect(history.json().items).toHaveLength(3);
      expect(history.json().items.map((item: { action: string }) => item.action)).toEqual([
        "Updated",
        "Updated",
        "Created"
      ]);
      expect(await prisma.complianceControlGovernance.count({ where: { tenantId } })).toBe(1);
      expect(await prisma.complianceGovernanceChange.count({ where: { tenantId } })).toBe(3);
      expect(
        await prisma.auditEvent.count({
          where: { action: "compliance_governance_updated", tenantId }
        })
      ).toBe(3);

      const other = await testHelpers.performSignup(app, "compliance-other", "Compliance Other Tenant");
      const isolated = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: other.cookie },
        method: "GET",
        url: `/api/v1/compliance/governance?framework=${FRAMEWORK}`
      });
      expect(isolated.statusCode).toBe(200);
      expect(isolated.json().summary).toMatchObject({ approved: 0, exceptions: 0, owned: 0 });
      expect(isolated.json().controls[0]).toMatchObject({ owner: null, signoffStatus: "Draft" });
    } finally {
      await app.close();
    }
  });
});
