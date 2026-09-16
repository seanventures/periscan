import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

/**
 * The snapshot embeds a preview of up to 5 control-observation signals, but the
 * controlObservationCount metric must reflect the TRUE total — not the display
 * cap. Regression guard for a metric that was previously counting the sliced
 * preview array.
 */
describe("Snapshot metrics count the full set, not the display preview", () => {
  it("reports the true control-observation count above the preview cap of 5", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("metrics-owner"),
          name: "Metrics Owner",
          password: "periscan-metrics-password",
          tenantName: "Metrics Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      const tenantId = owner.json().tenant.tenantId as string;

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `metrics-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scope.json().scopeId}/verify`
      });

      // Eight control-observation signals — more than the preview cap of 5.
      const CONTROL_SIGNAL_COUNT = 8;
      const now = new Date();
      await prisma.signalEnvelope.createMany({
        data: Array.from({ length: CONTROL_SIGNAL_COUNT }, () => ({
          redactionStatus: "Redacted" as const,
          sensitivityLevel: "Moderate" as const,
          signalCategory: "ControlObservation" as const,
          sourceType: "acceptance.control",
          sourceVendor: "Acceptance",
          tenantId,
          timestampIngested: now,
          timestampObserved: now
        }))
      });

      const snapshot = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshot.statusCode).toBe(201);
      const controlObservationTotal = await prisma.signalEnvelope.count({
        where: {
          signalCategory: "ControlObservation",
          tenantId
        }
      });

      // The embedded preview is still capped at 5...
      expect(
        (snapshot.json().controlObservations as unknown[]).length
      ).toBeLessThanOrEqual(5);
      // ...but the metric reflects the true total (no longer capped at 5).
      expect(snapshot.json().metrics.controlObservationCount).toBe(
        controlObservationTotal
      );
      expect(controlObservationTotal).toBeGreaterThanOrEqual(
        CONTROL_SIGNAL_COUNT
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
