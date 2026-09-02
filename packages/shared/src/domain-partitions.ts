/**
 * P09-16 — Enum accretion partition laws
 * --------------------------------------
 * domain.ts holds ~100+ z.enums. Accretion without partition-by-question-kind
 * is how ValidationState / Fixed token collisions happen.
 *
 * This module does NOT rewrite domain.ts wholesale (that is a multi-PR migrate).
 * It codifies the partition map and PR gate so new status enums declare:
 * 1. Which ontology Law they serve (or "platform" / "billing" if none)
 * 2. Which existing enum they do **not** duplicate
 *
 * Prefer placing new enums in the owning partition module below when extracting.
 */

import type { OntologyLawId } from "./ontology-laws";

/** Product coordinate partitions for domain enums. */
export const DOMAIN_ENUM_PARTITIONS = [
  "risk",
  "execution",
  "platform",
  "billing",
  "identity",
  "integrations",
  "ai_model",
  "threat",
  "evidence"
] as const;

export type DomainEnumPartition = (typeof DOMAIN_ENUM_PARTITIONS)[number];

/**
 * Target module path for each partition (extraction destination).
 * Until files exist, new enums may still land in domain.ts **if** they register
 * here and pass ENUM_ACCRETION_PR_CHECKLIST.
 */
export const DOMAIN_PARTITION_MODULES: Record<DomainEnumPartition, string> = {
  risk: "packages/shared/src/domain/risk.ts",
  execution: "packages/shared/src/domain/execution.ts",
  platform: "packages/shared/src/domain/platform.ts",
  billing: "packages/shared/src/domain/billing.ts",
  identity: "packages/shared/src/domain/identity.ts",
  integrations: "packages/shared/src/domain/integrations.ts",
  ai_model: "packages/shared/src/domain/ai-model.ts",
  threat: "packages/shared/src/domain/threat.ts",
  evidence: "packages/shared/src/domain/evidence.ts"
};

export type DomainEnumRegistration = {
  /** Enum export name, e.g. ValidationStateSchema */
  name: string;
  partition: DomainEnumPartition;
  /**
   * Ontology law this status enum serves, or null when the enum is pure
   * platform/billing plumbing (membership roles, invoice states, …).
   */
  law: OntologyLawId | null;
  /**
   * Explicit non-duplication: status tokens that must NOT be reintroduced
   * under a different name, or sibling enums this must not shadow.
   */
  doesNotDuplicate: readonly string[];
  /** One-line purpose for schema PR review. */
  purpose: string;
};

/**
 * Seed registry of high-risk status enums. Extend when adding a new status
 * enum — not every z.enum needs a row (closed type catalogs are fine).
 */
export const DOMAIN_STATUS_ENUM_REGISTRY: readonly DomainEnumRegistration[] = [
  {
    name: "ValidationStateSchema",
    partition: "risk",
    law: "language",
    doesNotDuplicate: [
      "RemediationStatusSchema",
      "VerifiedFindingStatus",
      "ExposureStatusSchema"
    ],
    purpose:
      "Path/finding certainty + control observation spine; Fixed only after verification (Law 4)."
  },
  {
    name: "RemediationStatusSchema",
    partition: "risk",
    law: "closure",
    doesNotDuplicate: ["ValidationStateSchema", "VerificationOutcomeSchema"],
    purpose: "Remediation work-queue state; Fixed requires VerificationEvent."
  },
  {
    name: "VerificationOutcomeSchema",
    partition: "risk",
    law: "closure",
    doesNotDuplicate: ["RemediationStatusSchema", "ValidatedFindingStatusSchema"],
    purpose: "Measured retest outcome only — sole Fixed authority."
  },
  {
    name: "ValidatedFindingStatusSchema",
    partition: "risk",
    law: "closure",
    doesNotDuplicate: ["FindingDispositionSchema", "RemediationStatusSchema"],
    purpose: "Finding projection lifecycle; Fixed only with linked verification."
  },
  {
    name: "FindingDispositionSchema",
    partition: "risk",
    law: "closure",
    doesNotDuplicate: ["ValidatedFindingStatusSchema"],
    purpose: "Analyst disposition overlay — must never include Fixed."
  },
  {
    name: "MissionStatusSchema",
    partition: "execution",
    law: "authorization",
    doesNotDuplicate: ["RunStatusSchema", "RunnerTaskStatusSchema"],
    purpose: "Validation mission control-plane state machine."
  },
  {
    name: "RunStatusSchema",
    partition: "execution",
    law: "authorization",
    doesNotDuplicate: ["MissionStatusSchema", "RunnerTaskStatusSchema"],
    purpose: "Single validation run execution state."
  },
  {
    name: "RunnerTaskStatusSchema",
    partition: "execution",
    law: "authorization",
    doesNotDuplicate: ["RunStatusSchema", "MissionStatusSchema"],
    purpose: "Internal runner task lease lifecycle."
  },
  {
    name: "RunnerStatusSchema",
    partition: "execution",
    law: null,
    doesNotDuplicate: ["RunnerFleetHealthStateSchema"],
    purpose: "Runner agent online/control-plane status."
  },
  {
    name: "MembershipRoleSchema",
    partition: "platform",
    law: null,
    doesNotDuplicate: ["ProductPersonaSchema"],
    purpose: "Tenant RBAC roles — not product persona marketing labels."
  },
  {
    name: "SubscriptionStatusSchema",
    partition: "billing",
    law: null,
    doesNotDuplicate: ["MissionStatusSchema"],
    purpose: "Commercial subscription lifecycle only."
  }
] as const;

/** Human + test gate for schema PRs that add status enums. */
export const ENUM_ACCRETION_PR_CHECKLIST = [
  "Declare partition (risk | execution | platform | billing | …) for every new status enum.",
  "Declare which Ontology Law the enum serves, or explicitly law: null for platform/billing.",
  "List which existing enums this does **not** duplicate (especially Fixed / Validated / Open).",
  "Do not introduce a new top-level lifecycle peer of ValidationState without a partition plan.",
  "Prefer DOMAIN_PARTITION_MODULES destination over further domain.ts growth when extracting.",
  "Risk graph coordinates use RiskRelatedEntityType only (see related-entity-partitions.ts)."
] as const;

export function findStatusEnumRegistration(
  name: string
): DomainEnumRegistration | undefined {
  return DOMAIN_STATUS_ENUM_REGISTRY.find((row) => row.name === name);
}

export function listStatusEnumsForPartition(
  partition: DomainEnumPartition
): DomainEnumRegistration[] {
  return DOMAIN_STATUS_ENUM_REGISTRY.filter((row) => row.partition === partition);
}
