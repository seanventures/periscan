import { describe, expect, it } from "vitest";

import {
  ATTACK_NAVIGATOR_DISCLAIMER,
  ATTACK_NAVIGATOR_LAYER_STATES,
  exportAttackNavigatorLayer
} from "@periscan/shared";

import {
  ATTACK_NAVIGATOR_WORKBENCH_COPY,
  countNavigatorStates,
  emptyNavigatorWorkbench,
  overlayNavigatorFromCoverage,
  parseNavigatorLayerInput,
  receiptsFromControlCoverageItems,
  serializeNavigatorExport,
  workbenchNavigatorFreshness
} from "./attack-navigator-workbench";

const EVIDENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const importedLayerJson = {
  domain: "enterprise-attack",
  name: "Imported SOC layer",
  techniques: [
    {
      color: "#2A9D8F",
      comment: "blocked in prod SIEM",
      links: [
        {
          label: "Evidence",
          url: `/api/v1/evidence/${EVIDENCE_ID}`
        }
      ],
      techniqueID: "T1059"
    },
    {
      metadata: [{ name: "state", value: "detected" }],
      tactic: "command-and-control",
      techniqueID: "T1071"
    },
    {
      metadata: [{ name: "state", value: "stale" }],
      techniqueID: "T1562"
    },
    {
      metadata: [{ name: "state", value: "tested" }],
      techniqueID: "T1595"
    }
  ],
  versions: { attack: "14", layer: "4.5", navigator: "4.9.1" }
};

