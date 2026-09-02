/**
 * Stable finding fingerprints and pure grouping helpers (Slice 4 Phase B).
 *
 * Findings are DERIVED (no findings table) from paths + signals. Fingerprints
 * identify unique security work so repeated observations update an occurrence
 * rather than minting indistinguishable queue items.
 *
 * Rules encoded here:
 * - same secret / same repo (same correlation keys + assets) → one fingerprint
 * - same path template family on different asset sets → distinct fingerprints
 * - path-primary absorb: signals that feed a path are counted as occurrences on
 *   the path group rather than competing work items (see
 *   absorbContributingSignalsIntoPathFindings)
 *
 * SAFETY: grouping never upgrades claim language (validationState /
 * exploitability / evidenceBasis). The representative row's claims are kept;
 * only identity, timing, asset, and evidence sets are merged.
 */

import { createHash } from "node:crypto";

const FINGERPRINT_VERSION = "v1";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Signal-like input for fingerprinting. Intentionally structural (not a full
 * SignalEnvelope) so callers can pass partial rows, fixtures, or pre-normalized
 * connector payloads without pulling the full domain type.
 */
export type SignalFindingFingerprintInput = {
  /** Optional explicit correlation keys (e.g. secret rule id, rule fingerprint). */
  correlationKeys?: readonly string[] | null;
  relatedAssetIds?: readonly string[] | null;
  signalCategory: string;
  signalSubcategory?: string | null;
  sourceType: string;
  sourceVendor: string;
  techniqueIds?: readonly string[] | null;
};

/**
 * Path-like input for fingerprinting. Prefer template/name family + asset
 * correlation keys — never random path UUIDs — so re-derived paths of the same
 * cause on the same assets collapse.
 */
export type PathFindingFingerprintInput = {
  /**
   * Stable asset correlation keys (typically Asset/Exposure entityIds from
   * path nodes). Sorted + deduped internally. Different asset sets ⇒ different
   * fingerprints for the same template.
   */
  assetCorrelationKeys: readonly string[];
  /** Optional methodology string (e.g. heuristic-pattern-correlation:repo-secret-cloud-role). */
  methodology?: string | null;
  /** Human path name; used when patternId/methodology do not yield a family. */
  name: string;
  /** Prefer this when available (CorrelatedPathDraft.patternId). */
  patternId?: string | null;
};

export type FindingFingerprintMaterial = {
  fingerprint: string;
  groupKey: string;
  rootCauseSummary: string;
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ");
}

function stripUuids(value: string): string {
  return value.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu,
    ""
  );
}

function slugify(value: string): string {
  return (
    stripUuids(normalizeToken(value))
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "unknown"
  );
}

function sortedUnique(values: readonly string[] | null | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map((value) => value.toLowerCase())
    )
  ].sort((left, right) => left.localeCompare(right));
}

/**
 * Derive a stable path template / name family.
 * Priority: patternId → methodology suffix → normalized name (UUIDs stripped).
 */
export function derivePathTemplateFamily(
  input: Pick<PathFindingFingerprintInput, "methodology" | "name" | "patternId">
): string {
  const patternId = input.patternId?.trim();
  if (patternId) {
    return slugify(patternId);
  }

  const methodology = input.methodology?.trim();
  if (methodology) {
    // e.g. heuristic-pattern-correlation:repo-secret-cloud-role
    const colonSuffix = methodology.match(/:([A-Za-z0-9][A-Za-z0-9_-]*)$/u);
    if (colonSuffix?.[1]) {
      return slugify(colonSuffix[1]);
    }
    const lastSegment = methodology.split(/[/:]/u).filter(Boolean).at(-1);
    if (lastSegment) {
      return slugify(lastSegment);
    }
  }

  return slugify(input.name);
}

function signalTemplateFamily(
  input: SignalFindingFingerprintInput
): string {
  const category = slugify(input.signalCategory);
  const subcategory = input.signalSubcategory?.trim()
    ? slugify(input.signalSubcategory)
    : "none";
  const sourceType = slugify(input.sourceType);
  return `${category}/${subcategory}/${sourceType}`;
}

// ---------------------------------------------------------------------------
// Fingerprint compute
// ---------------------------------------------------------------------------

/**
 * Stable fingerprint for a signal-derived finding.
 * Same secret + same repo (same category/subcategory/source + assets +
 * correlation keys) → same fingerprint across re-ingest.
 */
