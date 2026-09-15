import type { GlobalSearchResult } from "@periscan/shared";

import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

// Cross-entity global search backing the command palette. Case-insensitive
// substring match, tenant-scoped, capped per entity type so one noisy type
// can't drown the others. Read-only — no audit event. Only entity types with a
// real UI destination are searched (the client maps type -> route).
const PER_TYPE_LIMIT = 5;

export function createSearchServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "globalSearch"> {
  const { prisma } = deps;

  return {
    async globalSearch(context, query) {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        return { query: trimmed, results: [] };
      }

      const tenantId = context.tenant.tenantId;
      const contains = { contains: trimmed, mode: "insensitive" as const };

      const [scopes, assets, paths, remediations, aiApps, evidencePacks] =
        await Promise.all([
          prisma.scope.findMany({
            orderBy: { createdAt: "desc" },
            select: { scopeId: true, scopeType: true, value: true },
            take: PER_TYPE_LIMIT,
            where: { tenantId, value: contains }
          }),
          prisma.asset.findMany({
            orderBy: { createdAt: "desc" },
            select: { assetId: true, assetType: true, name: true },
            take: PER_TYPE_LIMIT,
            where: { name: contains, tenantId }
          }),
          prisma.attackPath.findMany({
            orderBy: { createdAt: "desc" },
            select: { name: true, pathId: true, validationState: true },
            take: PER_TYPE_LIMIT,
            where: { name: contains, tenantId }
          }),
          prisma.remediationTask.findMany({
            orderBy: { createdAt: "desc" },
            select: { recommendedAction: true, remediationId: true, status: true },
            take: PER_TYPE_LIMIT,
            where: { recommendedAction: contains, tenantId }
          }),
          prisma.aIApplication.findMany({
            orderBy: { createdAt: "desc" },
            select: { aiAppId: true, appType: true, name: true },
            take: PER_TYPE_LIMIT,
            where: { name: contains, tenantId }
          }),
          prisma.evidencePack.findMany({
            orderBy: { createdAt: "desc" },
            select: { evidencePackId: true, packType: true, title: true },
            take: PER_TYPE_LIMIT,
            where: { tenantId, title: contains }
          })
        ]);

      const results: GlobalSearchResult[] = [
        ...scopes.map((row) => ({
          id: row.scopeId,
          label: row.value,
          sublabel: `${row.scopeType} scope`,
          type: "Scope" as const
        })),
        ...assets.map((row) => ({
          id: row.assetId,
          label: row.name,
          sublabel: `${row.assetType} asset`,
          type: "Asset" as const
        })),
        ...paths.map((row) => ({
          id: row.pathId,
          label: row.name,
          sublabel: `Attack path · ${row.validationState}`,
          type: "AttackPath" as const
        })),
        ...remediations.map((row) => ({
          id: row.remediationId,
          label: row.recommendedAction,
          sublabel: `Remediation · ${row.status}`,
          type: "Remediation" as const
        })),
        ...aiApps.map((row) => ({
          id: row.aiAppId,
          label: row.name,
          sublabel: `${row.appType} AI app`,
          type: "AIApplication" as const
        })),
        ...evidencePacks.map((row) => ({
          id: row.evidencePackId,
          label: row.title,
          sublabel: `${row.packType} evidence pack`,
          type: "EvidencePack" as const
        }))
      ];

      return { query: trimmed, results };
    }
  };
}
