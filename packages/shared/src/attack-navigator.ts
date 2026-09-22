import { z } from "zod";

/**
 * ATT&CK Navigator import/export layers (PERISCAN-591).
 * Imported content is not executed coverage. liveSupported stays false.
 */

export const ATTACK_NAVIGATOR_LAYER_STATES = [
  "tested",
  "detected",
  "blocked",
  "stale"
] as const;
export const ATTACK_NAVIGATOR_MAX_TECHNIQUES = 400;
export const ATTACK_NAVIGATOR_MAX_BYTES = 256 * 1024;
export const ATTACK_NAVIGATOR_DEFAULT_WINDOW_DAYS = 30;
export const ATTACK_NAVIGATOR_TECHNIQUE_ID_PATTERN = /^T\d{4}(?:\.\d{3})?$/;
export const ATTACK_NAVIGATOR_DEFAULT_VERSIONS = {
  attack: "14",
  layer: "4.5",
  navigator: "4.9.1"
} as const;

export const ATTACK_NAVIGATOR_DISCLAIMER =
  "ATT&CK Navigator layers import and export tested, detected, blocked, and stale distinctions with evidence links. Imported content is not executed coverage. liveSupported is false. Curated overlay only — not the complete MITRE catalog.";

export const ATTACK_NAVIGATOR_STATE_COLORS = {
  blocked: "#2A9D8F",
  detected: "#F0A202",
  stale: "#8D99AE",
  tested: "#5B8DEF"
} as const;

export const AttackNavigatorLayerStateSchema = z.enum(
  ATTACK_NAVIGATOR_LAYER_STATES
);
export type AttackNavigatorLayerState = z.infer<
  typeof AttackNavigatorLayerStateSchema
>;

export const AttackNavigatorEvidenceLinkSchema = z.object({
  evidenceId: z.string().min(1).max(128).optional(),
  label: z.string().min(1).max(128),
  url: z.string().min(1).max(2048)
});
export type AttackNavigatorEvidenceLink = z.infer<
  typeof AttackNavigatorEvidenceLinkSchema
>;

export const AttackNavigatorTechniqueEntrySchema = z.object({
  comment: z.string().max(1024).optional(),
  enabled: z.boolean().default(true),
  evidenceLinks: z.array(AttackNavigatorEvidenceLinkSchema).max(20).default([]),
  state: AttackNavigatorLayerStateSchema,
  tactic: z.string().min(1).max(64).optional(),
  techniqueID: z.string().regex(/^T\d{4}(?:\.\d{3})?$/)
});
export type AttackNavigatorTechniqueEntry = z.infer<
  typeof AttackNavigatorTechniqueEntrySchema
>;

export const AttackNavigatorProvenanceSchema = z.enum([
  "Imported",
  "DerivedFromControlValidation"
]);
export type AttackNavigatorProvenance = z.infer<
  typeof AttackNavigatorProvenanceSchema
>;

export const AttackNavigatorCoverageLayerSchema = z.object({
  description: z.string().max(4096),
  domain: z.literal("enterprise-attack"),
  executedCoverage: z.literal(false),
  executable: z.literal(false),
  liveSupported: z.literal(false),
  name: z.string().min(1).max(256),
  provenance: AttackNavigatorProvenanceSchema,
  techniques: z
    .array(AttackNavigatorTechniqueEntrySchema)
    .min(1)
    .max(ATTACK_NAVIGATOR_MAX_TECHNIQUES),
  versions: z.object({
    attack: z.string().min(1).max(32),
    layer: z.string().min(1).max(32),
    navigator: z.string().min(1).max(32)
  })
});
export type AttackNavigatorCoverageLayer = z.infer<
  typeof AttackNavigatorCoverageLayerSchema
>;

export const AttackNavigatorImportDenialCodeSchema = z.enum([
  "attack_navigator_empty",
  "attack_navigator_invalid",
  "attack_navigator_too_large"
]);
export type AttackNavigatorImportDenialCode = z.infer<
  typeof AttackNavigatorImportDenialCodeSchema
>;