export function computeSignalFindingFingerprint(
  input: SignalFindingFingerprintInput
): string {
  return computeSignalFindingMaterial(input).fingerprint;
}

export function computeSignalFindingMaterial(
  input: SignalFindingFingerprintInput
): FindingFingerprintMaterial {
  const template = signalTemplateFamily(input);
  const assets = sortedUnique(input.relatedAssetIds);
  const correlationKeys = sortedUnique(input.correlationKeys);
  const techniques = sortedUnique(input.techniqueIds);
  const vendor = slugify(input.sourceVendor);

  const groupKey = [
    FINGERPRINT_VERSION,
    "signal",
    template,
    `vendor:${vendor}`,
    `assets:${assets.join(",") || "-"}`,
    `corr:${correlationKeys.join(",") || "-"}`,
    `tech:${techniques.join(",") || "-"}`
  ].join("|");

  const rootCauseSummary = buildSignalRootCauseSummary(input, assets);

  return {
    fingerprint: sha256Hex(groupKey),
    groupKey,
    rootCauseSummary
  };
}

function buildSignalRootCauseSummary(
  input: SignalFindingFingerprintInput,
  assets: string[]
): string {
  const category = input.signalCategory.trim() || "Signal";
  const subcategory = input.signalSubcategory?.trim();
  const label = subcategory ? `${category} / ${subcategory}` : category;
  const assetPart =
    assets.length === 0
      ? "no linked assets"
      : assets.length === 1
        ? "1 linked asset"
        : `${assets.length} linked assets`;
  return `${label} from ${input.sourceVendor} (${input.sourceType}); ${assetPart}.`;
}

/**
 * Stable fingerprint for a path-derived finding.
 * Uses path template/name family + asset correlation keys — NOT path UUIDs.
 * Same template on different assets → distinct fingerprints.
 */
export function computePathFindingFingerprint(
  input: PathFindingFingerprintInput
): string {
  return computePathFindingMaterial(input).fingerprint;
}

export function computePathFindingMaterial(
  input: PathFindingFingerprintInput
): FindingFingerprintMaterial {
  const templateFamily = derivePathTemplateFamily(input);
  const assets = sortedUnique(input.assetCorrelationKeys);

  const groupKey = [
    FINGERPRINT_VERSION,
    "path",
    templateFamily,
    `assets:${assets.join(",") || "-"}`
  ].join("|");

  const assetPart =
    assets.length === 0
      ? "no correlated assets"
      : assets.length === 1
        ? "1 correlated asset"
        : `${assets.length} correlated assets`;

  const rootCauseSummary = `Attack path template "${templateFamily}" affecting ${assetPart}.`;

  return {
    fingerprint: sha256Hex(groupKey),
    groupKey,
    rootCauseSummary
  };
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Minimal row shape accepted by groupFindingsByFingerprint. Callers may pass
 * richer ValidatedFinding-like objects; extra fields are preserved on the
 * representative member.
 */
export type FingerprintableFindingRow = {
  affectedAssetCount?: number | null;
  createdAt?: string | null;
  evidenceIds?: readonly string[] | null;
  findingId?: string | null;
  fingerprint: string;
  firstSeenAt?: string | null;
  groupKey?: string | null;
  lastSeenAt?: string | null;
  occurrenceCount?: number | null;
  relatedAssetIds?: readonly string[] | null;
  relatedPathIds?: readonly string[] | null;
  rootCauseSummary?: string | null;
  /** Prefer AttackPath as path-primary when absorbing signals. */
  sourceEntityType?: string | null;
  updatedAt?: string | null;
};

export type GroupedFindingRow<T extends FingerprintableFindingRow> = T & {
  affectedAssetCount: number;
  evidenceIds: string[];
  firstSeenAt: string;
  groupKey: string;
  lastSeenAt: string;
  memberFindingIds: string[];
  occurrenceCount: number;
  relatedAssetIds: string[];
  rootCauseSummary: string | null;
};

function rowFirstSeen(row: FingerprintableFindingRow): string {
  return row.firstSeenAt ?? row.createdAt ?? row.updatedAt ?? "";
}

function rowLastSeen(row: FingerprintableFindingRow): string {
  return row.lastSeenAt ?? row.updatedAt ?? row.createdAt ?? row.firstSeenAt ?? "";
}

function unionSortedIds(
  ...lists: Array<readonly string[] | null | undefined>
): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const id of list) {
      const trimmed = id.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((left, right) => left.localeCompare(right));
}

