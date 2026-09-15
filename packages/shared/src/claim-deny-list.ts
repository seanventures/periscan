import { z } from "zod";

/**
 * Productized claim-language deny list (P19-20).
 *
 * Shared contract for GTM, product-help, SE enablement, and schema/API honesty
 * gates. Engineering claim-language (paths/Fixed) is stronger; this catalog is
 * the customer-facing "what we never claim" surface so wartime demos and RFP
 * answers cannot invent peer-category language.
 *
 * Buckets:
 * - prove: claims backed by measured product behavior
 * - integrate: claims that require co-existence with peer tools
 * - refuse: never claim — hard deny phrases for sales/docs/UI
 */

export const ClaimLanguageBucketSchema = z.enum([
  "prove",
  "integrate",
  "refuse"
]);
export type ClaimLanguageBucket = z.infer<typeof ClaimLanguageBucketSchema>;

export const ClaimLanguageEntrySchema = z.object({
  bucket: ClaimLanguageBucketSchema,
  /** Short stable id for tests and enablement checklists. */
  id: z.string().min(1),
  /** Allowed phrasing for prove/integrate; forbidden phrasing for refuse. */
  phrase: z.string().min(1),
  /** Operator-facing rationale (why this is allowed or refused). */
  rationale: z.string().min(1)
});
export type ClaimLanguageEntry = z.infer<typeof ClaimLanguageEntrySchema>;

/**
 * Canonical deny / prove / integrate catalog. Keep in sync with
 * docs/competitive/POSITIONING.md and product-help caution language.
 */
