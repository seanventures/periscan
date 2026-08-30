import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scorecardPath = resolve(root, "docs/qa/analyst-scorecard.json");
const scorecard = JSON.parse(readFileSync(scorecardPath, "utf8"));

const errors = [];
const allowedVerdicts = new Set([
  "Leading",
  "Strong",
  "Partial",
  "Scaffold/gated",
  "Gap"
]);
const allowedOwners = new Set([
  "CTEM and BAS squad",
  "Agent and AI security squad",
  "RemOps and integrations squad",
  "Trust, NHI, and scale squad",
  "Experience and enterprise squad"
]);
const excludedAdjacentRequirementIds = [
  45, 46, 55, 56, 58, 95, 99, 100, 101, 102, 103, 104, 105, 106, 108, 109
];
const expectedRequirementIds = Array.from(
  { length: 110 },
  (_, index) => index + 1
).filter((id) => !excludedAdjacentRequirementIds.includes(id));
const expectedRequirementIdSet = new Set(expectedRequirementIds);
const requiredDependencyRows = new Set([
  2, 16, 18, 19, 21, 22, 26, 28, 35, 36, 37, 38, 44, 47, 51, 64, 72, 73, 74, 75,
  76, 77, 78
]);

function fail(message) {
  errors.push(message);
}

if (scorecard.schemaVersion !== 2) {
  fail(`schemaVersion must be 2; received ${scorecard.schemaVersion}`);
}
if (scorecard.benchmark !== "ASV/CTEM 94-requirement core matrix") {
  fail(`unexpected benchmark: ${String(scorecard.benchmark)}`);
}
if (
  scorecard.scope?.sourceMatrixRequirementCount !== 110 ||
  scorecard.scope?.coreRequirementCount !== 94 ||
  scorecard.scope?.retainedOriginalIds !== true ||
  JSON.stringify(scorecard.scope?.excludedAdjacentRequirementIds) !==
    JSON.stringify(excludedAdjacentRequirementIds)
) {
  fail("scorecard scope must preserve the approved 94-row ASV/CTEM boundary");
}
if (!Array.isArray(scorecard.requirements)) {
  fail("requirements must be an array");
}

const requirements = Array.isArray(scorecard.requirements)
  ? scorecard.requirements
  : [];
if (requirements.length !== 94) {
  fail(
    `scorecard must contain exactly 94 core requirements; received ${requirements.length}`
  );
}

const ids = new Set();
const dimensions = { function: 0, operations: 0, product: 0, ux: 0 };
const targetDistribution = new Map();
let currentPoints = 0;
let targetPoints = 0;
let strictFloorRows = 0;
let strongOrLeadingRows = 0;

for (const requirement of requirements) {
  const prefix = `requirement ${String(requirement.id ?? "unknown")}`;
  if (
    !Number.isInteger(requirement.id) ||
    requirement.id < 1 ||
    !expectedRequirementIdSet.has(requirement.id)
  ) {
    fail(`${prefix}: id is outside the approved ASV/CTEM core requirement set`);
    continue;
  }
  if (ids.has(requirement.id)) fail(`${prefix}: duplicate id`);
  ids.add(requirement.id);
  if (
    typeof requirement.requirement !== "string" ||
    requirement.requirement.trim() === ""
  ) {
    fail(`${prefix}: requirement name is required`);
  }
  if (!allowedVerdicts.has(requirement.verdict)) {
    fail(`${prefix}: unsupported verdict ${String(requirement.verdict)}`);
  }
  if (!allowedOwners.has(requirement.accountableOwnerRole)) {
    fail(`${prefix}: an approved accountable owner role is required`);
  }
  if (
    requiredDependencyRows.has(requirement.id) &&
    requirement.dependency === "None"
  ) {
    fail(
      `${prefix}: known external/safety/qualification dependency cannot be None`
    );
  }
  if (![4, 4.5, 5].includes(requirement.targetScore)) {
    fail(`${prefix}: targetScore must be 4, 4.5, or 5`);
  }
  targetDistribution.set(
    requirement.targetScore,
    (targetDistribution.get(requirement.targetScore) ?? 0) + 1
  );
  targetPoints += requirement.targetScore * 4;

  const current = requirement.current ?? {};
  let rowPoints = 0;
  for (const dimension of Object.keys(dimensions)) {
    const value = current[dimension];
    if (!Number.isInteger(value) || value < 0 || value > 5) {
      fail(
        `${prefix}: current.${dimension} must be an integer from 0 through 5`
      );
      continue;
    }
    dimensions[dimension] += value;
    rowPoints += value;
  }
  currentPoints += rowPoints;
  if (Math.abs(rowPoints / 4 - requirement.currentScore) > 0.001) {
    fail(`${prefix}: currentScore does not reconcile to its four dimensions`);
  }
  if (requirement.currentScore >= 4) strictFloorRows += 1;
  if (["Strong", "Leading"].includes(requirement.verdict)) {
    strongOrLeadingRows += 1;
  }
  if (
    !Array.isArray(requirement.evidenceRefs) ||
    requirement.evidenceRefs.length === 0
  ) {
    fail(`${prefix}: at least one evidence reference is required`);
  } else {
    for (const reference of requirement.evidenceRefs) {
      if (!existsSync(resolve(root, "docs/qa", reference))) {
        fail(`${prefix}: evidence reference does not exist: ${reference}`);
      }
    }
  }
  const reviewDue = new Date(requirement.evidenceReviewDueAt);
  if (Number.isNaN(reviewDue.valueOf())) {
    fail(`${prefix}: evidenceReviewDueAt must be a valid timestamp or date`);
  }
}

