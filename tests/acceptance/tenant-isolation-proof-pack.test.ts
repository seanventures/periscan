import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { createPrismaEvidenceService } from "../../packages/evidence/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("tenant isolation and data protection proof pack", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["isolation-proof", "isolation-other"]);
      await prisma.$disconnect();
    }
  });

  it("inspects live RLS and evidence integrity, persists exports, and isolates the pack", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma })
    });
    try {
      const owner = await testHelpers.performSignup(app, "isolation-proof", "Isolation Proof Tenant");
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      await createPrismaEvidenceService({ prisma }).putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: { measured: true, purpose: "isolation-proof-chain-baseline" },
        contentType: "application/json",
        evidenceId: randomUUID(),
        filename: "isolation-proof-chain-baseline",
        relatedEntityId: tenantId,
        relatedEntityType: "Tenant",
        sensitivityLevel: "Low",
        tenantId
      });

      const generated = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/reports/tenant-isolation-proof"
      });
      expect(generated.statusCode).toBe(201);
      expect(generated.json()).toMatchObject({
        dataProtection: {
          dataRegion: "us-east-1",
          integrationCredentialEncryption: "DevelopmentFallback"
        },
        evidenceChain: { checkedArtifacts: 1, valid: true },
        rls: { uncoveredTables: [] },
        tenantId
      });
      expect(generated.json().rls.policyCount).toBe(
        generated.json().rls.tenantScopedTableCount
      );
      expect(generated.json().rls.forcedTableCount).toBe(
        generated.json().rls.tenantScopedTableCount
      );
      expect(generated.json().controlResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            control: "PostgreSQL tenant row-level security backstop",
            status: "Pass"
          }),
          expect.objectContaining({
            control: "Integration credential encryption key",
            status: "NotConfigured"
          })
        ])
      );
      const reportId = generated.json().reportId as string;
      const pack = await prisma.evidencePack.findUniqueOrThrow({
        where: { evidencePackId: reportId }
      });
      expect(pack).toMatchObject({
        packType: "TenantIsolationDataProtectionReport",
        status: "Ready",
        tenantId
      });
      expect(pack.evidenceIds).toHaveLength(2);

      const exported = await app.inject({
        cookies,
        method: "POST",
        payload: { format: "html" },
        url: `/api/v1/reports/${reportId}/export`
      });
      expect(exported.statusCode).toBe(200);
      expect(exported.body).toContain("Tenant Isolation &amp; Data Protection Proof");
      expect(exported.body).not.toContain("periscan-dev-integration-credential-key");

      const other = await testHelpers.performSignup(app, "isolation-other", "Isolation Other Tenant");
      const isolated = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: other.cookie },
        method: "GET",
        url: `/api/v1/reports/${reportId}`
      });
      expect(isolated.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
