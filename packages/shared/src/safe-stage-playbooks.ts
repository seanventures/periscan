/**
 * Technique-mapped safe-stage playbooks (P05-17).
 *
 * Ethical kill-chain productization: every ATT&CK technique maps to a
 * *measurement class*, not an attack action. Forbidden classes never get a
 * default module. Allowed classes name one default safe module and honest
 * success criteria so purple-team checklists never impersonate live APT.
 */

export const MEASUREMENT_CLASSES = [
  "Exposure",
  "Detection",
  "Config",
  "Forbidden"
] as const;

export type MeasurementClass = (typeof MEASUREMENT_CLASSES)[number];

export const SAFE_STAGE_OUTCOMES = [
  "Validated",
  "Detected",
  "Missed",
  "Inconclusive",
  "Blocked",
  "NotAttempted"
] as const;

export type SafeStageOutcome = (typeof SAFE_STAGE_OUTCOMES)[number];

export interface SafeStagePlaybook {
  /** MITRE technique id (e.g. T1110). */
  techniqueId: string;
  /** Human stage name used in coverage planners. */
  stage: string;
  /** What kind of proof Periscan may produce for this technique. */
  measurementClass: MeasurementClass;
  /**
   * Default safe module when measurementClass is not Forbidden.
   * Null for Forbidden (human red-team handoff only).
   */
  defaultModuleId: string | null;
  /** Short operator-facing playbook title. */
  playbookTitle: string;
  /** What we prove vs refuse. */
  playbookSummary: string;
  /** Outcomes operators may honestly claim after the module runs. */
  successCriteria: SafeStageOutcome[];
  /** Explicit refusal text for Forbidden or partial stages. */
  refusalNote?: string;
}

/**
 * Canonical ATT&CK → measurement class table used by kill-chain coverage
 * planning, engagement handoff reports, and technique catalog UI.
 */
export const SAFE_STAGE_PLAYBOOKS: readonly SafeStagePlaybook[] = [
  {
    techniqueId: "T1110",
    stage: "Credential access",
    measurementClass: "Exposure",
    defaultModuleId: "gitleaks.repo_secrets",
    playbookTitle: "Prove credential *exposure* in repos",
    playbookSummary:
      "Scan authorized repositories for leaked secrets. Does not simulate credential dumping or password spraying.",
    successCriteria: ["Validated", "Inconclusive", "Missed"],
    refusalNote:
      "T1110 attack actions (spray, brute force, hash dump) are Forbidden. Schedule human RT for live credential abuse."
  },
  {
    techniqueId: "T1021",
    stage: "Lateral movement",
    measurementClass: "Forbidden",
    defaultModuleId: null,
    playbookTitle: "Lateral movement — not productized",
    playbookSummary:
      "No safe live module. Path hop probes may measure reachability edges, not RDP/SMB abuse.",
    successCriteria: ["NotAttempted"],
    refusalNote:
      "Live lateral movement is Forbidden. Use measured hop reachability + human RT for protocol abuse."
  },
  {
    techniqueId: "T1068",
    stage: "Privilege escalation",
    measurementClass: "Forbidden",
    defaultModuleId: null,
    playbookTitle: "Privilege escalation — not productized",
    playbookSummary: "No safe live module for privilege escalation exploits.",
    successCriteria: ["NotAttempted"],
    refusalNote: "Privilege escalation exploits stay on the safety floor."
  },
  {
    techniqueId: "T1543",
    stage: "Persistence",
    measurementClass: "Forbidden",
    defaultModuleId: null,
    playbookTitle: "Persistence — not productized",
    playbookSummary: "No persistence implant or service-creation modules.",
    successCriteria: ["NotAttempted"],
    refusalNote: "Persistence techniques are Forbidden in product modules."
  },
  {
    techniqueId: "T1041",
    stage: "Exfiltration",
    measurementClass: "Detection",
    defaultModuleId: "periscan.dns_exfil_canary",
    playbookTitle: "DNS exfil canary (detection observe)",
    playbookSummary:
      "Emit a bounded DNS canary to test whether controls observe or block the marker — not real data exfiltration.",
    successCriteria: ["Detected", "Blocked", "Missed", "Inconclusive"],
    refusalNote:
      "Real bulk exfiltration is Forbidden. Canary only, authorized scope only."
  },
  {
    techniqueId: "T1486",
    stage: "Impact (ransomware)",
    measurementClass: "Forbidden",
    defaultModuleId: null,
    playbookTitle: "Ransomware impact — never implemented",
    playbookSummary:
      "No ransomware encryption, encryption simulation, or impact pack.",
    successCriteria: ["NotAttempted"],
    refusalNote:
      "Ransomware impact is permanently Forbidden. Detection canaries may exist separately; never claim ransomware emulation."
  },
  {
    techniqueId: "T1484",
    stage: "Domain compromise",
    measurementClass: "Forbidden",
    defaultModuleId: null,
    playbookTitle: "Domain compromise — not productized",
    playbookSummary: "No domain-controller attack modules.",
    successCriteria: ["NotAttempted"],
    refusalNote: "Domain compromise techniques are Forbidden."
  },
  {
    techniqueId: "T1190",
    stage: "Web/API exploitation",
    measurementClass: "Exposure",
    defaultModuleId: "web.zap_baseline",
    playbookTitle: "Prove web/API *exposure* (baseline)",
    playbookSummary:
      "Safe ZAP baseline against authorized targets. Not weaponized exploit chaining.",
    successCriteria: ["Validated", "Inconclusive", "Missed"]
  },
  {
    techniqueId: "T1611",
    stage: "Cloud escape",
    measurementClass: "Config",
    defaultModuleId: "prowler.aws_posture",
    playbookTitle: "Prove cloud posture / escape *config* exposure",
    playbookSummary:
      "Prowler posture scan on authorized cloud accounts. Does not execute container or hypervisor escape.",
    successCriteria: ["Validated", "Inconclusive", "Missed"],
    refusalNote:
      "Live cloud escape exploits are Forbidden; config exposure only."
  },
  {
    techniqueId: "T1606",
    stage: "Identity forgery",
    measurementClass: "Forbidden",
    defaultModuleId: null,
    playbookTitle: "Identity forgery — not productized",
    playbookSummary: "No token forgery or federation abuse modules.",
    successCriteria: ["NotAttempted"],
    refusalNote: "Identity forgery is Forbidden."
  },
  {
    techniqueId: "T1552",
    stage: "Unsecured credentials",
    measurementClass: "Exposure",
    defaultModuleId: "gitleaks.repo_secrets",
    playbookTitle: "Prove unsecured credential exposure",
    playbookSummary:
      "Secrets discovery in authorized code and config — not credential theft.",
    successCriteria: ["Validated", "Inconclusive", "Missed"]
  },
  {
    techniqueId: "T1078",
    stage: "Valid accounts",
    measurementClass: "Config",
    defaultModuleId: null,
    playbookTitle: "Valid accounts — inventory only",
    playbookSummary:
      "No password-use simulation. Identity connectors may inventory accounts; attack use is Forbidden.",
    successCriteria: ["Inconclusive", "NotAttempted"],
    refusalNote:
      "Using valid accounts for access is Forbidden. Inventory and config exposure only."
  },
  {
    techniqueId: "T1562",
    stage: "Impair defenses",
    measurementClass: "Detection",
    defaultModuleId: "periscan.endpoint_benign_marker_emit",
    playbookTitle: "Benign marker for defense observation",
    playbookSummary:
      "Emit a benign endpoint marker so SIEM/EDR observation can be checked. Does not disable defenses.",
    successCriteria: ["Detected", "Blocked", "Missed", "Inconclusive"],
    refusalNote: "Disabling or impairing defenses is Forbidden."
  }
] as const;

