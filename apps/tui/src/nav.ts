export type ScreenId =
  | "home"
  | "login"
  | "scopes"
  | "validate"
  | "missions"
  | "findings"
  | "remediations"
  | "engines"
  | "health"
  | "evidence"
  | "bas"
  | "help";

export const SCREEN_ORDER: ScreenId[] = [
  "home",
  "login",
  "scopes",
  "validate",
  "missions",
  "findings",
  "remediations",
  "engines",
  "health"
];

export function screenLabel(id: ScreenId): string {
  const labels: Record<ScreenId, string> = {
    home: "home",
    login: "auth",
    scopes: "scopes",
    validate: "run",
    missions: "missions",
    findings: "findings",
    remediations: "fix",
    engines: "engines",
    health: "health",
    evidence: "evidence",
    bas: "bas",
    help: "help"
  };
  return labels[id];
}
