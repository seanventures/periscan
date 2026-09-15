import type {
  TenantThreatAlert,
  ThreatCatalogQuery,
  ThreatFeedStatus,
  ThreatIntelItem,
  ThreatSeverity
} from "@periscan/shared";
import type { Prisma } from "@prisma/client";

import { listThreatFeeds } from "../threat-feeds/registry.js";
import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

type ItemWithProvenance = Prisma.ThreatIntelItemGetPayload<{
  include: { provenance: true };
}>;
type AlertWithItem = Prisma.TenantThreatAlertGetPayload<{
  include: { item: { include: { provenance: true } } };
}>;

function serializeItem(item: ItemWithProvenance): ThreatIntelItem {
  return {
    threatIntelItemId: item.threatIntelItemId,
    kind: item.kind,
    canonicalKey: item.canonicalKey,
    title: item.title,
    summary: item.summary,
    cveIds: item.cveIds,
    cvssScore: item.cvssScore,
    epssScore: item.epssScore,
    severity: (item.severity as ThreatSeverity | null) ?? null,
    kev: item.kev,
    kevRansomware: item.kevRansomware,
    iocType: (item.iocType as ThreatIntelItem["iocType"]) ?? null,
    iocValue: item.iocValue,
    techniqueIds: item.techniqueIds,
    tags: item.tags,
    sourceCount: item.sourceCount,
    sources: [...new Set(item.provenance.map((p) => p.sourceKey))].sort(),
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    firstSeenAt: item.firstSeenAt.toISOString(),
    lastSeenAt: item.lastSeenAt.toISOString()
  };
}

function serializeAlert(alert: AlertWithItem): TenantThreatAlert {
  return {
    tenantThreatAlertId: alert.tenantThreatAlertId,
    threatIntelItemId: alert.threatIntelItemId,
    matchType: alert.matchType,
    matchedValue: alert.matchedValue,
    matchedScopeId: alert.matchedScopeId,
    severity: alert.severity,
    status: alert.status,
    createdAt: alert.createdAt.toISOString(),
    item: serializeItem(alert.item)
  };
}

/**
 * Super-feed read/operate surface: the global deduped catalog + feed health are
 * readable by any authenticated tenant member; per-tenant alerts are tenant
 * scoped and their status is operator-mutable.
 */
export function createSuperFeedServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "listThreatCatalog"
  | "getThreatFeedStatus"
  | "listThreatAlerts"
  | "setThreatAlertStatus"
> {
  const { prisma } = deps;
  const env = process.env;

  return {
    async listThreatCatalog(_context, query: ThreatCatalogQuery) {
      const where: Prisma.ThreatIntelItemWhereInput = {};
      if (query.kind) {
        where.kind = query.kind;
      }
      if (query.severity) {
        where.severity = query.severity;
      }
      if (query.kev !== undefined) {
        where.kev = query.kev;
      }
      if (query.q) {
        const q = query.q.trim();
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { canonicalKey: { contains: q, mode: "insensitive" } },
          { iocValue: { contains: q, mode: "insensitive" } },
          { cveIds: { has: q.toUpperCase() } }
        ];
      }
      const items = await prisma.threatIntelItem.findMany({
        where,
        include: { provenance: true },
        orderBy: { lastSeenAt: "desc" },
        take: query.limit ?? 50
      });
      return items.map(serializeItem);
    },

    async getThreatFeedStatus(): Promise<ThreatFeedStatus[]> {
      const states = await prisma.threatIntelSourceState.findMany();
      const stateBySource = new Map(states.map((s) => [s.sourceKey, s]));
      return listThreatFeeds().map((feed) => {
        const state = stateBySource.get(feed.sourceKey);
        return {
          sourceKey: feed.sourceKey,
          name: feed.name,
          category: feed.category,
          description: feed.description,
          cadenceMinutes: feed.cadenceMinutes,
          keyRequired: feed.keyRequired,
          keyConfigured: feed.keyEnvVar ? Boolean(env[feed.keyEnvVar]) : true,
          enabled: state?.enabled ?? true,
          lastPolledAt: state?.lastPolledAt
            ? state.lastPolledAt.toISOString()
            : null,
          nextPollAt: state?.nextPollAt ? state.nextPollAt.toISOString() : null,
          lastStatus: state?.lastStatus ?? null,
          lastError: state?.lastError ?? null,
          lastItemCount: state?.lastItemCount ?? 0,
          lastNewCount: state?.lastNewCount ?? 0,
          consecutiveErrors: state?.consecutiveErrors ?? 0
        };
      });
    },

    async listThreatAlerts(context, options) {
      const where: Prisma.TenantThreatAlertWhereInput = {
        tenantId: context.tenant.tenantId
      };
      if (options?.status) {
        where.status = options.status;
      }
      const alerts = await prisma.tenantThreatAlert.findMany({
        where,
        include: { item: { include: { provenance: true } } },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 100
      });
      return alerts.map(serializeAlert);
    },

    async setThreatAlertStatus(context, alertId, status) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "update a threat alert"
      );
      const existing = await prisma.tenantThreatAlert.findFirst({
        where: {
          tenantThreatAlertId: alertId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!existing) {
        throw new AppServiceError("Threat alert not found.", 404, "not_found");
      }
      const updated = await prisma.tenantThreatAlert.update({
        where: { tenantThreatAlertId: alertId },
        data: { status },
        include: { item: { include: { provenance: true } } }
      });
      return serializeAlert(updated);
    }
  };
}
