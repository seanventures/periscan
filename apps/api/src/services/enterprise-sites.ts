import {
  evaluateEnterpriseSiteDiscoverGate,
  type CreateEnterpriseSiteInput,
  type EnterpriseSite,
  type UpdateEnterpriseSiteInput,
  type VerifiedScopeSnapshot
} from "@periscan/shared";
import {
  createEnterpriseSiteRecord,
  getEnterpriseSiteRecord,
  listEnterpriseSiteRecords,
  updateEnterpriseSiteRecord,
  type EnterpriseSiteRecord
} from "@periscan/db";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

function toPublicSite(record: EnterpriseSiteRecord): EnterpriseSite {
  return {
    adDomains: record.adDomains,
    cidrs: record.cidrs,
    name: record.name,
    runnerIds: record.runnerIds,
    siteId: record.siteId
  };
}

export function assertEnterpriseSiteDiscoverAllowed(input: {
  sites: readonly EnterpriseSite[];
  target: string;
  verifiedScopes: readonly VerifiedScopeSnapshot[];
}): void {
  const decision = evaluateEnterpriseSiteDiscoverGate(input);
  if (decision && !decision.allowed) {
    throw new AppServiceError(
      decision.rationale,
      400,
      decision.code ?? "empty_site_catalog"
    );
  }
}

export function createEnterpriseSiteServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  "createEnterpriseSite" | "listEnterpriseSites" | "updateEnterpriseSite"
> {
  const { prisma } = deps;

  async function assertRunnersInTenant(
    tenantId: string,
    runnerIds: string[]
  ): Promise<void> {
    if (runnerIds.length === 0) {
      return;
    }
    const found = await prisma.runner.findMany({
      select: { runnerId: true },
      where: {
        runnerId: { in: runnerIds },
        tenantId
      }
    });
    if (found.length !== new Set(runnerIds).size) {
      throw new AppServiceError(
        "One or more runnerIds are not in this tenant.",
        400,
        "runner_not_found"
      );
    }
  }

  return {
    async listEnterpriseSites(context) {
      const rows = await listEnterpriseSiteRecords(
        prisma,
        context.tenant.tenantId
      );
      return rows.map(toPublicSite);
    },

    async createEnterpriseSite(context, input: CreateEnterpriseSiteInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create enterprise sites"
      );
      await assertRunnersInTenant(context.tenant.tenantId, input.runnerIds);
      const created = await createEnterpriseSiteRecord(prisma, {
        adDomains: input.adDomains,
        cidrs: input.cidrs,
        name: input.name,
        runnerIds: input.runnerIds,
        tenantId: context.tenant.tenantId
      });
      return toPublicSite(created);
    },

    async updateEnterpriseSite(
      context,
      siteId: string,
      input: UpdateEnterpriseSiteInput
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "update enterprise sites"
      );
      if (input.runnerIds) {
        await assertRunnersInTenant(context.tenant.tenantId, input.runnerIds);
      }
      const existing = await getEnterpriseSiteRecord(prisma, {
        siteId,
        tenantId: context.tenant.tenantId
      });
      if (!existing) {
        throw new AppServiceError(
          "Enterprise site not found.",
          404,
          "enterprise_site_not_found"
        );
      }
      const updated = await updateEnterpriseSiteRecord(prisma, {
        ...input,
        siteId,
        tenantId: context.tenant.tenantId
      });
      if (!updated) {
        throw new AppServiceError(
          "Enterprise site not found.",
          404,
          "enterprise_site_not_found"
        );
      }
      return toPublicSite(updated);
    }
  };
}
