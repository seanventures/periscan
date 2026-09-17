import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import {
  countCorrelatedThreatAdvisories,
  createRuntimeServices
} from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

/**
 * Proves GENUINE "are we exposed?" correlation: an open advisory whose CVE matches
 * a completed validation run in the tenant's environment is counted as correlated
 * (exposed), and the count surfaces in the snapshot metric — not just "an advisory
 * we imported".
 */
describe("Advisory exposure correlation", () => {
  it("counts an advisory as correlated when its CVE matches a completed validation run", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });
    const CVE = "CVE-2026-7777";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: `corr-${randomUUID()}@periscan.test`,
          name: "Corr Owner",
          password: "periscan-corr-password",
          tenantName: "Corr Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = signup.cookies.find(
        (c) => c.name === SESSION_COOKIE_NAME
      )!.value;
      const tenantId = signup.json().tenant.tenantId as string;
      const membership = await prisma.membership.findFirstOrThrow({
        where: { tenantId }
      });

      // Import an advisory carrying the CVE.
      const advisory = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          cveIds: [CVE],
          rawContent: `Advisory referencing ${CVE} affecting an exposed service.`,
          sourceName: "Manual Threat Desk",
          summary: "Exposure correlation advisory.",
          techniqueIds: [],
          title: `Advisory for ${CVE}`
        },
        url: "/api/v1/threat-advisories"
      });
      expect(advisory.statusCode).toBe(201);
      const advisoryId = advisory.json().advisory.threatAdvisoryId as string;
      // Before any matching run, the detail reports no exposure correlation.
      expect(advisory.json().exposure ?? null).toBeNull();

      // A verified scope + a completed validation run whose target references the
      // same CVE — i.e. that exposure exists in the validated environment.
      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `corr-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ValidationSnapshot",
          requestedBy: membership.userId,
          safetyLevel: "PassiveReadOnly",
          scopeId,
          scopeIds: [scopeId],
          status: "Completed",
          tenantId
        }
      });

      // A completed run with the right indicator but no evidence is not proof.
      // It must not count as "correlated to validation evidence" in Snapshot
      // metrics or advisory exposure details.
      await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: "periscan.acceptance.correlation",
          safetyLevel: "PassiveReadOnly",
          scopeId,
          status: "Completed",
          target: { cve: CVE, host: "unproven.example.com" },
          techniqueIds: [],
          tenantId
        }
      });

      const unprovenCorrelated = await countCorrelatedThreatAdvisories(
        prisma,
        tenantId
      );
      expect(unprovenCorrelated).toBe(0);

      const unprovenDetail = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/threat-advisories/${advisoryId}`
      });
      expect(unprovenDetail.statusCode).toBe(200);
      expect(unprovenDetail.json().exposure).toMatchObject({
        correlated: false,
        evidenceIds: [],
        matchingRunCount: 0
      });

      await prisma.validationRun.create({
        data: {
          evidenceIds: [randomUUID()],
          missionId: mission.missionId,
          moduleId: "periscan.acceptance.correlation",
          safetyLevel: "PassiveReadOnly",
          scopeId,
          status: "Completed",
          target: { cve: CVE, host: "exposed.example.com" },
          techniqueIds: [],
          tenantId
        }
      });

      // Genuine correlation: the advisory's CVE matches the completed run.
      const correlated = await countCorrelatedThreatAdvisories(
        prisma,
        tenantId
      );
      expect(correlated).toBeGreaterThanOrEqual(1);

      // The advisory detail now EXPLAINS the exposure: which indicator matched
      // (the CVE) and how many evidence-backed runs corroborate it.
      const detail = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/threat-advisories/${advisoryId}`
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().exposure).not.toBeNull();
      expect(detail.json().exposure.correlated).toBe(true);
      expect(detail.json().exposure.matchedCveIds).toContain(CVE);
      expect(detail.json().exposure.matchingRunCount).toBeGreaterThanOrEqual(1);
      expect(detail.json().exposure.evidenceIds.length).toBeGreaterThanOrEqual(
        1
      );

      // And it surfaces end-to-end in the snapshot metric.
      const snapshot = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshot.statusCode).toBe(201);
      expect(
        snapshot.json().metrics.correlatedThreatAdvisoryCount
      ).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