for (const id of expectedRequirementIds) {
  if (!ids.has(id)) fail(`requirement ${id}: missing from scorecard`);
}
for (const id of excludedAdjacentRequirementIds) {
  if (ids.has(id)) {
    fail(
      `requirement ${id}: adjacent AI-runtime row re-entered the core scorecard`
    );
  }
}

const programmaticHitl = requirements.find(
  (requirement) => requirement.id === 42
);
if (
  programmaticHitl?.currentScore !== 4 ||
  programmaticHitl.current?.operations !== 4
) {
  fail(
    "requirement 42: programmatic HITL must remain at the verified 4.0 floor"
  );
}
if (
  !programmaticHitl?.evidenceRefs?.includes(
    "../MODEL_TOOL_INTERVENTION_RUNBOOK.md"
  )
) {
  fail("requirement 42: model-tool intervention runbook evidence is required");
}
for (const requirement of requirements) {
  if (
    requirement.id !== 42 &&
    requirement.evidenceRefs?.includes("../MODEL_TOOL_INTERVENTION_RUNBOOK.md")
  ) {
    fail(
      `requirement ${requirement.id}: model-tool intervention evidence belongs only to requirement 42`
    );
  }
}

const continuousFeedback = requirements.find(
  (requirement) => requirement.id === 43
);
if (
  continuousFeedback?.currentScore !== 4 ||
  continuousFeedback.current?.operations !== 4
) {
  fail(
    "requirement 43: continuous feedback loops must remain at the verified 4.0 floor"
  );
}
if (
  !continuousFeedback?.evidenceRefs?.includes(
    "../SCENARIO_FEEDBACK_OPERATIONS_RUNBOOK.md"
  )
) {
  fail("requirement 43: scenario feedback operations runbook is required");
}
for (const requirement of requirements) {
  if (
    requirement.id !== 43 &&
    requirement.evidenceRefs?.includes(
      "../SCENARIO_FEEDBACK_OPERATIONS_RUNBOOK.md"
    )
  ) {
    fail(
      `requirement ${requirement.id}: scenario feedback evidence belongs only to requirement 43`
    );
  }
}

const hardwareTeeAssurance = requirements.find(
  (requirement) => requirement.id === 44
);
if (
  hardwareTeeAssurance?.currentScore !== 4 ||
  hardwareTeeAssurance.current?.function !== 4 ||
  hardwareTeeAssurance.current?.operations !== 4
) {
  fail(
    "requirement 44: TEE assurance must retain functional and operational 4.0 evidence"
  );
}
if (
  !hardwareTeeAssurance?.evidenceRefs?.includes(
    "../CONFIDENTIAL_COMPUTE_ASSURANCE_RUNBOOK.md"
  )
) {
  fail("requirement 44: confidential compute assurance runbook is required");
}
for (const requirement of requirements) {
  if (
    requirement.id !== 44 &&
    requirement.evidenceRefs?.includes(
      "../CONFIDENTIAL_COMPUTE_ASSURANCE_RUNBOOK.md"
    )
  ) {
    fail(
      `requirement ${requirement.id}: TEE assurance evidence belongs only to requirement 44`
    );
  }
}

