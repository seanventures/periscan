"use client";

import {
  type FormEvent,
  type InputHTMLAttributes,
  useEffect,
  useMemo,
  useState
} from "react";

import type {
  NonHumanIdentity,
  NonHumanIdentityInventory,
  NonHumanIdentityRiskLevel,
  NonHumanIdentityType,
  RegisterNonHumanIdentityInput
} from "@periscan/shared";

import {
  browserPeriscanApiClient as api,
  PeriscanApiClientError
} from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";

const IDENTITY_TYPES: NonHumanIdentityType[] = [
  "ServiceAccount",
  "OAuthClient",
  "OAuthToken",
  "APIKey",
  "WorkloadRole",
  "Certificate"
];

const RISK_TONE: Record<NonHumanIdentityRiskLevel, StateTone> = {
  Critical: "missed",
  High: "blocked",
  Medium: "approval",
  Low: "fixed"
};

const INPUT_CLASS =
  "h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand";

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function emptyInventory(): NonHumanIdentityInventory {
  return {
    identities: [],
    summary: {
      critical: 0,
      high: 0,
      orphaned: 0,
      overPrivileged: 0,
      publiclyExposed: 0,
      stale: 0,
      total: 0
    }
  };
}

export function NonHumanIdentityWorkbench() {
  const [inventory, setInventory] = useState<NonHumanIdentityInventory>(
    emptyInventory()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await api.getMe();
      setInventory(await api.listNonHumanIdentities());
    } catch (caught) {
      setError(
        caught instanceof PeriscanApiClientError && caught.status === 401
          ? "Sign in to view the tenant's non-human identity inventory."
          : caught instanceof Error
            ? caught.message
            : "Unable to load the non-human identity inventory."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const resourceEdges = useMemo(
    () =>
      inventory.identities.flatMap((identity) =>
        identity.resourceAccess.map((access) => ({ access, identity }))
      ),
    [inventory.identities]
  );

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setNotice(null);
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const resourceAccess = String(data.get("resourceAccess") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [resource = line, environment, access] = line
          .split("|")
          .map((part) => part.trim());
        return { access: access || "read", environment: environment || null, resource };
      });
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const optional = (name: string) => value(name) || null;
    const input: RegisterNonHumanIdentityInput = {
      credentialFingerprint: optional("credentialFingerprint"),
      displayName: value("displayName"),
      environment: optional("environment"),
      evidenceIds: [],
      expiresAt: optional("expiresAt")
        ? new Date(`${value("expiresAt")}T00:00:00.000Z`).toISOString()
        : null,
      externalId: value("externalId"),
      identityType: value("identityType") as NonHumanIdentityType,
      lastUsedAt: optional("lastUsedAt")
        ? new Date(`${value("lastUsedAt")}T00:00:00.000Z`).toISOString()
        : null,
      owner: optional("owner"),
      privileges: value("privileges")
        .split(",")
        .map((privilege) => privilege.trim())
        .filter(Boolean),
      provider: value("provider"),
      publicExposure: data.get("publicExposure") === "on",
      repository: optional("repository"),
      resourceAccess,
      rotatedAt: optional("rotatedAt")
        ? new Date(`${value("rotatedAt")}T00:00:00.000Z`).toISOString()
        : null,
      sourceIntegrationId: null
    };

    try {
      const identity = await api.registerNonHumanIdentity(input);
      form.reset();
      setNotice(
        `${identity.displayName} registered as ${identity.riskLevel} risk. No plaintext credential was stored.`
      );
      setShowRegister(false);
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Unable to register identity metadata."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Investigate / Identity exposure"
        title="Non-human identity inventory"
        description="Rank service accounts, workload roles, OAuth credentials, API keys, and certificates by measured metadata. Periscan stores no plaintext credential: source IDs are one-way hashed and credentials may be represented only by a SHA-256 fingerprint."
        actions={
          <button
            type="button"
            className={buttonClassName({ variant: "primary" })}
            onClick={() => setShowRegister((visible) => !visible)}
          >
            {showRegister ? "Close registration" : "Register metadata"}
          </button>
        }
      />

      {showRegister ? <RegistrationForm onSubmit={register} saving={saving} /> : null}
      {formError ? <p role="alert" className="text-sm text-missed">{formError}</p> : null}
      {notice ? <p role="status" className="text-sm text-fixed">{notice}</p> : null}

      {loading ? (
        <LoadingSkeleton rows={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <Panel aria-label="Identity risk summary">
            <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
              <Metric label="Inventory" value={inventory.summary.total} />
              <Metric label="Critical" value={inventory.summary.critical} tone="text-missed" />
              <Metric label="High" value={inventory.summary.high} tone="text-blocked-text" />
              <Metric label="Orphaned" value={inventory.summary.orphaned} />
              <Metric label="Over-privileged" value={inventory.summary.overPrivileged} />
              <Metric label="Public" value={inventory.summary.publiclyExposed} />
              <Metric label="Stale" value={inventory.summary.stale} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Ranked identities"
              actions={
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#cfe0ff]">
                  Highest risk first
                </span>
              }
            />
            {inventory.identities.length === 0 ? (
              <div className="p-5">
                <NotConfigured
                  title="No non-human identities inventoried"
                  message="Register secret-free source metadata or ingest it through a supported connector. An empty inventory does not mean no machine identities exist."
                />
              </div>
            ) : (
              <IdentityTable identities={inventory.identities} />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Resource reach" />
            {resourceEdges.length === 0 ? (
              <p className="p-5 text-sm text-muted">
                No resource-access edges are recorded. This is missing source data, not proof of no access.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {resourceEdges.map(({ access, identity }, index) => (
                  <div
                    className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)] sm:items-center"
                    key={`${identity.nonHumanIdentityId}-${access.resource}-${index}`}
                  >
                    <span className="truncate font-medium text-ink">{identity.displayName}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand">
                      {access.access} →
                    </span>
                    <span className="truncate text-muted">
                      {access.resource}
                      {access.environment ? ` · ${access.environment}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </PageShell>
  );
}

function Metric({ label, tone = "text-ink", value }: { label: string; tone?: string; value: number }) {
  return (
    <div className="p-4">
      <p className="text-[11px] text-subtle">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function IdentityTable({ identities }: { identities: NonHumanIdentity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="border-b border-line bg-surface text-[10px] uppercase tracking-[0.1em] text-subtle">
          <tr>
            <th className="px-4 py-3 font-semibold">Identity</th>
            <th className="px-4 py-3 font-semibold">Risk</th>
            <th className="px-4 py-3 font-semibold">Why ranked</th>
            <th className="px-4 py-3 font-semibold">Owner / environment</th>
            <th className="px-4 py-3 font-semibold">Last use</th>
            <th className="px-4 py-3 font-semibold">Rotation</th>
            <th className="px-4 py-3 font-semibold">Proof</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {identities.map((identity) => (
            <tr className="align-top" key={identity.nonHumanIdentityId}>
              <td className="px-4 py-4">
                <p className="font-medium text-ink">{identity.displayName}</p>
                <p className="mt-1 text-xs text-muted">{identity.provider} · {identity.identityType}</p>
                <p className="mt-1 font-mono text-[10px] text-subtle" title={identity.externalIdHash}>
                  source {identity.externalIdHash.slice(0, 10)}…
                </p>
              </td>
              <td className="px-4 py-4">
                <StateBadge tone={RISK_TONE[identity.riskLevel]}>{identity.riskLevel} · {identity.riskScore}</StateBadge>
              </td>
              <td className="max-w-sm px-4 py-4">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {identity.riskFlags.map((flag) => (
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-approval" key={flag}>{flag}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{identity.riskRationales[0] ?? "No elevated risk signal."}</p>
              </td>
              <td className="px-4 py-4 text-xs text-muted">
                <p>{identity.owner ?? "No owner"}</p>
                <p className="mt-1 text-subtle">{identity.environment ?? "Unknown environment"}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-mono text-[11px] text-muted">{formatDate(identity.lastUsedAt)}</td>
              <td className="whitespace-nowrap px-4 py-4 font-mono text-[11px] text-muted">{formatDate(identity.rotatedAt)}</td>
              <td className="px-4 py-4 text-xs text-muted">
                {identity.evidenceIds.length} evidence ID{identity.evidenceIds.length === 1 ? "" : "s"}
                <p className="mt-1 text-subtle">{identity.credentialFingerprint ? "Fingerprint recorded" : "No fingerprint"}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistrationForm({ onSubmit, saving }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return (
    <Panel>
      <PanelHeader title="Register secret-free metadata" />
      <form className="grid gap-4 p-5 lg:grid-cols-3" onSubmit={onSubmit}>
        <Field label="Display name" name="displayName" placeholder="Production release key" required />
        <Field label="Provider" name="provider" placeholder="GitHub" required />
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Identity type
          <select className={INPUT_CLASS} defaultValue="ServiceAccount" name="identityType">
            {IDENTITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <Field
          help="Used once to derive a tenant-scoped SHA-256 hash. Never returned or stored in plaintext."
          label="Source identifier"
          name="externalId"
          placeholder="client-id or key ID—not the secret"
          required
        />
        <Field label="Owner" name="owner" placeholder="Platform Engineering" />
        <Field label="Environment" name="environment" placeholder="production" />
        <Field label="Repository" name="repository" placeholder="org/service-api" />
        <Field help="Comma-separated source privileges." label="Privileges" name="privileges" placeholder="contents:write, deployments:write" />
        <Field
          help="Exactly 64 hexadecimal characters. Do not paste the underlying credential."
          label="Credential SHA-256 fingerprint"
          name="credentialFingerprint"
          pattern="[a-fA-F0-9]{64}"
          placeholder="Optional fingerprint only"
        />
        <Field label="Last used" name="lastUsedAt" type="date" />
        <Field label="Last rotated" name="rotatedAt" type="date" />
        <Field label="Expires" name="expiresAt" type="date" />
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted lg:col-span-2">
          Resource access
          <textarea
            className="min-h-24 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
            name="resourceAccess"
            placeholder={"repo:service-api | production | write\ncluster:payments | production | deploy"}
          />
          <span className="font-normal text-subtle">One per line: resource | environment | access.</span>
        </label>
        <div className="flex flex-col justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input className="size-4 accent-brand" name="publicExposure" type="checkbox" />
            Usable from a public endpoint
          </label>
          <button className={buttonClassName({ variant: "primary" })} disabled={saving} type="submit">
            {saving ? "Ranking metadata…" : "Register and rank"}
          </button>
        </div>
        <p className="text-xs leading-5 text-subtle lg:col-span-3">
          Plaintext passwords, tokens, private keys, and certificate material are rejected by the API contract. Risk is recalculated on every upsert from the metadata shown here.
        </p>
      </form>
    </Panel>
  );
}

function Field({ help, label, ...input }: { help?: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      <input className={INPUT_CLASS} {...input} />
      {help ? <span className="font-normal leading-4 text-subtle">{help}</span> : null}
    </label>
  );
}
