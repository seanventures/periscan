import { describe, expect, it } from "vitest";

import {
  CONTROL_EFFECTIVENESS_STRENGTH,
  CONTROL_LANGUAGE_LAW,
  ControlEffectivenessObservationSchema,
  ControlEffectivenessStateSchema,
  deriveControlEffectivenessState,
  ensureCoverageItemEffectivenessState,
  mapControlStateToEffectiveness,
  mapControlValidationVerdictToEffectiveness,
  mapDetectionRuleCoverageStatusToEffectiveness,
  mapEdgeRelationshipToControlEffectiveness
} from "./control-effectiveness";

describe("ControlEffectivenessStateSchema", () => {
  it("exposes the Slice 5 denominator states", () => {
    expect(ControlEffectivenessStateSchema.options).toEqual([
      "NotTested",
      "NoEvidence",
      "Inconclusive",
      "TelemetryOnly",
      "Detected",
      "Prevented",
      "Missed"
    ]);
  });

  it("orders claim strength so prevention outranks detection and telemetry", () => {
    expect(CONTROL_EFFECTIVENESS_STRENGTH.Prevented).toBeGreaterThan(
      CONTROL_EFFECTIVENESS_STRENGTH.Detected
    );
    expect(CONTROL_EFFECTIVENESS_STRENGTH.Detected).toBeGreaterThan(
      CONTROL_EFFECTIVENESS_STRENGTH.TelemetryOnly
    );
    expect(CONTROL_EFFECTIVENESS_STRENGTH.TelemetryOnly).toBeGreaterThan(
      CONTROL_EFFECTIVENESS_STRENGTH.Missed
    );
    expect(CONTROL_EFFECTIVENESS_STRENGTH.NotTested).toBe(0);
  });
});

describe("mapDetectionRuleCoverageStatusToEffectiveness", () => {
  it("maps every legacy coverage status into the canonical model", () => {
    expect(mapDetectionRuleCoverageStatusToEffectiveness("Blocked")).toBe(
      "Prevented"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("Covered")).toBe(
      "Detected"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("LoggedOnly")).toBe(
      "TelemetryOnly"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("Missed")).toBe(
      "Missed"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("NoEvidence")).toBe(
      "NoEvidence"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("NeedsTuning")).toBe(
      "Inconclusive"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("Stale")).toBe(
      "Inconclusive"
    );
    expect(mapDetectionRuleCoverageStatusToEffectiveness("NotTested")).toBe(
      "NotTested"
    );
  });
});

describe("mapControlValidationVerdictToEffectiveness", () => {
  const withEvidence = {
    correlationMatched: true,
    emissionReceiptPresent: true,
    evidenceIds: ["ev-1"],
    observationCompleted: true
  };

  it("maps supported verdicts when evidence is present", () => {
    expect(
      mapControlValidationVerdictToEffectiveness("Prevented", withEvidence)
    ).toBe("Prevented");
    expect(
      mapControlValidationVerdictToEffectiveness("Detected", withEvidence)
    ).toBe("Detected");
    expect(
      mapControlValidationVerdictToEffectiveness("TelemetryOnly", withEvidence)
    ).toBe("TelemetryOnly");
    expect(
      mapControlValidationVerdictToEffectiveness("Missed", withEvidence)
    ).toBe("Missed");
  });

  it("never invents Prevented without evidence", () => {
    expect(
      mapControlValidationVerdictToEffectiveness("Prevented", {
        correlationMatched: false,
        emissionReceiptPresent: false,
        evidenceIds: [],
        observationCompleted: true
      })
    ).toBe("Inconclusive");
  });

  it("never invents Missed without emission proof and evidence", () => {
    expect(
      mapControlValidationVerdictToEffectiveness("Missed", {
        correlationMatched: false,
        emissionReceiptPresent: false,
        evidenceIds: ["ev-1"],
        observationCompleted: true
      })
    ).toBe("NoEvidence");

    expect(
      mapControlValidationVerdictToEffectiveness("Missed", {
        correlationMatched: false,
        emissionReceiptPresent: true,
        evidenceIds: [],
        observationCompleted: true
      })
    ).toBe("NoEvidence");

    expect(
      mapControlValidationVerdictToEffectiveness("Missed", {
        correlationMatched: true,
        emissionReceiptPresent: false,
        evidenceIds: ["ev-1"],
        observationCompleted: false
      })
    ).toBe("Inconclusive");
  });

  it("maps incomplete and timeout verdicts to Inconclusive", () => {
    expect(
      mapControlValidationVerdictToEffectiveness("Inconclusive", withEvidence)
    ).toBe("Inconclusive");
    expect(
      mapControlValidationVerdictToEffectiveness(
        "NotObservedBeforeTimeout",
        withEvidence
      )
    ).toBe("Inconclusive");
  });
});