export const AttackNavigatorImportResultSchema = z.discriminatedUnion("ok", [
  z.object({
    executedCoverage: z.literal(false),
    layer: AttackNavigatorCoverageLayerSchema,
    ok: z.literal(true)
  }),
  z.object({
    code: AttackNavigatorImportDenialCodeSchema,
    executedCoverage: z.literal(false),
    ok: z.literal(false),
    rationale: z.string().min(1).max(280)
  })
]);
export type AttackNavigatorImportResult = z.infer<
  typeof AttackNavigatorImportResultSchema
>;

export const AttackNavigatorLegendItemSchema = z.object({
  color: z.string().min(1).max(32),
  label: z.string().min(1).max(64)
});
export type AttackNavigatorLegendItem = z.infer<
  typeof AttackNavigatorLegendItemSchema
>;

export const AttackNavigatorExportedTechniqueSchema = z.object({
  color: z.string().min(1),
  comment: z.string().max(1024).optional(),
  enabled: z.boolean(),
  links: z.array(
    z.object({
      label: z.string().min(1),
      url: z.string().min(1)
    })
  ),
  metadata: z.array(
    z.object({
      name: z.string().min(1),
      value: z.string().min(1)
    })
  ),
  tactic: z.string().min(1).optional(),
  techniqueID: z.string().regex(/^T\d{4}(?:\.\d{3})?$/)
});

export const AttackNavigatorExportedLayerSchema = z.object({
  description: z.string().min(1),
  domain: z.literal("enterprise-attack"),
  legendItems: z.array(AttackNavigatorLegendItemSchema).min(4),
  metadata: z.array(
    z.object({
      name: z.string().min(1),
      value: z.string().min(1)
    })
  ),
  name: z.string().min(1),
  techniques: z.array(AttackNavigatorExportedTechniqueSchema).min(1),
  versions: z.object({
    attack: z.string().min(1),
    layer: z.string().min(1),
    navigator: z.string().min(1)
  })
});
export type AttackNavigatorExportedLayer = z.infer<
  typeof AttackNavigatorExportedLayerSchema
>;

export const AttackNavigatorCoverageItemSchema = z.object({
  evidenceIds: z.array(z.string().min(1)).default([]),
  status: z.enum([
    "Covered",
    "Blocked",
    "LoggedOnly",
    "Missed",
    "NoEvidence",
    "NeedsTuning",
    "Stale",
    "NotTested"
  ]),
  tacticName: z.string().min(1).optional(),
  techniqueId: z.string().regex(ATTACK_NAVIGATOR_TECHNIQUE_ID_PATTERN)
});
export type AttackNavigatorCoverageItem = z.infer<
  typeof AttackNavigatorCoverageItemSchema
>;

export const AttackNavigatorTechniqueIdSchema = z
  .string()
  .regex(ATTACK_NAVIGATOR_TECHNIQUE_ID_PATTERN);
export type AttackNavigatorTechniqueId = z.infer<
  typeof AttackNavigatorTechniqueIdSchema
>;

export const AttackNavigatorFreshnessReceiptKindSchema = z.enum([
  "control_validation",
  "lab_receipt",
  "qualified_scenario"
]);
export type AttackNavigatorFreshnessReceiptKind = z.infer<
  typeof AttackNavigatorFreshnessReceiptKindSchema
>;

export const AttackNavigatorFreshnessReceiptSchema = z.object({
  at: z.string().min(1),
  kind: AttackNavigatorFreshnessReceiptKindSchema,
  techniqueID: AttackNavigatorTechniqueIdSchema
});
export type AttackNavigatorFreshnessReceipt = z.infer<
  typeof AttackNavigatorFreshnessReceiptSchema
>;

export const AttackNavigatorImportedTechniqueSchema = z.object({
  state: AttackNavigatorLayerStateSchema,
  techniqueID: AttackNavigatorTechniqueIdSchema
});
export type AttackNavigatorImportedTechnique = z.infer<
  typeof AttackNavigatorImportedTechniqueSchema
>;

export const AttackNavigatorFreshnessInputSchema = z.object({
  imported: z.array(AttackNavigatorImportedTechniqueSchema).default([]),
  now: z.string().min(1).optional(),
  receipts: z.array(AttackNavigatorFreshnessReceiptSchema).default([]),
  supportedScenarioTechniqueIds: z.array(AttackNavigatorTechniqueIdSchema),
  windowDays: z
    .number()
    .int()
    .positive()
    .max(3650)
    .default(ATTACK_NAVIGATOR_DEFAULT_WINDOW_DAYS)
});
export type AttackNavigatorFreshnessInput = z.input<
  typeof AttackNavigatorFreshnessInputSchema
