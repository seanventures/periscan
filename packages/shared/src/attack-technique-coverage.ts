import { z } from "zod";

import {
  AttackTechniqueSchema,
  getAttackTechniqueById,
  listAttackTechniques
} from "./mitre-attack";
import { getSafeStagePlaybook } from "./safe-stage-playbooks";
import { listControlValidationScenarios } from "./validation-catalog";

/**
 * Toolchain module ids for Atomic and Caldera. Live execution stays disabled;
 * mapped techniques are "not executed (live disabled)", without measured execution coverage.
 */
export const LIVE_DISABLED_TOOLCHAIN_MODULE_IDS = [
  "atomic.control_validation_safe",
  "caldera.advanced_adversarial"
] as const;

export type LiveDisabledToolchainModuleId =
  (typeof LIVE_DISABLED_TOOLCHAIN_MODULE_IDS)[number];

export const LIVE_DISABLED_EXECUTION_NOTE = "not executed (live disabled)";

export const ATTACK_TECHNIQUE_COVERAGE_LABELS = {
  SafeModule: "Safe module",
  CatalogOnly: "Catalog only",
  LiveDisabled: "Live disabled"
} as const;

export const AttackTechniqueCoverageKindSchema = z.enum([
  "SafeModule",
  "CatalogOnly",
  "LiveDisabled"
]);

export type AttackTechniqueCoverageKind = z.infer<
  typeof AttackTechniqueCoverageKindSchema
>;

export const AttackTechniqueCoverageLabelSchema = z.enum([
  "Safe module",
  "Catalog only",
  "Live disabled"
]);

export type AttackTechniqueCoverageLabel = z.infer<
  typeof AttackTechniqueCoverageLabelSchema
>;

export const AttackTechniqueLiveDisabledBindingSchema = z.object({
  moduleId: z.string().min(1),
  techniqueId: z.string().min(1)
});

export type AttackTechniqueLiveDisabledBinding = z.infer<
  typeof AttackTechniqueLiveDisabledBindingSchema
>;

/**
 * Allowlisted Atomic/Caldera fixture technique bindings. Modules tests assert
 * these stay aligned with toolchain fixtures. Not a MITRE-complete library.
 */
export const ATOMIC_CALDERA_FIXTURE_LIVE_DISABLED_BINDINGS: readonly AttackTechniqueLiveDisabledBinding[] =
  [
    {
      techniqueId: "T1595",
      moduleId: "atomic.control_validation_safe"
    },
    {
      techniqueId: "T1087",
      moduleId: "atomic.control_validation_safe"
    },
    {
      techniqueId: "T1087",
      moduleId: "caldera.advanced_adversarial"
    }
  ];

export const ATTACK_TECHNIQUE_COVERAGE_DISCLAIMER =
  "Curated safe-module map only — partial ATT&CK mapping; execution coverage requires measured receipts. Atomic and Caldera stay not executed (live disabled).";

export const AttackTechniqueCoverageEntrySchema = z.object({
  coverage: AttackTechniqueCoverageKindSchema,
  coverageLabel: AttackTechniqueCoverageLabelSchema,
  executionNote: z.string().min(1).nullable(),
  liveDisabledModuleIds: z.array(z.string().min(1)),
  safeModuleId: z.string().min(1).nullable(),
  techniqueId: z.string().min(1),
  techniqueName: z.string().min(1)
});

export type AttackTechniqueCoverageEntry = z.infer<
  typeof AttackTechniqueCoverageEntrySchema
>;

export const AttackTechniqueWithCoverageSchema = AttackTechniqueSchema.extend({
  coverage: AttackTechniqueCoverageKindSchema,
  coverageLabel: AttackTechniqueCoverageLabelSchema,
  executionNote: z.string().min(1).nullable(),
  liveDisabledModuleIds: z.array(z.string().min(1)),
  safeModuleId: z.string().min(1).nullable()
});

export type AttackTechniqueWithCoverage = z.infer<
  typeof AttackTechniqueWithCoverageSchema
>;

export function isLiveDisabledToolchainModuleId(
  moduleId: string
): moduleId is LiveDisabledToolchainModuleId {
  return (LIVE_DISABLED_TOOLCHAIN_MODULE_IDS as readonly string[]).includes(
    moduleId
  );
}

function addLiveDisabledBinding(
  map: Map<string, string[]>,
  techniqueId: string,
  moduleId: string
) {
  if (!isLiveDisabledToolchainModuleId(moduleId)) {
    return;
  }

  const current = map.get(techniqueId) ?? [];
  if (!current.includes(moduleId)) {
    current.push(moduleId);
    map.set(techniqueId, current);
  }
}

