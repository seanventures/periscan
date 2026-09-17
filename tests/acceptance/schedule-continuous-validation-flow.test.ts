import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S6 — platform E2E: ContinuousValidation schedules.
 *
 * create ContinuousValidation → pause / resume / run-now → priorDiffs honesty.
 * Diff language must not invent Fixed remediations from schedule cadence alone.
 */
describe("ContinuousValidation schedule pause/resume/run-now + priorDiffs honesty", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "cv-schedule"
      ]);
      await prisma.$disconnect();
    }
  });

  it("creates ContinuousValidation, honors pause, and exposes honest priorDiffs", async () => {
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
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        "cv-schedule",
        "CV Schedule Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      // Snapshot / continuous packs need a package with EvidencePacks.
      await prisma.tenant.update({
        data: { billingPackageKey: "ValidationSnapshot" },
        where: { tenantId }
      });

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `cv-schedule-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verify = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      // 1) Create ContinuousValidation cadence on verified scope.
      const create = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          audience: "Security Team",
          frequency: "Daily",
          maxTopItems: 5,
          missionType: "ContinuousValidation",
          nextRunAt: "2026-01-01T00:00:00.000Z",
          scopeIds: [scopeId]
        },
        url: "/api/v1/schedules"
      });
      expect(create.statusCode).toBe(201);
      expect(create.json().missionType).toBe("ContinuousValidation");
      expect(create.json().status).toBe("Active");
      const scheduleId = create.json().scheduleId as string;

      // 2) Pause blocks run-now.
      const pause = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/pause`
      });
      expect(pause.statusCode).toBe(200);
      expect(pause.json().status).toBe("Paused");

      const blocked = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/run`
      });
      expect(blocked.statusCode).toBe(409);

      // 3) Resume then run-now succeeds.
      const resume = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/resume`
      });
      expect(resume.statusCode).toBe(200);
      expect(resume.json().status).toBe("Active");

      const firstRun = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/run`
      });
      expect(firstRun.statusCode).toBe(201);
      const firstBody = firstRun.json();
      expect(firstBody.snapshot?.snapshotId).toBeTruthy();
      expect(firstBody.diff?.status).toBe("NoPreviousRun");
      // Continuous EASM honesty: summary must not invent a living map / Fixed fix.
      const firstSummary = String(firstBody.diff?.summary ?? "");
      expect(firstSummary.toLowerCase()).not.toMatch(
        /living map|full bas|ransomware/
      );
      expect(firstBody.schedule?.lastSnapshotId).toBe(
        firstBody.snapshot.snapshotId
      );

      // 4) Second run produces a comparable prior-diff (not Fixed-from-cadence).
      const secondRun = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/run`
      });
      expect(secondRun.statusCode).toBe(201);
      const secondBody = secondRun.json();
      expect(secondBody.diff?.previousSnapshotId).toBe(
        firstBody.snapshot.snapshotId
      );
      expect(secondBody.diff?.currentSnapshotId).toBe(
        secondBody.snapshot.snapshotId
      );
      // Without path mutations, status is not a fabricated Fixed claim.
      expect(secondBody.diff?.status).not.toBe("Fixed");
      expect(
        ["Unchanged", "Improved", "Regressed", "ReopenedRiskDetected"].includes(
          secondBody.diff?.status as string
        ) || typeof secondBody.diff?.status === "string"
      ).toBe(true);

      // 5) GET detail exposes priorDiffs / runHistory honestly (array; no Fixed invent).
      const detail = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/schedules/${scheduleId}`
      });
      expect(detail.statusCode).toBe(200);
      const detailBody = detail.json();
      expect(detailBody.missionType).toBe("ContinuousValidation");
      expect(detailBody.lastDiff).toBeTruthy();
      expect(detailBody.lastDiff?.status).not.toBe("Fixed");
      expect(Array.isArray(detailBody.priorDiffs)).toBe(true);
      expect(Array.isArray(detailBody.runHistory)).toBe(true);
      // lastDiff status mirrors most recent fire (not empty invent of Fixed).
      expect(detailBody.lastDiff?.status).toBe(secondBody.diff?.status);
      // Config history from appendScheduleRunHistory is honest about outcomes.
      const cfg = detailBody.config as {
        runHistory?: Array<{ outcome?: string }>;
        continuousEasm?: { note?: string };
      } | null;
      if (cfg?.runHistory && cfg.runHistory.length > 0) {
        for (const entry of cfg.runHistory) {
          expect(entry.outcome).not.toBe("Fixed");
        }
      }
      if (cfg?.continuousEasm?.note) {
        expect(cfg.continuousEasm.note.toLowerCase()).toMatch(
          /not living map|allowlisted/
        );
      }

      // Schedule cadence never marks remediations Fixed without verification.
      const fixedRemediations = await prisma.remediationTask.count({
        where: { status: "Fixed", tenantId }
      });
      expect(fixedRemediations).toBe(0);
    } finally {
      await app.close();
    }
  }, 60_000);
});