function isPathPrimary(row: FingerprintableFindingRow): boolean {
  return (
    row.sourceEntityType === "AttackPath" ||
    (row.groupKey?.startsWith(`${FINGERPRINT_VERSION}|path|`) ?? false)
  );
}

/**
 * Prefer path-primary rows as the merge representative so claim language stays
 * anchored on the path (which already encodes measured-vs-heuristic honestly).
 * Does NOT upgrade validationState/exploitability — those stay as on the
 * representative.
 */
function pickRepresentative<T extends FingerprintableFindingRow>(
  members: T[]
): T {
  const pathPrimary = members.find((row) => isPathPrimary(row));
  if (pathPrimary) {
    return pathPrimary;
  }
  // Oldest first-seen as stable tie-break (deterministic sort by firstSeen then findingId).
  const sorted = [...members].sort((left, right) => {
    const first = rowFirstSeen(left).localeCompare(rowFirstSeen(right));
    if (first !== 0) return first;
    return (left.findingId ?? "").localeCompare(right.findingId ?? "");
  });
  return sorted[0]!;
}

/**
 * Merge raw finding rows that share a fingerprint into a single operational
 * finding: min firstSeen, max lastSeen, union assets/evidence, sum occurrence
 * counts. Claim-language fields come only from the representative (path-primary
 * preferred) — never invented or upgraded.
 */
export function groupFindingsByFingerprint<
  T extends FingerprintableFindingRow
>(rawRows: readonly T[]): Array<GroupedFindingRow<T>> {
  const byFingerprint = new Map<string, T[]>();

  for (const row of rawRows) {
    const fingerprint = row.fingerprint?.trim();
    if (!fingerprint) {
      // Rows without a fingerprint stay as singleton groups keyed by findingId
      // (or a synthetic key) so callers never drop data.
      const fallbackKey = `unfingerprinted:${row.findingId ?? JSON.stringify(row.createdAt)}`;
      const bucket = byFingerprint.get(fallbackKey) ?? [];
      bucket.push(row);
      byFingerprint.set(fallbackKey, bucket);
      continue;
    }
    const bucket = byFingerprint.get(fingerprint) ?? [];
    bucket.push(row);
    byFingerprint.set(fingerprint, bucket);
  }

  const grouped: Array<GroupedFindingRow<T>> = [];

  for (const [fingerprint, members] of byFingerprint) {
    const representative = pickRepresentative(members);
    const firstSeenCandidates = members
      .map(rowFirstSeen)
      .filter((value) => value.length > 0)
      .sort((left, right) => left.localeCompare(right));
    const lastSeenCandidates = members
      .map(rowLastSeen)
      .filter((value) => value.length > 0)
      .sort((left, right) => right.localeCompare(left));

    const relatedAssetIds = unionSortedIds(
      ...members.map((member) => member.relatedAssetIds)
    );
    const evidenceIds = unionSortedIds(
      ...members.map((member) => member.evidenceIds)
    );
    const occurrenceCount = members.reduce(
      (sum, member) => sum + (member.occurrenceCount && member.occurrenceCount > 0
        ? member.occurrenceCount
        : 1),
      0
    );
    const memberFindingIds = members
      .map((member) => member.findingId)
      .filter((id): id is string => Boolean(id?.trim()))
      .sort((left, right) => left.localeCompare(right));

    const groupKey =
      representative.groupKey?.trim() ||
      members.find((member) => member.groupKey?.trim())?.groupKey?.trim() ||
      fingerprint;
    const rootCauseSummary =
      representative.rootCauseSummary?.trim() ||
      members.find((member) => member.rootCauseSummary?.trim())
        ?.rootCauseSummary?.trim() ||
      null;

    grouped.push({
      ...representative,
      affectedAssetCount: relatedAssetIds.length,
      evidenceIds,
      fingerprint:
        representative.fingerprint?.trim() ||
        (fingerprint.startsWith("unfingerprinted:")
          ? representative.fingerprint
          : fingerprint) ||
        fingerprint,
      firstSeenAt: firstSeenCandidates[0] ?? rowFirstSeen(representative),
      groupKey,
      lastSeenAt: lastSeenCandidates[0] ?? rowLastSeen(representative),
      memberFindingIds,
      occurrenceCount,
      relatedAssetIds,
      rootCauseSummary
    });
  }

  // Stable order: more occurrences first, then fingerprint.
  return grouped.sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
    return left.fingerprint.localeCompare(right.fingerprint);
  });
}