describe("ATT&CK Navigator workbench helpers (PERISCAN-591)", () => {
  it("starts empty without inventing detections or executed coverage", () => {
    const view = emptyNavigatorWorkbench();
    expect(view.kind).toBe("empty");
    expect(view.executedCoverage).toBe(false);
  });

  it("imports Navigator JSON into tested/detected/blocked/stale with evidence links", () => {
    const view = parseNavigatorLayerInput(importedLayerJson);
    expect(view.kind).toBe("layer");
    if (view.kind !== "layer") {
      return;
    }
    expect(view.executedCoverage).toBe(false);
    expect(view.source).toBe("import");
    expect(view.layer.executedCoverage).toBe(false);
    expect(view.layer.executable).toBe(false);
    expect(view.layer.liveSupported).toBe(false);
    expect(view.layer.provenance).toBe("Imported");

    const byId = Object.fromEntries(
      view.layer.techniques.map((row) => [row.techniqueID, row])
    );
    expect(byId.T1059?.state).toBe("blocked");
    expect(byId.T1059?.evidenceLinks[0]?.url).toContain(EVIDENCE_ID);
    expect(byId.T1071?.state).toBe("detected");
    expect(byId.T1562?.state).toBe("stale");
    expect(byId.T1595?.state).toBe("tested");
    expect(countNavigatorStates(view.layer)).toEqual({
      blocked: 1,
      detected: 1,
      stale: 1,
      tested: 1
    });
    expect(ATTACK_NAVIGATOR_LAYER_STATES).toEqual([
      "tested",
      "detected",
      "blocked",
      "stale"
    ]);
  });

  it("does not treat imported scores, commands, or payloads as executed coverage", () => {
    const view = parseNavigatorLayerInput({
      name: "Boastful import",
      techniques: [
        {
          command: "detonate --all",
          comment: "executed and blocked in production",
          payload: "Invoke-Mimikatz",
          score: 100,
          techniqueID: "T1059"
        }
      ]
    });
    expect(view.kind).toBe("layer");
    if (view.kind !== "layer") {
      return;
    }
    expect(view.executedCoverage).toBe(false);
    expect(view.layer.executedCoverage).toBe(false);
    expect(JSON.stringify(view.layer)).not.toMatch(/detonate|Invoke-Mimikatz/);
    expect(view.layer.techniques[0]?.state).toBe("tested");
  });

  it("overlays control-validation coverage without claiming executed coverage", () => {
    const view = overlayNavigatorFromCoverage({
      items: [
        {
          evidenceIds: [EVIDENCE_ID],
          status: "Blocked",
          tacticName: "Execution",
          techniqueId: "T1059"
        },
        {
          evidenceIds: [EVIDENCE_ID],
          status: "Covered",
          tacticName: "Command and Control",
          techniqueId: "T1071"
        },
        {
          evidenceIds: [],
          status: "Stale",
          tacticName: "Defense Evasion",
          techniqueId: "T1562"
        },
        {
          evidenceIds: [EVIDENCE_ID],
          status: "LoggedOnly",
          tacticName: "Reconnaissance",
          techniqueId: "T1595"
        },
        {
          evidenceIds: [],
          status: "NotTested",
          tacticName: "Initial Access",
          techniqueId: "T1078"
        }
      ],
      name: "Tenant control-validation overlay"
    });

    expect(view.kind).toBe("layer");
    if (view.kind !== "layer") {
      return;
    }
    expect(view.source).toBe("control-validation");
    expect(view.executedCoverage).toBe(false);
    expect(view.layer.executedCoverage).toBe(false);
    expect(view.layer.liveSupported).toBe(false);
    expect(view.layer.techniques.map((row) => row.techniqueID).sort()).toEqual([
      "T1059",
      "T1071",
      "T1562",
      "T1595"
    ]);
    expect(
      view.layer.techniques.some((row) => row.techniqueID === "T1078")
    ).toBe(false);
  });

  it("does not invent detections when coverage is empty or only NotTested", () => {
    const empty = overlayNavigatorFromCoverage({ items: [] });
    expect(empty.kind).toBe("denied");
    expect(empty.executedCoverage).toBe(false);
    if (empty.kind !== "denied") {
      return;
    }
    expect(empty.code).toBe("attack_navigator_empty");
    expect(empty.rationale.toLowerCase()).toMatch(/not executed coverage/);

    const untested = overlayNavigatorFromCoverage({
      items: [
        {
          evidenceIds: [],
          status: "NotTested",
          tacticName: "Initial Access",
          techniqueId: "T1078"
        }
      ]
    });
    expect(untested.kind).toBe("denied");
    expect(untested.executedCoverage).toBe(false);
  });

  it("round-trips export JSON through import without flipping executedCoverage", () => {
    const imported = parseNavigatorLayerInput(importedLayerJson);
    expect(imported.kind).toBe("layer");
    if (imported.kind !== "layer") {
      return;
    }
    const serialized = serializeNavigatorExport(imported.layer);
    expect(serialized.payload.metadata).toEqual(
      expect.arrayContaining([
        { name: "executedCoverage", value: "false" },
        { name: "liveSupported", value: "false" }
      ])
    );
    expect(JSON.parse(serialized.json)).toEqual(
      exportAttackNavigatorLayer(imported.layer)
    );

    const roundTrip = parseNavigatorLayerInput(serialized.json);
    expect(roundTrip.kind).toBe("layer");
    if (roundTrip.kind !== "layer") {
      return;
    }
    expect(roundTrip.executedCoverage).toBe(false);
    expect(roundTrip.layer.executedCoverage).toBe(false);
    expect(roundTrip.layer.techniques[0]?.state).toBe("blocked");
    expect(roundTrip.layer.techniques[0]?.evidenceLinks.length).toBeGreaterThan(
      0
    );
  });

  it("rejects invalid or empty imports without echoing source payloads", () => {
    const invalid = parseNavigatorLayerInput("{not-json");
    expect(invalid.kind).toBe("denied");
    expect(invalid.executedCoverage).toBe(false);
    if (invalid.kind !== "denied") {
      return;
    }
    expect(invalid.code).toBe("attack_navigator_invalid");
    expect(invalid.rationale.toLowerCase()).not.toContain("{not-json");

    const empty = parseNavigatorLayerInput({
      name: "empty",
      techniques: []
    });
    expect(empty.kind).toBe("denied");
    expect(empty.executedCoverage).toBe(false);
  });

  it("keeps workbench copy on the Navigator honesty floor", () => {
    const blob = [
      ATTACK_NAVIGATOR_DISCLAIMER,
      ATTACK_NAVIGATOR_WORKBENCH_COPY.description,
      ATTACK_NAVIGATOR_WORKBENCH_COPY.emptyBody,
      ATTACK_NAVIGATOR_WORKBENCH_COPY.notExecutedCoverage
    ]
      .join("\n")
      .toLowerCase();

    expect(blob).toMatch(/not executed coverage/);
    expect(blob).toMatch(/not 100% att&ck/);
    expect(blob).toMatch(/tested/);
    expect(blob).toMatch(/detected/);
    expect(blob).toMatch(/blocked/);
    expect(blob).toMatch(/stale/);
    expect(blob).not.toMatch(/magic quadrant/);
    expect(blob).not.toMatch(/forrester wave/);
    expect(blob).not.toMatch(/\b95\b/);
    expect(blob).not.toMatch(/live atomic/i);
  });

  it("excludes imported techniques from the executed numerator", () => {
    const recent = new Date().toISOString();
    const snap = workbenchNavigatorFreshness({
      imported: [{ techniqueID: "T1059", state: "tested" }],
      receipts: [{ techniqueID: "T1082", at: recent, kind: "lab_receipt" }],
      supportedScenarioTechniqueIds: ["T1082", "T1124"],
      windowDays: 30
    });
    expect(snap.numerator).toBe(1);
    expect(snap.denominator).toBe(2);
    expect(snap.executedCoverage).toBe(false);
    expect(snap.importedCountedAsExecuted).toBe(false);
    expect(snap.summary).toBe("1 of 2 supported scenarios, window 30d");
    expect(snap.summary).not.toMatch(/%/);
    expect(ATTACK_NAVIGATOR_WORKBENCH_COPY.freshness).toMatch(
      /supported scenarios, window \d+d/
    );
  });

  it("maps control-validation lastObservedAt into receipts and skips NotTested", () => {
    const recent = new Date().toISOString();
    const receipts = receiptsFromControlCoverageItems([
      {
        lastObservedAt: recent,
        status: "Blocked",
        techniqueId: "T1082"
      },
      {
        lastObservedAt: recent,
        status: "NotTested",
        techniqueId: "T1078"
      },
      {
        lastObservedAt: null,
        status: "Covered",
        techniqueId: "T1124"
      }
    ]);
    expect(receipts).toEqual([
      {
        at: recent,
        kind: "control_validation",
        techniqueID: "T1082"
      }
    ]);

    const emptyOverlay = overlayNavigatorFromCoverage({
      items: [
        {
          evidenceIds: [],
          status: "NotTested",
          tacticName: "Initial Access",
          techniqueId: "T1078"
        }
      ]
    });
    expect(emptyOverlay.kind).toBe("denied");
    if (emptyOverlay.kind !== "denied") {
      return;
    }
    expect(emptyOverlay.code).toBe("attack_navigator_empty");
    expect(emptyOverlay.executedCoverage).toBe(false);
  });
});
