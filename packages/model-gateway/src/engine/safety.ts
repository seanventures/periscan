/**
 * Ordinal ranking of the safety levels used to compare a tool's safety class
 * against the session policy profile's ceiling. Higher means more invasive.
 */
export const SAFETY_LEVEL_RANK: Record<string, number> = {
  PassiveReadOnly: 0,
  ActiveNonInvasive: 1,
  ControlledValidation: 2,
  BASLite: 3,
  AdvancedAdversarial: 4,
  Disallowed: 5
};

export function safetyLevelRank(level: string): number {
  return SAFETY_LEVEL_RANK[level] ?? SAFETY_LEVEL_RANK.Disallowed!;
}
