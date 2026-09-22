import { COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID } from "@periscan/shared";

/** Same engine interactive `g` pins on run (4). */
export const GITLEAKS_REPO_SECRETS = COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID;

/**
 * First-hour Community start set: Gitleaks only, matching interactive `g`.
 * Undefined when Gitleaks is not startable so callers fall back to the suite.
 */
export function pinGitleaksRepoSecretsModuleIds(
  startableModuleIds: readonly string[]
): string[] | undefined {
  if (startableModuleIds.includes(GITLEAKS_REPO_SECRETS)) {
    return [GITLEAKS_REPO_SECRETS];
  }
  return undefined;
}