export function getSafeStagePlaybook(
  techniqueId: string
): SafeStagePlaybook | undefined {
  return SAFE_STAGE_PLAYBOOKS.find((p) => p.techniqueId === techniqueId);
}

export function listExecutableSafeStages(): SafeStagePlaybook[] {
  return SAFE_STAGE_PLAYBOOKS.filter(
    (p) => p.measurementClass !== "Forbidden" && p.defaultModuleId !== null
  );
}

export function listForbiddenSafeStages(): SafeStagePlaybook[] {
  return SAFE_STAGE_PLAYBOOKS.filter((p) => p.measurementClass === "Forbidden");
}

/** Human RT handoff summary for engagement reports. */
export function buildSafeStageHandoffSummary(input: {
  provedTechniqueIds?: string[];
  targetLabel?: string;
}): {
  proved: SafeStagePlaybook[];
  notAttempted: SafeStagePlaybook[];
  summary: string;
} {
  const provedIds = new Set(input.provedTechniqueIds ?? []);
  const proved = SAFE_STAGE_PLAYBOOKS.filter((p) =>
    provedIds.has(p.techniqueId)
  );
  const notAttempted = SAFE_STAGE_PLAYBOOKS.filter(
    (p) =>
      !provedIds.has(p.techniqueId) &&
      (p.measurementClass === "Forbidden" || p.defaultModuleId === null)
  );
  const target = input.targetLabel ?? "authorized scope";
  const summary = [
    `Safe-stage coverage for ${target}:`,
    proved.length
      ? `we measured ${proved.length} technique(s) with exposure/detection/config modules`
      : "no techniques marked measured yet",
    notAttempted.length
      ? `we did not attempt ${notAttempted.length} Forbidden/unimplemented technique(s) — schedule human RT`
      : "no Forbidden residual stages in this table"
  ].join("; ");
  return { proved, notAttempted, summary };
}
