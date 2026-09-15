"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WEBHOOK_EVENT_TYPES, type MembershipRole } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { SsoConfigurationPanel } from "./sso-configuration-panel";
import { useApiResource, type ApiResource } from "../hooks/use-api-resource";
import { LocalizationReleaseWorkspace } from "./localization-release-workspace";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

/** Coarse + fine-grained API key scopes (P20-17). */
const SCOPES = [
  "read",
  "write",
  "admin",
  "mission:run",
  "remediation:write",
  "webhook:admin",
  "audit:read"
] as const;

function relTime(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function AdminConsole() {
  const session = useApiResource(() => api.getMe(), []);
  const keys = useApiResource(() => api.listApiKeys(), []);
  const branding = useApiResource(() => api.getTenantBranding(), []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Govern · Admin
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Tenant &amp; access
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Your workspace, its API keys, and report branding. Manage your own
          sign-in in{" "}
          <Link
            href="/account-security"
            className="text-brand hover:text-brand-2"
          >
            Account security
          </Link>
          .
        </p>
      </header>

      <AdminMarketPresenceBanner />

      {/* Workspace */}
      <Panel>
        <PanelHeader title="Workspace" />
        {session.loading ? (
          <LoadingSkeleton rows={2} />
        ) : session.error || !session.data ? (
          <ErrorState
            message={session.error ?? "Sign in to manage this workspace."}
            onRetry={session.refetch}
          />
        ) : (
          <div className="grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2">
            <Field label="Tenant" value={session.data.tenant.name} />
            <Field
              label="Data region"
              value={session.data.tenant.dataRegion}
              mono
            />
            <Field label="Signed in as" value={session.data.user.name} />
            <div>
              <FieldLabel>Your role</FieldLabel>
              <StateBadge tone="brand" dot={false} className="mt-1">
                {session.data.membership.role}
              </StateBadge>
            </div>
          </div>
        )}
      </Panel>

      <MembersPanel />

      <ApiKeysPanel keys={keys} />

      <InvitePanel />

      <BrandingPanel branding={branding} />

      <LocalizationReleaseWorkspace />

      <WebhooksPanel />

      <ForceMfaPanel />

      <SsoConfigurationPanel />

      <IdentityLifecycleHonestyPanel />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/billing"
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Billing &amp; usage
        </Link>
        <Link
          href="/trust-safety"
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Trust &amp; safety
        </Link>
        <Link
          href="/audit"
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Audit log
        </Link>
      </div>
    </div>
  );
}

/**
 * Admin honesty banner for zero customer references (P08-9 / #183).
 * Product never invents market presence; Trust & Safety owns the full panel.
 */
function AdminMarketPresenceBanner() {
  const trust = useApiResource(() => api.getTrustSafetySummary(), []);

  if (trust.loading || trust.error || !trust.data?.marketPresence) {
    return null;
  }

  const mp = trust.data.marketPresence;
  if (mp.publicReferenceCount > 0) {
    return null;
  }

  return (
    <div
      className="rounded-control border border-missed/40 bg-missed/10 px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="admin-zero-refs-banner"
    >
      <p className="font-display text-[13px] font-semibold text-missed">
        {mp.banner}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Wave {mp.waveMarketPresenceGate} · MQ {mp.mqMarketPresenceGate} · Peer
        diligence {mp.peerDiligenceGate}. Public references:{" "}
        {mp.publicReferenceCount}. See{" "}
        <Link href="/trust-safety" className="text-brand hover:text-brand-2">
          Trust &amp; Safety
        </Link>{" "}
        for the reference pack checklist empty state and path to first design
        partner (no fabricated logos).
      </p>
      <p className="mt-2 text-[12px] text-muted">
        Next:{" "}
        <Link href="/missions" className="text-brand hover:text-brand-2">
          Validate
        </Link>{" "}
        (measured proof loop) → internal session learning → written reference
        rights. Protocol:{" "}
        <span className="font-mono text-ink">
          docs/DESIGN_PARTNER/REFERENCE_FACTORY.md
        </span>
        .
      </p>
    </div>
  );
}

/**
 * Tenant force-MFA for password auth (P04-4 / P17-3). Complements deployment
 * env PERISCAN_REQUIRE_MFA. SSO sessions are not gated here — IdP owns MFA.
 */
function ForceMfaPanel() {
  const policy = useApiResource(() => api.getTenantRequireMfa(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const data = policy.data;
  const effective = data?.effectiveRequireMfa ?? false;
  const tenantOn = data?.requireMfa ?? false;
  const envOn = data?.envRequireMfa ?? false;

  async function setEnabled(enabled: boolean) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await api.setTenantRequireMfa({ enabled });
      await policy.refetch();
      setStatus(
        enabled
          ? "Force-MFA is on for password sign-in in this workspace."
          : "Tenant force-MFA is off. Deployment-wide env can still require MFA."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't update force-MFA policy."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Force multi-factor authentication"
        actions={
          <StateBadge tone={effective ? "fixed" : "inconclusive"} dot={false}>
            {effective ? "Required" : "Optional"}
          </StateBadge>
        }
      />
      {policy.loading ? (
        <LoadingSkeleton rows={3} />
      ) : policy.error ? (
        <ErrorState message={policy.error} onRetry={policy.refetch} />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[13px] text-muted">
            When required, password users without enrolled TOTP MFA are limited
            to the enrollment path until they activate an authenticator.
            Disabling MFA on an account is blocked while the policy is on. SSO
            login is not gated by this control — enforce MFA at the identity
            provider.
          </p>
          <div className="flex flex-wrap gap-2 text-[12px]">
            <StateBadge tone={tenantOn ? "fixed" : "inconclusive"} dot={false}>
              Tenant policy: {tenantOn ? "On" : "Off"}
            </StateBadge>
            <StateBadge tone={envOn ? "approval" : "inconclusive"} dot={false}>
              Deployment env: {envOn ? "PERISCAN_REQUIRE_MFA" : "Not set"}
            </StateBadge>
          </div>
          {envOn ? (
            <p className="rounded-control border border-approval/30 bg-approval/5 px-3 py-2 text-[12px] text-muted">
              Deployment-wide <span className="font-mono">PERISCAN_REQUIRE_MFA</span>{" "}
              is on. Turning the tenant flag off will not relax enforcement until
              the deployment flag is cleared.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || tenantOn}
              onClick={() => void setEnabled(true)}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy && !tenantOn ? "Saving…" : "Require MFA for password users"}
            </button>
            <button
              type="button"
              disabled={busy || !tenantOn}
              onClick={() => void setEnabled(false)}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {busy && tenantOn ? "Saving…" : "Make MFA optional (tenant)"}
            </button>
            <Link
              href="/account-security"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Enroll my MFA
            </Link>
          </div>
          {status ? (
            <p role="status" className="text-sm text-fixed">
              {status}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-missed">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

/**
 * Honest IdP lifecycle status (P04-4 / P17-1 / PERISCAN-30). Do not claim
 * SCIM/JIT until real inbound provisioning of Periscan users ships.
 * Plane = Partial; SCIM/JIT = NotConfigured (never conflate with Production).
 */
function IdentityLifecycleHonestyPanel() {
  return (
    <Panel data-testid="admin-identity-lifecycle-honesty">
      <PanelHeader
        title="Identity lifecycle (IdP)"
        actions={
          <StateBadge tone="approval" dot={false}>
            Partial
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4 text-[13px] text-muted">
        <p>
          Periscan does <strong className="text-ink">not</strong> ship full
          enterprise IdP lifecycle for its own control-plane users. Use this
          checklist for procurement and onboarding honesty.
        </p>
        <p className="rounded-control border border-line bg-surface px-3 py-2 text-[12px]">
          <strong className="text-ink">Partial vs NotConfigured:</strong>{" "}
          <span className="font-mono text-ink">Partial</span> is the overall
          plane (SSO + force-MFA + IdP group→role map). Inbound SCIM and JIT are
          literal <span className="font-mono text-ink">NotConfigured</span> —
          never sold as SCIM Production.
        </p>
        <ul className="flex flex-col gap-2">
          <li className="flex gap-2">
            <StateBadge tone="fixed" dot={false}>
              Shipped
            </StateBadge>
            <span>
              SSO (OIDC/SAML) for pre-provisioned members; optional SSO-enforced
              mode; per-user TOTP MFA; tenant and deployment force-MFA for
              password auth.
            </span>
          </li>
          <li className="flex gap-2">
            <StateBadge tone="inconclusive" dot={false}>
              NotConfigured
            </StateBadge>
            <span>
              Inbound SCIM 2.0 provisioning of Periscan users/groups (joiner /
              mover / leaver). Discovery stubs under{" "}
              <span className="font-mono text-ink">/api/v1/scim/v2/*</span>{" "}
              return HTTP 501 (not silent 404). CyberArk SCIM in Integrations is{" "}
              <em>read-only identity inventory</em> for attack-path context — not
              control-plane user lifecycle.
            </span>
          </li>
          <li className="flex gap-2">
            <StateBadge tone="inconclusive" dot={false}>
              NotConfigured
            </StateBadge>
            <span>
              Just-in-time (JIT) auto-create of tenant memberships on first SSO
              login is{" "}
              <span className="font-mono text-ink">NotConfigured</span> (P17-14).
              SSO requires an existing Active membership. Trust Safety reports{" "}
              <span className="font-mono text-ink">
                identityProvisioning.jitProvisioning.status
              </span>
              ; if JIT ships later it would be domain allowlist + default Viewer
              + audit <span className="font-mono">user.jit_provisioned</span>.
            </span>
          </li>
          <li className="flex gap-2">
            <StateBadge tone="validated" dot={false}>
              Partial
            </StateBadge>
            <span>
              IdP group → Periscan role mapping ships on tenant SSO
              configuration (OIDC/SAML claim rules). Invite and Admin member
              tools remain available for seats without mapped groups.
            </span>
          </li>
        </ul>
        <div
          className="rounded-control border border-line bg-surface px-3 py-2 text-[12px]"
          data-testid="admin-identity-order-form-cta"
        >
          <p className="text-ink font-medium">
            Enterprise order-form fill path
          </p>
          <p className="mt-1 text-subtle">
            Until SCIM/JIT ship, provision seats with invite or sales-assisted
            onboarding and paste the sales-assisted provisioning SLA into every
            enterprise order form / DPA annex.
          </p>
          <ul className="mt-1 list-inside list-disc text-[11px] text-subtle">
            <li>
              <span className="font-mono text-ink">
                docs/ENTERPRISE_IDENTITY_LIFECYCLE.md
              </span>{" "}
              — SLA + RFP language
            </li>
            <li>
              <span className="font-mono text-ink">
                docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md
              </span>{" "}
              — SCIM / Type II / pen-test residual
            </li>
            <li>
              <Link
                href="/trust-safety"
                className="text-brand hover:text-brand-2"
              >
                Trust &amp; Safety
              </Link>{" "}
              — live honesty contract
            </li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function ApiKeysPanel({
  keys
}: {
  keys: ApiResource<Awaited<ReturnType<typeof api.listApiKeys>>>;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set(["read"]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(
    null
  );

  function toggleScope(scope: string) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function create() {
    if (!name.trim() || scopes.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createApiKey({
        name: name.trim(),
        scopes: [...scopes] as Array<(typeof SCOPES)[number]>
      });
      setSecret({ name: created.name, value: created.secret });
      setName("");
      setScopes(new Set(["read"]));
      await keys.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't create the key."
      );
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: string, keyName: string) {
    setError(null);
    try {
      const rotated = await api.rotateApiKey(id);
      setSecret({ name: keyName, value: rotated.secret });
      await keys.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't rotate the key."
      );
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await api.revokeApiKey(id);
      await keys.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't revoke the key."
      );
    }
  }

  const activeKeys = (keys.data ?? []).filter((k) => !k.revokedAt);

  return (
    <Panel aria-labelledby="admin-api-keys-heading">
      <PanelHeader title="API keys" titleId="admin-api-keys-heading" />
      <div className="flex flex-col gap-3 p-4">
        {secret ? (
          <div className="rounded-card border border-fixed/40 bg-fixed/5 p-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-fixed">
              Copy this secret now — it won&apos;t be shown again
            </p>
            <p className="mt-1 text-[12px] text-muted">{secret.name}</p>
            <p className="mt-1 break-all rounded-control border border-line bg-bg px-2 py-1.5 font-mono text-[12px] text-ink">
              {secret.value}
            </p>
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="mt-2 text-xs text-subtle hover:text-ink"
            >
              I&apos;ve saved it — dismiss
            </button>
          </div>
        ) : null}

        {keys.loading ? (
          <LoadingSkeleton rows={2} className="p-0" />
        ) : keys.error ? (
          <ErrorState message={keys.error} onRetry={keys.refetch} />
        ) : activeKeys.length === 0 ? (
          <p className="text-sm text-subtle">No active API keys.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {activeKeys.map((key) => (
              <li
                key={key.apiKeyId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-line px-3 py-2"
              >
                <span className="text-[13px] text-ink">{key.name}</span>
                <span className="font-mono text-[11px] text-subtle">
                  {key.keyPrefix}…
                </span>
                {key.scopes.map((s) => (
                  <span
                    key={s}
                    className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle"
                  >
                    {s}
                  </span>
                ))}
                <span className="font-mono text-[11px] text-subtle">
                  used {relTime(key.lastUsedAt)}
                </span>
                <div className="ml-auto flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => rotate(key.apiKeyId, key.name)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Rotate
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(key.apiKeyId)}
                    className={cn(
                      buttonClassName({ size: "sm", variant: "secondary" }),
                      "text-missed"
                    )}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Create */}
        <div className="rounded-card border border-line bg-surface p-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            New key
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-xs">
              <span className="text-[11px] font-semibold text-muted">
                API key name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CI pipeline"
                className="w-full rounded-control border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
              />
            </label>
            <div className="flex max-w-xl flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScope(s)}
                  className={cn(
                    "rounded-control border px-2.5 py-1 font-mono text-[11px] transition-colors",
                    scopes.has(s)
                      ? "border-brand/60 bg-brand/12 text-ink"
                      : "border-line text-muted hover:text-ink"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={create}
              disabled={busy || !name.trim() || scopes.size === 0}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Creating…" : "Create key"}
            </button>
          </div>
          <p
            className="mt-1.5 text-[11px] leading-relaxed text-subtle"
            data-testid="api-key-least-privilege-hint"
          >
            Default <span className="font-mono">read</span> is least-privilege.
            Matrix: <span className="font-mono">read</span> → Viewer;{" "}
            <span className="font-mono">write</span> → mission:run +
            remediation:write; <span className="font-mono">admin</span> → all
            caps; fine scopes alone (
            <span className="font-mono">mission:run</span>,{" "}
            <span className="font-mono">remediation:write</span>,{" "}
            <span className="font-mono">webhook:admin</span>,{" "}
            <span className="font-mono">audit:read</span>) never elevate to full
            Admin — pick only what the automation needs.
          </p>
          <p className="mt-1 text-[11px] text-subtle">
            External automation guide:{" "}
            <Link
              href="/api-reference"
              className="font-semibold text-brand hover:text-brand-2"
              data-testid="api-key-automation-readme-link"
            >
              API reference (copy-as-curl)
            </Link>
            {" · "}
            <span
              className="font-mono text-ink"
              data-testid="api-key-automation-readme-path"
            >
              docs/examples/automation-readme.md
            </span>
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-missed">
            {error}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function BrandingPanel({
  branding
}: {
  branding: ApiResource<Awaited<ReturnType<typeof api.getTenantBranding>>>;
}) {
  const [org, setOrg] = useState("");
  const [color, setColor] = useState("#1499d6");
  const [support, setSupport] = useState("");
  const [footer, setFooter] = useState("");
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loaded = branding.data;
  useEffect(() => {
    if (loaded) {
      setOrg(loaded.organizationName ?? "");
      setColor(loaded.primaryColor ?? "#1499d6");
      setSupport(loaded.supportEmail ?? "");
      setFooter(loaded.reportFooter ?? "");
      setWhiteLabel(loaded.whiteLabelEnabled);
    }
  }, [loaded]);

  async function save() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      await api.updateTenantBranding({
        organizationName: org || null,
        primaryColor: color || null,
        supportEmail: support || null,
        reportFooter: footer || null,
        whiteLabelEnabled: whiteLabel
      });
      setStatus("Branding saved.");
      await branding.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't save branding."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Report branding" />
      {branding.loading ? (
        <LoadingSkeleton rows={3} />
      ) : branding.error ? (
        <ErrorState message={branding.error} onRetry={branding.refetch} />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <FieldLabel>Organization name</FieldLabel>
              <input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
              />
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Support email</FieldLabel>
              <input
                value={support}
                onChange={(e) => setSupport(e.target.value)}
                type="email"
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
              />
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Primary color</FieldLabel>
              <span className="flex items-center gap-2">
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  type="color"
                  className="h-8 w-10 rounded border border-line bg-surface"
                  aria-label="Primary color"
                />
                <span className="font-mono text-[12px] text-muted">
                  {color}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 self-end pb-1.5">
              <input
                type="checkbox"
                checked={whiteLabel}
                onChange={(e) => setWhiteLabel(e.target.checked)}
                className="accent-[color:var(--color-brand)]"
              />
              <span className="text-[13px] text-muted">
                Enable white-label reports
              </span>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <FieldLabel>Report footer</FieldLabel>
            <input
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Saving…" : "Save branding"}
            </button>
            {status ? (
              <span className="text-sm text-fixed">{status}</span>
            ) : null}
            {error ? (
              <span className="text-sm text-missed">{error}</span>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

const ASSIGNABLE_ROLES: MembershipRole[] = [
  "Owner",
  "Admin",
  "SecurityEngineer",
  "Viewer",
  "MSSPOwner",
  "ClientAdmin"
];

function MembersPanel() {
  const members = useApiResource(() => api.listTenantMembers(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = members.data ?? [];
  const ownerCount = rows.filter((m) => m.membership.role === "Owner").length;

  async function changeRole(membershipId: string, role: MembershipRole) {
    setBusyId(membershipId);
    setError(null);
    try {
      await api.updateTenantMemberRole(membershipId, role);
      await members.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't update role."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(membershipId: string) {
    setBusyId(membershipId);
    setError(null);
    try {
      await api.removeTenantMember(membershipId);
      await members.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't remove member."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel>
      <PanelHeader title={`Members (${rows.length})`} />
      {error ? (
        <p className="border-b border-line bg-[color:var(--color-blocked)]/5 px-4 py-2 text-[12px] text-[color:var(--color-blocked)]">
          {error}
        </p>
      ) : null}
      {members.loading ? (
        <LoadingSkeleton rows={3} />
      ) : members.error ? (
        <ErrorState message={members.error} onRetry={members.refetch} />
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-subtle">No members yet.</p>
      ) : (
        <ul>
          {rows.map((m) => {
            const isLastOwner =
              m.membership.role === "Owner" && ownerCount <= 1;
            const busy = busyId === m.membership.membershipId;
            return (
              <li
                key={m.membership.membershipId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="text-[13px] text-ink">{m.user.name}</span>
                <span className="font-mono text-[11px] text-subtle">
                  {m.user.email}
                </span>
                {m.user.status !== "Active" ? (
                  <StateBadge tone="inconclusive" dot={false}>
                    {m.user.status}
                  </StateBadge>
                ) : null}
                <div className="ml-auto flex items-center gap-2">
                  <select
                    aria-label={`Role for ${m.user.name}`}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-ink disabled:opacity-50"
                    disabled={busy || isLastOwner}
                    value={m.membership.role}
                    onChange={(event) =>
                      changeRole(
                        m.membership.membershipId,
                        event.target.value as MembershipRole
                      )
                    }
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={buttonClassName({
                      variant: "danger",
                      size: "sm"
                    })}
                    disabled={busy || isLastOwner}
                    title={
                      isLastOwner
                        ? "Can't remove the last owner"
                        : "Remove member"
                    }
                    onClick={() => remove(m.membership.membershipId)}
                  >
                    Remove
                  </button>
                </div>
                <span className="w-full font-mono text-[11px] text-subtle sm:w-auto">
                  joined {relTime(m.membership.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const INVITE_ROLES = ["Admin", "SecurityEngineer", "Viewer"] as const;

function InvitePanel() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] =
    useState<(typeof INVITE_ROLES)[number]>("SecurityEngineer");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    if (!email.trim() || !name.trim()) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      await api.inviteMember({ email: email.trim(), name: name.trim(), role });
      setStatus(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      setName("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't send the invite."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Invite a teammate" />
      <div className="flex flex-wrap items-end gap-2 p-4">
        <label className="flex flex-1 flex-col gap-1">
          <FieldLabel>Name</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <FieldLabel>Email</FieldLabel>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="min-w-0 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
          />
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Role</FieldLabel>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
          >
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !email.trim() || !name.trim()}
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          {busy ? "Sending…" : "Send invite"}
        </button>
        {status ? (
          <span className="w-full text-sm text-fixed">{status}</span>
        ) : null}
        {error ? (
          <span className="w-full text-sm text-missed">{error}</span>
        ) : null}
      </div>
    </Panel>
  );
}

/** Keep admin chips in lockstep with `WebhookEventTypeSchema` (P06-9). */
const WEBHOOK_EVENTS = WEBHOOK_EVENT_TYPES;

/** Pure curl helper for low-risk webhook test (UX-W4 / #177). */
export function webhookTestCurlSample(webhookId: string): string {
  return [
    "curl --request POST \\",
    `  "$PERISCAN_API_URL/api/v1/tenants/current/webhooks/${webhookId}/test" \\`,
    '  --header "Authorization: Bearer $PERISCAN_API_KEY"'
  ].join("\n");
}

function WebhooksPanel() {
  const webhooks = useApiResource(() => api.listWebhooks(), []);
  const eventCatalog = useApiResource(() => api.getWebhookEventCatalog(), []);
  const deadLetters = useApiResource(
    () => api.listDeadLetteredWebhookDeliveries(),
    []
  );
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<string>>(
    new Set(["mission.completed"])
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [copyCurl, setCopyCurl] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const catalogEvents =
    eventCatalog.data?.eventTypes?.length ?
      eventCatalog.data.eventTypes
    : WEBHOOK_EVENTS;
  const signatureHeader =
    eventCatalog.data?.headers.signature ?? "x-periscan-signature";
  const eventHeader = eventCatalog.data?.headers.event ?? "x-periscan-event";
  const deliveryHeader =
    eventCatalog.data?.headers.delivery ?? "x-periscan-delivery";
  const idempotencyHeader =
    eventCatalog.data?.headers.idempotencyKey ??
    "x-periscan-idempotency-key";
  const signatureFormat =
    eventCatalog.data?.signatureFormat ?? "sha256=<hex>";

  function toggleEvent(e: string) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  async function create() {
    if (!url.trim() || events.size === 0) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    setCopyCurl(null);
    try {
      const created = await api.createWebhook({
        url: url.trim(),
        events: [...events] as (typeof catalogEvents)[number][]
      });
      setSecret(created.secret);
      setUrl("");
      await webhooks.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't create webhook."
      );
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setStatus(null);
    setCopyCurl(null);
    try {
      await fn();
      await webhooks.refetch();
      await deadLetters.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  async function testWebhook(webhookId: string) {
    setError(null);
    setStatus(null);
    setCopyCurl(null);
    setCopiedCurl(false);
    try {
      await api.testWebhook(webhookId);
      setStatus("Test delivery enqueued.");
      setCopyCurl(webhookTestCurlSample(webhookId));
      await webhooks.refetch();
      await deadLetters.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't send test delivery."
      );
    }
  }

  async function rotateSecret(webhookId: string) {
    setError(null);
    setStatus(null);
    setCopyCurl(null);
    try {
      const rotated = await api.rotateWebhookSecret(webhookId);
      setSecret(rotated.secret);
      setStatus("Signing secret rotated — copy it now; it is shown once.");
      await webhooks.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't rotate secret."
      );
    }
  }

  async function redrive(deliveryId: string) {
    setError(null);
    setStatus(null);
    setCopyCurl(null);
    try {
      const result = await api.redriveWebhookDelivery(deliveryId);
      setStatus(`Redrove delivery ${result.deliveryId} → ${result.status}.`);
      await deadLetters.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't redrive delivery."
      );
    }
  }

  function copyAsCurl() {
    if (!copyCurl) return;
    void navigator.clipboard?.writeText(copyCurl).then(() => {
      setCopiedCurl(true);
      window.setTimeout(() => setCopiedCurl(false), 1500);
    });
  }

  return (
    <Panel aria-labelledby="admin-webhooks-heading">
      <PanelHeader
        title="Outbound webhooks"
        titleId="admin-webhooks-heading"
        link={{ href: "/api-reference", label: "Receiver contract" }}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm leading-6 text-muted">
          Subscribe to product events for SOAR/chat automation. Every delivery is
          HMAC-signed; secrets are shown once on create or rotate. Use{" "}
          <strong className="font-medium text-ink">Rotate secret</strong> and{" "}
          <strong className="font-medium text-ink">Redrive</strong> for ops
          hygiene without delete-and-recreate.
        </p>

        {/* UX-W4 / #178 #180 + P20-5: receiver contract from event-catalog */}
        <div
          id="webhook-receiver-contract"
          className="rounded-card border border-brand/35 bg-brand/8 p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
              Receiver contract
            </p>
            <Link
              href="/api-reference"
              className="font-mono text-[11px] font-medium text-brand hover:text-brand-2"
            >
              API reference · curl samples →
            </Link>
          </div>
          {eventCatalog.loading ? (
            <LoadingSkeleton rows={1} className="mt-2 p-0" />
          ) : eventCatalog.error ? (
            <ErrorState
              message={eventCatalog.error}
              onRetry={eventCatalog.refetch}
            />
          ) : (
            <>
              <dl className="mt-2 grid gap-1 text-[12px] text-muted">
                <div>
                  <dt className="inline font-semibold text-ink">Signature: </dt>
                  <dd className="inline font-mono text-ink">
                    {signatureHeader} = {signatureFormat}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">Event: </dt>
                  <dd className="inline font-mono text-ink">{eventHeader}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">Delivery: </dt>
                  <dd className="inline font-mono text-ink">{deliveryHeader}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">Idempotency: </dt>
                  <dd className="inline font-mono text-ink">
                    {idempotencyHeader}
                  </dd>
                </div>
              </dl>
              <p className="mt-1 text-xs leading-5 text-subtle">
                Live catalog from{" "}
                <code className="font-mono text-[11px]">
                  GET /api/v1/tenants/current/webhooks/event-catalog
                </code>
                . Secret prefix{" "}
                <span className="font-mono text-ink">whsec_</span> is shown once
                on create/rotate — never listed back. External automation
                guide:{" "}
                <span className="font-mono text-ink">
                  docs/examples/automation-readme.md
                </span>
                .
              </p>
              {eventCatalog.data?.eventDataSummaries &&
              eventCatalog.data.eventDataSummaries.length > 0 ? (
                <div
                  className="mt-3 border-t border-line pt-2"
                  data-testid="webhook-data-schema-examples"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-subtle">
                    Data schema fields (per event)
                  </p>
                  <ul
                    tabIndex={0}
                    className="mt-1.5 m-0 max-h-40 list-none space-y-1 overflow-y-auto p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {eventCatalog.data.eventDataSummaries.map((summary) => (
                      <li
                        key={summary.eventType}
                        className="rounded-control border border-line bg-bg px-2 py-1.5"
                      >
                        <p className="font-mono text-[11px] font-semibold text-ink">
                          {summary.eventType}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {summary.description}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-subtle">
                          data: {summary.dataFields.join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        {secret ? (
          <div className="rounded-card border border-fixed/40 bg-fixed/5 p-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-fixed">
              Signing secret — shown once. Verify the x-periscan-signature HMAC
              with it.
            </p>
            <p className="mt-1 break-all rounded-control border border-line bg-bg px-2 py-1.5 font-mono text-[12px] text-ink">
              {secret}
            </p>
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="mt-2 text-xs text-subtle hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {status ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-control border border-fixed/30 bg-fixed/5 px-3 py-2"
            role="status"
          >
            <p className="text-sm text-fixed">{status}</p>
            {copyCurl ? (
              <button
                type="button"
                onClick={copyAsCurl}
                className={buttonClassName({ size: "sm", variant: "secondary" })}
              >
                {copiedCurl ? "Copied" : "Copy as curl"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Configured endpoints
          </p>
          {webhooks.loading ? (
            <LoadingSkeleton rows={2} className="p-0" />
          ) : webhooks.error ? (
            <ErrorState message={webhooks.error} onRetry={webhooks.refetch} />
          ) : (webhooks.data ?? []).length === 0 ? (
            <p className="text-sm text-subtle">No webhooks configured.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(webhooks.data ?? []).map((w) => (
                <li
                  key={w.webhookId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-line px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">
                    {w.url}
                  </span>
                  <span className="font-mono text-[10px] text-subtle">
                    {w.events.length} events
                  </span>
                  <StateBadge
                    tone={w.enabled ? "fixed" : "inconclusive"}
                    dot={false}
                  >
                    {w.enabled ? "Enabled" : "Disabled"}
                  </StateBadge>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void testWebhook(w.webhookId)}
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => void rotateSecret(w.webhookId)}
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                      title="Issue a new signing secret (shown once)"
                    >
                      Rotate secret
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          api.updateWebhook(w.webhookId, {
                            enabled: !w.enabled
                          })
                        )
                      }
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                    >
                      {w.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => run(() => api.deleteWebhook(w.webhookId))}
                      className={cn(
                        buttonClassName({ size: "sm", variant: "secondary" }),
                        "text-missed"
                      )}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* P20-4: dead-letter triage + redrive — keep discoverable */}
        <div className="rounded-card border border-line bg-surface p-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Dead-letter triage · Redrive
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Permanently failed deliveries (retries exhausted).{" "}
            <strong className="font-medium text-ink">Redrive</strong> resets
            attempts and re-enqueues — only Failed or dead-lettered rows.
          </p>
          {deadLetters.loading ? (
            <LoadingSkeleton rows={1} className="mt-2 p-0" />
          ) : deadLetters.error ? (
            <ErrorState
              message={deadLetters.error}
              onRetry={deadLetters.refetch}
            />
          ) : (deadLetters.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No dead-lettered deliveries.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {(deadLetters.data ?? []).map((d) => (
                <li
                  key={d.deliveryId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-line px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">
                    {d.deliveryId.slice(0, 8)}… · {d.eventType} ·{" "}
                    {d.lastError ?? "no error detail"}
                  </span>
                  <StateBadge tone="missed" dot={false}>
                    {d.status}
                  </StateBadge>
                  <button
                    type="button"
                    onClick={() => void redrive(d.deliveryId)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Redrive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Create + event catalog (live types from event-catalog when available) */}
        <div className="rounded-card border border-line bg-surface p-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            New webhook
          </p>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">
              Webhook URL
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-endpoint.example.com/hooks/periscan"
              className="w-full rounded-control border border-line bg-bg px-3 py-1.5 font-mono text-[12px] text-ink outline-none placeholder:text-subtle focus:border-line-strong"
            />
          </label>
          <div className="mt-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Event catalog
            </p>
            <p className="mt-1 text-xs text-muted">
              Select emitted types (HMAC-signed). Chips prefer the live event
              catalog and fall back to{" "}
              <span className="font-mono">WEBHOOK_EVENT_TYPES</span>.
            </p>
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="group"
              aria-label="Webhook event catalog"
            >
              {catalogEvents.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEvent(e)}
                  aria-pressed={events.has(e)}
                  className={cn(
                    "rounded-control border px-2 py-1 font-mono text-[11px] transition-colors",
                    events.has(e)
                      ? "border-brand/60 bg-brand/12 text-ink"
                      : "border-line text-muted hover:text-ink"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy || !url.trim() || events.size === 0}
            className={cn(
              buttonClassName({ size: "sm", variant: "primary" }),
              "mt-3"
            )}
          >
            {busy ? "Creating…" : "Create webhook"}
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-missed">
            {error}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function Field({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p
        className={cn(
          "mt-0.5 text-[14px] text-ink",
          mono && "font-mono text-[12px]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}
