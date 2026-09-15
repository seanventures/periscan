import { z } from "zod";

export const AttackTacticIdSchema = z.enum([
  "TA0001",
  "TA0002",
  "TA0005",
  "TA0006",
  "TA0007",
  "TA0011",
  "TA0043"
]);

export const AttackTacticNameSchema = z.enum([
  "Initial Access",
  "Execution",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Command and Control",
  "Reconnaissance"
]);

export const AttackTechniqueSchema = z.object({
  description: z.string().min(1),
  safeExample: z.boolean(),
  tacticId: AttackTacticIdSchema,
  tacticName: AttackTacticNameSchema,
  techniqueId: z.string().regex(/^T\d{4}(?:\.\d{3})?$/),
  techniqueName: z.string().min(1)
});

export type AttackTacticId = z.infer<typeof AttackTacticIdSchema>;
export type AttackTacticName = z.infer<typeof AttackTacticNameSchema>;
export type AttackTechnique = z.infer<typeof AttackTechniqueSchema>;

const ATTACK_TECHNIQUES = [
  {
    description:
      "Safe example mapping for externally observable service discovery and scanning activity.",
    safeExample: true,
    tacticId: "TA0043",
    tacticName: "Reconnaissance",
    techniqueId: "T1595",
    techniqueName: "Active Scanning"
  },
  {
    description:
      "Safe example mapping for account and identity enumeration behaviors.",
    safeExample: true,
    tacticId: "TA0007",
    tacticName: "Discovery",
    techniqueId: "T1087",
    techniqueName: "Account Discovery"
  },
  {
    description:
      "Safe example mapping for secrets and unsecured credential discovery paths.",
    safeExample: true,
    tacticId: "TA0006",
    tacticName: "Credential Access",
    techniqueId: "T1552",
    techniqueName: "Unsecured Credentials"
  },
  {
    description:
      "Safe example mapping for using previously granted accounts or roles.",
    safeExample: true,
    tacticId: "TA0001",
    tacticName: "Initial Access",
    techniqueId: "T1078",
    techniqueName: "Valid Accounts"
  },
  {
    description:
      "Safe example mapping for defense impairment or monitoring bypass attempts.",
    safeExample: true,
    tacticId: "TA0005",
    tacticName: "Defense Evasion",
    techniqueId: "T1562",
    techniqueName: "Impair Defenses"
  },
  {
    description:
      "Safe example mapping for command-and-control style application-layer traffic.",
    safeExample: true,
    tacticId: "TA0011",
    tacticName: "Command and Control",
    techniqueId: "T1071",
    techniqueName: "Application Layer Protocol"
  },
  {
    description:
      "Safe example mapping for command and scripting interpreter execution behaviors observed by EDR/XDR telemetry.",
    safeExample: true,
    tacticId: "TA0002",
    tacticName: "Execution",
    techniqueId: "T1059",
    techniqueName: "Command and Scripting Interpreter"
  },
  {
    description:
      "Safe example mapping for spearphishing-attachment delivery observed by email security telemetry.",
    safeExample: true,
    tacticId: "TA0001",
    tacticName: "Initial Access",
    techniqueId: "T1566.001",
    techniqueName: "Phishing: Spearphishing Attachment"
  }
] as const satisfies readonly AttackTechnique[];

const attackTechniques = ATTACK_TECHNIQUES.map((technique) =>
  AttackTechniqueSchema.parse(technique)
);
const attackTechniqueMap = new Map(
  attackTechniques.map(
    (technique) => [technique.techniqueId, technique] as const
  )
);

export function listAttackTechniques() {
  return [...attackTechniques];
}

export function getAttackTechniqueById(techniqueId: string) {
  return attackTechniqueMap.get(techniqueId) ?? null;
}

export function mapAttackTechniqueIds(techniqueIds: string[]) {
  return techniqueIds
    .map((techniqueId) => getAttackTechniqueById(techniqueId))
    .filter((technique): technique is AttackTechnique => Boolean(technique));
}
