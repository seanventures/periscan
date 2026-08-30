import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { runEvidenceRetentionPurge } from "../../apps/worker/src/retention.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

describe("Evidence-retention purge audit acceptance workflow", () => {
  it("writes a first-class per-tenant AuditEvent that surfaces in the audit log", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("purge-audit-owner"),
          name: "Purge Audit Owner",
          password: "periscan-purge-audit-password",
          tenantName: "Purge Audit Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      // Drive the worker retention purge with a stubbed evidence service that
      // reports this tenant's purge count, but the REAL default Prisma-backed
      // audit sink — exercising the production audit-write path end-to-end.
      const evidenceService = {
        createEvidenceMetadata: async () => {
          throw new Error("unused");
        },
        getEvidenceArtifact: async () => null,
        linkEvidenceToEntity: async () => undefined,
        purgeExpiredEvidence: async () => ({
          evidenceIds: ["evidence-a", "evidence-b", "evidence-c"],
          purgedByTenant: { [tenantId]: 3 },
          purgedCount: 3
        }),
        putEvidenceArtifact: async () => {
          throw new Error("unused");
        }
      };

      const result = await runEvidenceRetentionPurge({
        env: { PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "30" },
        evidenceService: evidenceService as never,
        now: new Date("2026-06-06T00:00:00.000Z")
      });
      expect(result.skipped).toBe(false);
      expect(result.purgedCount).toBe(3);

      // The audit row exists at rest, scoped to the tenant, with the count and
      // retention window in metadata.
      const row = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "evidence_retention_purged", tenantId }
      });
      expect(row.actorType).toBe("System");
      expect(row.entityType).toBe("EvidencePack");
      expect(row.userId).toBeNull();
      const metadata = row.metadata as Record<string, unknown>;
      expect(metadata.purgedCount).toBe(3);
      expect(metadata.retentionDays).toBe(30);
      expect(metadata.olderThan).toBe("2026-05-07T00:00:00.000Z");

      // It is queryable through the tenant audit-log API, deserializing to the
      // dotted action name (the FROM_DB map + AuditEventActionSchema accept it).
      const audit = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/audit-events?action=evidence.retention.purged"
      });
      expect(audit.statusCode).toBe(200);
      const items = audit.json().items as Array<{
        action: string;
        actorType: string;
        entityType: string;
        metadata: Record<string, unknown>;
      }>;
      const purgeEvents = items.filter(
        (item) => item.action === "evidence.retention.purged"
      );
      expect(purgeEvents.length).toBeGreaterThan(0);
      expect(purgeEvents[0]!.actorType).toBe("System");
      expect(purgeEvents[0]!.metadata.purgedCount).toBe(3);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
