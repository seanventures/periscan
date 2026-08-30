// @ts-nocheck
import { randomBytes } from "node:crypto";

import argon2 from "argon2";

import type { Prisma } from "@prisma/client";

import { decryptSecret, encryptSecret } from "../integration-credentials.js";
import {
  isMfaRequiredForPasswordAuth,
  isRequireMfaEnabled
} from "../mfa-policy.js";
import { assertPrivilegedMfaStepUp } from "../mfa-step-up.js";
import {
  base32Encode,
  buildOtpauthUri,
  generateTotpSecret,
  verifyTotp
} from "../totp.js";

// MFA recovery codes: human-readable, single-use. We store ONLY a hash of the
// normalized code; the plaintext is shown to the user exactly once.
const MFA_RECOVERY_CODE_COUNT = 10;

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-z0-9]/giu, "").toUpperCase();
}

function generateRecoveryCodes(): Array<{ plaintext: string; hash: string }> {
  return Array.from({ length: MFA_RECOVERY_CODE_COUNT }, () => {
    // 10 random bytes → 16 base32 chars, grouped as XXXX-XXXX-XXXX-XXXX.
    const raw = base32Encode(randomBytes(10)).slice(0, 16);
    const plaintext = (raw.match(/.{1,4}/gu) ?? [raw]).join("-");
    return { hash: hashSecret(normalizeRecoveryCode(plaintext)), plaintext };
  });
}

import type { TenantApiKeyScope } from "@periscan/shared";

