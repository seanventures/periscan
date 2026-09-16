import { z } from "zod";

/**
 * Safety-equivalent specialist packs (PERISCAN-13 Phase C residual).
 *
 * Inventory for scorecard SafetyEquivalent / multi-vector rows that must never
 * ship live ransomware, credential theft, lateral spray, SharpHound, Caldera,
 * or Atomic live inject. Each row maps to bounded safe canaries / plan-only
 * surfaces or an explicit forever-refuse.
 *
 * Scorecard JSON is **not** auto-bumped from this catalog — honest Partial is a
 * matrix / residual-doc claim about the *canary class*, not peer BAS parity.
 */

export const SafetyPackClaimClassSchema = z.enum([
  "benign_marker_only",
  "plan_only",
  "exposure_only",
  "forever_refuse"
]);
export type SafetyPackClaimClass = z.infer<typeof SafetyPackClaimClassSchema>;

export const SafetyPackGateSchema = z.enum(["SafetyEquivalent", "Partner"]);
export type SafetyPackGate = z.infer<typeof SafetyPackGateSchema>;

export const SafetyEquivalentPackSchema = z.object({
  scorecardId: z.number().int().positive(),
  requirement: z.string().min(1),
  /** Current analyst-scorecard verdict (do not invent promotions here). */
  scorecardVerdict: z.enum([
    "Scaffold/gated",
    "Partial",
    "Strong",
    "Leading"
  ]),
  /**
   * Honest matrix-facing status of the *safety substitute* (canary / plan /
   * exposure), never the peer BAS capability name.
   */
  honestSubstituteVerdict: z.enum([
    "Partial",
    "Scaffold",
    "Missing",
    "ForeverRefuse"
  ]),
  claimClass: SafetyPackClaimClassSchema,
  gate: SafetyPackGateSchema,
  safeModules: z.array(z.string().min(1)),
  /** Peer claims that stay refused even if canaries ship. */
  foreverRefuse: z.array(z.string().min(1)),
  /** True when a bounded canary path can justify Partial *substitute* language. */
  canElevateSubstituteToPartial: z.boolean(),
  elevateCriteria: z.string().min(1),
  neverElevateReason: z.string().min(1).optional(),
  safetyNote: z.string().min(1)
});
export type SafetyEquivalentPack = z.infer<typeof SafetyEquivalentPackSchema>;

/**
 * Canonical inventory for SafetyEquivalent rows 16 / 19 / 21 / 22 and
 * Partner-gated siblings 2 / 26 / 28 (Slice C honesty panels).
 *
 * Partner rows stay Scaffold/gated forever without contracted feeds/labs;
 * product ships NotConfigured honesty shells only — never invent live dark-web
 * crawl, OT protocol speak, or crowdsourced pentester marketplaces.
 */
