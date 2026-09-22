import {
  ATTACK_NAVIGATOR_DISCLAIMER,
  ATTACK_NAVIGATOR_LAYER_STATES,
  ATTACK_NAVIGATOR_STATE_COLORS,
  AttackNavigatorFreshnessReceiptSchema,
  deriveNavigatorFreshness,
  exportAttackNavigatorLayer,
  exportAttackNavigatorLayerFromCoverage,
  importAttackNavigatorLayer,
  type AttackNavigatorCoverageItem,
  type AttackNavigatorCoverageLayer,
  type AttackNavigatorExportedLayer,
  type AttackNavigatorFreshnessInput,
  type AttackNavigatorFreshnessReceipt,
  type AttackNavigatorFreshnessSnapshot,
  type AttackNavigatorImportDenialCode,
  type AttackNavigatorLayerState
} from "@periscan/shared";

export const ATTACK_NAVIGATOR_WORKBENCH_HREF = "/attack-navigator";

export const ATTACK_NAVIGATOR_WORKBENCH_COPY = {
  description:
    "Import or export a Navigator layer with tested, detected, blocked, and stale distinctions and evidence links. Imported content is not executed coverage. This is not the complete MITRE catalog and not 100% ATT&CK. liveSupported is false. Scenario execution requires qualification. Freshness is N of D supported scenarios, window 30d.",
  emptyBody:
    "Paste or upload a Navigator layer JSON, or overlay this tenant's control-validation coverage. Empty is honest — it is not 100% ATT&CK and not executed coverage.",
  emptyTitle: "No Navigator overlay loaded",
  exportAction: "Export Navigator layer",
  eyebrow: "Controls overlay",
  freshness: "N of D supported scenarios, window 30d",
  importAction: "Import layer",
  notCompleteCatalog: "not the complete MITRE catalog",
  notExecutedCoverage: "Imported content is not executed coverage",
  notHundredPercent: "not 100% ATT&CK",
  overlayAction: "Overlay from control-validation coverage",
  overlayEmpty:
    "Control-validation coverage has no overlayable techniques. NotTested rows are omitted. This is not executed coverage.",
  title: "ATT&CK Navigator overlay"
} as const;

export type AttackNavigatorWorkbenchSource = "import" | "control-validation";

export type AttackNavigatorWorkbenchView =
  | { executedCoverage: false; kind: "empty" }
  | {
      code: AttackNavigatorImportDenialCode;
      executedCoverage: false;
      kind: "denied";
      rationale: string;
    }
  | {
      executedCoverage: false;
      kind: "layer";
      layer: AttackNavigatorCoverageLayer;
      source: AttackNavigatorWorkbenchSource;
    };

export function emptyNavigatorWorkbench(): AttackNavigatorWorkbenchView {
  return { executedCoverage: false, kind: "empty" };
}

export function parseNavigatorLayerInput(
  input: unknown
): AttackNavigatorWorkbenchView {
  const result = importAttackNavigatorLayer(input);
  if (!result.ok) {
    return {
      code: result.code,
      executedCoverage: false,
      kind: "denied",
      rationale: result.rationale
    };
  }
  return {
    executedCoverage: false,
    kind: "layer",
    layer: result.layer,
    source: "import"
  };
}

export function overlayNavigatorFromCoverage(input: {
  items: AttackNavigatorCoverageItem[];
  name?: string;
}): AttackNavigatorWorkbenchView {
  const overlayable = input.items.filter((item) => item.status !== "NotTested");
  if (overlayable.length === 0) {
    return {
      code: "attack_navigator_empty",
      executedCoverage: false,
      kind: "denied",
      rationale: ATTACK_NAVIGATOR_WORKBENCH_COPY.overlayEmpty
    };
  }

  try {
    const layer = exportAttackNavigatorLayerFromCoverage({
      items: overlayable,
      name: input.name ?? "Tenant control-validation overlay"
    });
    return {
      executedCoverage: false,
      kind: "layer",
      layer,
      source: "control-validation"
    };
  } catch {
    return {
      code: "attack_navigator_invalid",
      executedCoverage: false,
      kind: "denied",
      rationale:
        "Control-validation coverage could not be mapped to a Navigator overlay."
    };
  }
}

export function serializeNavigatorExport(layer: AttackNavigatorCoverageLayer): {
  filename: string;
  json: string;
  payload: AttackNavigatorExportedLayer;
} {
  const payload = exportAttackNavigatorLayer(layer);
  const slug = layer.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    filename: `${slug || "periscan-navigator-layer"}.json`,
    json: `${JSON.stringify(payload, null, 2)}\n`,
    payload
  };
}

export function countNavigatorStates(
  layer: AttackNavigatorCoverageLayer
): Record<AttackNavigatorLayerState, number> {
  const counts: Record<AttackNavigatorLayerState, number> = {
    blocked: 0,
    detected: 0,
    stale: 0,
    tested: 0
  };
  for (const technique of layer.techniques) {
    counts[technique.state] += 1;
  }
  return counts;
}

export function workbenchNavigatorFreshness(
  input: AttackNavigatorFreshnessInput
): AttackNavigatorFreshnessSnapshot {
  return deriveNavigatorFreshness(input);
}

export function receiptsFromControlCoverageItems(
  items: ReadonlyArray<{
    lastObservedAt?: string | null;
    status: string;
    techniqueId: string;
  }>
): AttackNavigatorFreshnessReceipt[] {
  const receipts: AttackNavigatorFreshnessReceipt[] = [];
  for (const item of items) {
    if (item.status === "NotTested" || !item.lastObservedAt) {
      continue;
    }
    const parsed = AttackNavigatorFreshnessReceiptSchema.safeParse({
      at: item.lastObservedAt,
      kind: "control_validation",
      techniqueID: item.techniqueId
    });
    if (parsed.success) {
      receipts.push(parsed.data);
    }
  }
  return receipts;
}

export {
  ATTACK_NAVIGATOR_DISCLAIMER,
  ATTACK_NAVIGATOR_LAYER_STATES,
  ATTACK_NAVIGATOR_STATE_COLORS
};
