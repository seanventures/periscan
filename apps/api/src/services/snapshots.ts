import { createHash, randomUUID } from "node:crypto";

import { EvidencePackType } from "@prisma/client";
import {
  createPrismaEvidenceService,
  inspectChainLinks
} from "@periscan/evidence";
import { generateEvidenceGroundedSummary } from "@periscan/operators";
import { renderValidationSnapshotReportHtml } from "@periscan/reports";
import type {
  EvidenceArtifact,
  ReportShareGrant,
  ValidationSnapshot
} from "@periscan/shared";

import {
  createReportShareToken,
  resolveReportShareJwtKeyring,
  verifyReportShareToken
} from "../security.js";
import { serializeDesignPartnerReportNote } from "../serializers/tenant.js";
import {
  AppServiceError,
  buildValidationSnapshotPayload,
  createReportPackFromSnapshot,
  describeNonSnapshotPackEvidenceState,
  executeInlineValidation,
  exportAdvisoryReadinessReportFromDetail,
  getReportExportFilename,
  getReportShareSecret,
  evaluatePolicyDecisionGate,
  loadEvidencePackAnalystNote,
  requireCapability,
  loadEvidencePackHtml,
  loadOrCreateEvidencePackPdf,
  loadTenantDesignPartnerSettings,
  loadTenantPreferredLocale,
  loadTenantReportBranding,
  loadThreatAdvisoryDetailRecord,
  loadValidationSnapshot,
  MEASURED_POSTURE_MODULE_IDS,
  rebuildEvidencePackRenderArtifacts,
  requireRole,
  SCOPE_EDITOR_ROLES,
  serializeEvidenceArtifact,
  serializeEvidencePack,
  serializeThreatAdvisoryDetail,
  TENANT_ADMIN_ROLES,
  writeAuditEvent,
  writePolicyBindingMismatchAudit
} from "../runtime-services.js";
import type {
  AppServices,
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";

const SNAPSHOT_POSTURE_SCOPE_LIMIT = 25;
const NON_SNAPSHOT_REPORT_PACK_TYPES = [
  EvidencePackType.ControlValidationReport,
  EvidencePackType.AIAppValidationReport,
  EvidencePackType.FixVerificationReport
] as const;

const EVIDENCE_VERIFICATION_METHOD = {
  algorithm: "SHA-256",
  authority: "Periscan evidence service",
  description:
    "Tenant-scoped hash-chain verification. This is a tamper-evident commitment, not an external digital signature.",
  signaturePresent: false
} as const;

async function loadEvidenceChainInspection(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string
) {
  const rows = await prisma.evidenceArtifact.findMany({
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
    where: { tenantId }
  });
  const chainedRows = rows.filter((row) => row.chainSeq !== null);
  const inspection = inspectChainLinks(
    chainedRows.map((row) => ({
      artifactType: row.artifactType,
      chainHash: row.chainHash ?? "",
      chainSeq: row.chainSeq ?? 0n,
      evidenceId: row.evidenceId,
      prevChainHash: row.prevChainHash,
      relatedEntityId: row.relatedEntityId,
      relatedEntityType: row.relatedEntityType,
      sha256: row.sha256,
      tenantId: row.tenantId
    }))
  );

  return {
    inspection,
    legacyUnchainedArtifacts: rows.length - chainedRows.length,
    totalArtifacts: rows.length
  };
}

interface ModelGatewayTurnReadModel {
  findMany(args: {
    orderBy: { createdAt: "desc" };
    select: { output: true; turnId: true };
    take: number;
    where: { modelSessionId: string };
  }): Promise<Array<{ output: unknown; turnId: string }>>;
}

type PrismaWithOptionalModelGatewayTurn = RuntimeServiceDeps["prisma"] & {
  modelGatewayTurn?: ModelGatewayTurnReadModel;
};

function readModelSessionIdFromPackTitle(title: string | null) {
  if (!title?.includes("model:")) {
    return null;
  }

  return title.split("model:")[1]?.slice(0, 12) ?? null;
}

function resolveSnapshotPostureIntervalMs() {
  const raw = Number.parseInt(
    process.env.PERISCAN_POSTURE_CHECK_INTERVAL_MS ?? "",
    10
  );

  return Number.isFinite(raw) && raw > 0 ? raw : 24 * 60 * 60 * 1000;
}

async function runMeasuredSnapshotPostureChecks(input: {
  context: Parameters<AppServices["createSnapshot"]>[0];
  devMode: boolean;
  prisma: RuntimeServiceDeps["prisma"];
  scopeId?: string;
}) {
  const scopes = await input.prisma.scope.findMany({
    orderBy: {
      createdAt: "asc"
    },
    take: SNAPSHOT_POSTURE_SCOPE_LIMIT,
    where: {
      scopeType: {
        in: ["Domain", "Subdomain"]
      },
      scopeId: input.scopeId,
      tenantId: input.context.tenant.tenantId,
      verificationStatus: "Verified"
    }
  });

  const now = new Date();
  const nextPostureCheckAt = new Date(
    now.getTime() + resolveSnapshotPostureIntervalMs()
  );

  for (const scope of scopes) {
    await Promise.all(
      MEASURED_POSTURE_MODULE_IDS.map((moduleId) =>
        executeInlineValidation({
          adminApproval: TENANT_ADMIN_ROLES.has(input.context.membership.role),
          context: input.context,
          executionEnvironment: "ControlPlane",
          explicitMissionApproval: true,
          missionType: "ExposureValidation",
          moduleId,
          prisma: input.prisma,
          scopeId: scope.scopeId,
          target: {
            hostname: scope.value,
            ...(input.devMode ? { fixtureMode: true } : {})
          }
        })
      )
    );

    await input.prisma.scope.update({
      data: {
        lastPostureCheckAt: now,
        nextPostureCheckAt
      },
      where: {
        scopeId: scope.scopeId
      }
    });
  }
}

// Snapshots, reports, and evidence service group (D1 Phase 2 closure decomposition).
export function createSnapshotReportEvidenceServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "createReport"
  | "createReportShareLink"
  | "createSnapshot"
  | "downloadEvidence"
  | "exportReport"
  | "generateEvidenceSummary"
  | "getEvidence"
  | "getReport"
  | "getEvidencePack"
  | "getReportAnalystNote"
  | "getSharedReportByToken"
  | "getSnapshot"
  | "getSnapshotReportHtml"
  | "listEvidence"
  | "listReports"
  | "listReportShareLinks"
  | "listSnapshots"
  | "redactEvidence"
  | "revokeReportShareLink"
  | "verifyEvidenceChain"
  | "verifyEvidenceIntegrity"
  | "updateReportAnalystNote"
> {
  const { devMode, emitTenantWebhook, prisma } = deps;

  function hashReportShareToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  function serializeReportShareGrant(record: {
    accessCount: number;
    createdAt: Date;
    evidencePackId: string;
    expiresAt: Date;
    lastAccessedAt: Date | null;
    reportShareId: string;
    revokedAt: Date | null;
    tenantId: string;
  }): ReportShareGrant {
    return {
      accessCount: record.accessCount,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      lastAccessedAt: record.lastAccessedAt?.toISOString() ?? null,
      reportId: record.evidencePackId,
      reportShareId: record.reportShareId,
      revokedAt: record.revokedAt?.toISOString() ?? null,
      tenantId: record.tenantId
    };
  }

  return {
    async listSnapshots(context) {
      const packs = await prisma.evidencePack.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          packType: "ValidationSnapshotReport",
          tenantId: context.tenant.tenantId
        }
      });
      const snapshots = await Promise.all(
        packs.map((pack) =>
          loadValidationSnapshot(prisma, context, pack.evidencePackId)
        )
      );

      return snapshots.filter((snapshot): snapshot is ValidationSnapshot =>
        Boolean(snapshot)
      );
    },

    async getSnapshot(context, snapshotId) {
      return loadValidationSnapshot(prisma, context, snapshotId);
    },

    async getSnapshotReportHtml(context, snapshotId) {
      const pack = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: snapshotId,
          packType: "ValidationSnapshotReport",
          tenantId: context.tenant.tenantId
        }
      });

      if (!pack) {
        return null;
      }

      const htmlArtifact = await loadEvidencePackHtml(
        prisma,
        context.tenant.tenantId,
        pack.evidencePackId
      );

      return htmlArtifact?.html ?? null;
    },

    async createSnapshot(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create validation snapshots"
      );

      let boundPolicyDecisionId: string | null = null;
      let boundScopeValue: string | null = null;
      if (input.scopeId || input.policyDecisionId) {
        if (!input.scopeId || !input.policyDecisionId) {
          throw new AppServiceError(
            "A guided snapshot requires both a scope and policy decision.",
            400,
            "snapshot_policy_binding_required"
          );
        }

        const decision = await prisma.policyDecision.findFirst({
          where: {
            policyDecisionId: input.policyDecisionId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!decision) {
          throw new AppServiceError(
            "Policy decision not found.",
            404,
            "policy_decision_not_found"
          );
        }

        const rejectBinding = async (
          code: string,
          message: string
        ): Promise<never> => {
          await writePolicyBindingMismatchAudit(prisma, context, decision, {
            attemptedMissionType: "ValidationSnapshot",
            attemptedSafetyLevel: "ActiveNonInvasive",
            attemptedScopeId: input.scopeId!,
            code,
            stage: "create"
          });
          throw new AppServiceError(message, 400, code);
        };

        if (decision.scopeId !== input.scopeId) {
          await rejectBinding(
            "policy_decision_scope_mismatch",
            "Policy decision must match the snapshot scope."
          );
        }
        if (decision.missionType !== "ValidationSnapshot") {
          await rejectBinding(
            "policy_decision_mission_type_mismatch",
            "Policy decision must authorize a validation snapshot."
          );
        }
        if (decision.safetyLevel !== "ActiveNonInvasive") {
          await rejectBinding(
            "policy_decision_safety_level_mismatch",
            "Policy decision must authorize ActiveNonInvasive validation."
          );
        }
        if (decision.executionEnvironment !== "ControlPlane") {
          await rejectBinding(
            "policy_decision_environment_mismatch",
            "Policy decision must authorize control-plane execution."
          );
        }

        const gate = evaluatePolicyDecisionGate(decision);
        if (gate !== "start") {
          throw new AppServiceError(
            gate === "pending"
              ? "Policy decision still requires approval."
              : "Policy decision does not authorize this snapshot.",
            gate === "pending" ? 409 : 400,
            gate === "pending" ? "policy_approval_required" : "policy_denied"
          );
        }

        const scope = await prisma.scope.findFirst({
          where: {
            scopeId: input.scopeId,
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        });
        if (!scope) {
          throw new AppServiceError(
            "The bound snapshot scope must still be verified.",
            400,
            "verified_scope_required"
          );
        }
        boundPolicyDecisionId = decision.policyDecisionId;
        boundScopeValue = scope.value;
      }

      await runMeasuredSnapshotPostureChecks({
        context,
        devMode,
        prisma,
        scopeId: input.scopeId
      });

      const payload = await buildValidationSnapshotPayload({
        audience: input.audience,
        context,
        maxTopItems: Math.max(3, Math.min(input.maxTopItems ?? 5, 5)),
        prisma
      });

      if (payload.scopeIds.length === 0) {
        throw new AppServiceError(
          "A validation snapshot requires at least one verified scope.",
          400,
          "verified_scope_required"
        );
      }

      const mission = await prisma.validationMission.create({
        data: {
          completedAt: new Date(),
          evidenceIds: payload.evidenceIds,
          missionType: "ValidationSnapshot",
          policyDecisionId: boundPolicyDecisionId,
          policyProfile: boundPolicyDecisionId
            ? "guided-snapshot-preview"
            : null,
          requestedBy: context.user.userId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: input.scopeId ?? payload.scopeIds[0]!,
          scopeIds: input.scopeId ? [input.scopeId] : payload.scopeIds,
          startedAt: new Date(),
          status: "Completed",
          tenantId: context.tenant.tenantId
        }
      });
      const evidencePack = await prisma.evidencePack.create({
        data: {
          audience: input.audience ?? "Security Team",
          evidenceIds: payload.evidenceIds,
          packType: "ValidationSnapshotReport",
          redactionLevel: "Moderate",
          status: "Draft",
          tenantId: context.tenant.tenantId,
          title: `Validation Snapshot ${new Date().toISOString().slice(0, 10)}`
        }
      });
      const htmlEvidenceId = randomUUID();
      const jsonEvidenceId = randomUUID();
      const snapshotScopeIds = input.scopeId
        ? [input.scopeId]
        : payload.scopeIds;
      const snapshot: ValidationSnapshot = {
        aiAppRisks: payload.aiAppRisks,
        controlObservations: payload.controlObservations,
        createdAt: evidencePack.createdAt.toISOString(),
        evidenceIds: [
          ...new Set([...payload.evidenceIds, htmlEvidenceId, jsonEvidenceId])
        ],
        evidencePack: {
          ...serializeEvidencePack(evidencePack),
          evidenceIds: [
            ...new Set([
              ...evidencePack.evidenceIds,
              htmlEvidenceId,
              jsonEvidenceId
            ])
          ]
        },
        integrationIds: payload.integrationIds,
        metrics: {
          aiRiskCount: payload.aiRiskCount,
          controlObservationCount: payload.controlObservationCount,
          highRiskPathCount: payload.highRiskPathCount,
          correlatedThreatAdvisoryCount: payload.correlatedThreatAdvisoryCount,
          integrationCount: payload.integrationIds.length,
          openThreatAdvisoryCount: payload.openThreatAdvisoryCount,
          remediationCount: payload.remediations.length,
          staleVerificationCount: payload.staleVerificationCount,
          topPathCount: payload.topAttackPaths.length,
          verifiedScopeCount: snapshotScopeIds.length
        },
        missionId: mission.missionId,
        remediationPriorities: payload.remediations,
        scopeIds: snapshotScopeIds,
        snapshotId: evidencePack.evidencePackId,
        summary: boundScopeValue
          ? {
              ...payload.summary,
              overview: `Fresh measured, non-invasive checks were limited to the authorized scope ${boundScopeValue}. The snapshot combines those results with existing tenant evidence; it does not imply every displayed observation was re-tested in this run.`
            }
          : payload.summary,
        tenantId: context.tenant.tenantId,
        topAttackPaths: payload.topAttackPaths,
        updatedAt: evidencePack.updatedAt.toISOString(),
        verificationPlan: [
          ...new Set(
            payload.remediations.map(
              (remediation) => remediation.verificationMethod
            )
          )
        ]
      };
      const [branding, locale] = await Promise.all([
        loadTenantReportBranding(prisma, context.tenant.tenantId),
        loadTenantPreferredLocale(prisma, context.tenant.tenantId)
      ]);
      const reportHtml = renderValidationSnapshotReportHtml(snapshot, {
        branding,
        locale
      });
      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const htmlArtifact = await evidenceService.putEvidenceArtifact({
        artifactType: "ReportExport",
        content: reportHtml,
        contentType: "text/html",
        evidenceId: htmlEvidenceId,
        filename: "validation-snapshot-report",
        relatedEntityId: evidencePack.evidencePackId,
        relatedEntityType: "EvidencePack",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });

      await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: snapshot,
        contentType: "application/json",
        evidenceId: jsonEvidenceId,
        filename: "validation-snapshot",
        relatedEntityId: evidencePack.evidencePackId,
        relatedEntityType: "EvidencePack",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });

      const finalizedPack = await prisma.evidencePack.update({
        where: {
          evidencePackId: evidencePack.evidencePackId
        },
        data: {
          status: "Ready",
          storageUri: htmlArtifact.artifact.storageUri
        }
      });

      await prisma.validationMission.update({
        where: {
          missionId: mission.missionId
        },
        data: {
          evidenceIds: [
            ...new Set([...payload.evidenceIds, htmlEvidenceId, jsonEvidenceId])
          ]
        }
      });

      await writeAuditEvent(prisma, {
        action: "report.generated",
        actorType: "System",
        entityId: finalizedPack.evidencePackId,
        entityType: "EvidencePack",
        metadata: {
          missionId: mission.missionId,
          packType: finalizedPack.packType
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      await emitTenantWebhook(context.tenant.tenantId, "snapshot.ready", {
        missionId: mission.missionId,
        snapshotId: finalizedPack.evidencePackId,
        summary: snapshot.summary
      });

      return {
        ...snapshot,
        evidencePack: serializeEvidencePack(finalizedPack),
        updatedAt: finalizedPack.updatedAt.toISOString()
      };
    },

    async listReports(context, options) {
      // Route callers pass a bounded default; direct service callers can omit
      // it only for controlled internal use.
      const packs = await prisma.evidencePack.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: options?.limit,
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return packs.map(serializeEvidencePack);
    },

    async getReport(context, reportId) {
      const pack = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId
        }
      });

      return pack ? serializeEvidencePack(pack) : null;
    },

    async getEvidencePack(
      this: AppServices,
      context: AuthenticatedContext,
      packId: string
    ) {
      // full getEvidencePack support for Q3: direct pack + model depth + pack viewer; delegates to getReport (same tenant-isolated EvidencePack load); prioritize specific pack load over CTEM
      return this.getReport(context, packId);
    },

    async createReport(this: AppServices, context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create reports"
      );
      await requireCapability(prisma, context, "EvidencePacks");

      if (input.snapshotId) {
        const snapshot = await loadValidationSnapshot(
          prisma,
          context,
          input.snapshotId
        );

        if (!snapshot) {
          throw new AppServiceError(
            "Snapshot not found.",
            404,
            "snapshot_not_found"
          );
        }

        return createReportPackFromSnapshot({
          audience: input.audience,
          context,
          packType: input.packType,
          prisma,
          snapshot,
          title: input.title
        });
      }

      const snapshot = await this.createSnapshot(context, {
        audience: input.audience,
        maxTopItems: input.maxTopItems
      });

      if (input.packType && input.packType !== snapshot.evidencePack.packType) {
        return createReportPackFromSnapshot({
          audience: input.audience,
          context,
          packType: input.packType,
          prisma,
          snapshot,
          title: input.title
        });
      }

      return snapshot.evidencePack;
    },

    async exportReport(context, reportId, input = {}) {
      await requireCapability(prisma, context, "EvidencePacks");
      const format = input.format ?? "html";
      const pack = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!pack) {
        return null;
      }

      if (pack.packType === "ThreatAdvisoryReadinessReport") {
        const readinessReport = await prisma.advisoryReadinessReport.findFirst({
          where: {
            evidencePackId: pack.evidencePackId,
            tenantId: context.tenant.tenantId
          }
        });

        if (!readinessReport) {
          return null;
        }

        const advisory = await loadThreatAdvisoryDetailRecord(
          prisma,
          context.tenant.tenantId,
          readinessReport.threatAdvisoryId
        );
        const detail = advisory
          ? serializeThreatAdvisoryDetail(advisory)
          : null;

        if (!detail) {
          return null;
        }

        return exportAdvisoryReadinessReportFromDetail({
          context,
          detail,
          format,
          pack,
          prisma
        });
      }

      if (format === "pdf") {
        let pdfExport = await loadOrCreateEvidencePackPdf({
          context,
          pack,
          prisma
        });

        if (!pdfExport) {
          const isNonSnap = NON_SNAPSHOT_REPORT_PACK_TYPES.some(
            (packType) => packType === pack.packType
          );
          if (isNonSnap) {
            try {
              await rebuildEvidencePackRenderArtifacts({
                context,
                pack,
                prisma
              });
              pdfExport = await loadOrCreateEvidencePackPdf({
                context,
                pack,
                prisma
              });
            } catch {
              // continue to null
            }
          }
        }

        if (!pdfExport) {
          return null;
        }

        const updatedPack = await prisma.evidencePack.update({
          where: {
            evidencePackId: pack.evidencePackId
          },
          data: {
            status: "Exported"
          }
        });

        return {
          artifact: pdfExport.artifact,
          content: pdfExport.pdf,
          contentType: "application/pdf",
          filename: getReportExportFilename(pack, "pdf"),
          format,
          report: serializeEvidencePack(updatedPack)
        };
      }

      const htmlExport = await loadEvidencePackHtml(
        prisma,
        context.tenant.tenantId,
        pack.evidencePackId
      );

      if (!htmlExport) {
        // On-demand direct render for packs (especially non-snapshot scheduled
        // Control/AI/Fix packs) that have no pre-cached ReportExport artifact yet.
        // This guarantees exportReport returns usable HTML for Ready packs even
        // in test environments or before any persist of artifacts succeeds.
        // Best-effort attempt to cache via rebuild; direct render as fallback.
        try {
          await rebuildEvidencePackRenderArtifacts({
            context,
            pack,
            prisma
          }).catch(() => {});
          const afterRebuild = await loadEvidencePackHtml(
            prisma,
            context.tenant.tenantId,
            pack.evidencePackId
          );
          if (afterRebuild?.html) {
            const updated = await prisma.evidencePack
              .update({
                where: { evidencePackId: pack.evidencePackId },
                data: { status: "Exported" }
              })
              .catch(() => pack);
            return {
              artifact: afterRebuild.artifact,
              content: afterRebuild.html,
              contentType: "text/html; charset=utf-8",
              filename: getReportExportFilename(pack, "html"),
              format,
              html: afterRebuild.html,
              report: serializeEvidencePack(updated)
            };
          }
        } catch {
          // Fall through to direct render below; export remains available.
        }

        // Direct render path (no storage dependency) — mirrors the synth logic
        // added to loadSnapshotFromEvidencePack so non-snap packs always work.
        const now = new Date().toISOString();
        const honesty = describeNonSnapshotPackEvidenceState({
          linkedObservationCount: 0,
          packEvidenceIds: Array.isArray(pack.evidenceIds)
            ? pack.evidenceIds
            : []
        });
        const base: ValidationSnapshot = {
          aiAppRisks: [],
          controlObservations: [],
          createdAt: now,
          evidenceIds: pack.evidenceIds,
          evidencePack: serializeEvidencePack(pack),
          integrationIds: [],
          metrics: {
            aiRiskCount: 0,
            controlObservationCount: 0,
            highRiskPathCount: 0,
            correlatedThreatAdvisoryCount: 0,
            integrationCount: 0,
            openThreatAdvisoryCount: 0,
            remediationCount: 0,
            staleVerificationCount: 0,
            topPathCount: 0,
            verifiedScopeCount: 0
          },
          missionId: null,
          remediationPriorities: [],
          scopeIds: [],
          snapshotId: pack.evidencePackId,
          summary: {
            headline: pack.title || `${pack.packType}`,
            overview: honesty.overview,
            topRiskBand: honesty.topRiskBand
          },
          tenantId: context.tenant.tenantId,
          topAttackPaths: [],
          updatedAt: now,
          verificationPlan: [
            pack.evidenceIds.length > 0
              ? "Review the evidence attached to this pack."
              : "Attach measured validation evidence before treating this report as proof.",
            "Re-run for updated results."
          ]
        };

        // Model linkage enrichment for non-snap packs (close G-wire): surface modelSessionId and best-effort analysis note if turns exist for the linked session.
        // This makes model insights visible in synth/export for non-snap without external 3P.
        const modelSessId = readModelSessionIdFromPackTitle(pack.title);
        if (modelSessId) {
          base.verificationPlan = [
            ...base.verificationPlan,
            `Frontier model session ${modelSessId} enqueued for analysis (see model gateway or full evidence for turns).`
          ];
          // best-effort: attach latest turn output summary to verificationPlan (typed access; falls back gracefully)
          try {
            const prismaWithModelTurns =
              prisma as PrismaWithOptionalModelGatewayTurn;
            const turns = prismaWithModelTurns.modelGatewayTurn
              ? await prismaWithModelTurns.modelGatewayTurn.findMany({
                  where: { modelSessionId: modelSessId },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { output: true, turnId: true }
                })
              : [];
            const t = turns[0] ?? null;
            if (t?.output) {
              const out =
                typeof t.output === "string"
                  ? t.output.slice(0, 220)
                  : JSON.stringify(t.output).slice(0, 220);
              base.verificationPlan.push(
                `Model analysis excerpt (turn ${t.turnId?.slice(0, 8) || ""}): ${out.replace(/[\r\n]/g, " ").slice(0, 180)}...`
              );
            }
          } catch {
            // Model excerpts are best-effort; the pack export remains valid.
          }
        }

        const branding = await loadTenantReportBranding(
          prisma,
          context.tenant.tenantId
        ).catch(() => null);
        const analystNote = await loadEvidencePackAnalystNote(
          prisma,
          context.tenant.tenantId,
          pack.evidencePackId
        ).catch(() => null);

        const reportHtml = renderValidationSnapshotReportHtml(base, {
          branding,
          analystNote,
          locale: await loadTenantPreferredLocale(
            prisma,
            context.tenant.tenantId
          ),
          packType: pack.packType
        });

        const evidenceService = createPrismaEvidenceService({ prisma });
        const htmlArtifact = await evidenceService.putEvidenceArtifact({
          artifactType: "ReportExport",
          content: reportHtml,
          contentType: "text/html",
          evidenceId: randomUUID(),
          filename: "report",
          relatedEntityId: pack.evidencePackId,
          relatedEntityType: "EvidencePack",
          sensitivityLevel: "Moderate",
          tenantId: context.tenant.tenantId
        });
        const updated = await prisma.evidencePack.update({
          where: { evidencePackId: pack.evidencePackId },
          data: { status: "Exported" }
        });

        return {
          artifact: htmlArtifact.artifact as EvidenceArtifact,
          content: reportHtml,
          contentType: "text/html; charset=utf-8",
          filename: getReportExportFilename(pack, "html"),
          format,
          html: reportHtml,
          report: serializeEvidencePack(updated || pack)
        };
      }

      const updatedPack = await prisma.evidencePack.update({
        where: {
          evidencePackId: pack.evidencePackId
        },
        data: {
          status: "Exported"
        }
      });

      return {
        artifact: htmlExport.artifact,
        content: htmlExport.html,
        contentType: "text/html; charset=utf-8",
        filename: getReportExportFilename(pack, "html"),
        format,
        html: htmlExport.html,
        report: serializeEvidencePack(updatedPack)
      };
    },

    async createReportShareLink(context, reportId) {
      // Minting a public, unauthenticated share link exposes the full report to
      // anyone with the URL, so it requires the same editor privilege as
      // creating the report — a read-only Viewer must not be able to share it.
      requireRole(context.membership.role, SCOPE_EDITOR_ROLES, "share reports");

      const pack = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!pack) {
        return null;
      }

      const reportShareId = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      // Purpose-split secret (PERISCAN_REPORT_SHARE_SECRET) with optional
      // previous-key dual-verify for rotation — never the session JWT alone in prod.
      const shareKeyring = resolveReportShareJwtKeyring(
        process.env,
        getReportShareSecret()
      );
      const token = await createReportShareToken(
        {
          reportId: pack.evidencePackId,
          reportShareId,
          tenantId: context.tenant.tenantId
        },
        shareKeyring
      );
      const share = await prisma.reportShare.create({
        data: {
          createdBy: context.user.userId,
          evidencePackId: pack.evidencePackId,
          expiresAt,
          reportShareId,
          tenantId: context.tenant.tenantId,
          tokenHash: hashReportShareToken(token)
        }
      });

      await writeAuditEvent(prisma, {
        action: "report.shared",
        actorType: "User",
        entityId: pack.evidencePackId,
        entityType: "EvidencePack",
        metadata: {
          expiresAt: expiresAt.toISOString(),
          packType: pack.packType
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        ...serializeReportShareGrant(share),
        token,
        url: `/api/v1/public/reports/share/${token}`
      };
    },

    async listReportShareLinks(context, reportId) {
      const report = await prisma.evidencePack.findFirst({
        select: { evidencePackId: true },
        where: {
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!report) {
        return [];
      }

      const shares = await prisma.reportShare.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        where: {
          evidencePackId: report.evidencePackId,
          tenantId: context.tenant.tenantId
        }
      });

      return shares.map(serializeReportShareGrant);
    },

    async revokeReportShareLink(context, reportId, reportShareId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "revoke report shares"
      );
      const share = await prisma.reportShare.findFirst({
        where: {
          evidencePackId: reportId,
          reportShareId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!share) {
        return null;
      }

      const updated = share.revokedAt
        ? share
        : await prisma.reportShare.update({
            data: { revokedAt: new Date() },
            where: { reportShareId }
          });

      if (!share.revokedAt) {
        await writeAuditEvent(prisma, {
          action: "report.share_revoked",
          actorType: "User",
          entityId: reportId,
          entityType: "EvidencePack",
          metadata: { reportShareId },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      }

      return serializeReportShareGrant(updated);
    },

    async getSharedReportByToken(token) {
      let claims: Awaited<ReturnType<typeof verifyReportShareToken>>;

      try {
        const shareKeyring = resolveReportShareJwtKeyring(
          process.env,
          getReportShareSecret()
        );
        claims = await verifyReportShareToken(token, shareKeyring);
      } catch {
        return null;
      }

      const share = await prisma.reportShare.findFirst({
        where: {
          evidencePackId: claims.reportId,
          expiresAt: { gt: new Date() },
          reportShareId: claims.reportShareId,
          revokedAt: null,
          tenantId: claims.tenantId,
          tokenHash: hashReportShareToken(token)
        }
      });

      if (!share) {
        return null;
      }

      const pack = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: claims.reportId,
          tenantId: claims.tenantId
        }
      });

      if (!pack) {
        return null;
      }

      const htmlArtifact = await loadEvidencePackHtml(
        prisma,
        claims.tenantId,
        pack.evidencePackId
      );

      if (!htmlArtifact) {
        return null;
      }

      const accessedAt = new Date();
      await prisma.reportShare.update({
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: accessedAt
        },
        where: { reportShareId: share.reportShareId }
      });
      await writeAuditEvent(prisma, {
        action: "report.accessed",
        actorType: "PublicLink",
        entityId: pack.evidencePackId,
        entityType: "EvidencePack",
        metadata: {
          accessedAt: accessedAt.toISOString(),
          reportShareId: share.reportShareId
        },
        tenantId: claims.tenantId,
        userId: null
      });

      return {
        html: htmlArtifact.html,
        report: serializeEvidencePack(pack)
      };
    },

    async getReportAnalystNote(context, reportId) {
      const report = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!report) {
        return null;
      }

      return loadEvidencePackAnalystNote(
        prisma,
        context.tenant.tenantId,
        reportId
      );
    },

    async updateReportAnalystNote(context, reportId, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update report analyst notes"
      );

      const settings = await loadTenantDesignPartnerSettings(
        prisma,
        context.tenant.tenantId
      );

      if (!settings.enabled) {
        throw new AppServiceError(
          "Design partner mode is not enabled for this tenant.",
          400,
          "design_partner_disabled"
        );
      }

      const report = await prisma.evidencePack.findFirst({
        where: {
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!report) {
        throw new AppServiceError("Report not found.", 404, "report_not_found");
      }

      const note = await prisma.evidencePackAnalystNote.upsert({
        create: {
          authorLabel: input.authorLabel?.trim() || "Periscan Analyst",
          body: input.body.trim(),
          createdBy: context.user.userId,
          evidencePackId: reportId,
          tenantId: context.tenant.tenantId,
          title: input.title?.trim() || null
        },
        update: {
          authorLabel: input.authorLabel?.trim() || "Periscan Analyst",
          body: input.body.trim(),
          title: input.title?.trim() || null
        },
        where: {
          evidencePackId: reportId
        }
      });

      await rebuildEvidencePackRenderArtifacts({
        context,
        pack: report,
        prisma
      });

      await writeAuditEvent(prisma, {
        action: "report.updated",
        actorType: "User",
        entityId: reportId,
        entityType: "EvidencePack",
        metadata: {
          field: "analystNote",
          hasTitle: Boolean(note.title)
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeDesignPartnerReportNote(note);
    },

    async listEvidence(context, options) {
      // Route callers pass a bounded default; direct service callers can omit
      // it only for controlled internal use. Offset supports page envelopes
      // (limit+1 hasMore) on GET /api/v1/evidence.
      const artifacts = await prisma.evidenceArtifact.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: (options as { offset?: number } | undefined)?.offset ?? 0,
        take: options?.limit,
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return artifacts.map(serializeEvidenceArtifact);
    },

    async getEvidence(context, evidenceId) {
      const artifact = await prisma.evidenceArtifact.findFirst({
        where: {
          evidenceId,
          tenantId: context.tenant.tenantId
        }
      });

      return artifact ? serializeEvidenceArtifact(artifact) : null;
    },

    async verifyEvidenceChain(context) {
      const { inspection, legacyUnchainedArtifacts, totalArtifacts } =
        await loadEvidenceChainInspection(prisma, context.tenant.tenantId);

      return {
        brokenAtSeq: inspection.brokenAtSeq ?? null,
        chainedArtifacts: inspection.total,
        checked: inspection.checked,
        legacyUnchainedArtifacts,
        links: inspection.links.map((link) => ({
          chainHash: link.chainHash,
          chainSeq: link.chainSeq,
          evidenceId: link.evidenceId,
          prevChainHash: link.prevChainHash,
          reason: link.reason ?? null,
          status: link.status,
          valid: link.valid
        })),
        method: EVIDENCE_VERIFICATION_METHOD,
        reason: inspection.reason ?? null,
        tenantId: context.tenant.tenantId,
        totalArtifacts,
        valid: inspection.valid,
        verifiedAt: new Date().toISOString()
      };
    },

    async verifyEvidenceIntegrity(context, evidenceId) {
      const artifact = await prisma.evidenceArtifact.findFirst({
        where: {
          evidenceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!artifact) {
        return null;
      }

      const evidenceService = createPrismaEvidenceService({ prisma });
      const stored = await evidenceService.getEvidenceArtifact(
        evidenceId,
        context.tenant.tenantId
      );
      const { inspection } = await loadEvidenceChainInspection(
        prisma,
        context.tenant.tenantId
      );
      const chain =
        inspection.links.find((link) => link.evidenceId === evidenceId) ?? null;
      const recordedSha256 = artifact.redactedSha256 ?? artifact.sha256;
      const contentValid = stored
        ? stored.computedSha256 === recordedSha256
        : false;

      let status: "Verified" | "ContentOnly" | "Broken" | "Unavailable";
      let reason: string | null;

      if (!stored) {
        status = "Unavailable";
        reason = "The stored evidence content is unavailable for verification.";
      } else if (!contentValid) {
        status = "Broken";
        reason =
          "Stored content does not match its recorded SHA-256 commitment.";
      } else if (artifact.chainSeq === null) {
        status = "ContentOnly";
        reason =
          "Content integrity passed, but this legacy artifact predates tenant hash chaining.";
      } else if (!chain || chain.status !== "Verified") {
        status = "Broken";
        reason =
          chain?.reason ??
          "The artifact has chain metadata but no verifiable tenant-chain link.";
      } else {
        status = "Verified";
        reason = null;
      }

      return {
        chain: chain
          ? {
              chainHash: chain.chainHash,
              chainSeq: chain.chainSeq,
              evidenceId: chain.evidenceId,
              prevChainHash: chain.prevChainHash,
              reason: chain.reason ?? null,
              status: chain.status,
              valid: chain.valid
            }
          : null,
        content: {
          commitment: artifact.redactedSha256 ? "RedactedCopy" : "Ingest",
          computedSha256: stored?.computedSha256 ?? null,
          recordedSha256,
          valid: contentValid
        },
        evidenceId,
        method: EVIDENCE_VERIFICATION_METHOD,
        reason,
        status,
        tenantId: context.tenant.tenantId,
        valid: status === "Verified",
        verifiedAt: new Date().toISOString()
      };
    },

    async downloadEvidence(context, evidenceId) {
      const artifact = await prisma.evidenceArtifact.findFirst({
        where: {
          evidenceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!artifact) {
        return null;
      }

      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const stored = await evidenceService.getEvidenceArtifact(
        evidenceId,
        context.tenant.tenantId
      );

      if (!stored) {
        return null;
      }

      // Integrity is verified against the RIGHT commitment: for an artifact that
      // was redacted after ingest, the stored blob is the redacted copy, so it is
      // checked against redactedSha256; the original sha256 remains the chain's
      // ingest commitment (surfaced as recordedSha256). Without this, a legitimate
      // redaction would be mis-reported as a tampered artifact.
      const integrityVerified = artifact.redactedSha256
        ? stored.computedSha256 === artifact.redactedSha256
        : stored.integrityVerified;

      return {
        artifact: serializeEvidenceArtifact(artifact),
        computedSha256: stored.computedSha256,
        content: stored.content,
        integrityVerified,
        recordedSha256: artifact.redactedSha256 ?? artifact.sha256
      };
    },

    async redactEvidence(context, evidenceId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "redact evidence"
      );

      const artifact = await prisma.evidenceArtifact.findFirst({
        where: {
          evidenceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!artifact) {
        throw new AppServiceError(
          "Evidence not found.",
          404,
          "evidence_not_found"
        );
      }

      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const result = await evidenceService.redactStoredEvidence(
        evidenceId,
        context.tenant.tenantId
      );

      if (!result) {
        throw new AppServiceError(
          "Evidence content not found.",
          404,
          "evidence_not_found"
        );
      }

      // Authorized redaction is a governed action on the evidence ledger — record
      // it in the audit trail (actor + whether content changed).
      await writeAuditEvent(prisma, {
        action: "evidence.redacted",
        actorType: "User",
        entityId: result.artifact.relatedEntityId,
        entityType: result.artifact.relatedEntityType,
        metadata: {
          contentChanged: result.changed,
          evidenceId,
          redactionStatus: result.redactionStatus
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return result.artifact;
    },

    async generateEvidenceSummary(context, input) {
      const artifacts =
        input.evidenceIds.length === 0
          ? []
          : await prisma.evidenceArtifact.findMany({
              orderBy: {
                createdAt: "asc"
              },
              where: {
                evidenceId: {
                  in: input.evidenceIds
                },
                tenantId: context.tenant.tenantId
              }
            });

      return generateEvidenceGroundedSummary({
        artifacts: artifacts.map(serializeEvidenceArtifact),
        generatedAt: new Date().toISOString(),
        useCase: input.useCase
      });
    }
  };
}
