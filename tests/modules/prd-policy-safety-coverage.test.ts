import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  PolicyDecisionOutcomeSchema,
  PolicyRequestedActionSchema
} from "../../packages/shared/src/domain.js";
import {
  evaluatePolicy,
  PolicyEvaluationInputSchema
} from "../../packages/policy/src/index.js";

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

function subsectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  return sectionBetween(source, startHeader, nextHeader);
}

function parseBullets(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

const INPUT_FIELD_ALIASES: Record<string, string> = {
  "tenant policy": "tenantPolicy",
  "user role": "userRole",
  scope: "scopeVerificationStatus",
  "mission type": "missionType",
  "module safety level": "safetyLevel",
  target: "target",
  "execution environment": "executionEnvironment",
  "requested action": "requestedAction"
};

const REQUESTED_ACTION_RULE_ALIASES: Record<string, string> = {
  "No credential theft.": "credentialTheft",
  "No destructive tests.": "destructive",
  "No persistence.": "persistence",
  "No real data exfiltration.": "realDataExfiltration",
  "No uncontrolled exploit chaining.": "uncontrolledExploitChaining"
};

function basePolicyInput() {
  return {
    adminApproval: false,
    executionEnvironment: "ExternalPoA" as const,
    explicitMissionApproval: false,
    missionType: "ExposureValidation" as const,
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "PassiveReadOnly" as const,
    scopeVerificationStatus: "Verified" as const,
    target: { hostname: "example.test" },
    tenantPolicy: {
      allowedExecutionEnvironments: [
        "ControlPlane",
        "ExternalPoA",
        "InternalRunner"
      ] as const,
      disallowedMissionTypes: [],
      maxSafetyLevel: "BASLite" as const,
      requireTimeWindowForSafetyLevels: []
    },
    timeWindowApproved: false,
    userRole: "SecurityEngineer" as const
  };
}

describe("PRD section 11 Policy and Safety Engine coverage", () => {
  it("keeps PRD policy inputs and outputs represented in public schemas", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const policySection = sectionBetween(
      prd,
      "## 11. Policy and Safety Engine",
      "## 12. Evidence Graph"
    );
    const inputBullets = parseBullets(
      subsectionBetween(policySection, "### 11.1 Inputs", "### 11.2 Outputs")
    );
    const outputBullets = parseBullets(
      subsectionBetween(policySection, "### 11.2 Outputs", "### 11.3 Rules")
    );
    const inputFields = new Set(PolicyEvaluationInputSchema.keyof().options);
    const outcomeValues = new Set(PolicyDecisionOutcomeSchema.options);
    const requestedActionFields = new Set(
      PolicyRequestedActionSchema.keyof().options
    );

    expect(inputBullets).toEqual(Object.keys(INPUT_FIELD_ALIASES));

    for (const inputName of inputBullets) {
      const field = INPUT_FIELD_ALIASES[inputName];
      expect(
        inputFields.has(field),
        `${inputName} should map to policy input ${field}`
      ).toBe(true);
    }

    for (const outcome of outputBullets) {
      expect(outcomeValues.has(outcome), outcome).toBe(true);
    }

    for (const field of Object.values(REQUESTED_ACTION_RULE_ALIASES)) {
      expect(requestedActionFields.has(field), field).toBe(true);
    }
  });

  it("keeps every PRD policy rule mapped to deterministic policy outcomes", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const policySection = sectionBetween(
      prd,
      "## 11. Policy and Safety Engine",
      "## 12. Evidence Graph"
    );
    const ruleBullets = parseBullets(
      subsectionBetween(policySection, "### 11.3 Rules", "### 11.4 Audit")
    );

    expect(ruleBullets).toEqual([
      "No validation without verified scope.",
      "Level 0 and 1 allowed for verified scope.",
      "Level 2 requires explicit mission approval.",
      "Level 3 requires admin approval.",
      "Level 4 disabled by default.",
      "Level 5 always denied.",
      "No destructive tests.",
      "No real data exfiltration.",
      "No persistence.",
      "No credential theft.",
      "No uncontrolled exploit chaining."
    ]);

    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        scopeVerificationStatus: "Pending"
      }).outcome
    ).toBe("RequiresVerifiedScope");

    for (const safetyLevel of [
      "PassiveReadOnly",
      "ActiveNonInvasive"
    ] as const) {
      expect(
        evaluatePolicy({
          ...basePolicyInput(),
          safetyLevel
        }).outcome
      ).toBe("Allowed");
    }

    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        safetyLevel: "ControlledValidation"
      }).outcome
    ).toBe("RequiresApproval");
    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        explicitMissionApproval: true,
        safetyLevel: "ControlledValidation"
      }).outcome
    ).toBe("Allowed");

    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        executionEnvironment: "InternalRunner",
        safetyLevel: "BASLite"
      }).outcome
    ).toBe("RequiresApproval");
    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        adminApproval: true,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: true,
        safetyLevel: "BASLite",
        userRole: "Owner"
      }).outcome
    ).toBe("Allowed");

    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        adminApproval: true,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: true,
        safetyLevel: "AdvancedAdversarial",
        timeWindowApproved: true,
        userRole: "Owner"
      }).outcome
    ).toBe("Denied");
    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        safetyLevel: "Disallowed"
      }).outcome
    ).toBe("Denied");

    for (const [rule, actionField] of Object.entries(
      REQUESTED_ACTION_RULE_ALIASES
    )) {
      expect(ruleBullets).toContain(rule);
      expect(
        evaluatePolicy({
          ...basePolicyInput(),
          requestedAction: {
            ...basePolicyInput().requestedAction,
            [actionField]: true
          }
        }).outcome,
        rule
      ).toBe("Denied");
    }
  });

  it("keeps tenant policy and policy-decision audit behavior explicit", async () => {
    const validationService = await readRepoFile(
      "apps/api/src/services/validation.ts"
    );
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const auditSection = sectionBetween(
      prd,
      "### 11.4 Audit",
      "## 12. Evidence Graph"
    );

    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        safetyLevel: "ControlledValidation",
        tenantPolicy: {
          ...basePolicyInput().tenantPolicy,
          maxSafetyLevel: "ActiveNonInvasive"
        }
      }).outcome
    ).toBe("Denied");
    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        safetyLevel: "ActiveNonInvasive",
        tenantPolicy: {
          ...basePolicyInput().tenantPolicy,
          requireTimeWindowForSafetyLevels: ["ActiveNonInvasive"]
        }
      }).outcome
    ).toBe("RequiresTimeWindow");
    expect(
      evaluatePolicy({
        ...basePolicyInput(),
        executionEnvironment: "InternalRunner",
        tenantPolicy: {
          ...basePolicyInput().tenantPolicy,
          allowedExecutionEnvironments: ["ExternalPoA"]
        }
      }).outcome
    ).toBe("Denied");

    expect(auditSection).toContain(
      "Every policy decision must create an audit event."
    );
    expect(validationService).toContain("prisma.policyDecision.create");
    expect(validationService).toContain('action: "policy.decision"');
  });
});
