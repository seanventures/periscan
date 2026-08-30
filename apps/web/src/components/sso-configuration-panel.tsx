"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { UpdateTenantSsoConfigInput } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

const inputClass =
  "w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const defaultScopes = {
  OIDC: "openid, email, profile",
  SAML: "saml:nameid:emailAddress"
} as const;

function csv(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function SsoConfigurationPanel() {
  const sso = useApiResource(() => api.getSsoConfig(), []);
  const [editing, setEditing] = useState(false);
  const [providerType, setProviderType] = useState<"OIDC" | "SAML">("OIDC");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [authorizationEndpoint, setAuthorizationEndpoint] = useState("");
  const [tokenEndpoint, setTokenEndpoint] = useState("");
  const [jwksUri, setJwksUri] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState<string>(defaultScopes.OIDC);
  const [domains, setDomains] = useState("");
  const [samlCertificate, setSamlCertificate] = useState("");
  const [samlMetadata, setSamlMetadata] = useState("");
  const [samlNameIdFormat, setSamlNameIdFormat] = useState(
    "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
  );
  const [enabled, setEnabled] = useState(true);
  const [enforced, setEnforced] = useState(false);
  const [roleClaimName, setRoleClaimName] = useState("groups");
  const [roleMappingsText, setRoleMappingsText] = useState("");
  const [defaultMappedRole, setDefaultMappedRole] = useState("");
  const [busy, setBusy] = useState<"disable" | "save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const config = sso.data;
    if (!config) {
      if (!redirectUri && typeof window !== "undefined") {
        setRedirectUri(`${window.location.origin}/api/v1/auth/sso/callback`);
      }
      return;
    }
    setProviderType(config.providerType);
    setIssuerUrl(config.issuerUrl);
    setAuthorizationEndpoint(config.authorizationEndpoint);
    setTokenEndpoint(config.tokenEndpoint ?? "");
    setJwksUri(config.jwksUri ?? "");
    setClientId(config.clientId);
    setRedirectUri(config.redirectUri ?? "");
    setScopes(config.scopes.join(", "));
    setDomains(config.emailDomainAllowlist.join(", "));
    setSamlNameIdFormat(
      config.samlNameIdFormat ??
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    );
    setEnabled(config.status === "Enabled");
    setEnforced(config.enforced);
    setRoleClaimName(config.roleClaimName ?? "groups");
    setRoleMappingsText(
      (config.roleMappings ?? [])
        .map((rule) => `${rule.claimValue}=${rule.role}`)
        .join("\n")
    );
    setDefaultMappedRole(config.defaultMappedRole ?? "");
  }, [sso.data, redirectUri]);

  function switchProvider(next: "OIDC" | "SAML") {
    setProviderType(next);
    setScopes(defaultScopes[next]);
    setError(null);
  }

  function importSamlMetadata() {
    setError(null);
    setStatus(null);
    try {
      const document = new DOMParser().parseFromString(
        samlMetadata.trim(),
        "application/xml"
      );
      if (document.querySelector("parsererror")) {
        throw new Error("The IdP metadata XML could not be parsed.");
      }
      const entityId = document.documentElement.getAttribute("entityID") ?? "";
      const signOnServices = Array.from(
        document.getElementsByTagNameNS("*", "SingleSignOnService")
      );
      const signOnService =
        signOnServices.find((item) =>
          item.getAttribute("Binding")?.includes("HTTP-Redirect")
        ) ?? signOnServices[0];
      const certificate = document
        .getElementsByTagNameNS("*", "X509Certificate")[0]
        ?.textContent?.replace(/\s+/gu, "");
      const nameIdFormat = document
        .getElementsByTagNameNS("*", "NameIDFormat")[0]
        ?.textContent?.trim();
      if (!entityId || !signOnService?.getAttribute("Location") || !certificate) {
        throw new Error(
          "Metadata must include an entity ID, SSO service URL, and signing certificate."
        );
      }
      setIssuerUrl(entityId);
      setAuthorizationEndpoint(signOnService.getAttribute("Location") ?? "");
      setSamlCertificate(
        `-----BEGIN CERTIFICATE-----\n${certificate.match(/.{1,64}/gu)?.join("\n") ?? certificate}\n-----END CERTIFICATE-----`
      );
      if (nameIdFormat) setSamlNameIdFormat(nameIdFormat);
      setStatus("IdP metadata imported. Review the values before saving.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't import metadata.");
    }
  }

  function parseRoleMappings() {
    const lines = roleMappingsText
      .split(/[\n,]/u)
      .map((line) => line.trim())
      .filter(Boolean);
    const rules: Array<{
      claimValue: string;
      role:
        | "Owner"
        | "Admin"
        | "SecurityEngineer"
        | "Viewer"
        | "MSSPOwner"
        | "ClientAdmin";
    }> = [];
    const allowed = new Set([
      "Owner",
      "Admin",
      "SecurityEngineer",
      "Viewer",
      "MSSPOwner",
      "ClientAdmin"
    ]);
    for (const line of lines) {
      const separator = line.includes("=")
        ? "="
        : line.includes(":")
          ? ":"
          : null;
      if (!separator) {
        throw new Error(
          `Role mapping "${line}" must use claimValue=Role (e.g. periscan-admins=Admin).`
        );
      }
      const [claimRaw, roleRaw] = line.split(separator, 2);
      const claimValue = claimRaw?.trim() ?? "";
      const role = roleRaw?.trim() ?? "";
      if (!claimValue || !allowed.has(role)) {
        throw new Error(
          `Role mapping "${line}" needs a claim value and one of: Owner, Admin, SecurityEngineer, Viewer, MSSPOwner, ClientAdmin.`
        );
      }
      rules.push({
        claimValue,
        role: role as (typeof rules)[number]["role"]
      });
    }
    return rules;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    setStatus(null);
    try {
      const roleMappings = parseRoleMappings();
      const mappedDefault = defaultMappedRole.trim();
      const common = {
        authorizationEndpoint: authorizationEndpoint.trim(),
        clientId: clientId.trim(),
        defaultMappedRole: (mappedDefault || null) as
          | "Owner"
          | "Admin"
          | "SecurityEngineer"
          | "Viewer"
          | "MSSPOwner"
          | "ClientAdmin"
          | null,
        emailDomainAllowlist: csv(domains).map((domain) => domain.toLowerCase()),
        enabled,
        enforced,
        issuerUrl: issuerUrl.trim(),
        redirectUri: redirectUri.trim() || null,
        roleClaimName: roleClaimName.trim() || null,
        roleMappings,
        scopes: csv(scopes)
      };
      const input: UpdateTenantSsoConfigInput =
        providerType === "OIDC"
          ? {
              ...common,
              clientSecret: clientSecret.trim() || undefined,
              jwksUri: jwksUri.trim() || null,
              providerType: "OIDC",
              tokenEndpoint: tokenEndpoint.trim() || null
            }
          : {
              ...common,
              providerType: "SAML",
              samlIdpCertificate: samlCertificate.trim() || undefined,
              samlNameIdFormat: samlNameIdFormat.trim()
            };
      await api.updateSsoConfig(input);
      setClientSecret("");
      setSamlCertificate("");
      await sso.refetch();
      setEditing(false);
      setStatus(`${providerType} configuration saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save SSO.");
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setBusy("disable");
    setError(null);
    setStatus(null);
    try {
      await api.disableSso();
      await sso.refetch();
      setEnabled(false);
      setStatus("Single sign-on is disabled. Password sign-in remains available.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't disable SSO.");
    } finally {
      setBusy(null);
    }
  }

  async function testLogin() {
    const config = sso.data;
    if (!config) return;
    setBusy("test");
    setError(null);
    try {
      const result = await api.startSsoLogin({
        prompt: "login",
        tenantId: config.tenantId
      });
      window.location.assign(result.authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't start test login.");
      setBusy(null);
    }
  }

  const config = sso.data;

  return (
    <Panel>
      <PanelHeader
        title="Single sign-on"
        actions={
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            disabled={busy !== null || sso.loading}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {editing ? "Cancel" : config ? "Edit setup" : "Configure"}
          </button>
        }
      />
      {sso.loading ? (
        <LoadingSkeleton rows={3} />
      ) : sso.error ? (
        <ErrorState message={sso.error} onRetry={sso.refetch} />
      ) : editing ? (
        <form onSubmit={save} className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-muted">Protocol</p>
            <div className="flex gap-1.5">
              {(["OIDC", "SAML"] as const).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => switchProvider(provider)}
                  className={cn(
                    buttonClassName({ size: "sm", variant: "secondary" }),
                    providerType === provider && "border-brand/60 bg-brand/10 text-ink"
                  )}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>

          <SsoField label={providerType === "OIDC" ? "Issuer URL" : "IdP entity ID URL"}>
            <input required type="url" value={issuerUrl} onChange={(event) => setIssuerUrl(event.target.value)} className={inputClass} />
          </SsoField>
          <SsoField label={providerType === "OIDC" ? "Authorization endpoint" : "IdP SSO URL"}>
            <input required type="url" value={authorizationEndpoint} onChange={(event) => setAuthorizationEndpoint(event.target.value)} className={inputClass} />
          </SsoField>
          <SsoField label={providerType === "OIDC" ? "Client ID" : "SP entity ID"}>
            <input required value={clientId} onChange={(event) => setClientId(event.target.value)} className={inputClass} />
          </SsoField>
          <SsoField label={providerType === "OIDC" ? "Callback URL" : "Assertion consumer service (ACS) URL"}>
            <input required type="url" value={redirectUri} onChange={(event) => setRedirectUri(event.target.value)} className={inputClass} />
          </SsoField>

          {providerType === "OIDC" ? (
            <>
              <SsoField label={config?.clientSecretSet ? "Client secret (leave blank to keep)" : "Client secret"}>
                <input required={!config?.clientSecretSet} type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" className={inputClass} />
              </SsoField>
              <SsoField label="Token endpoint">
                <input type="url" value={tokenEndpoint} onChange={(event) => setTokenEndpoint(event.target.value)} className={inputClass} />
              </SsoField>
              <SsoField label="JWKS URL">
                <input type="url" value={jwksUri} onChange={(event) => setJwksUri(event.target.value)} className={inputClass} />
              </SsoField>
              <SsoField label="Scopes (comma-separated)">
                <input required value={scopes} onChange={(event) => setScopes(event.target.value)} className={inputClass} />
              </SsoField>
            </>
          ) : (
            <>
              <SsoField label="IdP metadata XML (optional import)" wide>
                <textarea value={samlMetadata} onChange={(event) => setSamlMetadata(event.target.value)} rows={4} placeholder="Paste EntityDescriptor XML from your identity provider" className={inputClass + " font-mono text-xs"} />
                <button type="button" onClick={importSamlMetadata} disabled={!samlMetadata.trim()} className={buttonClassName({ size: "sm", variant: "secondary" }) + " self-start"}>Import metadata</button>
              </SsoField>
              <SsoField label={config?.samlIdpCertificateSet ? "IdP certificate (leave blank to keep)" : "IdP X.509 certificate"} wide>
                <textarea required={!config?.samlIdpCertificateSet} value={samlCertificate} onChange={(event) => setSamlCertificate(event.target.value)} rows={5} className={inputClass + " font-mono text-xs"} />
              </SsoField>
              <SsoField label="NameID format" wide>
                <input required value={samlNameIdFormat} onChange={(event) => setSamlNameIdFormat(event.target.value)} className={inputClass} />
              </SsoField>
            </>
          )}

          <SsoField label="Allowed email domains (comma-separated)">
            <input value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="example.com" className={inputClass} />
          </SsoField>
          <SsoField label="Role claim / attribute name">
            <input
              value={roleClaimName}
              onChange={(event) => setRoleClaimName(event.target.value)}
              placeholder="groups"
              className={inputClass}
            />
          </SsoField>
          <SsoField label="Group to role mappings" wide>
            <textarea
              value={roleMappingsText}
              onChange={(event) => setRoleMappingsText(event.target.value)}
              rows={4}
              placeholder={"periscan-admins=Admin\nperiscan-viewers=Viewer"}
              aria-label="Group to role mappings"
              className={inputClass + " font-mono text-xs"}
            />
            <span className="text-[11px] text-subtle">
              One claimValue=Role per line. Leave empty to keep invite-time roles.
              When set, unmatched users are denied unless a default role is
              configured. Multiple matching groups pick the highest-privilege
              role.
            </span>
          </SsoField>
          <SsoField label="Default mapped role (optional)">
            <select
              value={defaultMappedRole}
              onChange={(event) => setDefaultMappedRole(event.target.value)}
              className={inputClass}
            >
              <option value="">None (deny unmatched)</option>
              <option value="Viewer">Viewer</option>
              <option value="SecurityEngineer">SecurityEngineer</option>
              <option value="Admin">Admin</option>
              <option value="Owner">Owner</option>
              <option value="ClientAdmin">ClientAdmin</option>
              <option value="MSSPOwner">MSSPOwner</option>
            </select>
          </SsoField>
          <div className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3 text-sm text-muted">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Enable this configuration
            </label>
            <label className="flex items-start gap-2">
              <input className="mt-0.5" type="checkbox" checked={enforced} onChange={(event) => setEnforced(event.target.checked)} />
              <span>Require SSO for tenant sessions after testing succeeds.</span>
            </label>
          </div>

          {enforced ? (
            <p className="sm:col-span-2 rounded-control border border-approval/30 bg-approval/5 p-3 text-xs text-muted">
              Enforcement signs out password-authenticated tenant sessions. Save without enforcement first, then use Test login before turning this on.
            </p>
          ) : null}
          {error ? <p role="alert" className="sm:col-span-2 text-sm text-missed">{error}</p> : null}
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy !== null} className={buttonClassName({ variant: "primary" })}>
              {busy === "save" ? "Saving…" : "Save SSO setup"}
            </button>
          </div>
        </form>
      ) : config ? (
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-subtle">{config.providerType}</span>
            <StateBadge tone={config.status === "Enabled" ? "fixed" : "inconclusive"} dot={false}>{config.status}</StateBadge>
            {config.enforced ? <StateBadge tone="approval" dot={false}>Enforced</StateBadge> : null}
          </div>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-subtle">Identity provider</dt><dd className="mt-0.5 break-all text-ink">{config.issuerUrl}</dd></div>
            <div><dt className="text-subtle">Client / entity ID</dt><dd className="mt-0.5 break-all text-ink">{config.clientId}</dd></div>
            <div><dt className="text-subtle">Callback</dt><dd className="mt-0.5 break-all text-ink">{config.redirectUri ?? "Not set"}</dd></div>
            <div><dt className="text-subtle">Allowed domains</dt><dd className="mt-0.5 text-ink">{config.emailDomainAllowlist.join(", ") || "Provisioned users only"}</dd></div>
            <div>
              <dt className="text-subtle">Role claim mapping</dt>
              <dd className="mt-0.5 text-ink">
                {(config.roleMappings?.length ?? 0) === 0
                  ? "Disabled (invite-time roles)"
                  : `${config.roleClaimName ?? "groups"} · ${config.roleMappings.length} rule(s)${
                      config.defaultMappedRole
                        ? ` · default ${config.defaultMappedRole}`
                        : " · deny unmatched"
                    }`}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={testLogin} disabled={busy !== null || config.status !== "Enabled"} className={buttonClassName({ size: "sm", variant: "primary" })}>
              {busy === "test" ? "Redirecting…" : "Test login"}
            </button>
            {config.providerType === "SAML" ? (
              <a href="/api/v1/tenants/current/sso/metadata" target="_blank" rel="noreferrer" className={buttonClassName({ size: "sm", variant: "secondary" })}>SP metadata</a>
            ) : null}
            <button type="button" onClick={disable} disabled={busy !== null || config.status === "Disabled"} className={cn(buttonClassName({ size: "sm", variant: "secondary" }), "text-missed")}>
              {busy === "disable" ? "Disabling…" : "Disable"}
            </button>
          </div>
          {status ? <p role="status" className="mt-3 text-sm text-fixed">{status}</p> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-missed">{error}</p> : null}
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-muted">Connect your workforce identity provider with OIDC or SAML. Start unenforced, test the login, then require SSO.</p>
          {status ? <p role="status" className="mt-3 text-sm text-fixed">{status}</p> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-missed">{error}</p> : null}
        </div>
      )}
    </Panel>
  );
}

function SsoField({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", wide && "sm:col-span-2")}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