function collectLiveDisabledBindings(
  extra: readonly AttackTechniqueLiveDisabledBinding[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const scenario of listControlValidationScenarios()) {
    addLiveDisabledBinding(map, scenario.techniqueId, scenario.moduleId);
  }

  for (const binding of ATOMIC_CALDERA_FIXTURE_LIVE_DISABLED_BINDINGS) {
    addLiveDisabledBinding(map, binding.techniqueId, binding.moduleId);
  }

  for (const binding of extra) {
    addLiveDisabledBinding(map, binding.techniqueId, binding.moduleId);
  }

  return map;
}

function resolveSafeModuleId(techniqueId: string): string | null {
  const playbook = getSafeStagePlaybook(techniqueId);
  if (
    !playbook ||
    playbook.measurementClass === "Forbidden" ||
    playbook.measurementClass === "Danger" ||
    playbook.defaultModuleId == null
  ) {
    return null;
  }

  if (isLiveDisabledToolchainModuleId(playbook.defaultModuleId)) {
    return null;
  }

  return playbook.defaultModuleId;
}

function coverageEntryForTechnique(input: {
  liveDisabledModuleIds: string[];
  techniqueId: string;
}): AttackTechniqueCoverageEntry {
  const catalog = getAttackTechniqueById(input.techniqueId);
  const playbook = getSafeStagePlaybook(input.techniqueId);
  const safeModuleId = resolveSafeModuleId(input.techniqueId);
  const techniqueName =
    catalog?.techniqueName ?? playbook?.stage ?? input.techniqueId;

  if (safeModuleId) {
    return AttackTechniqueCoverageEntrySchema.parse({
      coverage: "SafeModule",
      coverageLabel: ATTACK_TECHNIQUE_COVERAGE_LABELS.SafeModule,
      executionNote: null,
      liveDisabledModuleIds: input.liveDisabledModuleIds,
      safeModuleId,
      techniqueId: input.techniqueId,
      techniqueName
    });
  }

  if (input.liveDisabledModuleIds.length > 0) {
    return AttackTechniqueCoverageEntrySchema.parse({
      coverage: "LiveDisabled",
      coverageLabel: ATTACK_TECHNIQUE_COVERAGE_LABELS.LiveDisabled,
      executionNote: LIVE_DISABLED_EXECUTION_NOTE,
      liveDisabledModuleIds: input.liveDisabledModuleIds,
      safeModuleId: null,
      techniqueId: input.techniqueId,
      techniqueName
    });
  }

  return AttackTechniqueCoverageEntrySchema.parse({
    coverage: "CatalogOnly",
    coverageLabel: ATTACK_TECHNIQUE_COVERAGE_LABELS.CatalogOnly,
    executionNote: null,
    liveDisabledModuleIds: [],
    safeModuleId: null,
    techniqueId: input.techniqueId,
    techniqueName
  });
}

export function listAttackTechniqueCoverage(
  extraLiveDisabledBindings: readonly AttackTechniqueLiveDisabledBinding[] = []
): AttackTechniqueCoverageEntry[] {
  const liveDisabled = collectLiveDisabledBindings(extraLiveDisabledBindings);
  const techniqueIds = new Set<string>([
    ...listAttackTechniques().map((technique) => technique.techniqueId),
    ...liveDisabled.keys()
  ]);

  return [...techniqueIds]
    .sort((left, right) => left.localeCompare(right))
    .map((techniqueId) =>
      coverageEntryForTechnique({
        liveDisabledModuleIds: liveDisabled.get(techniqueId) ?? [],
        techniqueId
      })
    );
}

export function getAttackTechniqueCoverage(
  techniqueId: string,
  extraLiveDisabledBindings: readonly AttackTechniqueLiveDisabledBinding[] = []
): AttackTechniqueCoverageEntry | null {
  return (
    listAttackTechniqueCoverage(extraLiveDisabledBindings).find(
      (row) => row.techniqueId === techniqueId
    ) ?? null
  );
}

export function attachAttackTechniqueCoverage<
  T extends { techniqueId: string }
>(
  technique: T,
  extraLiveDisabledBindings: readonly AttackTechniqueLiveDisabledBinding[] = []
): T &
  Pick<
    AttackTechniqueCoverageEntry,
    | "coverage"
    | "coverageLabel"
    | "executionNote"
    | "liveDisabledModuleIds"
    | "safeModuleId"
  > {
  const coverage = getAttackTechniqueCoverage(
    technique.techniqueId,
    extraLiveDisabledBindings
  );

  return {
    ...technique,
    coverage: coverage?.coverage ?? "CatalogOnly",
    coverageLabel: coverage?.coverageLabel ?? "Catalog only",
    executionNote: coverage?.executionNote ?? null,
    liveDisabledModuleIds: coverage?.liveDisabledModuleIds ?? [],
    safeModuleId: coverage?.safeModuleId ?? null
  };
}
