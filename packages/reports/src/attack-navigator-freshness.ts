/**
 * ATT&CK Navigator freshness export (PERISCAN-591).
 * Numerator = fresh qualified-scenario or control-validation receipts.
 * Denominator = supported scenario technique ids, not the MITRE catalog.
 * Imported-only techniques stay tested and are excluded from the numerator.
 * executedCoverage stays false. Not a coverage percent.
 */

import {
  ATTACK_NAVIGATOR_DISCLAIMER,
  deriveNavigatorFreshness,
  type AttackNavigatorFreshnessInput,
  type AttackNavigatorFreshnessSnapshot
} from "@periscan/shared";

export type AttackNavigatorFreshnessExportMetadata = {
  name: string;
  value: string;
};

export type AttackNavigatorFreshnessExport = {
  description: string;
  domain: "enterprise-attack";
  executedCoverage: false;
  executable: false;
  freshness: AttackNavigatorFreshnessSnapshot;
  importedCountedAsExecuted: false;
  liveSupported: false;
  metadata: AttackNavigatorFreshnessExportMetadata[];
  name: string;
};

export type AttackNavigatorFreshnessExportInput =
  AttackNavigatorFreshnessInput & {
    name?: string;
  };

export function exportAttackNavigatorFreshness(
  input: AttackNavigatorFreshnessExportInput
): AttackNavigatorFreshnessExport {
  const { name, ...freshnessInput } = input;
  const freshness = deriveNavigatorFreshness(freshnessInput);

  return {
    description: `${ATTACK_NAVIGATOR_DISCLAIMER} Freshness is ${freshness.summary}. Imported techniques are not executed coverage and are excluded from the numerator.`,
    domain: "enterprise-attack",
    executedCoverage: false,
    executable: false,
    freshness,
    importedCountedAsExecuted: false,
    liveSupported: false,
    metadata: [
      { name: "executedCoverage", value: "false" },
      { name: "liveSupported", value: "false" },
      { name: "importedCountedAsExecuted", value: "false" },
      { name: "freshness.numerator", value: String(freshness.numerator) },
      { name: "freshness.denominator", value: String(freshness.denominator) },
      { name: "freshness.windowDays", value: String(freshness.windowDays) },
      { name: "freshness.summary", value: freshness.summary }
    ],
    name: name ?? "Periscan ATT&CK Navigator freshness"
  };
}