export const SAFETY_EQUIVALENT_PACKS: readonly SafetyEquivalentPack[] = [
  {
    scorecardId: 2,
    requirement: "Dark Web & Credential Monitoring",
    scorecardVerdict: "Scaffold/gated",
    honestSubstituteVerdict: "Scaffold",
    claimClass: "forever_refuse",
    gate: "Partner",
    safeModules: [],
    foreverRefuse: [
      "Live dark-web crawl",
      "Credential theft or bulk credential dump ingestion as product feature",
      "In-product dark-web marketplace substitute without partner contract"
    ],
    canElevateSubstituteToPartial: false,
    elevateCriteria:
      "Only after contracted licensed feed + privacy-preserving match + rotation proof with ops runbook. Until then NotConfigured ExternallyGated shell only.",
    neverElevateReason:
      "No partner feed or k-anonymized credential match is productized. Intel feeds are not dark-web credential monitoring.",
    safetyNote:
      "No live dark-web crawl or credential theft. Partner feed only when contracted; otherwise NotConfigured."
  },
  {
    scorecardId: 16,
    requirement: "Agentless APT Execution",
    scorecardVerdict: "Scaffold/gated",
    honestSubstituteVerdict: "Partial",
    claimClass: "plan_only",
    gate: "SafetyEquivalent",
    safeModules: [
      "exploitation.killchain.engine",
      "periscan.endpoint_benign_marker_emit",
      "periscan.dns_exfil_canary",
      "gitleaks.repo_secrets",
      "web.zap_baseline",
      "prowler.aws_posture"
    ],
    foreverRefuse: [
      "Live multi-stage agentless APT engine",
      "Autonomous exploit chaining",
      "Caldera / Atomic live inject as APT substitute"
    ],
    canElevateSubstituteToPartial: true,
    elevateCriteria:
      "Keep kill-chain as plan-only (measured:false) and document safe-stage hand-offs (Exposure/Detection/Config). Partial substitute = coverage planner + optional safe modules, never live APT execution.",
    neverElevateReason:
      "Live agentless APT / kill-chain execution stays forever refuse under SECURITY_BOUNDARIES.",
    safetyNote:
      "Kill-chain planner and safe exposure modules only. No agentless APT engine, no live multi-stage exploit chain."
  },
  {
    scorecardId: 19,
    requirement: "Data Exfiltration over DNS",
    scorecardVerdict: "Strong",
    honestSubstituteVerdict: "Partial",
    claimClass: "benign_marker_only",
    gate: "SafetyEquivalent",
    safeModules: ["periscan.dns_exfil_canary"],
    foreverRefuse: [
      "Real bulk data exfiltration",
      "Customer data tunneling",
      "Unscoped DNS beacon farms"
    ],
    canElevateSubstituteToPartial: true,
    elevateCriteria:
      "POST control-sources/:id/dns-exfil-canary-proof (or module mission) emits allowlisted canary only; realDataExfiltrated=false; measured only when emit + liveTelemetry; Detected/Missed only with telemetry. Ops + live SIEM correlation can hold Strong/Partial substitute — never real-exfil product.",
    safetyNote:
      "Benign DNS canary (T1048 detection class). No real data leaves authorized scope. Not a multi-vector malware/phishing pack."
  },
  {
    scorecardId: 21,
    requirement: "Ransomware Emulation",
    scorecardVerdict: "Scaffold/gated",
    honestSubstituteVerdict: "ForeverRefuse",
    claimClass: "forever_refuse",
    gate: "SafetyEquivalent",
    safeModules: [
      // Detection-class substitutes only — never impact encryption modules.
      "periscan.endpoint_benign_marker_emit",
      "periscan.detection_marker_emit_observe"
    ],
    foreverRefuse: [
      "Live ransomware encryption",
      "Mass file lock / shadow-copy delete",
      "Encryption simulation packs that claim ransomware emulation"
    ],
    canElevateSubstituteToPartial: false,
    elevateCriteria:
      "Do not elevate row 21 to Partial/Strong as ransomware emulation. Optional Partial language is only for *detection canary class* (endpoint/process marker), never impact (T1486).",
    neverElevateReason:
      "T1486 Impact (ransomware) is permanently Forbidden in SAFE_STAGE_PLAYBOOKS (safeLiveModuleId null). Safety floor forever.",
    safetyNote:
      "Impact stage is a permanent safety-floor null. No live crypto, mass lock, or shadow-copy delete. Detection canary path only when qualified — never sold as ransomware emulation."
  },
  {
    scorecardId: 22,
    requirement: "Identity Abuse & Credential Harvesting",
    scorecardVerdict: "Scaffold/gated",
    honestSubstituteVerdict: "Partial",
    claimClass: "exposure_only",
    gate: "SafetyEquivalent",
    safeModules: [
      "gitleaks.repo_secrets",
      "identity.cred_spray",
      "kerberos_userenum",
      "bloodhound.identity_pathing"
    ],
    foreverRefuse: [
      "Live credential spray / brute force",
      "Token theft / credential dumping",
      "Privilege abuse live modules",
      "SharpHound collector in product"
    ],
    canElevateSubstituteToPartial: true,
    elevateCriteria:
      "Partial substitute = secrets exposure (gitleaks) + dry-run/fixture identity modules with liveSupported:false and measured:false on non-live paths. Never elevate via live spray or harvest.",
    neverElevateReason:
      "identity.cred_spray and related modules stay liveSupported:false; live authentication attempts hard-disabled.",
    safetyNote:
      "Synthetic / fixture identity exposure checks only. No credential harvesting, token theft, or privilege abuse live modules."
  },
  {
    scorecardId: 26,
    requirement: "OT/ICS Attack Packs",
    scorecardVerdict: "Scaffold/gated",
    honestSubstituteVerdict: "Scaffold",
    claimClass: "forever_refuse",
    gate: "Partner",
    safeModules: ["ot_ics.protocol_exposure"],
    foreverRefuse: [
      "Live OT/ICS attack pack claiming Validated without partner-lab qualification",
      "Active Modbus/DNP3/S7comm protocol speak or adversarial OT traffic",
      "Disruption of industrial control systems"
    ],
    canElevateSubstituteToPartial: false,
    elevateCriteria:
      "Partner-lab qualification receipt + passive-only measured evidence. Passive port classification (ot_ics.protocol_exposure) is exposure-only and never Validated OT attack.",
    neverElevateReason:
      "Product never speaks industrial protocols. Fixture OT baseline is Inconclusive, not measured attack pack proof.",
    safetyNote:
      "Passive port classification scaffold only. Never speaks OT protocols. Partner-lab qualification required before any Validated OT claim."
  },
  {
    scorecardId: 28,
    requirement: "Crowdsourced Human-in-the-Loop",
    scorecardVerdict: "Scaffold/gated",
    honestSubstituteVerdict: "Scaffold",
    claimClass: "forever_refuse",
    gate: "Partner",
    safeModules: [],
    foreverRefuse: [
      "Crowdsourced pentester marketplace product launch",
      "Internal approvals presented as external HITL crowd network",
      "Unvetted operator roster without partner contract"
    ],
    canElevateSubstituteToPartial: false,
    elevateCriteria:
      "Contracted human-validation partner + identity-bound evidence handoff + scope acknowledgement. Programmatic HITL interrupts (row 42) are a separate product path.",
    neverElevateReason:
      "No crowdsourced marketplace is productized. Do not rebrand internal approval workflows as crowd HITL.",
    safetyNote:
      "No crowdsourced pentester marketplace. HITL remains partner-gated engagement design, not a product launch surface."
  }
] as const;

