import {
  AttackPathAssessmentSchema,
  buildAttackPathRiskSummary,
  claimSafePathValidationState,
  RiskScoreInputSchema,
  RiskScoreSchema,
  type AssetValuation,
  type AttackPath,
  type AttackPathAssessment,
  type ControlState,
  type FinancialExposureEstimate,
  type RiskFactor,
  type RiskScore,
  type RiskScoreInput
} from "@periscan/shared";

function pertExpected(range: {
  maximum: number;
  minimum: number;
  mostLikely: number;
}) {
  return (range.minimum + 4 * range.mostLikely + range.maximum) / 6;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimateFinancialExposure(input: {
  assetId: string;
  assetName: string;
  valuation: AssetValuation;
}): FinancialExposureEstimate {
  const expectedFrequency = pertExpected(
    input.valuation.lossEventFrequencyPerYear
  );
  const expectedMagnitude = pertExpected(input.valuation.lossMagnitudeUsd);

  return {
    annualizedLossExposureUsd: roundCurrency(
      expectedFrequency * expectedMagnitude
    ),
    assetId: input.assetId,
    assetName: input.assetName,
    assumptions: [
      `Loss-event frequency range: ${input.valuation.lossEventFrequencyPerYear.minimum} / ${input.valuation.lossEventFrequencyPerYear.mostLikely} / ${input.valuation.lossEventFrequencyPerYear.maximum} per year.`,
      `Loss-magnitude range: $${input.valuation.lossMagnitudeUsd.minimum} / $${input.valuation.lossMagnitudeUsd.mostLikely} / $${input.valuation.lossMagnitudeUsd.maximum}.`,
      input.valuation.assumptionNotes,
      "This is a user-supplied, FAIR-inspired planning estimate—not measured loss history or a full FAIR assessment."
    ],
    businessServiceName: input.valuation.businessServiceName,
    confidence: input.valuation.confidence,
    currency: input.valuation.currency,
    expectedLossEventFrequencyPerYear: roundCurrency(expectedFrequency),
    expectedLossMagnitudeUsd: roundCurrency(expectedMagnitude),
    lowerBoundUsd: roundCurrency(
      input.valuation.lossEventFrequencyPerYear.minimum *
        input.valuation.lossMagnitudeUsd.minimum
    ),
    methodology: "FAIR-inspired PERT range estimate",
    upperBoundUsd: roundCurrency(
      input.valuation.lossEventFrequencyPerYear.maximum *
        input.valuation.lossMagnitudeUsd.maximum
    ),
    valuationUpdatedAt: input.valuation.updatedAt
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toBand(score: number): RiskScore["band"] {
  // P09-3: RiskBand "Fixed" is deliberately excluded from score→band mapping.
  // Fixed is presentation-only when verificationStatus === "Fixed" (early return
  // in calculateRiskScore). A path whose contributions net to 0 is residual
  // Informational exposure — never a remediation Fixed claim. Do not add Fixed
  // here; that would mint closed-band from scoring alone.
  if (score >= 85) {
    return "Critical";
  }

  if (score >= 70) {
    return "High";
  }

  if (score >= 45) {
    return "Medium";
  }

  if (score >= 20) {
    return "Low";
  }

  return "Informational";
}

function createFactor(
  key: string,
  label: string,
  value: string,
  contribution: number,
  rationale: string
): RiskFactor {
  return {
    contribution,
    key,
    label,
    rationale,
    value
  };
}

const validationStateContributions: Record<
  RiskScoreInput["validationState"],
  number
> = {
  Alerted: -2,
  Blocked: -20,
  ClosedWithoutEvidence: 6,
  Detected: -10,
  Discovered: 8,
  Exploitable: 24,
  Fixed: -100,
  Inconclusive: -12,
  Logged: -4,
  Missed: 12,
  Mitigated: -14,
  NeedsApproval: 4,
  NeedsInternalRunner: 2,
  NoEvidence: 8,
  NotConfigured: -8,
  PartiallyFixed: -8,
  Reachable: 14,
  RequiresIntegration: -6,
  RequiresInternalRunner: -4,
  RequiresVerifiedScope: -8,
  Reopened: 26,
  Routed: -1,
  StillExposed: 16,
  Validated: 20
};

const controlContributions: Record<ControlState, number> = {
  Alerted: -2,
  Blocked: -20,
  Detected: -10,
  Logged: -4,
  Missed: 14,
  NeedsTuning: 6,
  NoEvidence: 10,
  Routed: -1
};

const criticalityContributions: Record<
  RiskScoreInput["businessCriticality"],
  number
> = {
  Critical: 20,
  High: 12,
  Low: 0,
  Moderate: 6
};

const reachabilityContributions: Record<
  NonNullable<RiskScoreInput["reachability"]>,
  number
> = {
  InternetExposed: 12,
  InternalReachable: 8,
  NotReachable: -12,
  Reachable: 10,
  Unknown: 0
};

const exploitabilityContributions: Record<
  NonNullable<RiskScoreInput["exploitability"]>,
  number
> = {
  Exploitable: 16,
  NotExploitable: -14,
  ProofObserved: 8,
  Unknown: 0
};

const remediationContributions: Record<
  NonNullable<RiskScoreInput["remediationStatus"]>,
  number
> = {
  ClosedWithoutEvidence: 6,
  Fixed: -8,
  InProgress: -2,
  Inconclusive: -4,
  Mitigated: -10,
  Open: 4,
  PartiallyFixed: -6,
  Reopened: 8,
  StillExposed: 10,
  VerificationPending: -2
};

export function calculateRiskScore(input: RiskScoreInput): RiskScore {
  const parsed = RiskScoreInputSchema.parse(input);

  // P09-3: band Fixed is presentation of verificationStatus only — never mint
  // from remediationStatus/validationState, and never write RemediationTask
  // status Fixed from risk code (display label: "Closed (risk)").
  if (parsed.verificationStatus === "Fixed") {
    return RiskScoreSchema.parse({
      band: "Fixed",
      factors: [
        createFactor(
          "verification",
          "Verification outcome",
          "Fixed",
          -100,
          "A verification event marks residual path risk closed (risk band Fixed / Closed (risk)); this does not itself write remediation status."
        )
      ],
      score: 0,
      summary:
        "Risk band closed (verified): residual priority is zero based on current verification evidence. Remediation Fixed remains a separate verification-gated workflow status."
    });
  }

  const reachability = parsed.reachability ?? "Unknown";
  const exploitability = parsed.exploitability ?? "Unknown";
  const recurrence = parsed.recurrence ?? 0;
  const threatRelevance = parsed.threatRelevance ?? 0.5;
  const knownExploitation = parsed.knownExploitation ?? false;
  const sensitiveData = parsed.sensitiveData ?? false;

  // PRD 3.11 Business Impact Scoring extension (financial/regulatory/operational)
  // Scores from pillar/BAS/EXV evidence feed dynamic dashboard; 0 if not provided.
  const financialImpact = parsed.financialImpact ?? 0;
  const regulatoryImpact = parsed.regulatoryImpact ?? 0;
  const operationalImpact = parsed.operationalImpact ?? 0;
  const businessImpactContribution = Math.round(
    ((financialImpact + regulatoryImpact + operationalImpact) / 3) * 0.25
  );

  const impactContribution = Math.round(parsed.impactScore * 0.35);
  const confidenceContribution = Math.round(parsed.confidence * 15);
  const validationContribution =
    validationStateContributions[parsed.validationState] ?? 0;
  const reachabilityContribution = reachabilityContributions[reachability];
  const exploitabilityContribution =
    exploitabilityContributions[exploitability];
  const knownExploitationContribution = knownExploitation ? 10 : 0;
  const threatRelevanceContribution = Math.round((threatRelevance - 0.5) * 20);
  const recurrenceContribution = Math.min(12, recurrence * 3);
  const controlContribution = parsed.controlResponse
    ? controlContributions[parsed.controlResponse]
    : 0;
  const criticalityContribution =
    criticalityContributions[parsed.businessCriticality];
  const privilegeContribution = parsed.privilegedPath ? 12 : 0;
  const exposureContribution = parsed.internetExposed ? 10 : 0;
  const sensitiveDataContribution = sensitiveData ? 10 : 0;
  const remediationContribution = parsed.remediationStatus
    ? remediationContributions[parsed.remediationStatus]
    : 0;
  const verificationContribution =
    parsed.verificationStatus === "Mitigated"
      ? -10
      : parsed.verificationStatus === "PartiallyFixed"
        ? -6
        : parsed.verificationStatus === "Reopened"
          ? 8
          : parsed.verificationStatus === "ClosedWithoutEvidence"
            ? 6
            : 0;
  // Every factor below is atomic and appears exactly once in the score sum.
  // This keeps the explanation mathematically auditable in the product UI.
  const factors: RiskFactor[] = [
    createFactor(
      "impact-score",
      "Impact score",
      String(parsed.impactScore),
      impactContribution,
      "Higher-impact targets raise the business consequence of the path."
    ),
    createFactor(
      "confidence",
      "Evidence confidence",
      parsed.confidence.toFixed(2),
      confidenceContribution +
        (parsed.validationState === "Inconclusive" ? -6 : 0),
      "Higher confidence means the path is supported by stronger evidence; inconclusive evidence lowers confidence."
    ),
    createFactor(
      "validation-state",
      "Validation state",
      parsed.validationState,
      validationContribution,
      "Validated, reachable, or reopened states keep the path materially actionable."
    ),
    createFactor(
      "reachability",
      "Reachability",
      reachability,
      reachabilityContribution,
      "Internet or internal reachability raises priority; evidence that the path is not reachable reduces it."
    ),
    createFactor(
      "exploitability",
      "Exploitability",
      exploitability,
      exploitabilityContribution,
      "Observed proof or exploitability raises priority; evidence that the path is not exploitable reduces it."
    ),
    createFactor(
      "threat-relevance",
      "Threat relevance",
      threatRelevance.toFixed(2),
      threatRelevanceContribution,
      "Relevant active threat context raises priority; weak or unrelated threat context reduces it."
    ),
    createFactor(
      "business-criticality",
      "Business criticality",
      parsed.businessCriticality,
      criticalityContribution,
      "More critical assets increase urgency and downstream impact."
    )
  ];

  if (parsed.controlResponse) {
    factors.push(
      createFactor(
        "control-response",
        "Control response",
        parsed.controlResponse,
        controlContribution,
        "Blocked or detected paths score lower than paths missed by controls."
      )
    );
  }

  if (parsed.privilegedPath) {
    factors.push(
      createFactor(
        "privileged-path",
        "Privilege escalation",
        "true",
        privilegeContribution,
        "Paths that reach privileged roles or production authority are more dangerous."
      )
    );
  }

  if (parsed.internetExposed) {
    factors.push(
      createFactor(
        "internet-exposed",
        "Internet exposure",
        "true",
        exposureContribution,
        "Internet-facing entry points increase attacker accessibility."
      )
    );
  }

  if (sensitiveData) {
    factors.push(
      createFactor(
        "sensitive-data",
        "Sensitive data",
        "true",
        sensitiveDataContribution,
        "Paths involving sensitive data increase business impact."
      )
    );
  }

  // PRD 3.11: surface separate business impact dimensions for EXV/regulatory/ops
  if (financialImpact > 0 || regulatoryImpact > 0 || operationalImpact > 0) {
    factors.push(
      createFactor(
        "business-impact-dimensions",
        "Business impact (financial/regulatory/operational)",
        `${financialImpact}/${regulatoryImpact}/${operationalImpact}`,
        businessImpactContribution,
        "Financial, regulatory, and operational impact scores from evidence (pillar/BAS/EXV) quantify business-centric risk for attestations and dashboard."
      )
    );
  }

  if (knownExploitation) {
    factors.push(
      createFactor(
        "known-exploitation",
        "Known exploitation",
        "true",
        knownExploitationContribution,
        "Known exploitation in the wild increases urgency."
      )
    );
  }

  if (recurrenceContribution > 0) {
    factors.push(
      createFactor(
        "recurrence",
        "Recurrence",
        String(recurrence),
        recurrenceContribution,
        "Repeatedly observed or reopened exposure increases priority."
      )
    );
  }

  if (parsed.remediationStatus && remediationContribution !== 0) {
    factors.push(
      createFactor(
        "remediation-status",
        "Remediation status",
        parsed.remediationStatus,
        remediationContribution,
        "Remediation progress changes residual risk, but only verified fixes can mark a path fixed."
      )
    );
  }

  if (verificationContribution !== 0 && parsed.verificationStatus) {
    factors.push(
      createFactor(
        "verification-status",
        "Verification status",
        parsed.verificationStatus,
        verificationContribution,
        "Verification outcomes should materially change the residual risk."
      )
    );
  }

  const score = clampScore(
    impactContribution +
      confidenceContribution +
      validationContribution +
      reachabilityContribution +
      exploitabilityContribution +
      knownExploitationContribution +
      threatRelevanceContribution +
      recurrenceContribution +
      controlContribution +
      criticalityContribution +
      privilegeContribution +
      exposureContribution +
      sensitiveDataContribution +
      remediationContribution +
      verificationContribution +
      // PRD 3.11 business impact dimensions contribution (EXV dashboard)
      businessImpactContribution
  );
  const band = toBand(score);

  return RiskScoreSchema.parse({
    band,
    factors,
    score,
    summary:
      band === "Critical"
        ? "Critical-risk exposure with urgent remediation priority."
        : band === "High"
          ? "High-risk exposure that should be addressed before the next validation cycle."
          : band === "Medium"
            ? "Material exposure with meaningful impact, but not the highest current priority."
            : band === "Low"
              ? "Lower-severity exposure with some compensating control or impact reduction."
              : "Residual informational exposure with limited current risk."
  });
}

function deriveReachability(
  claimSafeValidationState: AttackPath["validationState"],
  internetExposed: boolean
): NonNullable<RiskScoreInput["reachability"]> {
  if (internetExposed) {
    return "InternetExposed";
  }

  // P09-2: claim-safe only — heuristic overclaims must not inflate reachability.
  if (
    claimSafeValidationState === "Reachable" ||
    claimSafeValidationState === "Validated" ||
    claimSafeValidationState === "Exploitable"
  ) {
    return "Reachable";
  }

  return "Unknown";
}

function deriveExploitability(
  claimSafeValidationState: AttackPath["validationState"]
): NonNullable<RiskScoreInput["exploitability"]> {
  // P09-2: claim-safe only — never treat unmeasured Validated/Exploitable as proof.
  if (claimSafeValidationState === "Exploitable") {
    return "Exploitable";
  }

  if (
    claimSafeValidationState === "Validated" ||
    claimSafeValidationState === "Reachable"
  ) {
    return "ProofObserved";
  }

  if (
    claimSafeValidationState === "Blocked" ||
    claimSafeValidationState === "Mitigated"
  ) {
    return "NotExploitable";
  }

  return "Unknown";
}

function deriveControlResponse(path: AttackPath): ControlState | null {
  const relationships = new Set(
    path.pathEdges.map((edge) => edge.relationship)
  );
  const haystack = [
    path.name,
    ...path.pathNodes.map((node) => node.label),
    ...path.pathEdges.map(
      (edge) => `${edge.relationship} ${edge.rationale ?? ""}`
    )
  ]
    .join(" ")
    .toLowerCase();

  if (relationships.has("BLOCKED_BY")) {
    return "Blocked";
  }

  if (relationships.has("MISSED_BY")) {
    return "Missed";
  }

  if (relationships.has("DETECTED_BY")) {
    return "Detected";
  }

  if (haystack.includes("blocked")) {
    return "Blocked";
  }

  if (haystack.includes("missed")) {
    return "Missed";
  }

  if (haystack.includes("detected")) {
    return "Detected";
  }

  if (haystack.includes("alert")) {
    return "Alerted";
  }

  return null;
}

function deriveCriticality(
  path: AttackPath
): RiskScoreInput["businessCriticality"] {
  if (path.impactScore >= 90) {
    return "Critical";
  }

  if (path.impactScore >= 75) {
    return "High";
  }

  if (path.impactScore >= 45) {
    return "Moderate";
  }

  return "Low";
}

export function assessAttackPathRisk(
  path: AttackPath,
  financialExposure: FinancialExposureEstimate | null = null
): AttackPathAssessment {
  const haystack = [path.name, ...path.pathNodes.map((node) => node.label)]
    .join(" ")
    .toLowerCase();
  // P09-2: risk factors use claim-safe path state so severity never inherits
  // overclaiming Validated/Exploitable without hop measurement.
  const claimSafeValidationState = claimSafePathValidationState(path);
  const risk = calculateRiskScore({
    businessCriticality: deriveCriticality(path),
    confidence: path.confidence,
    controlResponse: deriveControlResponse(path),
    exploitability: deriveExploitability(claimSafeValidationState),
    impactScore: Math.max(0, Math.min(100, path.impactScore)),
    internetExposed:
      haystack.includes("external") ||
      haystack.includes("internet") ||
      haystack.includes("public"),
    knownExploitation:
      haystack.includes("kev") ||
      haystack.includes("exploited in the wild") ||
      haystack.includes("known exploited"),
    privilegedPath:
      haystack.includes("role") ||
      haystack.includes("privileged") ||
      haystack.includes("production") ||
      haystack.includes("admin"),
    reachability: deriveReachability(
      claimSafeValidationState,
      haystack.includes("external") ||
        haystack.includes("internet") ||
        haystack.includes("public")
    ),
    recurrence: path.validationState === "Reopened" ? 1 : 0,
    remediationStatus: null,
    sensitiveData:
      haystack.includes("secret") ||
      haystack.includes("credential") ||
      haystack.includes("sensitive data") ||
      haystack.includes("production data"),
    threatRelevance: claimSafeValidationState === "Exploitable" ? 0.85 : 0.5,
    validationState: claimSafeValidationState,
    verificationStatus: null
  });

  return AttackPathAssessmentSchema.parse({
    attackPath: path,
    financialExposure,
    risk: {
      ...risk,
      summary: buildAttackPathRiskSummary(path, risk.band)
    }
  });
}

// Counts assessed paths whose canonical risk band is Critical or High. Snapshot
// "high-risk path" metrics must be computed over the FULL assessed set — never a
// display-sliced "top N" preview — or the count silently caps at the preview size.
export function countHighRiskAttackPaths(
  assessments: AttackPathAssessment[]
): number {
  return assessments.filter(
    (assessment) =>
      assessment.risk.band === "Critical" || assessment.risk.band === "High"
  ).length;
}

// P11-5: computeCrownJewelRiskImpact / applyCrownJewelImpactToRiskInput (living-map
// $$ fixture scale) moved to packages/evidence/src/fixtures/living-map-terrain.ts.
// Customer-visible financial impact must come from estimateFinancialExposure /
// AssetValuationVersion — never living-map stubs.
