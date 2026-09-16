"use client";

import { startTransition, useEffect, useState } from "react";
import QRCode from "qrcode";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import { useWithBusy } from "../hooks/use-with-busy";
import { Badge, Button, Card } from "../ui";
import { StatusPanel } from "./status-panel";

type LoadStatus = "loading" | "authenticated" | "unauthenticated" | "error";

const fieldClass = "flex flex-col gap-1 text-sm text-muted";
const inputClass =
  "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function MfaQrCode({ value }: { value: string }) {
  const matrix = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
  const path: string[] = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.get(row, column)) {
        path.push(`M${column} ${row}h1v1h-1z`);
      }
    }
  }

  return (
    <div className="w-fit rounded-control border border-line bg-white p-3">
      <svg
        aria-label="QR code for Periscan MFA enrollment"
        className="size-48 max-w-full"
        role="img"
        shapeRendering="crispEdges"
        viewBox={`-4 -4 ${matrix.size + 8} ${matrix.size + 8}`}
      >
        <rect
          fill="white"
          height={matrix.size + 8}
          width={matrix.size + 8}
          x="-4"
          y="-4"
        />
        <path d={path.join("")} fill="#0a1224" />
      </svg>
    </div>
  );
}

function RecoveryCodesPanel({ codes }: { codes: string[] }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-control border border-warning/40 bg-warning/10 p-3"
      aria-label="Recovery codes"
      role="status"
    >
      <strong className="text-ink">Save your recovery codes</strong>
      <p className="text-sm text-muted">
        Store these single-use codes somewhere safe. Each works once if you lose
        your authenticator. They will not be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-ink">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}

export function AccountSecurity() {
  const [auth, setAuth] = useState<AuthSessionPayload | null>(null);
  const [forceMfaEffective, setForceMfaEffective] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error: actionError, clearError, run } = useWithBusy();

  const [enrollment, setEnrollment] = useState<{
    secret: string;
    otpauthUri: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTotpCode, setPasswordTotpCode] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadStatus("loading");

    void browserPeriscanApiClient
      .getMe()
      .then(async (next) => {
        if (!active) {
          return;
        }
        setAuth(next);
        setLoadStatus("authenticated");
        try {
          const policy = await browserPeriscanApiClient.getTenantRequireMfa();
          if (active) {
            setForceMfaEffective(policy.effectiveRequireMfa);
          }
        } catch {
          // Fall back to tenant flag / enrollment signal on /me.
          if (active) {
            setForceMfaEffective(
              Boolean(next.tenant.requireMfa) ||
                Boolean(next.mfaEnrollmentRequired)
            );
          }
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setLoadStatus("unauthenticated");
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load your account."
        );
        setLoadStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshAuth() {
    const next = await browserPeriscanApiClient.getMe();
    setAuth(next);
    try {
      const policy = await browserPeriscanApiClient.getTenantRequireMfa();
      setForceMfaEffective(policy.effectiveRequireMfa);
    } catch {
      setForceMfaEffective(
        Boolean(next.tenant.requireMfa) || Boolean(next.mfaEnrollmentRequired)
      );
    }
  }

  if (loadStatus === "loading") {
    return (
      <StatusPanel
        body="Reading your account security settings."
        eyebrow="Account security"
        kind="loading"
        title="Loading account security."
      />
    );
  }

  if (loadStatus === "unauthenticated") {
    return (
      <StatusPanel
        body="Sign in from the workspace to manage multi-factor authentication for your account."
        eyebrow="Account security"
        kind="info"
        title="Sign in to manage account security."
      />
    );
  }

  if (loadStatus === "error" || !auth) {
    return (
      <StatusPanel
        body={loadError ?? "Account security is unavailable."}
        eyebrow="Account security"
        kind="error"
        title="Unable to load account security."
      />
    );
  }

  const mfaEnabled = Boolean(auth.user.mfaEnabledAt);
  const forceMfaEnrollment = Boolean(auth.mfaEnrollmentRequired);
  const mfaRequiredByPolicy =
    forceMfaEffective ||
    Boolean(auth.tenant.requireMfa) ||
    forceMfaEnrollment;

  return (
    <div className="flex flex-col gap-4">
      {actionError ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{actionError}</p>
          <button
            aria-label="Dismiss error"
            className="text-xs text-muted underline"
            onClick={() => clearError()}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {forceMfaEnrollment ? (
        <div
          className="rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink"
          role="status"
        >
          <strong>MFA enrollment required.</strong> Workspace or deployment
          policy requires multi-factor authentication before you can use the
          rest of Periscan. Enroll and verify an authenticator below.
        </div>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">
            Multi-factor authentication
          </h2>
          <Badge
            tone={mfaEnabled ? "success" : forceMfaEnrollment ? "warning" : "neutral"}
            role="status"
            aria-label={`MFA status: ${
              mfaEnabled
                ? "Enabled"
                : forceMfaEnrollment
                  ? "Required"
                  : "Disabled"
            }`}
          >
            {mfaEnabled
              ? "Enabled"
              : forceMfaEnrollment
                ? "Required"
                : "Disabled"}
          </Badge>
        </div>
        <p className="text-sm text-muted">
          TOTP-based MFA adds a second factor at sign-in for {auth.user.email}.
          Codes come from any authenticator app.
          {mfaRequiredByPolicy
            ? " Policy requires MFA for password users in this workspace."
            : null}
        </p>

        {!mfaEnabled ? (
          <div className="flex flex-col gap-3">
            {!enrollment ? (
              <div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    startTransition(
                      () =>
                        void run(async () => {
                          const result =
                            await browserPeriscanApiClient.enrollMfa();
                          setEnrollment(result);
                          setRecoveryCodes(null);
                        }, "Unable to begin MFA enrollment.")
                    )
                  }
                >
                  Enable MFA
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3">
                <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                  <MfaQrCode value={enrollment.otpauthUri} />
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted">
                      Scan this QR code with your authenticator app, then enter
                      the 6-digit code it shows to activate MFA.
                    </p>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="text-muted">
                        Can&apos;t scan? Enter this setup key manually.
                      </span>
                      <code className="break-all rounded-control bg-bg px-2 py-1 text-ink">
                        {enrollment.secret}
                      </code>
                    </div>
                  </div>
                </div>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(
                      () =>
                        void run(async () => {
                          const result =
                            await browserPeriscanApiClient.verifyMfa(
                              verifyCode
                            );
                          setRecoveryCodes(result.recoveryCodes);
                          setEnrollment(null);
                          setVerifyCode("");
                          await refreshAuth();
                        }, "Unable to verify the MFA code.")
                    );
                  }}
                >
                  <label className={fieldClass} htmlFor="mfa-verify-code">
                    <span>Authenticator code</span>
                    <input
                      className={inputClass}
                      id="mfa-verify-code"
                      inputMode="numeric"
                      onChange={(event) => setVerifyCode(event.target.value)}
                      value={verifyCode}
                      required
                    />
                  </label>
                  <Button disabled={busy} type="submit">
                    Verify &amp; activate
                  </Button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(
                  () =>
                    void run(async () => {
                      const result =
                        await browserPeriscanApiClient.regenerateMfaRecoveryCodes(
                          {
                            password: reauthPassword
                          }
                        );
                      setRecoveryCodes(result.recoveryCodes);
                      setReauthPassword("");
                    }, "Unable to regenerate recovery codes.")
                );
              }}
            >
              <label className={fieldClass} htmlFor="mfa-reauth-password">
                <span>Current password</span>
                <input
                  className={inputClass}
                  id="mfa-reauth-password"
                  onChange={(event) => setReauthPassword(event.target.value)}
                  type="password"
                  value={reauthPassword}
                  required
                />
              </label>
              <Button variant="secondary" disabled={busy} type="submit">
                Regenerate recovery codes
              </Button>
              <Button
                variant="danger"
                disabled={busy || mfaRequiredByPolicy}
                title={
                  mfaRequiredByPolicy
                    ? "MFA is required by policy and cannot be disabled"
                    : undefined
                }
                type="button"
                onClick={() =>
                  startTransition(
                    () =>
                      void run(async () => {
                        await browserPeriscanApiClient.disableMfa({
                          password: reauthPassword
                        });
                        setReauthPassword("");
                        setRecoveryCodes(null);
                        await refreshAuth();
                      }, "Unable to disable MFA.")
                  )
                }
              >
                Disable MFA
              </Button>
            </form>
            <p className="text-xs text-muted">
              {mfaRequiredByPolicy
                ? "MFA is required by workspace or deployment policy and cannot be disabled here."
                : "Enter your current password to regenerate codes or disable MFA."}
            </p>
          </div>
        )}

        {recoveryCodes ? <RecoveryCodesPanel codes={recoveryCodes} /> : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Password</h2>
          <p className="mt-1 text-sm text-muted">
            Updating your password also signs out older browsers and devices.
          </p>
        </div>
        {passwordSuccess ? (
          <p className="text-sm text-success" role="status">
            {passwordSuccess}
          </p>
        ) : null}
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(
              () =>
                void run(async () => {
                  if (newPassword !== confirmPassword) {
                    throw new Error(
                      "New password confirmation does not match."
                    );
                  }
                  const result = await browserPeriscanApiClient.changePassword({
                    currentPassword,
                    newPassword,
                    totpCode: passwordTotpCode || undefined
                  });
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordTotpCode("");
                  setPasswordSuccess(result.message);
                }, "Unable to update password.")
            );
          }}
        >
          <label className={fieldClass} htmlFor="current-password">
            <span>Current password</span>
            <input
              autoComplete="current-password"
              className={inputClass}
              id="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label className={fieldClass} htmlFor="password-totp-code">
            <span>Authenticator code (when MFA is enabled)</span>
            <input
              autoComplete="one-time-code"
              className={inputClass}
              id="password-totp-code"
              inputMode="numeric"
              onChange={(event) => setPasswordTotpCode(event.target.value)}
              value={passwordTotpCode}
            />
          </label>
          <label className={fieldClass} htmlFor="new-password">
            <span>New password</span>
            <input
              autoComplete="new-password"
              className={inputClass}
              id="new-password"
              minLength={12}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label className={fieldClass} htmlFor="confirm-password">
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              className={inputClass}
              id="confirm-password"
              minLength={12}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <div className="md:col-span-2">
            <Button disabled={busy} type="submit">
              Update password
            </Button>
          </div>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Active sessions
            </h2>
            <p className="mt-1 text-sm text-muted">
              This browser has the session you are using now.
            </p>
          </div>
          <Badge tone="success">Current browser</Badge>
        </div>
        <div className="rounded-control border border-line bg-bg p-3">
          <p className="text-sm font-medium text-ink">Signed-in browser</p>
          <p className="mt-1 text-xs text-muted">
            Sessions expire after seven days. Device names, IP addresses, and
            location history are not persisted by the current signed-cookie
            session model.
          </p>
        </div>
        {sessionSuccess ? (
          <p className="text-sm text-success" role="status">
            {sessionSuccess}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy}
            onClick={() =>
              startTransition(
                () =>
                  void run(async () => {
                    const result =
                      await browserPeriscanApiClient.revokeOtherSessions();
                    setSessionSuccess(result.message);
                  }, "Unable to revoke other sessions.")
              )
            }
            variant="secondary"
          >
            Sign out other sessions
          </Button>
          <p className="text-xs text-muted">
            Invalidates every older Periscan session while keeping this browser
            signed in.
          </p>
        </div>
      </Card>
    </div>
  );
}
