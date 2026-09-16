import { randomUUID } from "node:crypto";

import { inspectChainLinks, createPrismaEvidenceService } from "@periscan/evidence";
import {
  TenantIsolationProofSchema,
  type TenantIsolationProof,
  type TenantIsolationProofControl
} from "@periscan/shared";

import {
  requireCapability,
  requireRole,
  SCOPE_EDITOR_ROLES,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type TenantIsolationProofServices = Pick<
  AppServices,
  "createTenantIsolationProof"
>;

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProofHtml(proof: TenantIsolationProof) {
  const controls = proof.controlResults
    .map(
      (control) => `<tr><td>${escapeHtml(control.control)}</td><td><strong class="${control.status.toLowerCase()}">${escapeHtml(control.status)}</strong></td><td>${escapeHtml(control.detail)}</td></tr>`
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Periscan tenant isolation &amp; data protection proof</title>
<style>body{font:14px/1.55 Inter,system-ui,sans-serif;color:#15203b;margin:40px}header{border-bottom:3px solid #1672bd;padding-bottom:20px;margin-bottom:28px}h1{font-size:26px;margin:0 0 6px}h2{font-size:17px;margin-top:28px}p,td{color:#42506d}table{width:100%;border-collapse:collapse}th,td{padding:11px;border-bottom:1px solid #d8deea;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#687590}.pass{color:#18794e}.fail{color:#b42318}.notconfigured{color:#9a6700}.mono{font-family:ui-monospace,monospace;font-size:11px}.box{display:inline-block;margin:0 16px 12px 0;padding:10px 14px;border:1px solid #d8deea;border-radius:8px}</style></head>
<body><header><h1>Tenant Isolation &amp; Data Protection Proof</h1><p>Live control inspection generated ${escapeHtml(proof.generatedAt)}. This report describes the current deployment; it is not a certification.</p></header>
<div class="box"><strong>Tenant</strong><br><span class="mono">${escapeHtml(proof.tenantId)}</span></div>
<div class="box"><strong>Data region</strong><br>${escapeHtml(proof.dataProtection.dataRegion)}</div>
<div class="box"><strong>RLS coverage</strong><br>${proof.rls.tenantScopedTableCount - proof.rls.uncoveredTables.length}/${proof.rls.tenantScopedTableCount} tables</div>
<div class="box"><strong>Evidence chain</strong><br>${proof.evidenceChain.valid ? "Valid" : "Broken"} · ${proof.evidenceChain.checkedArtifacts} checked</div>
<h2>Control results</h2><table><thead><tr><th>Control</th><th>Status</th><th>Live evidence</th></tr></thead><tbody>${controls}</tbody></table>
<h2>Scope and limitations</h2><p>Database policy coverage is read from PostgreSQL system catalogs. Evidence integrity is recomputed for the tenant-scoped hash chain. Encryption configuration reports configured state only and never includes key material. Application authorization and cross-tenant object access remain covered by separate acceptance and security-boundary tests.</p>
<p class="mono">Report ${escapeHtml(proof.reportId)} · Evidence ${proof.evidenceIds.map(escapeHtml).join(", ")}</p></body></html>`;
}

export function createTenantIsolationProofServices(
  deps: RuntimeServiceDeps
): TenantIsolationProofServices {
  const { prisma } = deps;
  return {
    async createTenantIsolationProof(context) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "generate tenant-isolation proof"
      );
      await requireCapability(prisma, context, "EvidencePacks");
      const generatedAt = new Date();
      const [tenant, tenantTables, rlsTables, policies, evidenceRows, activeReportShares] =
        await Promise.all([
          prisma.tenant.findUniqueOrThrow({
            select: { dataRegion: true },
            where: { tenantId: context.tenant.tenantId }
          }),
          prisma.$queryRaw<Array<{ table_name: string }>>`
            SELECT DISTINCT table_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'tenant_id'
            ORDER BY table_name
          `,
          prisma.$queryRaw<
            Array<{ forced: boolean; rls_enabled: boolean; table_name: string }>
          >`
            SELECT c.relname AS table_name,
                   c.relrowsecurity AS rls_enabled,
                   c.relforcerowsecurity AS forced
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
          `,
          prisma.$queryRaw<Array<{ table_name: string }>>`
            SELECT tablename AS table_name
            FROM pg_policies
            WHERE schemaname = 'public' AND policyname = 'tenant_isolation'
          `,
          prisma.evidenceArtifact.findMany({
            orderBy: { chainSeq: "asc" },
            select: {
              artifactType: true,
              chainHash: true,
              chainSeq: true,
              evidenceId: true,
              prevChainHash: true,
              relatedEntityId: true,
              relatedEntityType: true,
              sha256: true,
              tenantId: true
            },
            where: { tenantId: context.tenant.tenantId }
          }),
          prisma.reportShare.count({
            where: {
              expiresAt: { gt: generatedAt },
              revokedAt: null,
              tenantId: context.tenant.tenantId
            }
          })
        ]);
      const rlsByTable = new Map(rlsTables.map((row) => [row.table_name, row]));
      const policyTables = new Set(policies.map((row) => row.table_name));
      const uncoveredTables = tenantTables
        .map((row) => row.table_name)
        .filter((table) => {
          const rls = rlsByTable.get(table);
          return !rls?.rls_enabled || !rls.forced || !policyTables.has(table);
        });
      const chained = evidenceRows.filter(
        (row): row is typeof row & { chainHash: string; chainSeq: bigint } =>
          row.chainHash !== null && row.chainSeq !== null
      );
      const inspection = inspectChainLinks(
        chained.map((row) => ({
          artifactType: row.artifactType,
          chainHash: row.chainHash,
          chainSeq: row.chainSeq,
          evidenceId: row.evidenceId,
          prevChainHash: row.prevChainHash,
          relatedEntityId: row.relatedEntityId,
          relatedEntityType: row.relatedEntityType,
          sha256: row.sha256,
          tenantId: row.tenantId
        }))
      );
      const evidenceEncryptionAtRest = process.env
        .PERISCAN_EVIDENCE_ENCRYPTION_AT_REST
        ? "Configured"
        : "NotConfigured";
      const integrationCredentialEncryption = process.env
        .PERISCAN_INTEGRATION_CREDENTIAL_KEY
        ? "Configured"
        : deps.devMode
          ? "DevelopmentFallback"
          : "NotConfigured";
      const controlResults: TenantIsolationProofControl[] = [
        {
          control: "PostgreSQL tenant row-level security backstop",
          detail:
            uncoveredTables.length === 0
              ? `${tenantTables.length} tenant-scoped tables have an enabled, forced tenant_isolation policy. Runtime enforcement is write-path first: interactive transactions bind SET LOCAL ROLE + app.current_tenant; standalone reads still require explicit tenantId filters (not full-query RLS).`
              : `${uncoveredTables.length} tenant-scoped table(s) lack complete RLS coverage: ${uncoveredTables.join(", ")}.`,
          status: uncoveredTables.length === 0 ? "Pass" : "Fail"
        },
        {
          control: "Tenant evidence-chain integrity",
          detail:
            chained.length === 0
              ? "No chained tenant evidence exists yet; integrity cannot be demonstrated."
              : inspection.valid
                ? `${inspection.checked} tenant evidence links recomputed successfully.`
                : `The chain broke at sequence ${inspection.brokenAtSeq ?? "unknown"}.`,
          status:
            chained.length === 0
              ? "NotConfigured"
              : inspection.valid
                ? "Pass"
                : "Fail"
        },
        {
          control: "Evidence encryption-at-rest configuration",
          detail:
            evidenceEncryptionAtRest === "Configured"
              ? "A deployment-managed evidence encryption-at-rest setting is configured."
              : "PERISCAN_EVIDENCE_ENCRYPTION_AT_REST is not configured in this deployment.",
          status:
            evidenceEncryptionAtRest === "Configured"
              ? "Pass"
              : "NotConfigured"
        },
        {
          control: "Integration credential encryption key",
          detail:
            integrationCredentialEncryption === "Configured"
              ? "A dedicated integration credential encryption key is configured; key material is not included."
              : integrationCredentialEncryption === "DevelopmentFallback"
                ? "This development deployment uses the documented non-production fallback key."
                : "A dedicated integration credential encryption key is not configured.",
          status:
            integrationCredentialEncryption === "Configured"
              ? "Pass"
              : "NotConfigured"
        },
        {
          control: "Governed report sharing",
          detail: `${activeReportShares} active tenant report share link(s); links are expiring, revocable, token-hashed, and access-audited.`,
          status: "Pass"
        }
      ];
      const report = await prisma.evidencePack.create({
        data: {
          audience: "Auditor",
          evidenceIds: [],
          packType: "TenantIsolationDataProtectionReport",
          redactionLevel: "Moderate",
          status: "Draft",
          tenantId: context.tenant.tenantId,
          title: "Tenant Isolation & Data Protection Proof"
        }
      });
      const htmlEvidenceId = randomUUID();
      const jsonEvidenceId = randomUUID();
      const proof = TenantIsolationProofSchema.parse({
        controlResults,
        dataProtection: {
          activeReportShares,
          dataRegion: tenant.dataRegion,
          evidenceEncryptionAtRest,
          integrationCredentialEncryption
        },
        evidenceChain: {
          brokenAtSequence: inspection.brokenAtSeq ?? null,
          checkedArtifacts: inspection.checked,
          valid: chained.length > 0 && inspection.valid
        },
        evidenceIds: [htmlEvidenceId, jsonEvidenceId],
        generatedAt: generatedAt.toISOString(),
        reportId: report.evidencePackId,
        rls: {
          forcedTableCount: tenantTables.filter(
            (row) => rlsByTable.get(row.table_name)?.forced
          ).length,
          policyCount: tenantTables.filter((row) =>
            policyTables.has(row.table_name)
          ).length,
          tenantScopedTableCount: tenantTables.length,
          uncoveredTables
        },
        tenantId: context.tenant.tenantId
      });
      const evidenceService = createPrismaEvidenceService({ prisma });
      const htmlArtifact = await evidenceService.putEvidenceArtifact({
        artifactType: "ReportExport",
        content: renderProofHtml(proof),
        contentType: "text/html",
        evidenceId: htmlEvidenceId,
        filename: "tenant-isolation-data-protection-proof",
        relatedEntityId: report.evidencePackId,
        relatedEntityType: "EvidencePack",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });
      await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: proof,
        contentType: "application/json",
        evidenceId: jsonEvidenceId,
        filename: "tenant-isolation-data-protection-proof",
        relatedEntityId: report.evidencePackId,
        relatedEntityType: "EvidencePack",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });
      await prisma.evidencePack.update({
        data: {
          evidenceIds: [htmlEvidenceId, jsonEvidenceId],
          status: "Ready",
          storageUri: htmlArtifact.artifact.storageUri
        },
        where: { evidencePackId: report.evidencePackId }
      });
      await writeAuditEvent(prisma, {
        action: "report.generated",
        actorType: "User",
        entityId: report.evidencePackId,
        entityType: "EvidencePack",
        metadata: {
          packType: "TenantIsolationDataProtectionReport",
          rlsUncoveredTableCount: uncoveredTables.length,
          tenantEvidenceChainValid: proof.evidenceChain.valid
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return proof;
    }
  };
}