>;

export const AttackNavigatorFreshnessSnapshotSchema = z.object({
  denominator: z.number().int().nonnegative(),
  empty: z.boolean(),
  executedCoverage: z.literal(false),
  freshTechniqueIds: z.array(AttackNavigatorTechniqueIdSchema),
  importedCountedAsExecuted: z.literal(false),
  importedTechniqueIds: z.array(AttackNavigatorTechniqueIdSchema),
  numerator: z.number().int().nonnegative(),
  staleTechniqueIds: z.array(AttackNavigatorTechniqueIdSchema),
  summary: z.string().min(1),
  windowDays: z.number().int().positive()
});
export type AttackNavigatorFreshnessSnapshot = z.infer<
  typeof AttackNavigatorFreshnessSnapshotSchema
>;

export function formatNavigatorFreshnessSummary(input: {
  denominator: number;
  numerator: number;
  windowDays: number;
}): string {
  return `${input.numerator} of ${input.denominator} supported scenarios, window ${input.windowDays}d`;
}

function uniqueTechniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

/**
 * Freshness uses supported (startable or lab-qualified) scenario technique ids
 * as the denominator. Imported-only techniques stay tested and never enter the
 * numerator. executedCoverage stays false.
 */
export function deriveNavigatorFreshness(
  input: AttackNavigatorFreshnessInput
): AttackNavigatorFreshnessSnapshot {
  const parsed = AttackNavigatorFreshnessInputSchema.parse(input);
  const supported = uniqueTechniqueIds(parsed.supportedScenarioTechniqueIds);
  const supportedSet = new Set(supported);
  const nowMs = parsed.now ? Date.parse(parsed.now) : Date.now();
  const clock = Number.isFinite(nowMs) ? nowMs : Date.now();
  const windowMs = parsed.windowDays * 24 * 60 * 60 * 1000;
  const latestByTechnique = new Map<string, number>();

  for (const receipt of parsed.receipts) {
    if (!supportedSet.has(receipt.techniqueID)) {
      continue;
    }
    const at = Date.parse(receipt.at);
    if (!Number.isFinite(at)) {
      continue;
    }
    const previous = latestByTechnique.get(receipt.techniqueID);
    if (previous === undefined || at > previous) {
      latestByTechnique.set(receipt.techniqueID, at);
    }
  }

  const freshTechniqueIds: string[] = [];
  const staleTechniqueIds: string[] = [];
  for (const techniqueID of supported) {
    const latest = latestByTechnique.get(techniqueID);
    if (latest === undefined) {
      continue;
    }
    if (clock - latest <= windowMs) {
      freshTechniqueIds.push(techniqueID);
    } else {
      staleTechniqueIds.push(techniqueID);
    }
  }

  freshTechniqueIds.sort();
  staleTechniqueIds.sort();

  return AttackNavigatorFreshnessSnapshotSchema.parse({
    denominator: supported.length,
    empty: supported.length === 0,
    executedCoverage: false,
    freshTechniqueIds,
    importedCountedAsExecuted: false,
    importedTechniqueIds: uniqueTechniqueIds(
      parsed.imported.map((row) => row.techniqueID)
    ).sort(),
    numerator: freshTechniqueIds.length,
    staleTechniqueIds,
    summary: formatNavigatorFreshnessSummary({
      denominator: supported.length,
      numerator: freshTechniqueIds.length,
      windowDays: parsed.windowDays
    }),
    windowDays: parsed.windowDays
  });
}

const STATE_LABELS: Record<AttackNavigatorLayerState, string> = {
  blocked: "Blocked",
  detected: "Detected",
  stale: "Stale",
  tested: "Tested"
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeHex(color: string): string {
  const match = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color.trim());
  if (!match?.[1]) {
    return color.trim().toUpperCase();
  }
  return `#${match[1].toUpperCase()}`;
}

function stateFromLabel(label: string): AttackNavigatorLayerState | null {
  const normalized = label.trim().toLowerCase();
  if (
    normalized === "tested" ||
    normalized === "detected" ||
    normalized === "blocked" ||
    normalized === "stale"
  ) {
    return normalized;
  }
  return null;
}

