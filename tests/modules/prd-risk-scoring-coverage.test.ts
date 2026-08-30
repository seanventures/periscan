import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { calculateRiskScore } from "../../packages/evidence/src/risk.js";
import { RiskScoreInputSchema } from "../../packages/shared/src/domain.js";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseBullets(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

const INPUT_FIELD_ALIASES: Record<string, string> = {
  "asset criticality": "businessCriticality",
  "business impact": "impactScore",
  confidence: "confidence",
  "control response": "controlResponse",
  exploitability: "exploitability",
  "identity privilege": "privilegedPath",
  "known exploitation": "knownExploitation",
  reachability: "reachability",
  recurrence: "recurrence",
  "remediation status": "remediationStatus",
  "threat relevance": "threatRelevance",
  "validation state": "validationState",
  "verification status": "verificationStatus"
};

function baseRiskInput() {
  return {
    businessCriticality: "High" as const,
    confidence: 0.82,
    controlResponse: "Detected" as const,
    exploitability: "ProofObserved" as const,
    impactScore: 78,
    internetExposed: false,
    knownExploitation: false,
    privilegedPath: false,
    reachability: "Reachable" as const,
    recurrence: 0,
    remediationStatus: null,
    sensitiveData: false,
    threatRelevance: 0.5,
    validationState: "Validated" as const,
    verificationStatus: null
  };
}

describe("PRD section 13 Risk Scoring coverage", () => {
  it("keeps every PRD scoring input represented in the public risk input contract", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const riskSection = sectionBetween(
      prd,
      "## 13. Risk Scoring",
      "## 14. Periscan Runner Spec"
    );
    const prdInputs = parseBullets(
      sectionBetween(riskSection, "### 13.1 Inputs", "### 13.2 Formula")
    );
    const riskInputFields = new Set(Object.keys(RiskScoreInputSchema.shape));

    expect(prdInputs).toEqual([
      "validation state",
      "reachability",
      "exploitability",
      "control response",
      "identity privilege",
      "asset criticality",
      "business impact",
      "known exploitation",
      "threat relevance",
      "confidence",
      "recurrence",
      "remediation status",
      "verification status"
    ]);

    for (const prdInput of prdInputs) {
      expect(riskInputFields).toContain(INPUT_FIELD_ALIASES[prdInput]);
    }

    expect(
      RiskScoreInputSchema.parse({
        ...baseRiskInput(),
        exploitability: "Exploitable",
        knownExploitation: true,
        reachability: "InternetExposed",
        recurrence: 2,
        remediationStatus: "StillExposed",
        sensitiveData: true,
        threatRelevance: 0.92
      })
    ).toMatchObject({
      exploitability: "Exploitable",
      knownExploitation: true,
      reachability: "InternetExposed",
      recurrence: 2,
      remediationStatus: "StillExposed",
      sensitiveData: true,
      threatRelevance: 0.92
    });
  });

  it("keeps the PRD real-risk formula explainable through atomic score factors", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const riskSection = sectionBetween(
      prd,
      "## 13. Risk Scoring",
      "## 14. Periscan Runner Spec"
    );

    expect(riskSection).toContain("Real Risk =");
    expect(riskSection).toContain("Attack Feasibility");
    expect(riskSection).toContain("Business Impact");
    expect(riskSection).toContain("Control Failure");
    expect(riskSection).toContain("Confidence");
    expect(riskSection).toContain("Threat Relevance");

    const risk = calculateRiskScore({
      ...baseRiskInput(),
      controlResponse: "Missed",
      exploitability: "Exploitable",
      knownExploitation: true,
      reachability: "InternetExposed",
      recurrence: 2,
      sensitiveData: true,
      threatRelevance: 0.95
    });

    expect(risk.factors.map((factor) => factor.key)).toEqual(
      expect.arrayContaining([
        "impact-score",
        "confidence",
        "validation-state",
        "reachability",
        "exploitability",
        "threat-relevance",
        "business-criticality",
        "control-response",
        "sensitive-data",
        "known-exploitation",
        "recurrence"
      ])
    );
    expect(risk.score).toBeGreaterThanOrEqual(85);
    expect(risk.band).toBe("Critical");
  });

  it("keeps every PRD scoring modifier directional and evidence-safe", async () => {
    const base = baseRiskInput();
    const blocked = calculateRiskScore({ ...base, controlResponse: "Blocked" });
    const detected = calculateRiskScore({
      ...base,
      controlResponse: "Detected"
    });
    const missed = calculateRiskScore({ ...base, controlResponse: "Missed" });
    const verifiedFixed = calculateRiskScore({
      ...base,
      verificationStatus: "Fixed"
    });
    const reopened = calculateRiskScore({
      ...base,
      validationState: "Reopened"
    });
    const validated = calculateRiskScore({
      ...base,
      validationState: "Validated"
    });
    const sensitive = calculateRiskScore({ ...base, sensitiveData: true });
    const notSensitive = calculateRiskScore({ ...base, sensitiveData: false });
    const privileged = calculateRiskScore({ ...base, privilegedPath: true });
    const standard = calculateRiskScore({ ...base, privilegedPath: false });
    const inconclusive = calculateRiskScore({
      ...base,
      validationState: "Inconclusive"
    });

    expect(blocked.score).toBeLessThan(detected.score);
    expect(detected.score).toBeLessThan(missed.score);
    expect(verifiedFixed.band).toBe("Fixed");
    expect(verifiedFixed.score).toBe(0);
    expect(reopened.score).toBeGreaterThan(validated.score);
    expect(sensitive.score).toBeGreaterThan(notSensitive.score);
    expect(privileged.score).toBeGreaterThan(standard.score);
    expect(inconclusive.score).toBeLessThan(validated.score);

    const remediationOnlyFixed = calculateRiskScore({
      ...base,
      remediationStatus: "Fixed"
    });
    expect(remediationOnlyFixed.band).not.toBe("Fixed");
    expect(remediationOnlyFixed.score).toBeGreaterThan(0);
  });
});
