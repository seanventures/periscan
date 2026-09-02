"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  communityScopeAuthorizationHint,
  communityScopeVerificationKind,
  defaultAssetClassForCommunityScope,
  inferCommunityScopeType,
  listCommunityValidationSuiteForScopeType,
  type Scope,
  type ScopeType
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { ScopeSafetyEditor } from "./scope-safety-editor";
import { ScopeValueHint } from "./scope-value-hint";

const VERIFY_TONE: Record<string, StateTone> = {
  Verified: "fixed",
  Pending: "approval",
  Rejected: "missed"
};

const COMMUNITY_ADD_SCOPE_TYPES = [
  "Domain",
  "Repository",
  "CloudAccount",
  "IPRange"
] as const;
type CommunityAddScopeType = (typeof COMMUNITY_ADD_SCOPE_TYPES)[number];

function isCommunityAddScopeType(
  value: string
): value is CommunityAddScopeType {
  return (COMMUNITY_ADD_SCOPE_TYPES as readonly string[]).includes(value);
}

function communityAddScopeTypeLabel(type: CommunityAddScopeType): string {
  if (type === "CloudAccount") {
    return "AWS account";
  }
  if (type === "IPRange") {
    return "CIDR";
  }
  return type;
}

function communityAddScopePlaceholder(type: CommunityAddScopeType): string {
  switch (type) {
    case "Repository":
      return "/opt/customer/repo";
    case "CloudAccount":
      return "123456789012";
    case "IPRange":
      return "10.0.0.0/24";
    default:
      return "example.com";
  }
}

// SETTLED 506: Attest is Owner/Admin, not a DNS skip and not equal to the repo token file.
const REPOSITORY_ATTEST_DISCLAIMER =
  "Audited attestation — not a substitute for the authorization file when the control plane can read the path.";
const NETWORK_ATTEST_DISCLAIMER =
  "Audited Owner/Admin statement that this CIDR or internal network is customer-authorized.";

function attestActionLabel(scopeType: string): string {
  return communityScopeVerificationKind(scopeType) === "repository_token_file"
    ? "Attest as Owner (runner-only path)"
    : "Attest as Owner";
}

function attestDisclaimer(scopeType: string): string | null {
  const kind = communityScopeVerificationKind(scopeType);
  if (kind === "repository_token_file") {
    return REPOSITORY_ATTEST_DISCLAIMER;
  }
  if (kind === "operator_attestation") {
    return NETWORK_ATTEST_DISCLAIMER;
  }
  return null;
}

/**
 * Authorized-scope home. One add form: Domain (DNS TXT), Repository
 * (authorization file), CloudAccount (connected AWS or Owner attest), or CIDR
 * (Owner attest). Domain never skips DNS.
 */