// Honesty pass 2026-07-30 (A8 / P12-3 / P19-r1 / P05-11 / P13-4 / P12-16):
// residual Leading on matrix Partial/Scaffold/Missing demoted; SCV → Partial
// while inject loop remains off; scoreGovernance forbids MQ/Wave export.
// Prior 2026-07-29 pass: APV/DRV/Choke/Multi-Agent/Partner/Compliance caps.
// Totals: 1,484/1,880 (78.9) after 2026-08-03 continuous-loop Slice E lab-demo rescore.
// Prior Slice D: 1,471/1,880 (78.2). Slice A: 1,383/1,880 (73.6).
//
// Slice 10 path-to-95 floors (docs/qa/SLICE10_PATH_TO_95.md):
// - CURRENT honesty lock (enforced below): 1383/1880 (73.6%), dims
//   product=361 function=352 ux=359 operations=311, strict≥4.0 = 45,
//   Strong+Leading = 74, target sum = 1802/1880 (95.9%).
// - DONE floor for Plane Slice 10: currentPoints ≥ 1786 (95.0%), preferred
//   1802 (95.9%), plus blind rescore + release gates. Do NOT raise enforced
//   current floors until evidence-backed rescore; do NOT invent Leading.
// - Caps remain until claims change: Partner≠Leading; rows 29/30/33 ≠
//   Strong/Leading; row 4 score < 4; row 80 score < 4; SCV ≠ Strong/Leading
//   while inject disabled; Leading only on Fully-E2E-aligned allowlist.

// P12-16: dual scoreboard — internal index ≠ MQ/Wave progress.
if (scorecard.scoreGovernance?.isMagicQuadrantProgress !== false) {
  fail(
    "scoreGovernance.isMagicQuadrantProgress must be false (P12-16 internal≠MQ)"
  );
}
if (scorecard.scoreGovernance?.isForresterWaveProgress !== false) {
  fail(
    "scoreGovernance.isForresterWaveProgress must be false (P12-16 internal≠Wave)"
  );
}
if (scorecard.scoreGovernance?.internalEngineeringIndexOnly !== true) {
  fail(
    "scoreGovernance.internalEngineeringIndexOnly must be true (P12-16)"
  );
}
if (
  scorecard.scoreGovernance?.marketPresence?.namedCustomerReferences !== 0
) {
  fail(
    "scoreGovernance.marketPresence.namedCustomerReferences must remain 0 until real refs land (P08-2/P12-6/P13-1) — do not fabricate"
  );
}

// P12-7: Partner/Ecosystem rows cannot claim Leading on the core scorecard.
for (const requirement of requirements) {
  if (
    requirement.dependency === "Partner" &&
    requirement.verdict === "Leading"
  ) {
    fail(
      `requirement ${requirement.id}: Partner-gated row cannot be Leading without joint customer proof (P12-7)`
    );
  }
}

// P12-8: peak-hype agent platform criteria must not sit at Leading inside AEV core.
const hypeScaffoldIds = new Set([29, 30, 33]); // Multi-Agent, Hybrid Compiler, Conversational
for (const requirement of requirements) {
  if (
    hypeScaffoldIds.has(requirement.id) &&
    ["Leading", "Strong"].includes(requirement.verdict)
  ) {
    fail(
      `requirement ${requirement.id}: agent/hype AEV criteria must stay Partial/Scaffold until measured mission assembly is real (P12-8)`
    );
  }
}

// P12-12: Choke Point is pattern-attached breakers, not min-cut graph science.
const choke = requirements.find((requirement) => requirement.id === 4);
if (choke && (choke.verdict === "Leading" || choke.currentScore >= 4)) {
  fail(
    "requirement 4: Choke Point Analysis cannot be Leading while pathBreakers are pattern-attached (P12-12)"
  );
}

// P12-13: Automated Compliance Attestations are not regulated program attestation.
const complianceAttest = requirements.find(
  (requirement) => requirement.id === 80
);
if (
  complianceAttest &&
  (complianceAttest.verdict === "Leading" ||
    complianceAttest.currentScore >= 4)
) {
  fail(
    "requirement 80: Automated Compliance Attestations cannot be Leading on partial catalog (P12-13)"
  );
}