export const CLAIM_LANGUAGE_CATALOG: readonly ClaimLanguageEntry[] = [
  {
    bucket: "prove",
    id: "measured-vs-heuristic",
    phrase: "Measured vs Heuristic path labels with hop receipts",
    rationale:
      "Path certainty follows weakest-hop evidence; risk severity never upgrades certainty."
  },
  {
    bucket: "prove",
    id: "fixed-only-after-retest",
    phrase: "Fixed only after measured re-validation",
    rationale:
      "Remediation Fixed requires a verification event; ticket close alone is ClosedWithoutEvidence."
  },
  {
    bucket: "prove",
    id: "policy-denied-never-queued",
    phrase: "Denied tasks are never queued",
    rationale:
      "Policy gate Denied fails closed before mission/job queue; webhook policy.denied emits on deny paths."
  },
  {
    bucket: "prove",
    id: "aev-ctem-proof-layer",
    phrase: "AEV / CTEM proof layer on authorized scope",
    rationale:
      "Category home is continuous exposure validation and proof, not a peer scenario-library BAS."
  },
  {
    bucket: "prove",
    id: "tee-customer-attestation-qualify",
    phrase: "Qualify customer TEE/H100 attestation evidence",
    rationale:
      "Verifier-not-host: Periscan seals requirement → receipt → decision against customer-supplied evidence; it does not provision or run enclave/H100 workloads."
  },
  {
    bucket: "integrate",
    id: "cnapp-coexist",
    phrase: "Co-exist with CNAPP (e.g. Wiz) — do not replace",
    rationale: "Cloud graph depth is integrate-not-replace; connectors are read-only posture signals."
  },
  {
    bucket: "integrate",
    id: "rbvm-coexist",
    phrase: "Co-exist with RBVM (e.g. Tenable) — validation layer on top",
    rationale: "Prioritization consumes findings; Periscan does not claim full RBVM inventory parity."
  },
  {
    bucket: "integrate",
    id: "bas-library-partner",
    phrase: "Partner or walk on full multi-vector BAS library RFPs",
    rationale:
      "Cymulate/AttackIQ-class scenario libraries are not a Periscan home category."
  },
  {
    bucket: "refuse",
    id: "full-bas-peer",
    phrase: "Full multi-vector BAS platform like Cymulate/AttackIQ",
    rationale:
      "Atomic is dry-run/import; control inject is hard-disabled; ransomware/kill-chain stages are plan-only scaffolds."
  },
  {
    bucket: "refuse",
    id: "live-ransomware-emulation",
    phrase: "Live ransomware encryption / mass file lock emulation",
    rationale:
      "Safety floor forever: no live crypto, shadow-copy delete, or mass lock. Scaffold only until a detection canary exists."
  },
  {
    bucket: "refuse",
    id: "live-kill-chain-engine",
    phrase: "Live kill-chain / APT execution engine",
    rationale:
      "exploitation.killchain.engine is a coverage planner; most stages have null safeLiveModuleId."
  },
  {
    bucket: "refuse",
    id: "dora-compliant-certificate",
    phrase: "We make you DORA/NIS2/PCI/ISO certified",
    rationale:
      "Compliance packs attach measured evidence to framework claims; they are not certification, not an audit opinion, and not control-catalog substitutes."
  },
  {
    bucket: "refuse",
    id: "compliance-audit-opinion",
    phrase: "Compliance pack is a formal audit opinion or certification",
    rationale:
      "Wave G2: every pack disclaimer is customer evidence support only — not certification / not audit opinion."
  },
  {
    bucket: "refuse",
    id: "tee-enclave-host",
    phrase: "We run your agents inside a TEE/enclave or host H100 confidential compute",
    rationale:
      "Wave I5 claim freeze: Periscan qualifies customer attestation evidence only; it is not the TEE/H100 host."
  },
  {
    bucket: "refuse",
    id: "cnapp-replacement",
    phrase: "Replace your CNAPP / cloud security graph",
    rationale: "Integrate Wiz-class signals; never sell as CNAPP peer."
  },
  {
    bucket: "refuse",
    id: "rbvm-replacement",
    phrase: "Replace your vulnerability management platform",
    rationale: "Validation and proof layer on top of RBVM inventories."
  },
  {
    bucket: "refuse",
    id: "auto-pentest-peer",
    phrase: "Autonomous red team / full auto-pentest peer",
    rationale:
      "Safety floor refuses live offensive chaining; complement human red team with continuous proof of cheap links."
  },
  {
    bucket: "refuse",
    id: "scorecard-leading-export",
    phrase: "Export internal scorecard Leading rows as external capability claims",
    rationale:
      "analyst-scorecard.json is an engineering index; external language follows COMPETITIVE_COVERAGE_MATRIX Fully-E2E/Partial/Scaffold only."
  },
  {
    bucket: "refuse",
    id: "leading-on-partial",
    phrase: "Leading on Partial or Scaffold matrix rows",
    rationale:
      "External Leading only after matrix Fully-E2E + score-gate allowlist (11,13,24,69,90,91) + blind rescore. Partial/Scaffold never sells as Leading."
  },
  {
    bucket: "refuse",
    id: "auto-mitigate-control-push",
    phrase: "Auto-mitigate as control push / firewall or policy push",
    rationale:
      "Product auto-revalidates; no config change is pushed. Prefer auto-revalidate language until an approved control-push path ships."
  },
  {
    bucket: "refuse",
    id: "tee-execution-host",
    phrase: "We run your agents / workloads inside a TEE or confidential enclave",
    rationale:
      "Periscan qualifies customer-supplied TEE/H100 attestation evidence (verifier); it does not provision or host confidential compute."
  },
  {
    bucket: "refuse",
    id: "ray-as-shipped",
    phrase: "Ray cluster scaling shipped / Ray as a product runtime",
    rationale:
      "Matrix #99 Ray is Absent / platform-adjacency only; core async workers are not a Ray product claim. Wave K freeze."
  },
  {
    bucket: "refuse",
    id: "fabricated-customer-refs",
    phrase:
      "Named customer references, logo walls, case studies, or ARR theater without written consent",
    rationale:
      "P12-6 / P08-2 / P13-1: publicReferenceCount is zero until a real consent ledger exists. Never invent logos, Fortune claims, anonymized F500 fiction, or fake ARR."
  },
  {
    bucket: "refuse",
    id: "mq-leaders-ready-zero-refs",
    phrase:
      "Magic Quadrant / Forrester Wave Leaders-ready or market-presence Pass with zero customer references",
    rationale:
      "Zero named refs = MQ market presence Fail and not Leaders-ready. Internal scorecard % is not Wave/MQ progress (scoreGovernance.isMagicQuadrantProgress=false)."
  },
  {
    bucket: "refuse",
    id: "demo-as-customer-proof",
    phrase:
      "Treat demo tenants, lab E2E, seed fixtures, or sample /demo reports as customer references",
    rationale:
      "Reference pack G0: sample and lab paths are labeled proof only. They never fill Wave/MQ reference inventory."
  },
  {
    bucket: "refuse",
    id: "self-serve-card-checkout",
    phrase:
      "Self-serve card checkout / live payment processor while paymentProcessorStatus is NotConfigured",
    rationale:
      "PERISCAN-469: billing is a usage/entitlement ledger only. Schema hardcodes paymentProcessorStatus NotConfigured — sales-led invoice / approval-reference until a real processor path ships."
  },
  {
    bucket: "refuse",
    id: "live-public-marketplace-without-ops",
    phrase:
      "Live / public AWS Marketplace listing without ops-attested Public state",
    rationale:
      "PERISCAN-469: product code or IntegrationReady never proves public listing. Public requires LISTING_STATE=Public plus PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN; never invent marketplace listing URLs."
  },
  {
    bucket: "refuse",
    id: "scim-production-inbound",
    phrase:
      "Inbound SCIM 2.0 for Periscan users is Production / shipped / full IdP lifecycle",
    rationale:
      "PERISCAN-30: identityProvisioning.scimInbound.status is NotConfigured; /api/v1/scim/v2/* returns 501 stubs. CyberArk SCIM is read-only inventory only. Plane is Partial (SSO/MFA/role map) — never claim SCIM Production."
  },
  {
    bucket: "refuse",
    id: "vendor-soc2-type-ii-claimed",
    phrase:
      "Vendor SOC 2 Type II certified / product packs equal Type II attestation",
    rationale:
      "PERISCAN-30: vendorAssurance.soc2TypeIiStatus defaults None; customer evidence packs are not Periscan vendor Type II. No fake Type II reports or bridge letters."
  }
] as const;