export function ScopesWorkbench() {
  const scopes = useApiResource(() => api.listScopes(), []);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [scopeType, setScopeType] = useState<CommunityAddScopeType>("Domain");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = scopes.data ?? [];
  const selected =
    all.find((s) => s.scopeId === selectedScopeId) ?? all[0] ?? null;
  const selectedKind = selected
    ? communityScopeVerificationKind(selected.scopeType)
    : null;
  const selectedAttestCopy = selected
    ? attestDisclaimer(selected.scopeType)
    : null;

  const summary = useMemo(() => {
    const verified = all.filter((s) => s.verificationStatus === "Verified");
    const stale = verified.filter((s) => s.verificationStale);
    return {
      total: all.length,
      verified: verified.length,
      pending: all.filter((s) => s.verificationStatus === "Pending").length,
      stale: stale.length
    };
  }, [all]);

  async function addScope() {
    const value = newDomain.trim();
    if (!value) return;
    setAdding(true);
    setError(null);
    try {
      const scope = await api.createScope({
        assetClass: defaultAssetClassForCommunityScope(scopeType),
        scopeType,
        value
      });
      setNewDomain("");
      await scopes.refetch();
      setSelectedScopeId(scope.scopeId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't add that scope."
      );
    } finally {
      setAdding(false);
    }
  }

  async function verify(scope: Scope, operatorAttestation = false) {
    setVerifying(true);
    setError(null);
    try {
      await api.verifyScope(scope.scopeId, { operatorAttestation });
      await scopes.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Verification didn't pass yet — complete the challenge and retry."
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Operate · Scope
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Scope
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Nothing runs until a scope is verified.
        </p>
      </header>

      {all.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Scopes" value={summary.total} />
          <SummaryTile label="Verified" value={summary.verified} tone="fixed" />
          <SummaryTile label="Pending" value={summary.pending} tone="approval" />
          <SummaryTile label="Stale" value={summary.stale} tone="missed" />
        </div>
      ) : null}

      <Panel>
        <div
          className={cn(
            "flex flex-col gap-3 p-4 sm:flex-row sm:items-end",
            all.length > 0 || scopes.loading || scopes.error || error
              ? "border-b border-line"
              : null
          )}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Type
            <select
              aria-label="Scope type"
              value={scopeType}
              onChange={(e) => {
                const next = e.target.value;
                if (isCommunityAddScopeType(next)) {
                  setScopeType(next);
                }
              }}
              className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink"
            >
              {COMMUNITY_ADD_SCOPE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {communityAddScopeTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
            Value
            <input
              aria-label="Scope value"
              value={newDomain}
              onChange={(e) => {
                const next = e.target.value;
                setNewDomain(next);
                const inferred = inferCommunityScopeType(next);
                if (inferred && isCommunityAddScopeType(inferred)) {
                  setScopeType(inferred);
                }
              }}
              placeholder={communityAddScopePlaceholder(scopeType)}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <button
            type="button"
            disabled={adding || !newDomain.trim()}
            onClick={() => void addScope()}
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {adding ? "Adding…" : "Add scope"}
          </button>
        </div>
        <ScopeValueHint value={newDomain} />

        {error ? (
          <div
            role="alert"
            className="border-b border-missed/30 bg-missed/10 px-4 py-2 text-sm text-missed"
          >
            {error}
          </div>
        ) : null}

        {scopes.loading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : scopes.error ? (
          <div className="p-4">
            <ErrorState message={scopes.error} onRetry={scopes.refetch} />
          </div>
        ) : all.length > 0 ? (
          <ul className="divide-y divide-line">
            {all.map((scope) => {
              const active =
                (selectedScopeId ?? selected?.scopeId) === scope.scopeId;
              return (
                <li key={scope.scopeId}>
                  <button
                    type="button"
                    onClick={() => setSelectedScopeId(scope.scopeId)}
                    className={cn(
                      "flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors",
                      active ? "bg-brand/5" : "hover:bg-surface-strong/40"
                    )}
                  >
                    <span className="font-mono text-sm text-ink">
                      {scope.value}
                    </span>
                    <span className="font-mono text-[11px] text-subtle">
                      {scope.scopeType}
                    </span>
                    <StateBadge
                      tone={
                        VERIFY_TONE[scope.verificationStatus] ?? "inconclusive"
                      }
                      dot={false}
                    >
                      {scope.verificationStatus}
                    </StateBadge>
                    {scope.verificationStale ? (
                      <StateBadge tone="missed" dot={false}>
                        Stale
                      </StateBadge>
                    ) : null}
                    <span className="ml-auto font-mono text-[11px] text-subtle">
                      max {scope.effectiveMaxSafetyLevel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Panel>

      {selected ? (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-2">
                Selected scope
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink">
                {selected.value}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {selected.scopeType} · safety ceiling{" "}
                {selected.effectiveMaxSafetyLevel}
                {selected.verifiedAt
                  ? ` · verified ${new Date(selected.verifiedAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {selected.verificationStatus !== "Verified" ||
              selected.verificationStale ? (
                <>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => void verify(selected)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "primary"
                    })}
                  >
                    {verifying ? "Verifying…" : "Verify authorization"}
                  </button>
                  {selectedKind !== "dns_txt" ? (
                    <div className="flex max-w-sm flex-col items-end gap-1">
                      <button
                        type="button"
                        disabled={verifying}
                        onClick={() => void verify(selected, true)}
                        aria-describedby={
                          selectedAttestCopy
                            ? "scope-attest-disclaimer"
                            : undefined
                        }
                        className={buttonClassName({
                          size: "sm",
                          variant: "secondary"
                        })}
                      >
                        {verifying
                          ? "Attesting…"
                          : attestActionLabel(selected.scopeType)}
                      </button>
                      {selectedAttestCopy ? (
                        <p
                          id="scope-attest-disclaimer"
                          className="text-right text-[11px] leading-snug text-muted"
                        >
                          {selectedAttestCopy}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              <Link
                href="/missions"
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                Run Community validation →
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div className="rounded-control border border-line bg-surface/40 px-3 py-3">
              <p className="text-sm text-muted">
                {communityScopeAuthorizationHint(selected.scopeType)}
              </p>
              {selected.verificationStatus !== "Verified" &&
              selected.verificationToken ? (
                <p className="mt-2 font-mono text-[12px] text-ink">
                  Token {selected.verificationToken}
                  {selectedKind === "repository_token_file"
                    ? " → .periscan-authorization"
                    : selectedKind === "dns_txt"
                      ? " → DNS TXT _periscan."
                      : ""}
                </p>
              ) : null}
            </div>
            <CommunityPackPreview scopeType={selected.scopeType} />
            <ScopeSafetyEditor
              scope={selected}
              onSaved={async () => {
                await scopes.refetch();
              }}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function CommunityPackPreview({ scopeType }: { scopeType: ScopeType }) {
  const pack = listCommunityValidationSuiteForScopeType(scopeType);
  if (pack.length === 0) {
    return (
      <p className="text-sm text-subtle">
        No Community engines apply to {scopeType} yet.
      </p>
    );
  }
  return (
    <div>
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
        Community pack for {scopeType}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {pack.map((entry) => (
          <li
            key={entry.moduleId}
            className="flex flex-wrap items-baseline gap-2 text-sm"
          >
            <span className="text-ink">{entry.title}</span>
            <span className="font-mono text-[11px] text-subtle">
              {entry.toolId ?? "first-party"} · {entry.toolLicense}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "brand"
}: {
  label: string;
  value: number;
  tone?: "brand" | "fixed" | "approval" | "missed";
}) {
  const toneClass =
    tone === "fixed"
      ? "text-fixed"
      : tone === "approval"
        ? "text-approval"
        : tone === "missed"
          ? "text-missed"
          : "text-brand";
  return (
    <div className="rounded-card border border-line bg-elevated/50 px-3 py-3">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold", toneClass)}>
        {value}
      </p>
    </div>
  );
}