// P05-11 / P13-4: SCV cannot be Strong/Leading while inject loop is hard-disabled.
const scv = requirements.find((requirement) => requirement.id === 6);
if (scv && ["Leading", "Strong"].includes(scv.verdict)) {
  fail(
    "requirement 6: Security Control Validation cannot be Strong/Leading while closed inject is disabled (P05-11/P13-4)"
  );
}

// P12-3 / P19-r1: Leading only on matrix Fully-E2E-aligned allowlist.
const leadingAllowlist = new Set([11, 13, 24, 69, 90, 91]);
for (const requirement of requirements) {
  if (
    requirement.verdict === "Leading" &&
    !leadingAllowlist.has(requirement.id)
  ) {
    fail(
      `requirement ${requirement.id}: Leading forbidden unless matrix Fully-E2E-aligned allowlist (P12-3/P19-r1); allowlist=[${[...leadingAllowlist].join(",")}]`
    );
  }
}

// Matrix poison rows must not re-inflate to Leading (explicit denylist).
const neverLeadingIds = new Set([
  3, // APV multi-hop Partial
  4, // choke Partial
  5, // exposure graphs (APV-adjacent)
  6, // SCV Partial inject-off
  8, // DRV Partial/Scaffold
  23, // dynamic paths Scaffold/Partial
  25, // SSCS Partial
  59, // AI control Partial
  61, // prompt injection (AI BAS-adjacent)
  65, // AI kill-switch
  66, // data fabric Partial
  70, // IaC push absent
  78, // vCenter CustomerQualification / Partial
  79, // threat intel Partial
  80, // compliance Scaffold
  92, // assessment licensing commercial NotConfigured
  98 // marketplace Scaffold
]);
for (const requirement of requirements) {
  if (
    neverLeadingIds.has(requirement.id) &&
    requirement.verdict === "Leading"
  ) {
    fail(
      `requirement ${requirement.id}: matrix/honesty denylist forbids Leading (P19-r1)`
    );
  }
}

if (
  !scorecard.scope?.presentation?.note ||
  !Array.isArray(scorecard.scope?.partnerRequirementIds)
) {
  fail(
    "scorecard.scope must publish partnerRequirementIds + presentation split (P12-7 core vs Partner appendix)"
  );
}
const expectedDimensions = {
  function: 374,
  operations: 369,
  product: 374,
  ux: 372
};
for (const [dimension, expected] of Object.entries(expectedDimensions)) {
  if (dimensions[dimension] !== expected) {
    fail(
      `${dimension} current score must reconcile to ${expected}; received ${dimensions[dimension]}`
    );
  }
}
if (currentPoints !== 1489) {
  fail(
    `current score must reconcile to 1489/1880; received ${currentPoints}/1880`
  );
}
if (Math.abs(scorecard.currentScore - (currentPoints / 1880) * 100) > 0.05) {
  fail(
    `declared currentScore must reconcile to ${((currentPoints / 1880) * 100).toFixed(1)}; received ${String(scorecard.currentScore)}`
  );
}
if (strictFloorRows !== 80) {
  fail(`strict 4.0 floor must contain 80 rows; received ${strictFloorRows}`);
}
if (strongOrLeadingRows !== 81) {
  fail(
    `Strong/Leading classification must contain 81 rows; received ${strongOrLeadingRows}`
  );
}
if (targetPoints !== 1802) {
  fail(`target must reconcile to 1802/1880; received ${targetPoints}/1880`);
}
if (Math.abs(scorecard.targetScore - (targetPoints / 1880) * 100) > 0.05) {
  fail(
    `declared targetScore must reconcile to ${((targetPoints / 1880) * 100).toFixed(1)}; received ${String(scorecard.targetScore)}`
  );
}
for (const [target, expected] of [
  [4, 12],
  [4.5, 15],
  [5, 67]
]) {
  if (targetDistribution.get(target) !== expected) {
    fail(
      `target ${target.toFixed(1)} must contain ${expected} rows; received ${targetDistribution.get(target) ?? 0}`
    );
  }
}

if (errors.length > 0) {
  console.error("Analyst score gate failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Analyst scorecard verified: ${requirements.length}/94 ASV/CTEM rows, ` +
    `${currentPoints}/1880 (${((currentPoints / 1880) * 100).toFixed(1)}%) current, ` +
    `${targetPoints}/1880 (${((targetPoints / 1880) * 100).toFixed(1)}%) target; ` +
    `${strictFloorRows}/94 at the strict 4.0 floor and ${strongOrLeadingRows}/94 Strong/Leading.`
);
