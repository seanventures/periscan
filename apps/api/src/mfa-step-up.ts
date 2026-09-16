import type { PrismaClient } from "@prisma/client";

import { decryptSecret } from "./integration-credentials.js";
import {
  isMfaRequiredForPasswordAuth,
  isRequireMfaEnabled,
  privilegedActionRequiresMfaStepUp
} from "./mfa-policy.js";
import { AppServiceError, type AuthenticatedContext } from "./runtime-services.js";
import { verifyTotp } from "./totp.js";

/**
 * Re-verify TOTP for privileged password-session mutations (P03-7 residual).
 *
 * Call from API-key mint/rotate/revoke, offensive/destructive flips, and
 * force-MFA policy changes. SSO / API-key / system auth skip step-up.
 * Password sessions with MFA enrolled (or under force-MFA) must supply a
 * current authenticator code via body `totpCode` or header `x-periscan-mfa-code`.
 */
export async function assertPrivilegedMfaStepUp(
  prisma: PrismaClient,
  context: AuthenticatedContext,
  totpCode?: string | null
): Promise<void> {
  const forceMfa = isMfaRequiredForPasswordAuth({
    envRequireMfa: isRequireMfaEnabled(),
    tenantRequireMfa: Boolean(context.tenant.requireMfa)
  });
  const mfaEnabled = Boolean(context.user.mfaEnabledAt);

  if (
    !privilegedActionRequiresMfaStepUp({
      authMethod: context.session.authMethod,
      forceMfa,
      mfaEnabled
    })
  ) {
    return;
  }

  const user = await prisma.user.findUnique({
    select: {
      mfaEnabledAt: true,
      mfaSecret: true
    },
    where: { userId: context.user.userId }
  });

  if (!user?.mfaSecret || !user.mfaEnabledAt) {
    throw new AppServiceError(
      "Multi-factor authentication enrollment is required for this privileged action.",
      403,
      "mfa_enrollment_required"
    );
  }

  const code = totpCode?.trim();
  if (
    !code ||
    !verifyTotp(decryptSecret(user.mfaSecret), code, Date.now(), { window: 1 })
  ) {
    throw new AppServiceError(
      "A current authenticator code is required for this privileged action.",
      401,
      "mfa_step_up_required"
    );
  }
}

/** Prefer body totpCode; fall back to the step-up header. */
export function resolveStepUpTotpCode(
  bodyCode: string | null | undefined,
  headerCode: string | string[] | undefined
): string | undefined {
  if (typeof bodyCode === "string" && bodyCode.trim()) {
    return bodyCode.trim();
  }
  if (typeof headerCode === "string" && headerCode.trim()) {
    return headerCode.trim();
  }
  if (Array.isArray(headerCode)) {
    const first = headerCode.find((value) => value.trim());
    return first?.trim();
  }
  return undefined;
}
