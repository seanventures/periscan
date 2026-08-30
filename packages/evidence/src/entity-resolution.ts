export type ResolvableAsset = {
  assetId: string;
  assetType: string;
  identifiers: Record<string, unknown>;
  name: string;
};

export type AssetResolution = {
  canonicalKeys: string[];
  conflictFields: string[];
  confidence: number;
  matchedAssetId: string | null;
  mergedIdentifiers: Record<string, unknown>;
  status: "Created" | "Matched" | "ConflictMatched" | "AmbiguousCreated";
};

const STRONG_IDENTIFIER_KEYS = new Set([
  "agentid",
  "arn",
  "cloudresourceid",
  "deviceid",
  "externalid",
  "id",
  "instanceid",
  "repositoryid",
  "resourceid",
  "serialnumber",
  "url"
]);

// Only these non-ID fields can contribute an exact identifier match. All other
// values (region, location, account, subscription, state, resource kind, and
// similar provider context) are deliberately ignored for identity resolution;
// matching them collapses sibling resources into one canonical asset.
const WEAK_IDENTIFIER_KEYS = new Set([
  "domain",
  "email",
  "fqdn",
  "hostname",
  "ip",
  "ipaddress",
  "repository",
  "repositoryurl",
  "service",
  "username"
]);

function normalizeIdentifierValue(key: string, value: string): string {
  const trimmed = value.trim();
  if (key.toLowerCase().includes("url")) {
    try {
      const url = new URL(trimmed);
      url.hostname = url.hostname.toLowerCase();
      url.hash = "";
      return url.toString().replace(/\/$/u, "");
    } catch {
      return trimmed.toLowerCase().replace(/\/$/u, "");
    }
  }
  return trimmed.toLowerCase().replace(/\.$/u, "");
}

export function normalizeAssetIdentifiers(
  identifiers: Record<string, unknown>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(identifiers)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;
    const value =
      typeof rawValue === "string" || typeof rawValue === "number"
        ? String(rawValue)
        : null;
    if (!value?.trim()) continue;
    normalized[key] = normalizeIdentifierValue(key, value);
  }
  return normalized;
}

function canonicalKeys(identifiers: Record<string, string>): string[] {
  return Object.entries(identifiers)
    .map(([key, value]) => `${key}:${value}`)
    .sort();
}

export function resolveAssetObservation(input: {
  candidates: ResolvableAsset[];
  observed: Omit<ResolvableAsset, "assetId">;
}): AssetResolution {
  const observedIdentifiers = normalizeAssetIdentifiers(
    input.observed.identifiers
  );
  const observedKeys = new Set(canonicalKeys(observedIdentifiers));
  const ranked = input.candidates
    .map((candidate) => {
      const candidateIdentifiers = normalizeAssetIdentifiers(
        candidate.identifiers
      );
      const matches = Object.entries(observedIdentifiers).filter(
        ([key, value]) => candidateIdentifiers[key] === value
      );
      const typeCompatible = candidate.assetType === input.observed.assetType;
      const identityMatches = matches.filter(
        ([key]) =>
          STRONG_IDENTIFIER_KEYS.has(key) || WEAK_IDENTIFIER_KEYS.has(key)
      );
      const strongMatch =
        typeCompatible &&
        identityMatches.some(([key]) => STRONG_IDENTIFIER_KEYS.has(key));
      const weakMatch = typeCompatible && identityMatches.length > 0;
      const typeAndNameMatch =
        typeCompatible &&
        candidate.name.trim().toLowerCase() ===
          input.observed.name.trim().toLowerCase();
      const score = strongMatch
        ? 1
        : weakMatch
          ? 0.92
          : typeAndNameMatch
            ? 0.78
            : 0;
      return { candidate, candidateIdentifiers, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.assetId.localeCompare(right.candidate.assetId)
    );

  const best = ranked[0];
  if (!best) {
    return {
      canonicalKeys: [...observedKeys],
      confidence: 1,
      conflictFields: [],
      matchedAssetId: null,
      mergedIdentifiers: input.observed.identifiers,
      status: "Created"
    };
  }
  if (ranked[1]?.score === best.score) {
    return {
      canonicalKeys: [...observedKeys],
      confidence: 0.5,
      conflictFields: ["ambiguous_identity"],
      matchedAssetId: null,
      mergedIdentifiers: input.observed.identifiers,
      status: "AmbiguousCreated"
    };
  }

  const conflictFields = Object.entries(observedIdentifiers)
    .filter(
      ([key, value]) =>
        best.candidateIdentifiers[key] !== undefined &&
        best.candidateIdentifiers[key] !== value
    )
    .map(([key]) => key)
    .sort();
  const mergedIdentifiers = { ...best.candidate.identifiers };
  for (const [key, value] of Object.entries(input.observed.identifiers)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!(normalizedKey in best.candidateIdentifiers)) {
      mergedIdentifiers[key] = value;
    }
  }

  return {
    canonicalKeys: [...observedKeys],
    confidence: best.score,
    conflictFields,
    matchedAssetId: best.candidate.assetId,
    mergedIdentifiers,
    status: conflictFields.length > 0 ? "ConflictMatched" : "Matched"
  };
}
