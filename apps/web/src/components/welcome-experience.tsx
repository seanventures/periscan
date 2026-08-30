"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { ProductOutcome, ProductPersona } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { Brandmark, buttonClassName, cn } from "../ui";

const PERSONAS: Array<{
  description: string;
  label: string;
  value: ProductPersona;
}> = [
  {
    description:
      "Lead with validated risk, control misses, change, and proof ready to share.",
    label: "Security leader",
    value: "SecurityLeader"
  },
  {
    description:
      "Lead with the operator queue, mission readiness, findings, and fresh verification.",
    label: "Security engineer",
    value: "SecurityEngineer"
  },
  {
    description:
      "Lead with evidence traceability, integrity, governed delivery, and framework context.",
    label: "GRC or auditor",
    value: "GrcAuditor"
  },
  {
    description:
      "Lead with client exceptions, stalled work, missing inputs, and proof delivery.",
    label: "MSSP or vCISO",
    value: "MsspOperator"
  }
];

const OUTCOMES: Array<{
  description: string;
  label: string;
  value: ProductOutcome;
}> = [
  {
    description:
      "Understand the measured path or control miss that matters most.",
    label: "Prioritize risk",
    value: "PrioritizeRisk"
  },
  {
    description:
      "Validate a path, route the smallest fix, and prove it with a fresh re-test.",
    label: "Run a proof loop",
    value: "RunProofLoop"
  },
  {
    description: "Build a traceable, governed evidence pack for a stakeholder.",
    label: "Produce assurance",
    value: "ProduceAssurance"
  },
  {
    description:
      "Find the client tenants with regressions, stale proof, or overdue work.",
    label: "Triage clients",
    value: "TriageClients"
  }
];

/**
 * Optional persona / outcome customize view.
 *
 * P02-1 residual: not a first-run spine. Signup and empty Home use GetStarted
 * on `/dashboard`. Signed-in users hitting bare `/welcome` are redirected to
 * Home; open `?customize=1` (shell "View ·") to keep persona pick capability.
 * Unsigned visitors only see login/signup (middleware also redirects them).
 */
