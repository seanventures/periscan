"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import type { DataResidencyOptions } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  readNextQueryParam,
  safeInternalNextPath
} from "../lib/safe-next-path";
import { Brandmark, buttonClassName } from "../ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [dataRegion, setDataRegion] = useState("");
  const [residencyOptions, setResidencyOptions] =
    useState<DataResidencyOptions | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignup) return;
    let active = true;
    void api.getDataResidencyOptions().then(
      (options) => {
        if (!active) return;
        setResidencyOptions(options);
        setDataRegion(options.defaultRegion);
      },
      () => {
        // Signup remains available with the server-side deployment default.
      }
    );
    return () => {
      active = false;
    };
  }, [isSignup]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) {
        await api.signup({
          dataRegion: dataRegion || undefined,
          name: name.trim(),
          tenantName: tenantName.trim(),
          email: email.trim(),
          password
        });
      } else {
        await api.login({
          email: email.trim(),
          password,
          totpCode: totp.trim() || undefined
        });
      }
      // P02-1 residual: signup lands on Home so GetStarted owns first-run.
      // Optional persona customize stays at /welcome via shell "View ·", not a
      // competing post-signup spine.
      let destination = "/dashboard";
      if (!isSignup) {
        // Middleware (and shared links) set ?next= for post-login return.
        // Prefer a safe same-origin relative path over persona home.
        const deepLink = safeInternalNextPath(readNextQueryParam());
        if (deepLink) {
          destination = deepLink;
        } else {
          try {
            const activation = await api.getProductActivationState();
            destination =
              activation.profile.productPersona === "SecurityLeader"
                ? "/executive"
                : activation.profile.productPersona === "GrcAuditor"
                  ? "/reports"
                  : activation.profile.productPersona === "MsspOperator"
                    ? "/mssp"
                    : "/dashboard";
          } catch {
            // Authentication succeeded; a profile read must never strand login.
          }
        }
      }
      router.push(destination);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : isSignup
            ? "Couldn't create your account."
            : "Couldn't sign you in.";
      if (
        !isSignup &&
        /mfa|totp|two-factor|authenticator|verification code/i.test(message)
      ) {
        setNeedsTotp(true);
        setError("Enter the code from your authenticator app.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function continueWithSso() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError(
        "Enter your work email to find your organization's SSO configuration."
      );
      return;
    }
    setSsoBusy(true);
    setError(null);
    try {
      const result = await api.startSsoLogin({ email: normalizedEmail });
      window.location.assign(result.authorizationUrl);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't start SSO."
      );
      setSsoBusy(false);
    }
  }

  function enterDemo() {
    setDemoBusy(true);
    try {
      localStorage.setItem("periscan.demo.guide.v1", JSON.stringify(["start"]));
    } catch {
      // Demo progress is optional and contains no customer or session data.
    }
    router.push("/demo/workspace");
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="auth-main flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink"
    >
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Brandmark size={26} />
          <p className="font-display text-sm text-muted">
            {isSignup
              ? "Create your evidence command center."
              : "Find the path. Validate the risk. Prove it's fixed."}
          </p>
        </div>

        <form
          onSubmit={submit}
          aria-label={isSignup ? "Create account" : "Sign in"}
          className="flex flex-col gap-3 rounded-card border border-line bg-elevated p-6"
        >
          <h1 className="font-display text-lg font-semibold">
            {isSignup ? "Create account" : "Sign in"}
          </h1>

          {isSignup ? (
            <>
              <Field label="Your name" htmlFor="name">
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className={inputClass}
                />
              </Field>
              <Field label="Organization" htmlFor="tenant">
                <input
                  id="tenant"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                  autoComplete="organization"
                  className={inputClass}
                />
              </Field>
              <Field label="Data residency" htmlFor="data-region">
                <select
                  id="data-region"
                  aria-label="Data residency"
                  value={dataRegion}
                  onChange={(event) => setDataRegion(event.target.value)}
                  disabled={!residencyOptions}
                  required
                  className={inputClass}
                >
                  {!residencyOptions ? (
                    <option value="">Loading configured regions…</option>
                  ) : null}
                  {residencyOptions?.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] leading-4 text-subtle">
                  Evidence is routed to storage configured for this region. This
                  choice is fixed at workspace provisioning.
                </span>
              </Field>
            </>
          ) : null}

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={inputClass}
            />
          </Field>

          {!isSignup ? (
            <div className="-mt-1 text-right">
              <Link
                href="/reset-password"
                className="text-xs text-brand hover:text-brand-2"
              >
                Forgot password?
              </Link>
            </div>
          ) : null}

          {!isSignup && needsTotp ? (
            <Field label="Authenticator code" htmlFor="totp">
              <input
                id="totp"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className={inputClass + " font-mono tracking-[0.3em]"}
                autoFocus
              />
            </Field>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-missed">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className={
              buttonClassName({ variant: "primary" }) +
              " mt-1 w-full justify-center"
            }
          >
            {busy
              ? isSignup
                ? "Creating…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>

          {!isSignup ? (
            <>
              <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-wider text-subtle before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                or
              </div>
              <button
                type="button"
                onClick={continueWithSso}
                disabled={busy || ssoBusy || demoBusy}
                className={
                  buttonClassName({ variant: "secondary" }) +
                  " w-full justify-center"
                }
              >
                {ssoBusy ? "Redirecting…" : "Continue with SSO"}
              </button>

              <div className="mt-1 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={enterDemo}
                  disabled={busy || ssoBusy || demoBusy}
                  className={buttonClassName({
                    className: "w-full",
                    variant: "ghost"
                  })}
                >
                  {demoBusy ? "Opening demo…" : "Use demo login"}
                </button>
                <p className="mt-1.5 text-center text-[11px] leading-4 text-subtle">
                  Opens an isolated, read-only sample workspace. No customer
                  session or credentials are created.
                </p>
              </div>
            </>
          ) : null}
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-brand hover:text-brand-2">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Periscan?{" "}
              <Link href="/signup" className="text-brand hover:text-brand-2">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}