import { serializeMembership, serializeUser } from "../serializers/entities.js";
import { serializeTenant } from "../serializers/tenant.js";
import {
  apiKeyRoleForScopes,
  AppServiceError,
  API_KEY_TOKEN_PREFIX,
  generateApiKeyToken,
  hashSecret,
  requireRole,
  serializeApiKey,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

// Auth, session, and API-key service group (D1 Phase 2 closure decomposition).
// SECURITY-SENSITIVE: argon2 password hashing, session/tenant resolution, and
// SHA-256-hashed API-key authentication. Bodies copied byte-exact;
// options.dataRegion is threaded via deps.dataRegion.
export function createAuthServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "acceptInvite"
  | "authenticateApiKey"
  | "createApiKey"
  | "changePassword"
  | "confirmPasswordReset"
  | "enrollMfa"
  | "verifyMfa"
  | "regenerateMfaRecoveryCodes"
  | "disableMfa"
  | "getSessionContext"
  | "listApiKeys"
  | "login"
  | "recordLogout"
  | "requestPasswordReset"
  | "revokeOtherSessions"
  | "revokeApiKey"
  | "rotateApiKey"
  | "signup"
  | "verifyEmail"
> {
  const {
    availableDataRegions,
    dataRegion,
    emailTransport,
    prisma,
    webBaseUrl
  } = deps;

  // Password-reset tokens live for one hour; email-verification tokens longer
  // since verifying is not time-critical.
  const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
  const EMAIL_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  // Per-user account lockout to slow online password guessing (complements the
  // IP/tenant rate limiter). Configurable; sane defaults.
  const LOGIN_MAX_ATTEMPTS = Math.max(
    1,
    Number(process.env.PERISCAN_LOGIN_MAX_ATTEMPTS ?? 5) || 5
  );
  const LOGIN_LOCKOUT_MS =
    Math.max(
      1,
      Number(process.env.PERISCAN_LOGIN_LOCKOUT_MINUTES ?? 15) || 15
    ) *
    60 *
    1000;

  // Best-effort verification email after signup commits — a mail outage must
  // never roll back account creation.
  async function sendVerificationEmail(user: {
    email: string;
    name: string;
    userId: string;
  }) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.userToken.create({
      data: {
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        purpose: "EmailVerification",
        tokenHash: hashSecret(rawToken),
        userId: user.userId
      }
    });
    const verifyUrl = `${webBaseUrl}/verify-email?token=${rawToken}`;
    try {
      await emailTransport.send({
        subject: "Verify your Periscan email",
        text: [
          `Hi ${user.name},`,
          "",
          "Confirm your email address to finish setting up your Periscan account.",
          "This link expires in 7 days.",
          "",
          verifyUrl
        ].join("\n"),
        to: user.email
      });
    } catch (error) {
      console.error(
        `[verify-email] failed to send verification email to ${user.email}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    async signup(input) {
      const selectedDataRegion = input.dataRegion ?? dataRegion;
      if (!availableDataRegions.includes(selectedDataRegion)) {
        throw new AppServiceError(
          `Data region ${selectedDataRegion} is not configured for this deployment.`,
          400,
          "data_region_unavailable"
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: input.email
        }
      });

      if (existingUser) {
        throw new AppServiceError(
          "A user with that email already exists.",
          409,
          "email_in_use"
        );
      }

      const passwordHash = await argon2.hash(input.password);

      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const tenant = await tx.tenant.create({
            data: {
              dataRegion: selectedDataRegion,
              name: input.tenantName,
              type: input.tenantType ?? "Organization"
            }
          });

          const user = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              passwordHash,
              status: "Active"
            }
          });

          const membership = await tx.membership.create({
            data: {
              role: "Owner",
              tenantId: tenant.tenantId,
              userId: user.userId
            }
          });

          await writeAuditEvent(tx, {
            action: "signup",
            actorType: "User",
            entityId: user.userId,
            entityType: "Tenant",
            metadata: {
              dataRegion: selectedDataRegion,
              email: user.email
            },
            tenantId: tenant.tenantId,
            userId: user.userId
          });
          await writeAuditEvent(tx, {
            action: "tenant.created",
            actorType: "User",
            entityId: tenant.tenantId,
            entityType: "Tenant",
            metadata: {
              tenantName: tenant.name
            },
            tenantId: tenant.tenantId,
            userId: user.userId
          });

          return {
            membership,
            tenant,
            user
          };
        }
      );

      await sendVerificationEmail({
        email: result.user.email,
        name: result.user.name,
        userId: result.user.userId
      });

      return {
        membership: serializeMembership(result.membership),
        session: {
          authMethod: "password",
          defaultTenantId: result.tenant.tenantId,
          sessionVersion: result.user.sessionVersion,
          userId: result.user.userId
        },
        tenant: serializeTenant(result.tenant),
        user: serializeUser(result.user)
      };
    },

    async login(input) {
      const user = await prisma.user.findUnique({
        where: {
          email: input.email
        }
      });

      if (!user?.passwordHash) {
        // Unknown email or invite-pending user: generic failure, no lock state
        // (so this endpoint can't be used to enumerate or to lock arbitrary
        // accounts an attacker names).
        return null;
      }

      // Reject while the account is locked, without consuming the password check.
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new AppServiceError(
          "Too many failed attempts. Try again later or reset your password.",
          429,
          "account_locked"
        );
      }

      const isValid = await argon2.verify(user.passwordHash, input.password);

      if (!isValid) {
        // Count the failure; lock the account once the threshold is reached.
        const attempts = user.failedLoginAttempts + 1;
        const locked = attempts >= LOGIN_MAX_ATTEMPTS;
        await prisma.user.update({
          data: {
            failedLoginAttempts: locked ? 0 : attempts,
            lockedUntil: locked ? new Date(Date.now() + LOGIN_LOCKOUT_MS) : null
          },
          where: { userId: user.userId }
        });
        const membershipForAudit = await prisma.membership.findFirst({
          orderBy: { createdAt: "asc" },
          where: { userId: user.userId }
        });
        await writeAuditEvent(prisma, {
          action: "login.failed",
          actorType: "User",
          entityId: user.userId,
          entityType: "Tenant",
          metadata: { attempts, locked },
          tenantId: membershipForAudit?.tenantId ?? null,
          userId: user.userId
        });
        if (locked) {
          throw new AppServiceError(
            "Too many failed attempts. Try again later or reset your password.",
            429,
            "account_locked"
          );
        }
        return null;
      }

      // Successful login clears any accumulated failure state.
      if (user.failedLoginAttempts !== 0 || user.lockedUntil) {
        await prisma.user.update({
          data: { failedLoginAttempts: 0, lockedUntil: null },
          where: { userId: user.userId }
        });
      }

      // Resolve membership before second-factor / force-MFA decisions so we can
      // evaluate tenant.requireMfa and SSO enforcement against the right tenant.
      const membership = await prisma.membership.findFirst({
        where: {
          userId: user.userId
        },
        orderBy: {
          createdAt: "asc"
        },
        include: {
          tenant: true
        }
      });

      if (!membership) {
        throw new AppServiceError(
          "No tenant membership exists for this user.",
          403,
          "membership_missing"
        );
      }

      const ssoConfig = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: membership.tenant.tenantId
        }
      });
      if (ssoConfig?.status === "Enabled" && ssoConfig.enforced) {
        await writeAuditEvent(prisma, {
          action: "sso.login_failed",
          actorType: "User",
          entityId: user.userId,
          entityType: "Tenant",
          metadata: {
            code: "sso_required",
            reason: "Password login blocked because tenant SSO is enforced."
          },
          tenantId: membership.tenant.tenantId,
          userId: user.userId
        });
        throw new AppServiceError(
          "Tenant requires SSO login.",
          403,
          "sso_required"
        );
      }

      // Second factor: once a user has ACTIVATED MFA, a correct password alone
      // is not enough. The password was already verified above, so an MFA
      // failure here is NOT a password-guessing signal — it does not touch the
      // lockout counter (which exists to slow password guessing).
      if (user.mfaEnabledAt) {
        if (!user.mfaSecret) {
          // mfaEnabledAt set without a stored secret is an inconsistent state;
          // fail closed rather than silently bypassing the second factor.
          throw new AppServiceError(
            "Multi-factor authentication is not configured correctly.",
            401,
            "mfa_invalid"
          );
        }

        if (!input.totpCode && !input.recoveryCode) {
          throw new AppServiceError(
            "A multi-factor authentication code is required.",
            401,
            "mfa_required"
          );
        }

        // A single-use recovery code is accepted in place of a TOTP code. It is
        // consumed (and audited) only when a CAS claim succeeds — soft
        // find-then-update would let concurrent logins both mint sessions from
        // the same recovery code.
        let secondFactorOk = false;
        if (input.recoveryCode) {
          const codeHash = hashSecret(
            normalizeRecoveryCode(input.recoveryCode)
          );
          const claimed = await prisma.mfaRecoveryCode.updateMany({
            data: { consumedAt: new Date() },
            where: { codeHash, consumedAt: null, userId: user.userId }
          });
          if (claimed.count === 1) {
            await writeAuditEvent(prisma, {
              action: "mfa.recovery_used",
              actorType: "User",
              entityId: user.userId,
              entityType: "Tenant",
              metadata: {},
              tenantId: membership.tenant.tenantId,
              userId: user.userId
            });
            secondFactorOk = true;
          }
        }

        if (
          !secondFactorOk &&
          input.totpCode &&
          verifyTotp(
            decryptSecret(user.mfaSecret),
            input.totpCode,
            Date.now(),
            {
              window: 1
            }
          )
        ) {
          secondFactorOk = true;
        }

        if (!secondFactorOk) {
          throw new AppServiceError(
            "The multi-factor authentication code is invalid.",
            401,
            "mfa_invalid"
          );
        }
      } else {
        // Force-MFA: password login without enrolled MFA is only allowed as the
        // setup path (session is later restricted to enroll/verify/me/logout).
        // Full product access is denied by requireAuthContext until MFA is on.
        // SSO is not gated here.
        const mfaRequired = isMfaRequiredForPasswordAuth({
          envRequireMfa: isRequireMfaEnabled(),
          tenantRequireMfa: Boolean(membership.tenant.requireMfa)
        });
        if (mfaRequired) {
          await writeAuditEvent(prisma, {
            action: "login",
            actorType: "User",
            entityId: user.userId,
            entityType: "Tenant",
            metadata: {
              mfaEnrollmentRequired: true,
              tenantId: membership.tenant.tenantId
            },
            tenantId: membership.tenant.tenantId,
            userId: user.userId
          });

          return {
            membership: serializeMembership(membership),
            session: {
              authMethod: "password",
              defaultTenantId: membership.tenant.tenantId,
              sessionVersion: user.sessionVersion,
              userId: user.userId
            },
            tenant: serializeTenant(membership.tenant),
            user: serializeUser(user)
          };
        }
      }

      await writeAuditEvent(prisma, {
        action: "login",
        actorType: "User",
        entityId: user.userId,
        entityType: "Tenant",
        metadata: {
          tenantId: membership.tenant.tenantId
        },
        tenantId: membership.tenant.tenantId,
        userId: user.userId
      });

      return {
        membership: serializeMembership(membership),
        session: {
          authMethod: "password",
          defaultTenantId: membership.tenant.tenantId,
          sessionVersion: user.sessionVersion,
          userId: user.userId
        },
        tenant: serializeTenant(membership.tenant),
        user: serializeUser(user)
      };
    },

    async getSessionContext(session, requestedTenantId) {
      const membership = await prisma.membership.findFirst({
        where: {
          tenantId: requestedTenantId ?? session.defaultTenantId,
          userId: session.userId
        },
        include: {
          tenant: true,
          user: true
        }
      });

      if (!membership) {
        return null;
      }

      if (
        (session.authMethod === "password" || session.authMethod === "sso") &&
        (session.sessionVersion ?? 0) !== membership.user.sessionVersion
      ) {
        return null;
      }

      const ssoConfig = await prisma.tenantSsoConfig.findUnique({
        where: {
          tenantId: membership.tenantId
        }
      });
      if (ssoConfig?.status === "Enabled" && ssoConfig.enforced) {
        if (session.authMethod === "system") {
          // Internal schedulers use system context and still need tenant access
          // after a customer enables SSO enforcement.
        } else if (
          session.authMethod !== "sso" ||
          session.defaultTenantId !== membership.tenantId
        ) {
          return null;
        }
      }

      return {
        membership: serializeMembership(membership),
        session,
        tenant: serializeTenant(membership.tenant),
        user: serializeUser(membership.user)
      };
    },

    async recordLogout(context) {
      await writeAuditEvent(prisma, {
        action: "logout",
        actorType: "User",
        entityId: context.user.userId,
        entityType: "Tenant",
        metadata: {
          tenantId: context.tenant.tenantId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async changePassword(context, input) {
      const user = await prisma.user.findUnique({
        where: { userId: context.user.userId }
      });

      if (!user?.passwordHash) {
        throw new AppServiceError(
          "This account does not have a local password.",
          400,
          "password_unavailable"
        );
      }

      if (!(await argon2.verify(user.passwordHash, input.currentPassword))) {
        throw new AppServiceError(
          "The current password is incorrect.",
          401,
          "reauth_required"
        );
      }

      if (await argon2.verify(user.passwordHash, input.newPassword)) {
        throw new AppServiceError(
          "Choose a new password that is different from the current password.",
          400,
          "password_unchanged"
        );
      }

      if (user.mfaEnabledAt) {
        if (
          !user.mfaSecret ||
          !input.totpCode ||
          !verifyTotp(
            decryptSecret(user.mfaSecret),
            input.totpCode,
            Date.now(),
            { window: 1 }
          )
        ) {
          throw new AppServiceError(
            "A current authenticator code is required to change this password.",
            401,
            "mfa_required"
          );
        }
      }

      const passwordHash = await argon2.hash(input.newPassword);
      const updated = await prisma.user.update({
        data: {
          passwordHash,
          sessionVersion: { increment: 1 }
        },
        where: { userId: user.userId }
      });

      await writeAuditEvent(prisma, {
        action: "password.changed",
        actorType: "User",
        entityId: user.userId,
        entityType: "Tenant",
        metadata: { otherSessionsRevoked: true },
        tenantId: context.tenant.tenantId,
        userId: user.userId
      });

      return {
        changed: true,
        session: {
          ...context.session,
          sessionVersion: updated.sessionVersion
        }
      };
    },

    async revokeOtherSessions(context) {
      const updated = await prisma.user.update({
        data: { sessionVersion: { increment: 1 } },
        where: { userId: context.user.userId }
      });

      await writeAuditEvent(prisma, {
        action: "sessions.revoked",
        actorType: "User",
        entityId: context.user.userId,
        entityType: "Tenant",
        metadata: { currentSessionPreserved: true },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        changed: true,
        session: {
          ...context.session,
          sessionVersion: updated.sessionVersion
        }
      };
    },

    async requestPasswordReset(input) {
      // Always resolves successfully regardless of whether the email exists, so
      // the endpoint can never be used to enumerate accounts. Work only happens
      // for a real user.
      const user = await prisma.user.findUnique({
        where: { email: input.email }
      });
      if (!user || user.status === "Disabled") {
        return;
      }

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashSecret(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await prisma.userToken.create({
        data: {
          expiresAt,
          purpose: "PasswordReset",
          tokenHash,
          userId: user.userId
        }
      });

      const resetUrl = `${webBaseUrl}/reset-password?token=${rawToken}`;
      await emailTransport.send({
        subject: "Reset your Periscan password",
        text: [
          `Hi ${user.name},`,
          "",
          "We received a request to reset your Periscan password. Use the link",
          "below to choose a new one. It expires in 1 hour. If you did not request",
          "this, you can safely ignore this email.",
          "",
          resetUrl
        ].join("\n"),
        to: user.email
      });

      // Audit against the user's first tenant when one exists; tenantId may be
      // null for a user with no membership yet (e.g. an unaccepted invite).
      const membership = await prisma.membership.findFirst({
        orderBy: { createdAt: "asc" },
        where: { userId: user.userId }
      });
      await writeAuditEvent(prisma, {
        action: "password_reset.requested",
        actorType: "User",
        entityId: user.userId,
        entityType: "Tenant",
        metadata: { email: user.email },
        tenantId: membership?.tenantId ?? null,
        userId: user.userId
      });
    },

    async confirmPasswordReset(input) {
      const tokenHash = hashSecret(input.token);
      const token = await prisma.userToken.findUnique({
        where: { tokenHash }
      });

      if (
        !token ||
        token.purpose !== "PasswordReset" ||
        token.consumedAt ||
        token.expiresAt.getTime() <= Date.now()
      ) {
        throw new AppServiceError(
          "This password reset link is invalid or has expired.",
          400,
          "invalid_token"
        );
      }

      const passwordHash = await argon2.hash(input.password);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          data: {
            passwordHash,
            sessionVersion: { increment: 1 },
            // A successful reset also activates an invited (null-password) user.
            status: "Active"
          },
          where: { userId: token.userId }
        });
        // Consume this token and invalidate any other outstanding reset tokens
        // for the user so an older link cannot be replayed.
        await tx.userToken.updateMany({
          data: { consumedAt: new Date() },
          where: {
            consumedAt: null,
            purpose: "PasswordReset",
            userId: token.userId
          }
        });

        const membership = await tx.membership.findFirst({
          orderBy: { createdAt: "asc" },
          where: { userId: token.userId }
        });
        await writeAuditEvent(tx, {
          action: "password_reset.completed",
          actorType: "User",
          entityId: token.userId,
          entityType: "Tenant",
          metadata: {},
          tenantId: membership?.tenantId ?? null,
          userId: token.userId
        });
      });

      return { ok: true };
    },

    async acceptInvite(input) {
      const tokenHash = hashSecret(input.token);
      const token = await prisma.userToken.findUnique({
        where: { tokenHash }
      });

      if (
        !token ||
        token.purpose !== "Invite" ||
        token.consumedAt ||
        token.expiresAt.getTime() <= Date.now()
      ) {
        throw new AppServiceError(
          "This invite link is invalid or has expired.",
          400,
          "invalid_token"
        );
      }

      const passwordHash = await argon2.hash(input.password);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          data: { passwordHash, status: "Active" },
          where: { userId: token.userId }
        });
        await tx.userToken.updateMany({
          data: { consumedAt: new Date() },
          where: {
            consumedAt: null,
            purpose: "Invite",
            userId: token.userId
          }
        });

        const membership = await tx.membership.findFirst({
          orderBy: { createdAt: "asc" },
          where: { userId: token.userId }
        });
        await writeAuditEvent(tx, {
          action: "invite.accepted",
          actorType: "User",
          entityId: token.userId,
          entityType: "Tenant",
          metadata: {},
          tenantId: membership?.tenantId ?? null,
          userId: token.userId
        });
      });

      return { ok: true };
    },

    async enrollMfa(context) {
      // Generate a fresh TOTP secret, store it ENCRYPTED at rest, and return the
      // secret + otpauth URI for the user's authenticator app. MFA is not active
      // until a code is verified (a later increment) — enrolling again before
      // activation simply rotates the pending secret. Once MFA is active, refuse
      // silent rotation: a hijacked session must not replace the victim's factor
      // without going through disableMfa (password/TOTP re-auth).
      const user = await prisma.user.findUnique({
        where: { userId: context.user.userId }
      });
      if (user?.mfaEnabledAt) {
        throw new AppServiceError(
          "Multi-factor authentication is already active. Disable it before enrolling a new authenticator.",
          400,
          "mfa_already_active"
        );
      }

      const secret = generateTotpSecret();
      await prisma.user.update({
        data: { mfaSecret: encryptSecret(secret) },
        where: { userId: context.user.userId }
      });

      await writeAuditEvent(prisma, {
        action: "mfa.enrolled",
        actorType: "User",
        entityId: context.user.userId,
        entityType: "Tenant",
        metadata: {},
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        otpauthUri: buildOtpauthUri({
          accountName: context.user.email,
          issuer: "Periscan",
          secretBase32: secret
        }),
        secret
      };
    },

    async verifyMfa(context, input) {
      // Activate MFA by proving possession of the enrolled secret. The stored
      // secret is encrypted at rest; decrypt it only to verify the code.
      const user = await prisma.user.findUnique({
        where: { userId: context.user.userId }
      });

      if (!user?.mfaSecret) {
        throw new AppServiceError(
          "Start MFA enrollment before verifying a code.",
          400,
          "mfa_not_enrolled"
        );
      }

      const secret = decryptSecret(user.mfaSecret);
      if (!verifyTotp(secret, input.code, Date.now(), { window: 1 })) {
        throw new AppServiceError(
          "The multi-factor authentication code is invalid.",
          400,
          "mfa_invalid"
        );
      }

      // Idempotent: re-verifying an already-active enrollment keeps the original
      // activation timestamp and does NOT mint new recovery codes (those are
      // returned once on first activation; use regenerate to rotate them).
      const mfaEnabledAt = user.mfaEnabledAt ?? new Date();
      let recoveryCodes: string[] = [];
      if (!user.mfaEnabledAt) {
        const codes = generateRecoveryCodes();
        recoveryCodes = codes.map((code) => code.plaintext);
        await prisma.$transaction([
          prisma.user.update({
            data: { mfaEnabledAt },
            where: { userId: user.userId }
          }),
          prisma.mfaRecoveryCode.createMany({
            data: codes.map((code) => ({
              codeHash: code.hash,
              userId: user.userId
            }))
          })
        ]);

        await writeAuditEvent(prisma, {
          action: "mfa.activated",
          actorType: "User",
          entityId: user.userId,
          entityType: "Tenant",
          metadata: { recoveryCodeCount: recoveryCodes.length },
          tenantId: context.tenant.tenantId,
          userId: user.userId
        });
      }

      return {
        activated: true,
        mfaEnabledAt: mfaEnabledAt.toISOString(),
        recoveryCodes
      };
    },

    async regenerateMfaRecoveryCodes(context, input) {
      const user = await prisma.user.findUnique({
        where: { userId: context.user.userId }
      });

      if (!user?.mfaSecret || !user.mfaEnabledAt) {
        throw new AppServiceError(
          "Activate MFA before regenerating recovery codes.",
          400,
          "mfa_not_active"
        );
      }

      // Re-auth: require the current password OR a current TOTP code so a
      // hijacked session cannot silently rotate (and exfiltrate) recovery codes.
      const password = input.password?.trim();
      const totpCode = input.totpCode?.trim();
      const passwordOk =
        password && user.passwordHash
          ? await argon2.verify(user.passwordHash, password)
          : false;
      const totpOk = totpCode
        ? verifyTotp(decryptSecret(user.mfaSecret), totpCode, Date.now(), {
            window: 1
          })
        : false;

      if (!passwordOk && !totpOk) {
        throw new AppServiceError(
          "Re-authenticate with your password or a current code to regenerate recovery codes.",
          401,
          "reauth_required"
        );
      }

      const codes = generateRecoveryCodes();
      await prisma.$transaction([
        prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.userId } }),
        prisma.mfaRecoveryCode.createMany({
          data: codes.map((code) => ({
            codeHash: code.hash,
            userId: user.userId
          }))
        })
      ]);

      await writeAuditEvent(prisma, {
        action: "mfa.recovery_regenerated",
        actorType: "User",
        entityId: user.userId,
        entityType: "Tenant",
        metadata: { recoveryCodeCount: codes.length },
        tenantId: context.tenant.tenantId,
        userId: user.userId
      });

      return { recoveryCodes: codes.map((code) => code.plaintext) };
    },

    async disableMfa(context, input) {
      const user = await prisma.user.findUnique({
        where: { userId: context.user.userId }
      });

      if (!user?.mfaSecret || !user.mfaEnabledAt) {
        throw new AppServiceError(
          "Multi-factor authentication is not active.",
          400,
          "mfa_not_active"
        );
      }

      // Force-MFA policy: do not allow stripping MFA while the deployment or
      // tenant requires it. Fail closed — operators must clear the policy first.
      const tenant = await prisma.tenant.findUnique({
        where: { tenantId: context.tenant.tenantId }
      });
      const mfaRequired = isMfaRequiredForPasswordAuth({
        envRequireMfa: isRequireMfaEnabled(),
        tenantRequireMfa: Boolean(tenant?.requireMfa)
      });
      if (mfaRequired) {
        throw new AppServiceError(
          "Multi-factor authentication is required by policy and cannot be disabled.",
          403,
          "mfa_required_by_policy"
        );
      }

      // Re-auth before removing a security control: current password OR a
      // current TOTP code. A hijacked session must not be able to silently
      // strip MFA off the account.
      const password = input.password?.trim();
      const totpCode = input.totpCode?.trim();
      const passwordOk =
        password && user.passwordHash
          ? await argon2.verify(user.passwordHash, password)
          : false;
      const totpOk = totpCode
        ? verifyTotp(decryptSecret(user.mfaSecret), totpCode, Date.now(), {
            window: 1
          })
        : false;

      if (!passwordOk && !totpOk) {
        throw new AppServiceError(
          "Re-authenticate with your password or a current code to disable MFA.",
          401,
          "reauth_required"
        );
      }

      // Clear every factor atomically: secret, activation flag, recovery codes.
      await prisma.$transaction([
        prisma.user.update({
          data: { mfaEnabledAt: null, mfaSecret: null },
          where: { userId: user.userId }
        }),
        prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.userId } })
      ]);

      await writeAuditEvent(prisma, {
        action: "mfa.disabled",
        actorType: "User",
        entityId: user.userId,
        entityType: "Tenant",
        metadata: {},
        tenantId: context.tenant.tenantId,
        userId: user.userId
      });

      return { disabled: true };
    },

    async verifyEmail(input) {
      const tokenHash = hashSecret(input.token);
      const token = await prisma.userToken.findUnique({
        where: { tokenHash }
      });

      if (
        !token ||
        token.purpose !== "EmailVerification" ||
        token.consumedAt ||
        token.expiresAt.getTime() <= Date.now()
      ) {
        throw new AppServiceError(
          "This verification link is invalid or has expired.",
          400,
          "invalid_token"
        );
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          data: { emailVerifiedAt: new Date() },
          where: { userId: token.userId }
        });
        await tx.userToken.updateMany({
          data: { consumedAt: new Date() },
          where: {
            consumedAt: null,
            purpose: "EmailVerification",
            userId: token.userId
          }
        });

        const membership = await tx.membership.findFirst({
          orderBy: { createdAt: "asc" },
          where: { userId: token.userId }
        });
        await writeAuditEvent(tx, {
          action: "email.verified",
          actorType: "User",
          entityId: token.userId,
          entityType: "Tenant",
          metadata: {},
          tenantId: membership?.tenantId ?? null,
          userId: token.userId
        });
      });

      return { ok: true };
    },

    async authenticateApiKey(rawKey) {
      if (!rawKey || !rawKey.startsWith(API_KEY_TOKEN_PREFIX)) {
        return null;
      }

      const apiKey = await prisma.tenantApiKey.findUnique({
        include: {
          tenant: true
        },
        where: {
          keyHash: hashSecret(rawKey)
        }
      });

      if (!apiKey || apiKey.revokedAt) {
        return null;
      }

      if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      await prisma.tenantApiKey.update({
        data: {
          lastUsedAt: new Date()
        },
        where: {
          apiKeyId: apiKey.apiKeyId
        }
      });

      const creator = await prisma.user.findUnique({
        where: {
          userId: apiKey.createdBy
        }
      });
      const now = new Date();
      const role = apiKeyRoleForScopes(apiKey.scopes as TenantApiKeyScope[]);

      return {
        apiKeyScopes: apiKey.scopes as TenantApiKeyScope[],
        membership: {
          createdAt: apiKey.createdAt.toISOString(),
          membershipId: apiKey.apiKeyId,
          role,
          tenantId: apiKey.tenantId,
          updatedAt: apiKey.updatedAt.toISOString(),
          userId: apiKey.createdBy
        },
        session: {
          authMethod: "api_key",
          defaultTenantId: apiKey.tenantId,
          userId: apiKey.createdBy
        },
        tenant: serializeTenant(apiKey.tenant),
        user: creator
          ? serializeUser(creator)
          : {
              createdAt: now.toISOString(),
              email: `api-key+${apiKey.apiKeyId}@periscan.local`,
              name: `API key (${apiKey.name})`,
              status: "Active",
              updatedAt: now.toISOString(),
              userId: apiKey.createdBy
            }
      };
    },

    async createApiKey(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "create an API key"
      );
      await assertPrivilegedMfaStepUp(prisma, context, input.totpCode);

      const token = generateApiKeyToken();
      const created = await prisma.tenantApiKey.create({
        data: {
          createdBy: context.user.userId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          keyHash: token.keyHash,
          keyPrefix: token.keyPrefix,
          name: input.name,
          scopes: input.scopes,
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "api_key.created",
        actorType: "User",
        entityId: created.apiKeyId,
        entityType: "Tenant",
        metadata: {
          name: created.name,
          scopes: created.scopes
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        ...serializeApiKey(created),
        secret: token.secret
      };
    },

    async listApiKeys(context) {
      requireRole(context.membership.role, TENANT_ADMIN_ROLES, "list API keys");

      const keys = await prisma.tenantApiKey.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return keys.map(serializeApiKey);
    },

    async revokeApiKey(context, apiKeyId, totpCode?: string | null) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "revoke an API key"
      );
      await assertPrivilegedMfaStepUp(prisma, context, totpCode);

      const existing = await prisma.tenantApiKey.findFirst({
        where: {
          apiKeyId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!existing) {
        throw new AppServiceError("API key not found.", 404, "not_found");
      }

      const revoked = existing.revokedAt
        ? existing
        : await prisma.tenantApiKey.update({
            data: {
              revokedAt: new Date()
            },
            where: {
              apiKeyId
            }
          });

      if (!existing.revokedAt) {
        await writeAuditEvent(prisma, {
          action: "api_key.revoked",
          actorType: "User",
          entityId: apiKeyId,
          entityType: "Tenant",
          metadata: {
            name: revoked.name
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      }

      return serializeApiKey(revoked);
    },

    async rotateApiKey(context, apiKeyId, totpCode?: string | null) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "rotate an API key"
      );
      await assertPrivilegedMfaStepUp(prisma, context, totpCode);

      const existing = await prisma.tenantApiKey.findFirst({
        where: {
          apiKeyId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!existing) {
        throw new AppServiceError("API key not found.", 404, "not_found");
      }

      if (existing.revokedAt) {
        throw new AppServiceError(
          "Cannot rotate a revoked API key.",
          409,
          "api_key_revoked"
        );
      }

      const token = generateApiKeyToken();
      const rotated = await prisma.tenantApiKey.update({
        data: {
          keyHash: token.keyHash,
          keyPrefix: token.keyPrefix,
          lastUsedAt: null
        },
        where: {
          apiKeyId
        }
      });

      await writeAuditEvent(prisma, {
        action: "api_key.rotated",
        actorType: "User",
        entityId: apiKeyId,
        entityType: "Tenant",
        metadata: {
          name: rotated.name
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        ...serializeApiKey(rotated),
        secret: token.secret
      };
    }
  };
}
