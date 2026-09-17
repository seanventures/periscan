import type { GatewayPrisma } from "./audit.js";

export type ScopedAsset = {
  assetId: string;
  assetType?: string;
  businessCriticality?: string;
  identifiers?: unknown;
  internetExposed?: boolean;
  name?: string | null;
  status?: string;
  tags?: string[] | null;
};

export type ScopedExposure = {
  assetId?: string | null;
  evidenceIds: string[];
  exposureId: string;
  exposureType?: string;
  severity?: string;
  status?: string;
  validationState?: string;
};

export type ScopedAttackPath = {
  confidence?: number;
  evidenceIds: string[];
  impactScore?: number;
  name?: string;
  pathId: string;
  validationState?: string;
};

type ScopeRecord = {
  scopeId: string;
  scopeType?: string;
  value: string;
};

const MAX_SCOPE_ASSET_SCAN = 500;

type FindManyDelegate = {
  findMany: (args: never) => Promise<unknown[]>;
};

type ScopeFilterPrisma = GatewayPrisma;

function findMany(delegate: unknown, args: unknown): Promise<unknown[]> {
  return (delegate as FindManyDelegate).findMany(args as never);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/u, "");
}

function collectPrimitiveStrings(
  value: unknown,
  output: string[] = []
): string[] {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPrimitiveStrings(item, output);
    }
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectPrimitiveStrings(item, output);
    }
  }
  return output;
}

function hostnameFrom(value: string): string | null {
  try {
    return normalize(new URL(value).hostname);
  } catch {
    return null;
  }
}

function scopeMatchesText(scope: ScopeRecord, rawText: string): boolean {
  const scopeValue = normalize(scope.value);
  const text = normalize(rawText);
  if (!scopeValue || !text) {
    return false;
  }

  if (text === scopeValue || text.includes(scopeValue)) {
    return true;
  }

  const textHost = hostnameFrom(text);
  const scopeHost = hostnameFrom(scopeValue) ?? scopeValue;
  if (
    textHost &&
    (textHost === scopeHost || textHost.endsWith(`.${scopeHost}`))
  ) {
    return true;
  }

  return text.endsWith(`.${scopeValue}`);
}

export function assetMatchesVerifiedScope(
  asset: ScopedAsset,
  scopes: ScopeRecord[]
): boolean {
  if (scopes.length === 0) {
    return false;
  }
  const searchableValues = [
    asset.name ?? "",
    ...(asset.tags ?? []),
    ...collectPrimitiveStrings(asset.identifiers)
  ];

  return scopes.some((scope) =>
    searchableValues.some((value) => scopeMatchesText(scope, value))
  );
}

export async function loadVerifiedScopesForSession(input: {
  prisma: Pick<GatewayPrisma, "scope">;
  scopeIds: string[];
  tenantId: string;
}): Promise<ScopeRecord[]> {
  if (input.scopeIds.length === 0) {
    return [];
  }

  return (await findMany(input.prisma.scope, {
    select: { scopeId: true, scopeType: true, value: true },
    where: {
      scopeId: { in: input.scopeIds },
      tenantId: input.tenantId,
      verificationStatus: "Verified"
    }
  })) as ScopeRecord[];
}

export async function loadAssetsForVerifiedScopes(input: {
  prisma: ScopeFilterPrisma;
  scopeIds: string[];
  take: number;
  tenantId: string;
}): Promise<ScopedAsset[]> {
  const scopes = await loadVerifiedScopesForSession(input);
  if (scopes.length === 0) {
    return [];
  }

  const assets = (await findMany(input.prisma.asset, {
    orderBy: { businessCriticality: "desc" },
    take: Math.max(input.take, MAX_SCOPE_ASSET_SCAN),
    where: { tenantId: input.tenantId }
  })) as ScopedAsset[];

  return assets
    .filter((asset) => assetMatchesVerifiedScope(asset, scopes))
    .slice(0, input.take);
}

export async function loadExposuresForScopedAssets(input: {
  assetIds: string[];
  prisma: ScopeFilterPrisma;
  take: number;
  tenantId: string;
}): Promise<ScopedExposure[]> {
  if (input.assetIds.length === 0) {
    return [];
  }
  return (await findMany(input.prisma.exposure, {
    orderBy: { severity: "desc" },
    take: input.take,
    where: {
      assetId: { in: input.assetIds },
      tenantId: input.tenantId
    }
  })) as ScopedExposure[];
}

export async function loadAttackPathsForScopedEntities(input: {
  entityIds: string[];
  prisma: ScopeFilterPrisma;
  take: number;
  tenantId: string;
}): Promise<ScopedAttackPath[]> {
  if (input.entityIds.length === 0) {
    return [];
  }
  return (await findMany(input.prisma.attackPath, {
    orderBy: { impactScore: "desc" },
    take: input.take,
    where: {
      pathNodes: {
        some: {
          entityId: { in: input.entityIds }
        }
      },
      tenantId: input.tenantId
    }
  })) as ScopedAttackPath[];
}
