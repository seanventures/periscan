/**
 * Force-MFA policy helpers (P04-4 / P17).
 *
 * Deployment env: PERISCAN_REQUIRE_MFA=true
 * Tenant flag: tenants.require_mfa
 *
 * When either is enabled, password sessions without enrolled MFA are limited to
 * the MFA setup path (enroll/verify, session context, logout). SSO and API-key
 * auth are not gated by this policy (IdP / key issuance own their factors).
 */

export type RequireMfaEnv = {
  NODE_ENV?: string;
  PERISCAN_DEPLOYMENT_ENVIRONMENT?: string;
  PERISCAN_REQUIRE_MFA?: string;
};

/**
 * Resolve whether the deployment-wide force-MFA flag is on.
 *
 * - Explicit "true" → required
 * - Explicit "false" / unset / empty → not required (unless fail-closed path)
 * - Any other value in production → fail closed (treat as required)
 */
export function isRequireMfaEnabled(
  env: RequireMfaEnv = process.env
): boolean {
  const raw = env.PERISCAN_REQUIRE_MFA;
  if (raw === undefined || raw === "") {
    return false;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }

  // Unknown / malformed value: fail closed in production so a mis-set flag
  // cannot silently disable force-MFA when operators intended to enable it.
  const isProduction =
    env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production" ||
    env.NODE_ENV === "production";
  return isProduction;
}

/**
 * Effective policy for a password principal: env OR tenant flag.
 * SSO / API key / system auth never consult this for login blocking.
 */
export function isMfaRequiredForPasswordAuth(input: {
  envRequireMfa: boolean;
  tenantRequireMfa: boolean;
}): boolean {
  return input.envRequireMfa || input.tenantRequireMfa;
}

/**
 * Paths a password session may hit while force-MFA is on and the user has not
 * yet activated MFA. Everything else is denied (fail closed).
 *
 * `method` is used for routes that are safe only as reads during setup
 * (e.g. force-MFA policy GET). Mutations stay blocked until MFA is enrolled.
 */
export function isMfaSetupAllowedPath(
  urlPath: string,
  method: string = "GET"
): boolean {
  // Strip query string; Fastify request.url may include it.
  const path = urlPath.split("?")[0] ?? urlPath;
  const verb = method.toUpperCase();

  if (
    path === "/api/v1/me" ||
    path === "/api/v1/auth/logout" ||
    path === "/api/v1/auth/mfa/enroll" ||
    path === "/api/v1/auth/mfa/verify" ||
    path === "/api/v1/tenants/current"
  ) {
    return true;
  }

  // Read-only force-MFA policy so the account-security UI can explain why
  // enrollment is required without granting product access.
  return (
    path === "/api/v1/tenants/current/security-settings/require-mfa" &&
    verb === "GET"
  );
}

/**
 * Decide whether a password-authenticated context is restricted to MFA setup.
 * SSO / API key / system sessions are never setup-restricted by this policy.
 */
export function isPasswordSessionMfaSetupRestricted(input: {
  authMethod: string | undefined;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}): boolean {
  if (!input.mfaRequired) {
    return false;
  }
  if (input.mfaEnabled) {
    return false;
  }
  // Only human password sessions are restricted. SSO is out of scope
  // (IdP-side MFA); API keys and system jobs are non-interactive.
  return input.authMethod === "password" || input.authMethod === undefined;
}

/**
 * Privileged-action step-up (P03-7 residual).
 *
 * Password sessions that already enrolled MFA (or that sit under force-MFA)
 * must re-prove the second factor for high-blast-radius mutations: API key
 * mint/rotate, offensive/destructive flips, force-MFA policy changes, kill
 * switch. SSO / API-key / system principals are not stepped up here (IdP and
 * key issuance own their factors).
 */
export function privilegedActionRequiresMfaStepUp(input: {
  authMethod: string | undefined;
  mfaEnabled: boolean;
  forceMfa: boolean;
}): boolean {
  if (
    input.authMethod === "api_key" ||
    input.authMethod === "sso" ||
    input.authMethod === "system"
  ) {
    return false;
  }
  // password or undefined (legacy session claims)
  if (input.forceMfa) {
    return true;
  }
  return input.mfaEnabled;
}