describe("deriveControlEffectivenessState", () => {
  it("returns NotTested when nothing has been observed", () => {
    expect(deriveControlEffectivenessState({})).toBe("NotTested");
    expect(
      deriveControlEffectivenessState({ observationAttempted: false })
    ).toBe("NotTested");
  });

  it("returns Inconclusive when observation started but did not complete", () => {
    expect(
      deriveControlEffectivenessState({
        observationAttempted: true,
        observationCompleted: false
      })
    ).toBe("Inconclusive");
  });

  it("returns NoEvidence when a completed observation found nothing", () => {
    expect(
      deriveControlEffectivenessState({
        noEvidenceObserved: true,
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("NoEvidence");
  });

  it("returns TelemetryOnly for log-only evidence without promoting to Detected", () => {
    expect(
      deriveControlEffectivenessState({
        evidenceIds: ["ev-log"],
        observedBehaviors: ["Logged"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("TelemetryOnly");
  });

  it("returns Detected for detect/alert/route evidence without promoting to Prevented", () => {
    expect(
      deriveControlEffectivenessState({
        evidenceIds: ["ev-detect"],
        observedBehaviors: ["Detected", "Logged"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Detected");

    expect(
      deriveControlEffectivenessState({
        evidenceIds: ["ev-alert"],
        observedBehaviors: ["Alerted"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Detected");
  });

  it("returns Prevented only when block evidence is present", () => {
    expect(
      deriveControlEffectivenessState({
        evidenceIds: ["ev-block"],
        observedBehaviors: ["Blocked", "Detected"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Prevented");

    expect(
      deriveControlEffectivenessState({
        evidenceIds: [],
        observedBehaviors: ["Blocked"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Inconclusive");
  });

  it("returns Missed only with completed observation, emission proof, and evidence", () => {
    expect(
      deriveControlEffectivenessState({
        emissionReceiptPresent: true,
        evidenceIds: ["ev-miss"],
        observedBehaviors: ["Missed"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Missed");

    expect(
      deriveControlEffectivenessState({
        correlationMatched: true,
        evidenceIds: ["ev-miss"],
        observedBehaviors: ["Missed"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Missed");

    expect(
      deriveControlEffectivenessState({
        evidenceIds: ["ev-miss"],
        observedBehaviors: ["Missed"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("NoEvidence");
  });

  it("prefers explicit verdict over coverage status and behaviors", () => {
    expect(
      deriveControlEffectivenessState({
        coverageStatus: "Covered",
        evidenceIds: ["ev-1"],
        observedBehaviors: ["Detected"],
        observationAttempted: true,
        observationCompleted: true,
        verdict: "Prevented"
      })
    ).toBe("Prevented");
  });

  it("prefers coverage status when no verdict is present", () => {
    expect(
      deriveControlEffectivenessState({
        coverageStatus: "LoggedOnly",
        observedBehaviors: ["Detected"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("TelemetryOnly");
  });

  it("maps NeedsTuning behavior to Inconclusive", () => {
    expect(
      deriveControlEffectivenessState({
        evidenceIds: ["ev-tune"],
        observedBehaviors: ["NeedsTuning"],
        observationAttempted: true,
        observationCompleted: true
      })
    ).toBe("Inconclusive");
  });

  it("parses observation input through the schema", () => {
    const parsed = ControlEffectivenessObservationSchema.parse({
      evidenceIds: ["a"],
      observedBehaviors: ["Logged"]
    });
    expect(parsed.observationAttempted).toBe(false);
    expect(parsed.observedBehaviors).toEqual(["Logged"]);
  });
});

describe("ensureCoverageItemEffectivenessState", () => {
  it("preserves an existing effectivenessState", () => {
    expect(
      ensureCoverageItemEffectivenessState({
        effectivenessState: "Prevented",
        status: "Covered"
      }).effectivenessState
    ).toBe("Prevented");
  });

  it("derives from legacy status when effectivenessState is missing", () => {
    expect(
      ensureCoverageItemEffectivenessState({
        status: "Blocked"
      }).effectivenessState
    ).toBe("Prevented");

    expect(
      ensureCoverageItemEffectivenessState({
        status: "NotTested"
      }).effectivenessState
    ).toBe("NotTested");
  });
});

describe("Control language quadruple reduction (P09-8)", () => {
  it("maps control edges to effectiveness with evidence gates", () => {
    expect(
      mapEdgeRelationshipToControlEffectiveness("BLOCKED_BY", {
        evidenceIds: ["e1"]
      })
    ).toBe("Prevented");
    expect(
      mapEdgeRelationshipToControlEffectiveness("DETECTED_BY", {
        evidenceIds: ["e1"]
      })
    ).toBe("Detected");
    expect(
      mapEdgeRelationshipToControlEffectiveness("MISSED_BY", {
        evidenceIds: ["e1"],
        emissionReceiptPresent: true
      })
    ).toBe("Missed");
    expect(
      mapEdgeRelationshipToControlEffectiveness("BLOCKED_BY", {
        evidenceIds: []
      })
    ).toBe("Inconclusive");
    expect(mapEdgeRelationshipToControlEffectiveness("CAN_ACCESS")).toBeNull();
  });

  it("maps legacy ControlState into the same atom", () => {
    expect(mapControlStateToEffectiveness("Blocked")).toBe("Prevented");
    expect(mapControlStateToEffectiveness("Logged")).toBe("TelemetryOnly");
    expect(mapControlStateToEffectiveness("NeedsTuning")).toBe("Inconclusive");
    expect(CONTROL_LANGUAGE_LAW).toMatch(/ControlEffectivenessState/);
  });
});