export function listSafetyEquivalentPacks(): SafetyEquivalentPack[] {
  return SAFETY_EQUIVALENT_PACKS.map((pack) =>
    SafetyEquivalentPackSchema.parse(pack)
  );
}

export function getSafetyEquivalentPack(
  scorecardId: number
): SafetyEquivalentPack | undefined {
  return SAFETY_EQUIVALENT_PACKS.find((p) => p.scorecardId === scorecardId);
}

/** Packs that may honestly use Partial *substitute* language (not peer BAS). */
export function listPartialEligibleSafetyPacks(): SafetyEquivalentPack[] {
  return SAFETY_EQUIVALENT_PACKS.filter((p) => p.canElevateSubstituteToPartial);
}

/** Packs that must never be sold as the peer capability (forever refuse core). */
export function listForeverRefuseSafetyPacks(): SafetyEquivalentPack[] {
  return SAFETY_EQUIVALENT_PACKS.filter(
    (p) =>
      p.claimClass === "forever_refuse" ||
      p.honestSubstituteVerdict === "ForeverRefuse"
  );
}

/** Partner-gated scorecard shells (dark web / OT / crowd HITL). */
export function listPartnerGatedPacks(): SafetyEquivalentPack[] {
  return SAFETY_EQUIVALENT_PACKS.filter((p) => p.gate === "Partner");
}

/**
 * SafetyEquivalent gate packs only (rows 16 / 19 / 21 / 22).
 * Partner rows (2 / 26 / 28) are excluded.
 */
export function listSafetyEquivalentGatePacks(): SafetyEquivalentPack[] {
  return SAFETY_EQUIVALENT_PACKS.filter((p) => p.gate === "SafetyEquivalent");
}

/**
 * Slice D scaffold core: APT (16) / ransomware (21) / identity (22).
 * DNS canary (19) is Strong and not a scaffold core row.
 */
export const SAFETY_SCAFFOLD_CORE_SCORECARD_IDS = [16, 21, 22] as const;

export function listSafetyScaffoldCorePacks(): SafetyEquivalentPack[] {
  return SAFETY_SCAFFOLD_CORE_SCORECARD_IDS.map((id) => {
    const pack = getSafetyEquivalentPack(id);
    if (!pack) {
      throw new Error(`Missing safety scaffold core pack for scorecard #${id}`);
    }
    return pack;
  });
}

/** UI scaffold table: every inventory row still Scaffold/gated (excludes #19 Strong). */
export function listScaffoldGatedPacks(): SafetyEquivalentPack[] {
  return SAFETY_EQUIVALENT_PACKS.filter(
    (p) => p.scorecardVerdict === "Scaffold/gated"
  );
}

export const SafetyEquivalentPacksResponseSchema = z.object({
  packs: z.array(SafetyEquivalentPackSchema).min(1),
  partnerGatedScorecardIds: z.array(z.number().int().positive()),
  /** SafetyEquivalent gate only — 16, 19, 21, 22. */
  safetyEquivalentScorecardIds: z.array(z.number().int().positive()),
  /**
   * Scaffold core for Slice D honesty — APT plan-only, ransomware forever refuse,
   * identity exposure-only (16 / 21 / 22).
   */
  scaffoldCoreScorecardIds: z.array(z.number().int().positive()),
  note: z.string().min(1)
});
export type SafetyEquivalentPacksResponse = z.infer<
  typeof SafetyEquivalentPacksResponseSchema
>;

export function buildSafetyEquivalentPacksResponse(): SafetyEquivalentPacksResponse {
  const packs = listSafetyEquivalentPacks();
  return {
    packs,
    partnerGatedScorecardIds: packs
      .filter((p) => p.gate === "Partner")
      .map((p) => p.scorecardId),
    safetyEquivalentScorecardIds: packs
      .filter((p) => p.gate === "SafetyEquivalent")
      .map((p) => p.scorecardId),
    scaffoldCoreScorecardIds: [...SAFETY_SCAFFOLD_CORE_SCORECARD_IDS],
    note: "Safety-equivalent + partner-gated inventory. Scorecard Scaffold/gated rows stay gated until blind rescore. Canary/plan/exposure substitutes never authorize live ransomware, credential theft, SharpHound, Caldera, or Atomic live inject. Scaffold core 16=plan_only APT, 21=forever_refuse ransomware impact, 22=exposure_only identity. Partner rows (2/26/28) stay NotConfigured ExternallyGated without contracted feeds/labs."
  };
}