function defaultColorStateMap(): Map<string, AttackNavigatorLayerState> {
  return new Map(
    (
      Object.entries(ATTACK_NAVIGATOR_STATE_COLORS) as Array<
        [AttackNavigatorLayerState, string]
      >
    ).map(([state, color]) => [normalizeHex(color), state])
  );
}

function legendColorStateMap(
  legendItems: unknown
): Map<string, AttackNavigatorLayerState> {
  const map = defaultColorStateMap();
  if (!Array.isArray(legendItems)) {
    return map;
  }
  for (const item of legendItems) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const label = readString(record.label);
    const color = readString(record.color);
    if (!label || !color) {
      continue;
    }
    const state = stateFromLabel(label);
    if (state) {
      map.set(normalizeHex(color), state);
    }
  }
  return map;
}

function metadataState(metadata: unknown): AttackNavigatorLayerState | null {
  if (!Array.isArray(metadata)) {
    return null;
  }
  for (const item of metadata) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const name = readString(record.name)?.toLowerCase();
    if (name !== "state" && name !== "periscan.state") {
      continue;
    }
    const value = readString(record.value);
    if (!value) {
      continue;
    }
    const state = stateFromLabel(value);
    if (state) {
      return state;
    }
  }
  return null;
}

function evidenceLinksFromTechnique(
  record: Record<string, unknown>
): AttackNavigatorEvidenceLink[] {
  const links: AttackNavigatorEvidenceLink[] = [];
  if (Array.isArray(record.links)) {
    for (const item of record.links) {
      const link = asRecord(item);
      const label = link ? readString(link.label) : undefined;
      const url = link ? readString(link.url) : undefined;
      if (!label || !url) {
        continue;
      }
      const evidenceIdMatch =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(
          url
        );
      links.push({
        evidenceId: evidenceIdMatch?.[0],
        label,
        url
      });
    }
  }
  return links.slice(0, 20);
}

function tacticSlug(tacticName: string | undefined): string | undefined {
  if (!tacticName) {
    return undefined;
  }
  const slug = tacticName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : undefined;
}

function coverageStatusToState(
  status: AttackNavigatorCoverageItem["status"]
): AttackNavigatorLayerState | null {
  if (status === "NotTested") {
    return null;
  }
  if (status === "Blocked") {
    return "blocked";
  }
  if (status === "Covered") {
    return "detected";
  }
  if (status === "Stale") {
    return "stale";
  }
  return "tested";
}

function importFail(
  code: AttackNavigatorImportDenialCode,
  rationale: string
): AttackNavigatorImportResult {
  return AttackNavigatorImportResultSchema.parse({
    code,
    executedCoverage: false,
    ok: false,
    rationale
  });
}

