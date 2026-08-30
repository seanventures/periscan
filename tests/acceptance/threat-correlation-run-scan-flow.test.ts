import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import {
  countCorrelatedThreatAdvisories,
  createRuntimeServices
} from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

/**
 * Threat-advisory correlation must not under-report exposure just because the
 * matching run is older than the bounded recency scan. A technique-matched run
 * is fetched authoritatively (DB hasSome) regardless of age, so even with the
 * run scan limited to 1 — which only sees a newer, non-matching run — the older
 * technique-matching run still correlates the advisory.
 */
describe("Threat correlation counts technique matches beyond the recency scan cap", () => {
  it("correlates an advisory via an old technique-matched run outside the scan window", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });
    let tenantId = "";

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("threat-scan-owner"),
          name: "Threat Scan Owner",
          password: "periscan-threat-scan-password",
          tenantName: "Threat Scan Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      sessionCookie(owner);
      tenantId = owner.json().tenant.tenantId as string;

      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ExposureValidation",
          requestedBy: randomUUID(),
          safetyLevel: "ActiveNonInvasive",
          scopeId: randomUUID(),
          scopeIds: [],
          status: "Queued",
          tenantId
        }
      });

      const baseRun = {
        evidenceIds: [randomUUID()],
        missionId: mission.missionId,
        moduleId: "acceptance.threat",
        safetyLevel: "ActiveNonInvasive" as const,
        scopeId: randomUUID(),
        status: "Completed" as const,
        target: {},
        tenantId
      };

      // The OLDER run carries the advisory's technique...
      await prisma.validationRun.create({
        data: {
          ...baseRun,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          techniqueIds: ["T1059"]
        }
      });
      // ...while the NEWER run (the only one a recency scan of 1 would see) does not.
      await prisma.validationRun.create({
        data: {
          ...baseRun,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          techniqueIds: ["T9999"]
        }
      });

      await prisma.threatAdvisory.create({
        data: {
          cveIds: [],
          evidenceIds: [],
          iocValues: [],
          rawEvidenceId: randomUUID(),
          sourceName: "Acceptance Feed",
          status: "Imported",
          summary: "Advisory covering T1059.",
          techniqueIds: ["T1059"],
          tenantId,
          title: "Execution via command interpreter"
        }
      });

      // Scan limited to 1 run: the recency scan sees only the newer, non-matching
      // run. Correlation must still find the older technique-matched run via the
      // authoritative hasSome fetch.
      const correlated = await countCorrelatedThreatAdvisories(
        prisma,
        tenantId,
        1
      );
      expect(correlated).toBe(1);
    } finally {
      // No tenant cleanup: deleting a tenant here races the concurrent global
      // system-validation-sweep test (a tenant vanishing mid-sweep counts as a
      // sweep failure); the shared acceptance DB accumulates test data anyway.
      void tenantId;
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