export const ClaimLanguageCatalogSchema = z
  .array(ClaimLanguageEntrySchema)
  .min(1);

export function listClaimLanguageByBucket(
  bucket: ClaimLanguageBucket
): ClaimLanguageEntry[] {
  return CLAIM_LANGUAGE_CATALOG.filter((entry) => entry.bucket === bucket);
}

export function listRefusedClaimPhrases(): string[] {
  return listClaimLanguageByBucket("refuse").map((entry) => entry.phrase);
}

export function isRefusedClaimPhrase(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return listRefusedClaimPhrases().some((phrase) => {
    const refused = phrase.toLowerCase();
    // Full catalog phrase in text, or a long enough SE paraphrase of the phrase.
    return (
      normalized.includes(refused) ||
      (normalized.length >= 16 && refused.includes(normalized))
    );
  });
}

/** Five Laws of product ontology (P09-17) — machine-checkable acceptance gates. */
export const ONTOLOGY_LAWS = [
  {
    id: "L1-spine-entities",
    law: "No new top-level entity that restates Asset, Signal, Path, Finding, or Evidence without a reduction rule.",
    gate: "Schema and API reviews reject parallel inventories that re-export spine concepts under new names."
  },
  {
    id: "L2-state-partitions",
    law: "No new state enum that overlaps ValidationState without an explicit partition plan.",
    gate: "FindingDisposition never includes Fixed; path certainty states are claim-gated."
  },
  {
    id: "L3-fixed-only-verification",
    law: "Fixed only via verification evidence (measured re-validation).",
    gate: "assertRemediationFixedOnlyViaVerification; ticket close cannot mint Fixed."
  },
  {
    id: "L4-score-composition",
    law: "Every score cites a composition law; risk severity never upgrades evidence certainty.",
    gate: "deriveAttackPathClaim + risk summary builders refuse certainty upgrades from band alone."
  },
  {
    id: "L5-pillars-not-missions",
    law: "Pillars and tags are not new mission types; nav jobs map to spine work, not feature zoo routes.",
    gate: "MissionType additions require proof-loop necessity; Labs hide theater surfaces."
  }
] as const;

export type OntologyLaw = (typeof ONTOLOGY_LAWS)[number];
