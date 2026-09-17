"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { Brandmark, buttonClassName } from "../ui";

const inputClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function AccessRecoveryForm({ mode }: { mode: "invite" | "reset" }) {
  const searchParams = useSearchParams();
  const token =
    searchParams?.get("token")?.trim() ??
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")?.trim()
      : "") ??
    "";
  const requestingReset = mode === "reset" && !token;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (requestingReset) {
        const result = await api.requestPasswordReset(email.trim());
        setSuccess(result.message);
      } else {
        if (!token) throw new Error("This link is missing its secure token.");
        if (password.length < 12) {
          throw new Error("Use at least 12 characters for your new password.");
        }
        if (password !== confirmation) throw new Error("Passwords do not match.");
        const result =
          mode === "invite"
            ? await api.acceptInvite({ password, token })
            : await api.confirmPasswordReset({ password, token });
        setSuccess(result.message);
        setPassword("");
        setConfirmation("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  const title = requestingReset
    ? "Reset your password"
    : mode === "invite"
      ? "Join your workspace"
      : "Choose a new password";

  return (
    <main id="main-content" tabIndex={-1} className="auth-main flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Brandmark size={26} />
          <p className="max-w-xs font-display text-sm text-muted">
            {requestingReset
              ? "We'll send a one-hour reset link if the account exists."
              : mode === "invite"
                ? "Activate your account to enter the workspace that invited you."
                : "Set a strong password to recover access to Periscan."}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-card border border-line bg-elevated p-6"
        >
          <h1 className="font-display text-lg font-semibold">{title}</h1>

          {requestingReset ? (
            <label className="flex flex-col gap-1">
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Work email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className={inputClass}
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  New password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Confirm password
                </span>
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  className={inputClass}
                />
              </label>
              <p className="text-xs text-subtle">At least 12 characters.</p>
            </>
          )}

          {error ? (
            <p role="alert" className="text-sm text-missed">
              {error}
            </p>
          ) : null}
          {success ? (
            <div role="status" className="rounded-control border border-fixed/30 bg-fixed/5 p-3 text-sm text-fixed">
              <p>{success}</p>
              {!requestingReset ? (
                <Link href="/login" className="mt-2 inline-block font-medium underline">
                  Continue to sign in
                </Link>
              ) : null}
            </div>
          ) : null}

          {!success || requestingReset ? (
            <button
              type="submit"
              disabled={busy}
              className={buttonClassName({ variant: "primary" }) + " mt-1 w-full justify-center"}
            >
              {busy
                ? "Working…"
                : requestingReset
                  ? "Send reset link"
                  : mode === "invite"
                    ? "Activate account"
                    : "Update password"}
            </button>
          ) : null}
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="text-brand hover:text-brand-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