export function importAttackNavigatorLayer(
  input: unknown
): AttackNavigatorImportResult {
  let raw: unknown = input;
  if (typeof input === "string") {
    if (input.length > ATTACK_NAVIGATOR_MAX_BYTES) {
      return importFail(
        "attack_navigator_too_large",
        "Navigator layer exceeds the bounded import size."
      );
    }
    try {
      raw = JSON.parse(input) as unknown;
    } catch {
      return importFail(
        "attack_navigator_invalid",
        "Navigator layer JSON could not be parsed."
      );
    }
  }

  const record = asRecord(raw);
  if (!record) {
    return importFail(
      "attack_navigator_invalid",
      "Navigator layer must be a JSON object."
    );
  }

  if (!Array.isArray(record.techniques)) {
    return importFail(
      "attack_navigator_invalid",
      "Navigator layer techniques must be an array."
    );
  }

  if (record.techniques.length > ATTACK_NAVIGATOR_MAX_TECHNIQUES) {
    return importFail(
      "attack_navigator_too_large",
      "Navigator layer exceeds the bounded technique count."
    );
  }

  const colorState = legendColorStateMap(record.legendItems);
  const versionsRecord = asRecord(record.versions);
  const techniques: AttackNavigatorTechniqueEntry[] = [];

  for (const item of record.techniques) {
    const technique = asRecord(item);
    if (!technique) {
      continue;
    }
    const techniqueID = readString(technique.techniqueID);
    if (!techniqueID || !/^T\d{4}(?:\.\d{3})?$/.test(techniqueID)) {
      continue;
    }
    const fromMetadata = metadataState(technique.metadata);
    const color = readString(technique.color);
    const fromColor = color ? colorState.get(normalizeHex(color)) : undefined;
    const state = fromMetadata ?? fromColor ?? "tested";
    const tactic =
      readString(technique.tactic) ??
      tacticSlug(readString(technique.tacticName));
    techniques.push(
      AttackNavigatorTechniqueEntrySchema.parse({
        comment: readString(technique.comment),
        enabled: technique.enabled === false ? false : true,
        evidenceLinks: evidenceLinksFromTechnique(technique),
        state,
        tactic,
        techniqueID
      })
    );
  }

  if (techniques.length === 0) {
    return importFail(
      "attack_navigator_empty",
      "Navigator layer contained no importable techniques."
    );
  }

  const name = readString(record.name);
  if (!name) {
    return importFail(
      "attack_navigator_invalid",
      "Navigator layer is missing a name."
    );
  }

  return AttackNavigatorImportResultSchema.parse({
    executedCoverage: false,
    layer: {
      description:
        readString(record.description) ?? ATTACK_NAVIGATOR_DISCLAIMER,
      domain: "enterprise-attack",
      executedCoverage: false,
      executable: false,
      liveSupported: false,
      name,
      provenance: "Imported",
      techniques,
      versions: {
        attack:
          readString(versionsRecord?.attack) ??
          ATTACK_NAVIGATOR_DEFAULT_VERSIONS.attack,
        layer:
          readString(versionsRecord?.layer) ??
          ATTACK_NAVIGATOR_DEFAULT_VERSIONS.layer,
        navigator:
          readString(versionsRecord?.navigator) ??
          ATTACK_NAVIGATOR_DEFAULT_VERSIONS.navigator
      }
    },
    ok: true
  });
}

export function exportAttackNavigatorLayerFromCoverage(input: {
  items: AttackNavigatorCoverageItem[];
  name: string;
}): AttackNavigatorCoverageLayer {
  const techniques = input.items.flatMap((item) => {
    const parsed = AttackNavigatorCoverageItemSchema.parse(item);
    const state = coverageStatusToState(parsed.status);
    if (!state) {
      return [];
    }
    return [
      AttackNavigatorTechniqueEntrySchema.parse({
        comment: state,
        enabled: true,
        evidenceLinks: parsed.evidenceIds.map((evidenceId) => ({
          evidenceId,
          label: "Evidence",
          url: `/api/v1/evidence/${evidenceId}`
        })),
        state,
        tactic: tacticSlug(parsed.tacticName),
        techniqueID: parsed.techniqueId
      })
    ];
  });

  return AttackNavigatorCoverageLayerSchema.parse({
    description: ATTACK_NAVIGATOR_DISCLAIMER,
    domain: "enterprise-attack",
    executedCoverage: false,
    executable: false,
    liveSupported: false,
    name: input.name,
    provenance: "DerivedFromControlValidation",
    techniques,
    versions: ATTACK_NAVIGATOR_DEFAULT_VERSIONS
  });
}

export function exportAttackNavigatorLayer(
  layer: AttackNavigatorCoverageLayer
): AttackNavigatorExportedLayer {
  const parsed = AttackNavigatorCoverageLayerSchema.parse(layer);
  return AttackNavigatorExportedLayerSchema.parse({
    description: parsed.description,
    domain: "enterprise-attack",
    legendItems: ATTACK_NAVIGATOR_LAYER_STATES.map((state) => ({
      color: ATTACK_NAVIGATOR_STATE_COLORS[state],
      label: STATE_LABELS[state]
    })),
    metadata: [
      { name: "executedCoverage", value: "false" },
      { name: "liveSupported", value: "false" },
      { name: "provenance", value: parsed.provenance }
    ],
    name: parsed.name,
    techniques: parsed.techniques.map((technique) => ({
      color: ATTACK_NAVIGATOR_STATE_COLORS[technique.state],
      comment: technique.comment ?? technique.state,
      enabled: technique.enabled,
      links: technique.evidenceLinks.map((link) => ({
        label: link.label,
        url: link.url
      })),
      metadata: [
        { name: "state", value: technique.state },
        { name: "executedCoverage", value: "false" }
      ],
      tactic: technique.tactic,
      techniqueID: technique.techniqueID
    })),
    versions: parsed.versions
  });
}
