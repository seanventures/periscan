import { z } from "zod";

/**
 * High-danger BAS/AEV catalog (T1486, unscoped spray, credential harvest,
 * ransomware impact). These are productized in their own section — not
 * Community default start, not unmarked, not forever hidden.
 *
 * Start still requires: verified scope + policy Allowed + qualification +
 * tenant authorization + explicit danger acknowledgement. Denied starts
 * never queue.
 */

export const DangerClassSchema = z.enum([
  "ransomware_impact",
  "unscoped_spray",
  "credential_harvest",
  "kill_chain_impact",
  "persistence",
  "metasploit_payload"
]);
export type DangerClass = z.infer<typeof DangerClassSchema>;

export const DangerCatalogEntrySchema = z.object({
  dangerClass: DangerClassSchema,
  description: z.string().min(1),
  moduleId: z.string().min(1),
  section: z.literal("High danger"),
  techniqueId: z.string().min(1),
  title: z.string().min(1)
});
export type DangerCatalogEntry = z.infer<typeof DangerCatalogEntrySchema>;

export const DANGER_CATALOG: readonly DangerCatalogEntry[] = [
  {
    dangerClass: "ransomware_impact",
    description:
      "T1486 impact-class validation. Extra danger acknowledgement required. Not Community default start.",
    moduleId: "exploitation.impact_t1486",
    section: "High danger",
    techniqueId: "T1486",
    title: "Ransomware / impact (T1486)"
  },
  {
    dangerClass: "unscoped_spray",
    description:
      "Credential spray beyond owned-account allowlist. Extra danger acknowledgement required. Not Community default start.",
    moduleId: "identity.cred_spray",
    section: "High danger",
    techniqueId: "T1110",
    title: "Unscoped credential spray"
  },
  {
    dangerClass: "credential_harvest",
    description:
      "Credential harvest / dumping class. Extra danger acknowledgement required. Not Community default start.",
    moduleId: "identity.credential_harvest",
    section: "High danger",
    techniqueId: "T1003",
    title: "Credential harvest"
  },
  {
    dangerClass: "kill_chain_impact",
    description:
      "Kill-chain impact stage. Extra danger acknowledgement required. Not Community default start.",
    moduleId: "exploitation.killchain.engine",
    section: "High danger",
    techniqueId: "T1486",
    title: "Kill-chain impact"
  },
  {
    dangerClass: "persistence",
    description:
      "Persistence-class validation. Extra danger acknowledgement required. Not Community default start.",
    moduleId: "exploitation.persistence",
    section: "High danger",
    techniqueId: "T1547",
    title: "Persistence"
  },
  {
    dangerClass: "metasploit_payload",
    description:
      "Unrestricted Metasploit PAYLOAD. Extra danger acknowledgement required. Not a check(); not Community default start.",
    moduleId: "exploit.metasploit_payload",
    section: "High danger",
    techniqueId: "T1203",
    title: "Metasploit payload"
  },
  {
    dangerClass: "credential_harvest",
    description:
      "Infection Monkey Mimikatz / credential-steal plugin. Extra danger acknowledgement required. Engine Lab only, not Community default start.",
    moduleId: "infection-monkey.mimikatz",
    section: "High danger",
    techniqueId: "T1003",
    title: "Infection Monkey credential steal (Mimikatz)"
  }
] as const;

export const EvaluateDangerStartInputSchema = z.object({
  dangerAcknowledged: z.boolean(),
  dangerAckDigest: z.string().min(16).optional(),
  policyAllowed: z.boolean(),
  qualified: z.boolean(),
  scenarioId: z.string().min(1),
  scopeVerified: z.boolean(),
  tenantAuthorized: z.boolean()
});
export type EvaluateDangerStartInput = z.infer<
  typeof EvaluateDangerStartInputSchema
>;

export const EvaluateDangerStartResultSchema = z
  .object({
    dangerClass: DangerClassSchema.nullable(),
    denyReason: z.string().min(1).nullable(),
    jobsQueued: z.number().int().nonnegative(),
    queued: z.boolean(),
    section: z.literal("High danger"),
    startable: z.boolean()
  })
  .refine(
    (result) => result.startable || (result.jobsQueued === 0 && !result.queued),
    { message: "Denied danger-class starts must never queue jobs." }
  );
export type EvaluateDangerStartResult = z.infer<
  typeof EvaluateDangerStartResultSchema
>;