export function WelcomeExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customize =
    searchParams.get("customize") === "1" ||
    searchParams.get("customize") === "true";
  const activation = useApiResource(() => api.getProductActivationState(), []);
  const [persona, setPersona] = useState<ProductPersona | null>(null);
  const [outcome, setOutcome] = useState<ProductOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activation.data?.profile.productPersona) {
      setPersona(activation.data.profile.productPersona);
    }
    if (activation.data?.profile.primaryOutcome) {
      setOutcome(activation.data.profile.primaryOutcome);
    }
  }, [activation.data]);

  // P02-1: signed-in bare /welcome is not a competing first-run board.
  // SecurityLeader lands Executive (ICP leadership first-run); others Home.
  useEffect(() => {
    if (activation.loading || customize) return;
    if (activation.data) {
      const personaHome =
        activation.data.profile.productPersona === "SecurityLeader"
          ? "/executive"
          : "/dashboard";
      router.replace(personaHome);
    }
  }, [activation.loading, activation.data, customize, router]);

  // SecurityLeader → /executive first-run (Operate leadership path).
  // Other personas keep Home GetStarted as the first-run spine.
  const continueDestination =
    persona === "SecurityLeader" ? "/executive" : "/dashboard";
  const primaryCtaLabel = busy
    ? "Saving…"
    : persona === "SecurityLeader"
      ? "Continue to Executive"
      : "Continue to Home setup";

  async function save() {
    if (!persona || !outcome) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateProductExperienceProfile({
        primaryOutcome: outcome,
        productPersona: persona
      });
      router.push(continueDestination);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't save your starting view."
      );
    } finally {
      setBusy(false);
    }
  }

  // Unsigned / unauthenticated: login + signup only (no persona wizard).
  // Middleware normally redirects before render; this is a belt-and-suspenders
  // UX if the session cookie is missing or the activation call is denied.
  const unauthenticated =
    !activation.loading &&
    activation.data == null &&
    Boolean(activation.error);

  if (unauthenticated) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="auth-main min-h-screen bg-bg px-5 py-8 text-ink sm:px-8 sm:py-12"
      >
        <div className="mx-auto max-w-md">
          <Brandmark size={24} />
          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Welcome
          </p>
          <h1 className="mt-3 text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Sign in to get started
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            First-run setup lives on Home after you sign in. This page does not
            run a separate onboarding wizard.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={buttonClassName({ variant: "primary" })}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={buttonClassName({ variant: "ghost" })}
            >
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Bare /welcome for signed-in users: brief handoff while replace runs.
  if (!customize && (activation.loading || activation.data)) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="auth-main min-h-screen bg-bg px-5 py-8 text-ink sm:px-8 sm:py-12"
      >
        <div className="mx-auto max-w-md">
          <Brandmark size={24} />
          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Continuing to Home
          </p>
          <h1 className="mt-3 text-balance font-display text-3xl font-semibold leading-tight">
            Setup lives on the dashboard
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            First-run is GetStarted on Home — not a second wizard here.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonClassName({ variant: "primary" }), "mt-8 inline-flex")}
          >
            Open Home setup
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="auth-main min-h-screen bg-bg px-5 py-8 text-ink sm:px-8 sm:py-12"
    >
      <div className="mx-auto max-w-5xl">
        <header className="max-w-2xl">
          <Brandmark size={24} />
          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Optional · Customize view
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-tight sm:text-5xl">
            What proof do you need first?
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted">
            Optional 30-second role picker. Periscan prioritizes landing view
            and guidance only — it does not change permissions. Security leaders
            continue to Executive; operators continue to Home setup (connect →
            authorize → validate).
          </p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <ChoiceGroup
            eyebrow="1 · Your role"
            items={PERSONAS}
            selected={persona}
            onSelect={(value) => setPersona(value as ProductPersona)}
          />
          <ChoiceGroup
            eyebrow="2 · First outcome"
            items={OUTCOMES}
            selected={outcome}
            onSelect={(value) => setOutcome(value as ProductOutcome)}
          />
        </div>

        <footer className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {error ? (
              <p role="alert" className="text-sm text-missed">
                {error}
              </p>
            ) : (
              <p className="text-xs text-subtle">
                Skip or continue — Security leaders open Executive; operators
                see three Home setup steps. Full proof-loop checklist stays on
                the activation guide.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(continueDestination)}
              className={buttonClassName({ variant: "ghost" })}
            >
              {persona === "SecurityLeader"
                ? "Skip — go to Executive"
                : "Skip — go to Home setup"}
            </button>
            <button
              type="button"
              disabled={!persona || !outcome || busy}
              onClick={save}
              className={buttonClassName({ variant: "primary" })}
            >
              {primaryCtaLabel}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}

function ChoiceGroup({
  eyebrow,
  items,
  onSelect,
  selected
}: {
  eyebrow: string;
  items: Array<{ description: string; label: string; value: string }>;
  onSelect: (value: string) => void;
  selected: string | null;
}) {
  return (
    <section aria-labelledby={`${eyebrow}-label`}>
      <h2
        id={`${eyebrow}-label`}
        className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-subtle"
      >
        {eyebrow}
      </h2>
      <ul className="mt-3 flex list-none flex-col gap-2">
        {items.map((item) => {
          const active = selected === item.value;
          return (
            <li key={item.value}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item.value)}
                className={cn(
                  "group flex min-h-24 w-full items-start gap-4 rounded-card border p-4 text-left transition-colors",
                  active
                    ? "border-brand bg-brand/[0.08]"
                    : "border-line bg-elevated hover:border-line-strong"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 grid size-5 shrink-0 place-items-center rounded-full border",
                    active ? "border-brand bg-brand" : "border-line-strong"
                  )}
                >
                  {active ? (
                    <span className="size-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <span>
                  <span className="block font-display text-[15px] font-semibold text-ink">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-[13px] leading-5 text-muted">
                    {item.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