/**
 * Path-primary absorb: when a signal finding feeds a path (relatedPathIds
 * intersects a path finding's findingId / relatedPathIds), fold the signal into
 * the path group as an extra occurrence and drop the standalone signal row.
 *
 * Does not invent claim language — path claims stay on the path row; signal
 * evidence/assets/timestamps are unioned only.
 *
 * Call this on raw (pre-group) rows, then groupFindingsByFingerprint if needed,
 * or on already-built finding lists that still have distinct findingIds.
 *
 * Enriched fields (firstSeenAt/lastSeenAt/occurrenceCount/relatedAssetIds/
 * evidenceIds/affectedAssetCount) are written onto the path row object; callers
 * should read them from the returned copies.
 */
export function absorbContributingSignalsIntoPathFindings<
  T extends FingerprintableFindingRow
>(rows: readonly T[]): T[] {
  const pathRows: T[] = [];
  const signalRows: T[] = [];

  for (const row of rows) {
    if (isPathPrimary(row)) {
      pathRows.push(row);
    } else {
      signalRows.push(row);
    }
  }

  if (pathRows.length === 0 || signalRows.length === 0) {
    return rows.map((row) => ({ ...row }));
  }

  // Map path identity → index in pathRows for mutation-friendly absorb.
  const pathById = new Map<string, number>();
  for (let index = 0; index < pathRows.length; index += 1) {
    const path = pathRows[index]!;
    if (path.findingId) {
      pathById.set(path.findingId, index);
    }
    for (const relatedPathId of path.relatedPathIds ?? []) {
      if (!pathById.has(relatedPathId)) {
        pathById.set(relatedPathId, index);
      }
    }
  }

  const absorbedSignalIds = new Set<string>();
  const nextPathRows: T[] = pathRows.map((path) => ({ ...path }));

  for (const signal of signalRows) {
    const linkedPathIds = signal.relatedPathIds ?? [];
    let absorbedInto: number | null = null;
    for (const pathId of linkedPathIds) {
      const index = pathById.get(pathId);
      if (index !== undefined) {
        absorbedInto = index;
        break;
      }
    }
    if (absorbedInto === null) {
      continue;
    }

    const path = nextPathRows[absorbedInto]!;
    const pathFirst = rowFirstSeen(path);
    const signalFirst = rowFirstSeen(signal);
    const pathLast = rowLastSeen(path);
    const signalLast = rowLastSeen(signal);

    const firstSeenAt =
      pathFirst && signalFirst
        ? pathFirst <= signalFirst
          ? pathFirst
          : signalFirst
        : pathFirst || signalFirst || undefined;
    const lastSeenAt =
      pathLast && signalLast
        ? pathLast >= signalLast
          ? pathLast
          : signalLast
        : pathLast || signalLast || undefined;

    const relatedAssetIds = unionSortedIds(
      path.relatedAssetIds,
      signal.relatedAssetIds
    );

    nextPathRows[absorbedInto] = {
      ...path,
      // Preserve path claim fields from path (...path first).
      evidenceIds: unionSortedIds(path.evidenceIds, signal.evidenceIds),
      firstSeenAt: firstSeenAt ?? path.firstSeenAt ?? null,
      lastSeenAt: lastSeenAt ?? path.lastSeenAt ?? null,
      occurrenceCount:
        (path.occurrenceCount && path.occurrenceCount > 0
          ? path.occurrenceCount
          : 1) +
        (signal.occurrenceCount && signal.occurrenceCount > 0
          ? signal.occurrenceCount
          : 1),
      relatedAssetIds,
      affectedAssetCount: relatedAssetIds.length
    };

    if (signal.findingId) {
      absorbedSignalIds.add(signal.findingId);
    } else {
      // Mark by object identity fallback: use index in original for filtering.
      absorbedSignalIds.add(`__idx:${signalRows.indexOf(signal)}`);
    }
  }

  const remainingSignals = signalRows
    .filter((signal, index) => {
      if (signal.findingId && absorbedSignalIds.has(signal.findingId)) {
        return false;
      }
      if (absorbedSignalIds.has(`__idx:${index}`)) {
        return false;
      }
      return true;
    })
    .map((signal) => ({ ...signal }));

  return [...nextPathRows, ...remainingSignals];
}