const DANGER_MODULE_BY_SCENARIO: Record<string, DangerClass> = {
  "exploitation.impact_t1486": "ransomware_impact",
  "identity.cred_spray": "unscoped_spray",
  "identity.credential_harvest": "credential_harvest",
  "exploitation.killchain.engine": "kill_chain_impact",
  "exploitation.persistence": "persistence",
  "exploit.metasploit_payload": "metasploit_payload",
  "infection-monkey.mimikatz": "credential_harvest"
};

export const HIGH_DANGER_SECTION_TITLE = "High danger" as const;

export const HIGH_DANGER_SECTION_COPY =
  "Not Community default start. Not unmarked Validate. Extra danger acknowledgement plus qualification and tenant authorization. Denied starts never queue without ack.";

export const HIGH_DANGER_ACK_CHECKBOX_LABEL =
  "I acknowledge High-danger impact (T1486, unscoped spray, credential harvest, persistence, unrestricted Metasploit PAYLOAD, kill-chain). Denied starts never queue.";

export const HIGH_DANGER_ACK_DIGEST = "high-danger-ack-v1";

export const DangerOperatorGateSchema = z.object({
  available: z.boolean(),
  items: z.array(DangerCatalogEntrySchema),
  qualified: z.boolean(),
  tenantAuthorized: z.boolean()
});
export type DangerOperatorGate = z.infer<typeof DangerOperatorGateSchema>;

export function isDangerCatalogModule(moduleId: string): boolean {
  return DANGER_CATALOG.some((entry) => entry.moduleId === moduleId);
}

export function listDangerCatalog(): DangerCatalogEntry[] {
  return [...DANGER_CATALOG];
}

export function emptyDangerOperatorGate(): DangerOperatorGate {
  return {
    available: false,
    items: listDangerCatalog(),
    qualified: false,
    tenantAuthorized: false
  };
}

export function presentDangerCatalogOperatorView(input: {
  dangerAcknowledged: boolean;
  dangerAckDigest?: string;
  gate: DangerOperatorGate;
  policyAllowed: boolean;
  scopeVerified: boolean;
}): {
  ackRequired: boolean;
  authorizeState: "authorized" | "authorization denied";
  copy: typeof HIGH_DANGER_SECTION_COPY;
  entries: Array<DangerCatalogEntry & { start: EvaluateDangerStartResult }>;
  qualifyState: "qualified" | "qualification required";
  section: typeof HIGH_DANGER_SECTION_TITLE;
  startEnabled: boolean;
} {
  const catalog =
    input.gate.items.length > 0 ? input.gate.items : listDangerCatalog();
  const entries = catalog.map((entry) => ({
    ...entry,
    start: evaluateDangerStart({
      dangerAcknowledged: input.dangerAcknowledged,
      dangerAckDigest: input.dangerAckDigest,
      policyAllowed: input.policyAllowed,
      qualified: input.gate.qualified,
      scenarioId: entry.moduleId,
      scopeVerified: input.scopeVerified,
      tenantAuthorized: input.gate.tenantAuthorized
    })
  }));
  return {
    ackRequired: !input.dangerAcknowledged,
    authorizeState: input.gate.tenantAuthorized
      ? "authorized"
      : "authorization denied",
    copy: HIGH_DANGER_SECTION_COPY,
    entries,
    qualifyState: input.gate.qualified
      ? "qualified"
      : "qualification required",
    section: HIGH_DANGER_SECTION_TITLE,
    startEnabled: entries.every((entry) => entry.start.startable)
  };
}

export function evaluateDangerStart(
  input: EvaluateDangerStartInput
): EvaluateDangerStartResult {
  const parsed = EvaluateDangerStartInputSchema.parse(input);
  const dangerClass = DANGER_MODULE_BY_SCENARIO[parsed.scenarioId] ?? null;
  const deny = (reason: string): EvaluateDangerStartResult => ({
    dangerClass,
    denyReason: reason,
    jobsQueued: 0,
    queued: false,
    section: "High danger",
    startable: false
  });

  if (!dangerClass) {
    return deny("not_danger_catalog");
  }
  if (!parsed.scopeVerified) {
    return deny("scope_unverified");
  }
  if (!parsed.policyAllowed) {
    return deny("policy_denied");
  }
  if (!parsed.qualified) {
    return deny("qualification_required");
  }
  if (!parsed.tenantAuthorized) {
    return deny("tenant_authorization_required");
  }
  if (!parsed.dangerAcknowledged || !parsed.dangerAckDigest) {
    return deny("danger_acknowledgement_required");
  }

  return {
    dangerClass,
    denyReason: null,
    jobsQueued: 0,
    queued: false,
    section: "High danger",
    startable: true
  };
}
