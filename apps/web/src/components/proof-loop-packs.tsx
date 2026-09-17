"use client";

import Link from "next/link";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  StateBadge,
  buttonClassName
} from "../ui";

export function ProofLoopPacks() {
  const readiness = useApiResource(async () => {
    const [
      activation,
      integrations,
      scopes,
      aiApps,
      controls,
      runners,
      session,
      integrity,
      enterprise
    ] = await Promise.all([
      api.getProductActivationState(),
      api.listIntegrations(),
      api.listScopes(),
      api.listAIApplications(),
      api.listControlSources(),
      api.listRunners(),
      api.getMe(),
      api.verifyEvidenceChain(),
      api.getEnterpriseBreadthReadiness()
    ]);
    return {
      activation,
      integrations,
      scopes,
      aiApps,
      controls,
      runners,
      session,
      integrity,
      enterprise
    };
  }, []);

  if (readiness.loading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-6">
        <LoadingSkeleton rows={9} />
      </div>
    );
  }
  if (readiness.error || !readiness.data) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-6">
        <ErrorState
          message={readiness.error ?? "Pack readiness is unavailable."}
          onRetry={readiness.refetch}
        />
      </div>
    );
  }

  const {
    activation,
    integrations,
    scopes,
    aiApps,
    controls,
    runners,
    session,
    integrity,
    enterprise
  } = readiness.data;
  const connected = integrations.some((item) => item.status === "Connected");
  const verified = scopes.some(
    (item) => item.verificationStatus === "Verified"
  );
  const externalScope = scopes.some(
    (item) =>
      item.verificationStatus === "Verified" &&
      ["Domain", "Subdomain", "IPRange"].includes(item.scopeType)
  );
  const policyPreviewed = activation.milestones.some(
    (item) => item.key === "PolicyPreviewed" && item.state === "Completed"
  );
  const runnerReady = runners.some((item) => item.status === "Active");
  const packs = [
    {
      description:
        "Correlate connected signals, validate a bounded scenario, route the smallest fix, and deliver governed proof.",
      href: "/missions",
      name: "Core validation",
      checks: [
        ["Connected signal source", connected, "/integrations"],
        ["Verified authorized scope", verified, "/missions"],
        ["Policy preview recorded", policyPreviewed, "/policies"],
        ["Evidence chain available", integrity.valid, "/evidence"]
      ]
    },
    {
      description:
        "Run safe AI application tests through the same scope, policy, evidence, remediation, and verification loop.",
      href: "/ai-apps",
      name: "AI application validation",
      checks: [
        ["AI application registered", aiApps.length > 0, "/ai-apps"],
        ["Verified scope", verified, "/missions"],
        ["Policy preview recorded", policyPreviewed, "/policies"],
        ["Evidence chain available", integrity.valid, "/evidence"]
      ]
    },
    {
      description:
        "Measure whether a recorded control detected, blocked, logged, alerted, or missed the governed test.",
      href: "/controls",
      name: "Control validation",
      checks: [
        ["Control source configured", controls.length > 0, "/controls"],
        ["Connected signal source", connected, "/integrations"],
        ["Verified scope", verified, "/missions"],
        ["Policy preview recorded", policyPreviewed, "/policies"]
      ]
    },
    {
      description:
        "Run approved in-network discovery and checks through an outbound-only runner with local scope constraints.",
      href: "/runners",
      name: "Internal runner validation",
      checks: [
        ["Runner online", runnerReady, "/runners"],
        [
          "Internal scope verified",
          scopes.some(
            (item) =>
              item.scopeType === "InternalNetwork" &&
              item.verificationStatus === "Verified"
          ),
          "/missions"
        ],
        ["Policy preview recorded", policyPreviewed, "/policies"],
        ["Evidence chain available", integrity.valid, "/evidence"]
      ]
    },
    {
      description:
        "Validate internet-facing reachability only inside a verified external scope and its effective safety ceiling.",
      href: "/external-validation",
      name: "External validation",
      checks: [
        ["External scope verified", externalScope, "/missions"],
        ["Connected signal source", connected, "/integrations"],
        ["Policy preview recorded", policyPreviewed, "/policies"],
        ["Evidence chain available", integrity.valid, "/evidence"]
      ]
    },
    {
      description:
        "Rank client exceptions and deliver branded proof while preserving tenant boundaries and underlying evidence.",
      href: "/mssp",
      name: "MSSP delivery",
      checks: [
        ["MSSP parent tenant", session.tenant.type === "MSSP", "/mssp"],
        ["Evidence chain available", integrity.valid, "/evidence"],
        ["Report workflow available", true, "/reports"],
        ["Tenant audit available", true, "/audit"]
      ]
    }
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6">
      <header className="max-w-3xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Admin readiness · deep link
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Capability readiness
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Not a daily product line or package SKU. This deep-linked readiness
          matrix checks whether real prerequisites (scope, integration, runner,
          policy, evidence) are present before a mode is usable. Primary path
          remains Connect → Validate → Paths → Findings → Remediation → Reports.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {packs.map((pack) => {
          const ready = pack.checks.every((check) => check[1]);
          const missing = pack.checks.filter((check) => !check[1]);
          return (
            <Panel key={pack.name} className="flex flex-col">
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      {pack.name}
                    </h2>
                    <p className="mt-1 text-[13px] leading-5 text-muted">
                      {pack.description}
                    </p>
                  </div>
                  <StateBadge tone={ready ? "fixed" : "approval"} dot={false}>
                    {ready
                      ? "Ready"
                      : `${missing.length} prerequisite${missing.length === 1 ? "" : "s"}`}
                  </StateBadge>
                </div>
                <ul className="mt-4 list-none divide-y divide-line border-y border-line">
                  {pack.checks.map(([label, satisfied, href]) => (
                    <li
                      key={label}
                      className="flex items-center gap-2 py-2 text-xs"
                    >
                      <span
                        aria-hidden
                        className={satisfied ? "text-fixed" : "text-approval"}
                      >
                        {satisfied ? "✓" : "○"}
                      </span>
                      <span className={satisfied ? "text-muted" : "text-ink"}>
                        {label}
                      </span>
                      {!satisfied ? (
                        <Link
                          href={href}
                          className="ml-auto font-semibold text-brand"
                        >
                          Resolve →
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Link
                  href={pack.href}
                  className={buttonClassName({
                    className: "mt-4 w-fit",
                    variant: ready ? "primary" : "secondary"
                  })}
                >
                  {ready ? "Open pack workspace" : "Review pack"}
                </Link>
              </div>
            </Panel>
          );
        })}
      </div>

      <section className="mt-4 border-t border-line pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
              Enterprise breadth
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
              Capability truth, tenant by tenant
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Operational means a healthy customer connector or measured tenant
              inventory exists. Configurable means the native path is
              implemented but still needs customer data. Externally gated means
              Periscan cannot complete the promise alone.
            </p>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
            Assessed{" "}
            {new Date(enterprise.generatedAt).toLocaleString("en-US", {
              timeZone: "UTC"
            })}{" "}
            UTC
          </p>
        </div>

        <div className="mt-5 divide-y divide-line border-y border-line">
          {enterprise.packs.map((pack, index) => {
            const tone =
              pack.state === "Operational"
                ? "fixed"
                : pack.state === "Configurable"
                  ? "approval"
                  : "inconclusive";
            return (
              <article
                key={pack.key}
                className="grid gap-4 py-5 lg:grid-cols-[3rem_0.8fr_1.7fr] lg:gap-6"
              >
                <span
                  aria-hidden
                  className="font-mono text-xs font-semibold text-subtle"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <StateBadge tone={tone}>{pack.state}</StateBadge>
                  <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                    {pack.name}
                  </h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted">
                    {pack.description}
                  </p>
                </div>
                <ul className="list-none divide-y divide-line/70 border-l border-line pl-4">
                  {pack.checks.map((check) => {
                    const satisfied = check.state === "Satisfied";
                    const external = check.state === "ExternalDependency";
                    return (
                      <li
                        key={check.key}
                        className="py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            aria-hidden
                            className={
                              satisfied
                                ? "text-fixed"
                                : external
                                  ? "text-inconclusive-text"
                                  : "text-approval"
                            }
                          >
                            {satisfied ? "✓" : external ? "◇" : "○"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-xs font-semibold text-ink">
                                {check.label}
                              </span>
                              {check.actionHref ? (
                                <Link
                                  href={check.actionHref}
                                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-brand"
                                >
                                  {satisfied ? "Open" : "Resolve"} →
                                </Link>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted">
                              {check.detail}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
