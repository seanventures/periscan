"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import type {
  AttackPathAssessment,
  DesignPartnerWorkspace,
  Integration,
  RemediationTask,
  Scope,
  ValidationSnapshot
} from "@periscan/shared";
import { buildAttackPathRiskSummary } from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload,
  type RemediationVerificationResult,
  type ScopePostureCheckResult
} from "../lib/periscan-api-client";
import {
  AttackPathGraph,
  Badge,
  Button,
  buttonClassName,
  Card,
  StatusPill
} from "../ui";
import { AttackPathDepth } from "./attack-path-depth";

interface RemediationVerificationView {
  previousEvidenceIds: string[];
  result: RemediationVerificationResult;
}

interface WorkspaceState {
  attackPaths: AttackPathAssessment[];
  auth: AuthSessionPayload | null;
  designPartner: DesignPartnerWorkspace | null;
  integrations: Integration[];
  remediations: RemediationTask[];
  scopes: Scope[];
  snapshots: ValidationSnapshot[];
}

interface SnapshotWorkbenchProps {
  fixtureConnectorShortcutsEnabled?: boolean;
}

const DEFAULT_FIXTURE_CONNECTOR_SHORTCUTS_ENABLED =
  process.env.NEXT_PUBLIC_PERISCAN_ENABLE_FIXTURE_CONNECTORS === "true";

const SNAPSHOT_FIXTURE_CONNECTORS = [
  {
    connectorKey: "github",
    label: "GitHub fixture"
  },
  {
    connectorKey: "aws",
    label: "AWS fixture"
  }
] as const;

const SNAPSHOT_FLOW_STEPS = [
  "1. Define scope",
  "2. Connect systems",
  "3. Run validation",
  "4. Review report",
  "5. Create remediation",
  "6. Verify fix",
  "7. Export evidence"
] as const;

const INITIAL_WORKSPACE_STATE: WorkspaceState = {
  attackPaths: [],
  auth: null,
  designPartner: null,
  integrations: [],
  remediations: [],
  scopes: [],
  snapshots: []
};

const fieldClass = "flex flex-col gap-1 text-sm text-muted";
const inputClass =
  "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const listCardClass =
  "flex items-start justify-between gap-3 rounded-control border border-line bg-surface p-3";
const tileClass =
  "flex flex-col gap-1 rounded-control border border-line bg-surface p-3";
const sectionHeaderClass = "flex items-center justify-between gap-4";
const kickerClass = "text-xs uppercase tracking-wide text-subtle";
const chipClass =
  "inline-flex items-center rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted";

function renderEvidenceCountLabel(evidenceIds: string[]) {
  return `${evidenceIds.length} evidence link${evidenceIds.length === 1 ? "" : "s"}`;
}

function buildDnsVerificationName(scopeValue: string) {
  return `_periscan.${scopeValue.trim().toLowerCase().replace(/\.+$/u, "")}`;
}

async function loadWorkspaceState(
  auth: AuthSessionPayload
): Promise<WorkspaceState> {
  const [
    attackPaths,
    designPartner,
    integrations,
    remediations,
    scopes,
    snapshots
  ] = await Promise.all([
    browserPeriscanApiClient.listAttackPaths(),
    browserPeriscanApiClient.getDesignPartnerWorkspace(),
    browserPeriscanApiClient.listIntegrations(),
    browserPeriscanApiClient.listRemediations(),
    browserPeriscanApiClient.listScopes(),
    browserPeriscanApiClient.listSnapshots()
  ]);

  return {
    attackPaths,
    auth,
    designPartner,
    integrations,
    remediations,
    scopes,
    snapshots
  };
}

export function SnapshotWorkbench({
  fixtureConnectorShortcutsEnabled = DEFAULT_FIXTURE_CONNECTOR_SHORTCUTS_ENABLED
}: SnapshotWorkbenchProps = {}) {
  const [workspace, setWorkspace] = useState(INITIAL_WORKSPACE_STATE);
  const [domainValue, setDomainValue] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authForm, setAuthForm] = useState({
    email: "",
    name: "",
    password: "",
    tenantName: ""
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [postureResults, setPostureResults] = useState<
    Record<string, ScopePostureCheckResult>
  >({});
  const [postureBusyScopeId, setPostureBusyScopeId] = useState<string | null>(
    null
  );
  const [selectedTicketDest, setSelectedTicketDest] = useState<
    Record<string, string>
  >({});
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [verifyingRemediationId, setVerifyingRemediationId] = useState<
    string | null
  >(null);
  const [verificationViews, setVerificationViews] = useState<
    Record<string, RemediationVerificationView>
  >({});

  async function refreshWorkspace(auth: AuthSessionPayload) {
    const nextState = await loadWorkspaceState(auth);

    setWorkspace(nextState);
  }

  async function verifyRemediationFix(
    remediationId: string,
    previousEvidenceIds: string[]
  ) {
    setErrorMessage(null);
    setVerifyingRemediationId(remediationId);

    try {
      const result =
        await browserPeriscanApiClient.verifyRemediation(remediationId);

      setVerificationViews((current) => ({
        ...current,
        [remediationId]: { previousEvidenceIds, result }
      }));

      if (workspace.auth) {
        await refreshWorkspace(workspace.auth);
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to verify the remediation fix."
      );
    } finally {
      setVerifyingRemediationId(null);
    }
  }

  useEffect(() => {
    let active = true;
    setIsLoadingAuth(true);

    void browserPeriscanApiClient
      .getMe()
      .then(async (auth) => {
        if (!active) {
          return;
        }

        try {
          const nextState = await loadWorkspaceState(auth);
          if (active) {
            setWorkspace(nextState);
          }
        } catch (loadError: unknown) {
          if (active) {
            setErrorMessage(
              loadError instanceof Error
                ? loadError.message
                : "Unable to load workspace data."
            );
            // show authed UI shell with error banner (honest empty data + error)
            setWorkspace({ ...INITIAL_WORKSPACE_STATE, auth });
          }
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setWorkspace(INITIAL_WORKSPACE_STATE);
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Periscan workspace."
        );
      })
      .finally(() => {
        if (active) {
          setIsLoadingAuth(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function withBusy(task: () => Promise<void>) {
    setErrorMessage(null);
    setIsBusy(true);

    try {
      await task();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Periscan request failed."
      );
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoadingAuth) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading workspace...</p>
      </Card>
    );
  }

  if (!workspace.auth) {
    return (
      <Card elevated className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className={kickerClass}>Periscan control plane</span>
          <h2 className="text-lg font-semibold text-ink">
            Authenticate into the API-backed workspace
          </h2>
          <p className="text-sm text-muted">
            The UI is a thin consumer of the versioned API. Sign in or create a
            tenant, then connect systems and generate a Validation Snapshot.
          </p>
        </div>

        <div
          className="inline-flex gap-1 rounded-pill border border-line bg-surface p-1"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            role="tab"
            aria-selected={authMode === "signup"}
            className={
              authMode === "signup"
                ? "rounded-control bg-brand-fill px-3 py-1 text-sm text-white"
                : "rounded-pill px-3 py-1 text-sm text-ink transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            }
            onClick={() => setAuthMode("signup")}
            type="button"
          >
            Create tenant
          </button>
          <button
            role="tab"
            aria-selected={authMode === "login"}
            className={
              authMode === "login"
                ? "rounded-control bg-brand-fill px-3 py-1 text-sm text-white"
                : "rounded-pill px-3 py-1 text-sm text-ink transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            }
            onClick={() => setAuthMode("login")}
            type="button"
          >
            Sign in
          </button>
        </div>

        <form
          aria-label="Workspace authentication"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => {
              void withBusy(async () => {
                const auth =
                  authMode === "signup"
                    ? await browserPeriscanApiClient.signup(authForm)
                    : await browserPeriscanApiClient.login({
                        email: authForm.email,
                        password: authForm.password
                      });

                await refreshWorkspace(auth);
              });
            });
          }}
        >
          {authMode === "signup" ? (
            <>
              <label className={fieldClass} htmlFor="workspace-auth-name">
                <span>Name</span>
                <input
                  className={inputClass}
                  id="workspace-auth-name"
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Your name"
                  required
                  value={authForm.name}
                />
              </label>
              <label className={fieldClass} htmlFor="workspace-auth-tenant">
                <span>Tenant</span>
                <input
                  className={inputClass}
                  id="workspace-auth-tenant"
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      tenantName: event.target.value
                    }))
                  }
                  placeholder="Company or team name"
                  required
                  value={authForm.tenantName}
                />
              </label>
            </>
          ) : null}
          <label className={fieldClass} htmlFor="workspace-auth-email">
            <span>Email</span>
            <input
              className={inputClass}
              id="workspace-auth-email"
              onChange={(event) =>
                setAuthForm((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              placeholder="you@company.com"
              required
              type="email"
              value={authForm.email}
            />
          </label>
          <label className={fieldClass} htmlFor="workspace-auth-password">
            <span>Password</span>
            <input
              className={inputClass}
              id="workspace-auth-password"
              onChange={(event) =>
                setAuthForm((current) => ({
                  ...current,
                  password: event.target.value
                }))
              }
              placeholder="Password"
              required
              type="password"
              value={authForm.password}
            />
          </label>
          <div>
            <Button disabled={isBusy} type="submit">
              {isBusy
                ? "Working..."
                : authMode === "signup"
                  ? "Create tenant and continue"
                  : "Sign in"}
            </Button>
          </div>
        </form>

        {errorMessage ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-danger">{errorMessage}</p>
            <button
              className="text-xs text-muted underline"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss error"
              type="button"
            >
              Dismiss
            </button>
            <button
              className="text-xs text-muted underline"
              onClick={() => {
                setErrorMessage(null);
                if (typeof window !== "undefined") window.location.reload();
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}
      </Card>
    );
  }

  const latestSnapshot = workspace.snapshots[0] ?? null;
  const designPartner = workspace.designPartner;
  const verifiedScopes = workspace.scopes.filter(
    (scope) => scope.verificationStatus === "Verified"
  );
  const designPartnerEnabled = designPartner?.settings.enabled ?? false;
  const connectedKeys = new Set(
    workspace.integrations.map(
      (integration) => integration.config?.connectorKey
    )
  );
  const latestSnapshotAttackPaths =
    latestSnapshot?.topAttackPaths ?? workspace.attackPaths;
  const latestSnapshotRemediations =
    latestSnapshot?.remediationPriorities ?? workspace.remediations;
  const ticketingDestinations = workspace.integrations.filter(
    (int) => int.category === "Ticketing" || int.category === "MSSP"
  );
  const latestSnapshotPathEvidenceCount = latestSnapshot
    ? new Set(
        latestSnapshot.topAttackPaths.flatMap(
          ({ attackPath }) => attackPath.evidenceIds
        )
      ).size
    : 0;
  const latestSnapshotRemediationEvidenceCount = latestSnapshot
    ? new Set(
        latestSnapshot.remediationPriorities.flatMap(
          (remediation) => remediation.evidenceIds
        )
      ).size
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card
        elevated
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex flex-col gap-1">
          <span className={kickerClass}>Periscan validation workspace</span>
          <h2 className="text-lg font-semibold text-ink">
            Find the path. Validate the risk. Prove it’s fixed.
          </h2>
          <p className="text-sm text-muted">
            Signed in as {workspace.auth.user.email} for{" "}
            {workspace.auth.tenant.name}. Connect verified scope and authorized
            integrations, then run a Validation Snapshot through the API.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/trust-safety"
          >
            Trust &amp; Safety
          </Link>
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              startTransition(() => {
                void withBusy(async () => {
                  await browserPeriscanApiClient.logout();
                  setWorkspace(INITIAL_WORKSPACE_STATE);
                });
              });
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className={tileClass}>
          <span className="text-xs text-muted">Verified scopes</span>
          <strong
            className="text-2xl text-ink"
            aria-label={`Verified scope count: ${verifiedScopes.length}`}
            role="status"
          >
            {verifiedScopes.length}
          </strong>
        </div>
        <div className={tileClass}>
          <span className="text-xs text-muted">Connected integrations</span>
          <strong
            className="text-2xl text-ink"
            aria-label={`Connected integration count: ${workspace.integrations.length}`}
            role="status"
          >
            {workspace.integrations.length}
          </strong>
        </div>
        <div className={tileClass}>
          <span className="text-xs text-muted">Top attack paths</span>
          <strong
            className="text-2xl text-ink"
            aria-label={`Workspace attack path count: ${workspace.attackPaths.length}`}
            role="status"
          >
            {workspace.attackPaths.length}
          </strong>
        </div>
        <div className={tileClass}>
          <span className="text-xs text-muted">Remediation tasks</span>
          <strong
            className="text-2xl text-ink"
            aria-label={`Workspace remediation count: ${workspace.remediations.length}`}
            role="status"
          >
            {workspace.remediations.length}
          </strong>
        </div>
        <div className={tileClass}>
          <span className="text-xs text-muted">Design partner mode</span>
          <strong
            className="text-2xl text-ink"
            aria-label={`Design partner mode dashboard status: ${
              designPartnerEnabled ? "On" : "Off"
            }`}
            role="status"
          >
            {designPartnerEnabled ? "On" : "Off"}
          </strong>
        </div>
      </div>

      <Card
        className="flex flex-col gap-3"
        aria-label="Validation Snapshot flow"
      >
        <div className={sectionHeaderClass}>
          <h3 className="text-base font-semibold text-ink">
            Validation Snapshot flow
          </h3>
          <Badge tone="info" role="status">
            API-backed
          </Badge>
        </div>
        <ol className="grid gap-2 md:grid-cols-4 lg:grid-cols-7">
          {SNAPSHOT_FLOW_STEPS.map((step) => (
            <li
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              key={step}
            >
              {step}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className={sectionHeaderClass}>
            <h3 className="text-base font-semibold text-ink">
              1. Define scope
            </h3>
            <StatusPill
              status={verifiedScopes.length > 0 ? "Ready" : "Required"}
              aria-label={`Scope verification status: ${
                verifiedScopes.length > 0 ? "Ready" : "Required"
              }`}
            />
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(() => {
                void withBusy(async () => {
                  await browserPeriscanApiClient.createScope({
                    scopeType: "Domain",
                    value: domainValue
                  });
                  await refreshWorkspace(workspace.auth!);
                });
              });
            }}
          >
            <label className="sr-only" htmlFor="workspace-domain-scope">
              Domain scope
            </label>
            <input
              className={`${inputClass} flex-1`}
              id="workspace-domain-scope"
              onChange={(event) => setDomainValue(event.target.value)}
              placeholder="verified.example.com"
              required
              value={domainValue}
            />
            <Button variant="secondary" disabled={isBusy} type="submit">
              Add domain
            </Button>
          </form>
          <div className="flex flex-col gap-2">
            {workspace.scopes.length === 0 ? (
              <p className="text-sm text-muted">No scopes yet.</p>
            ) : (
              workspace.scopes.map((scope) => (
                <div className={listCardClass} key={scope.scopeId}>
                  <div>
                    <strong className="text-ink">{scope.value}</strong>
                    <p className="text-sm text-muted">
                      {scope.verificationStatus}
                    </p>
                    {scope.verificationStatus !== "Verified" &&
                    scope.verificationMethod === "DNS_TXT" &&
                    scope.verificationToken ? (
                      <div className="mt-2 flex max-w-xl flex-col gap-1 rounded-control border border-line bg-surface-strong p-2 text-xs text-muted">
                        <span className="font-medium text-ink">
                          Publish this DNS TXT record before verifying:
                        </span>
                        <code className="break-all">
                          {buildDnsVerificationName(scope.value)} TXT{" "}
                          {scope.verificationToken}
                        </code>
                      </div>
                    ) : null}
                    {scope.lastPostureCheckAt ? (
                      <p className="text-sm text-muted">
                        Posture last checked{" "}
                        {new Date(scope.lastPostureCheckAt).toLocaleString()}
                        {scope.nextPostureCheckAt
                          ? ` · next due ${new Date(scope.nextPostureCheckAt).toLocaleString()}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {scope.verificationStatus === "Verified" ? (
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => {
                          setPostureBusyScopeId(scope.scopeId);
                          startTransition(() => {
                            void withBusy(async () => {
                              const result =
                                await browserPeriscanApiClient.runScopePostureCheck(
                                  scope.scopeId
                                );
                              setPostureResults((prev) => ({
                                ...prev,
                                [scope.scopeId]: result
                              }));
                              // Refresh so the scope's posture cadence
                              // (last/next checked) reflects the enrollment.
                              await refreshWorkspace(workspace.auth!);
                            }).finally(() => setPostureBusyScopeId(null));
                          });
                        }}
                      >
                        {postureBusyScopeId === scope.scopeId
                          ? "Running posture check..."
                          : "Run posture check"}
                      </Button>
                      {postureResults[scope.scopeId] ? (
                        <ul
                          aria-label={`Posture check results for ${scope.value}`}
                          className="flex flex-col gap-1 text-sm"
                        >
                          {postureResults[scope.scopeId]!.checks.map(
                            (check) => {
                              // Three honest states: a measured exposure, a
                              // measured-clean "OK", and Inconclusive (we could
                              // not measure — e.g. unreachable). Never show "OK"
                              // for something we did not actually measure.
                              const inconclusive =
                                !check.exposure &&
                                check.validationState === "Inconclusive";
                              const tone = check.exposure
                                ? "warning"
                                : inconclusive
                                  ? "neutral"
                                  : "success";
                              const label = check.exposure
                                ? `Exposure (${check.outcome})`
                                : inconclusive
                                  ? `Inconclusive (${check.outcome})`
                                  : "OK";

                              return (
                                <li key={check.moduleId}>
                                  <span className="text-muted">
                                    {check.moduleId}
                                  </span>
                                  {": "}
                                  <Badge tone={tone}>{label}</Badge>
                                </li>
                              );
                            }
                          )}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => {
                        startTransition(() => {
                          void withBusy(async () => {
                            await browserPeriscanApiClient.verifyScope(
                              scope.scopeId
                            );
                            await refreshWorkspace(workspace.auth!);
                          });
                        });
                      }}
                    >
                      Verify
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className={sectionHeaderClass}>
            <h3 className="text-base font-semibold text-ink">
              2. Connect systems
            </h3>
            <Badge
              tone="success"
              aria-label={`Connected integration count: ${workspace.integrations.length}`}
              role="status"
            >
              {workspace.integrations.length} connected
            </Badge>
          </div>
          <p className="text-sm text-muted">
            Use the full Integration Marketplace and API credential setup for
            live connectors. Explicitly enabled local lab environments can also
            expose fixture connector shortcuts; production workspaces keep those
            shortcuts hidden.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/integrations"
            >
              Open Integration Marketplace
            </Link>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href="/trust-safety"
            >
              Review Trust &amp; Safety
            </Link>
          </div>
          {fixtureConnectorShortcutsEnabled ? (
            <div className="flex flex-col gap-2">
              {SNAPSHOT_FIXTURE_CONNECTORS.map(({ connectorKey, label }) => (
                <div className={listCardClass} key={connectorKey}>
                  <div>
                    <strong className="text-ink">{label}</strong>
                    <p
                      aria-label={`${label} connection status: ${
                        connectedKeys.has(connectorKey)
                          ? "Connected"
                          : "Not connected"
                      }`}
                      className="text-sm text-muted"
                      role="status"
                    >
                      {connectedKeys.has(connectorKey)
                        ? "Connected"
                        : "Not connected"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isBusy || connectedKeys.has(connectorKey)}
                    onClick={() => {
                      startTransition(() => {
                        void withBusy(async () => {
                          const integration =
                            await browserPeriscanApiClient.createIntegration({
                              connectorKey,
                              mockMode: true
                            });
                          try {
                            await browserPeriscanApiClient.syncIntegration(
                              integration.integrationId
                            );
                          } catch {
                            // Non-fatal for explicitly enabled local fixture
                            // shortcuts; the connected integration remains
                            // visible after the workspace refresh.
                          }
                          await refreshWorkspace(workspace.auth!);
                        });
                      });
                    }}
                  >
                    {connectedKeys.has(connectorKey)
                      ? "Connected"
                      : "Connect fixture"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className={listCardClass}>
              <div>
                <strong className="text-ink">Live connector setup</strong>
                <p
                  className="text-sm text-muted"
                  role="status"
                  aria-label="Fixture connector shortcut status: disabled"
                >
                  Fixture connector shortcuts are disabled in this environment.
                  Configure live GitHub, AWS, and workflow integrations through
                  the API or connector-specific onboarding; connected systems
                  appear here after sync.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <div className={sectionHeaderClass}>
          <h3 className="text-base font-semibold text-ink">
            3. Run Validation Snapshot
          </h3>
          <Badge
            tone={latestSnapshot ? "info" : "neutral"}
            aria-label={`Validation Snapshot status: ${
              latestSnapshot ? "Latest ready" : "Awaiting run"
            }`}
            role="status"
          >
            {latestSnapshot ? "Latest ready" : "Awaiting run"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isBusy || verifiedScopes.length === 0}
            onClick={() => {
              startTransition(() => {
                void withBusy(async () => {
                  await browserPeriscanApiClient.createSnapshot({
                    audience: "Security Team",
                    maxTopItems: 5
                  });
                  await refreshWorkspace(workspace.auth!);
                });
              });
            }}
          >
            Run Validation Snapshot
          </Button>
          {latestSnapshot ? (
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href={`/snapshots/${latestSnapshot.snapshotId}`}
            >
              Open latest report
            </Link>
          ) : null}
        </div>
        {latestSnapshot ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-control border border-line bg-surface p-3">
              <strong className="text-ink">
                {latestSnapshot.summary.headline}
              </strong>
              <p className="text-sm text-muted">
                {latestSnapshot.summary.overview}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <article className={tileClass}>
                <span className={kickerClass}>Snapshot coverage</span>
                <strong className="text-xl text-ink">
                  {latestSnapshot.evidenceIds.length}
                </strong>
                <p className="text-sm text-muted">
                  Evidence artifacts attached to this snapshot.
                </p>
              </article>
              <article className={tileClass}>
                <span className={kickerClass}>Path evidence</span>
                <strong className="text-xl text-ink">
                  {latestSnapshotPathEvidenceCount}
                </strong>
                <p className="text-sm text-muted">
                  Unique evidence links across the priority attack paths.
                </p>
              </article>
              <article className={tileClass}>
                <span className={kickerClass}>Control validation</span>
                <strong className="text-xl text-ink">
                  {latestSnapshot.controlObservations.length}
                </strong>
                <p className="text-sm text-muted">
                  {latestSnapshot.controlObservations.length > 0
                    ? "Normalized control signals are attached to this run."
                    : "No control validation signals are attached to this snapshot yet."}
                </p>
              </article>
              <article className={tileClass}>
                <span className={kickerClass}>AI validation</span>
                <strong className="text-xl text-ink">
                  {latestSnapshot.aiAppRisks.length}
                </strong>
                <p className="text-sm text-muted">
                  {latestSnapshot.aiAppRisks.length > 0
                    ? "Normalized AI validation signals are attached to this run."
                    : "No AI validation signals are attached to this snapshot yet."}
                </p>
              </article>
              <article className={tileClass}>
                <span className={kickerClass}>Threat exposure</span>
                <strong className="text-xl text-ink">
                  {latestSnapshot.metrics.openThreatAdvisoryCount}
                </strong>
                <p className="text-sm text-muted">
                  {latestSnapshot.metrics.openThreatAdvisoryCount > 0
                    ? `Open threat advisories tracked · ${latestSnapshot.metrics.correlatedThreatAdvisoryCount} correlate to this tenant's validation evidence.`
                    : "No open threat advisories are currently tracked."}
                </p>
              </article>
              <article className={tileClass}>
                <span className={kickerClass}>Stale verifications</span>
                <strong className="text-xl text-ink">
                  {latestSnapshot.metrics.staleVerificationCount}
                </strong>
                <p className="text-sm text-muted">
                  {latestSnapshot.metrics.staleVerificationCount > 0
                    ? "Settled fixes whose re-verification is overdue — confirm a claimed “Fixed” still holds."
                    : "All settled fixes are within their re-verification window."}
                </p>
              </article>
            </div>
            <p className="text-xs text-muted">
              Reports only render control and AI sections when the snapshot
              payload includes normalized signals for those feature areas.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Run the snapshot after scope verification and integration setup.
          </p>
        )}
      </Card>

      {designPartner ? (
        <Card className="flex flex-col gap-3">
          <div className={sectionHeaderClass}>
            <h3 className="text-base font-semibold text-ink">
              Design Partner Mode
            </h3>
            <StatusPill
              status={designPartnerEnabled ? "Enabled" : "Disabled"}
              aria-label={`Design partner mode status: ${
                designPartnerEnabled ? "Enabled" : "Disabled"
              }`}
            />
          </div>
          <p className="text-sm text-muted">
            Guided onboarding, integration setup, report preview, and Periscan
            analyst notes for first-customer delivery.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => {
                startTransition(() => {
                  void withBusy(async () => {
                    await browserPeriscanApiClient.updateDesignPartnerSettings({
                      enabled: !designPartnerEnabled
                    });
                    await refreshWorkspace(workspace.auth!);
                  });
                });
              }}
            >
              {designPartnerEnabled
                ? "Disable design partner mode"
                : "Enable design partner mode"}
            </Button>
            {designPartner.snapshotRequest.previewPath ? (
              <Link
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
                href={designPartner.snapshotRequest.previewPath}
              >
                Preview latest report
              </Link>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
              <div className={sectionHeaderClass}>
                <h4 className="text-sm font-semibold text-ink">
                  Onboarding checklist
                </h4>
                <Badge
                  aria-label={`Onboarding checklist complete count: ${
                    designPartner.onboardingChecklist.filter(
                      (item) => item.status === "Complete"
                    ).length
                  } of ${designPartner.onboardingChecklist.length}`}
                  role="status"
                >
                  {
                    designPartner.onboardingChecklist.filter(
                      (item) => item.status === "Complete"
                    ).length
                  }
                  /{designPartner.onboardingChecklist.length}
                </Badge>
              </div>
              {designPartner.onboardingChecklist.map((item) => (
                <div className={listCardClass} key={item.itemId}>
                  <div>
                    <strong className="text-ink">{item.label}</strong>
                    <p className="text-sm text-muted">{item.description}</p>
                  </div>
                  <StatusPill
                    status={item.status}
                    aria-label={`Onboarding checklist ${item.label} status: ${item.status}`}
                  />
                </div>
              ))}
            </article>
            <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
              <div className={sectionHeaderClass}>
                <h4 className="text-sm font-semibold text-ink">
                  Integration setup
                </h4>
                <Badge
                  aria-label={`Integration setup checklist complete count: ${
                    designPartner.integrationChecklist.filter(
                      (item) => item.status === "Complete"
                    ).length
                  } of ${designPartner.integrationChecklist.length}`}
                  role="status"
                >
                  {
                    designPartner.integrationChecklist.filter(
                      (item) => item.status === "Complete"
                    ).length
                  }
                  /{designPartner.integrationChecklist.length}
                </Badge>
              </div>
              {designPartner.integrationChecklist.map((item) => (
                <div className={listCardClass} key={item.itemId}>
                  <div>
                    <strong className="text-ink">{item.label}</strong>
                    <p className="text-sm text-muted">{item.description}</p>
                  </div>
                  <StatusPill
                    status={item.status}
                    aria-label={`Integration setup ${item.label} status: ${item.status}`}
                  />
                </div>
              ))}
            </article>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
              <div className={sectionHeaderClass}>
                <h4 className="text-sm font-semibold text-ink">
                  Snapshot request
                </h4>
                <StatusPill
                  status={designPartner.snapshotRequest.status}
                  aria-label={`Design partner snapshot request status: ${designPartner.snapshotRequest.status}`}
                />
              </div>
              <p className="text-sm text-muted">
                {designPartner.snapshotRequest.requestedAt
                  ? `Latest report requested at ${designPartner.snapshotRequest.requestedAt}.`
                  : "No Validation Snapshot has been requested for this tenant yet."}
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
              <div className={sectionHeaderClass}>
                <h4 className="text-sm font-semibold text-ink">
                  Periscan analyst note
                </h4>
                <StatusPill
                  status={
                    designPartner.latestAnalystNote ? "Attached" : "Pending"
                  }
                  aria-label={`Periscan analyst note status: ${
                    designPartner.latestAnalystNote ? "Attached" : "Pending"
                  }`}
                />
              </div>
              {designPartner.latestAnalystNote ? (
                <>
                  <strong className="text-ink">
                    {designPartner.latestAnalystNote.title ??
                      "Periscan analyst note"}
                  </strong>
                  <p className="text-sm text-muted">
                    {designPartner.latestAnalystNote.body}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Attach founder or operator context from the report preview
                  page.
                </p>
              )}
            </article>
            <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3 lg:col-span-2">
              <div className={sectionHeaderClass}>
                <h4 className="text-sm font-semibold text-ink">
                  Analyst evidence (tenant)
                </h4>
                <Badge
                  aria-label={`Proof-loop milestones complete: ${designPartner.analystEvidence.proofLoop.completedMilestones} of ${designPartner.analystEvidence.proofLoop.totalMilestones}`}
                  role="status"
                >
                  {designPartner.analystEvidence.proofLoop.completedMilestones}/
                  {designPartner.analystEvidence.proofLoop.totalMilestones}{" "}
                  proof-loop
                </Badge>
              </div>
              <p className="text-sm text-muted">
                Real-first proof-loop metrics for this tenant. Maturity:{" "}
                <strong className="text-ink">
                  {designPartner.analystEvidence.proofLoop.maturity}
                </strong>
                . Onboarding{" "}
                {designPartner.analystEvidence.checklist.onboardingComplete}/
                {designPartner.analystEvidence.checklist.onboardingTotal};{" "}
                integrations{" "}
                {designPartner.analystEvidence.checklist.integrationComplete}/
                {designPartner.analystEvidence.checklist.integrationTotal}.
                Measured runs with evidence:{" "}
                {
                  designPartner.analystEvidence.counts
                    .completedRunsWithEvidence
                }
                ; re-validations:{" "}
                {designPartner.analystEvidence.counts.verificationEvents}; packs
                shared/exported:{" "}
                {designPartner.analystEvidence.counts.exportedOrSharedPacks}.
              </p>
              {designPartner.analystEvidence.honesty.publicReferenceCount ===
              0 ? (
                <p
                  className="rounded-control border border-missed/40 bg-missed/10 px-3 py-2 text-xs text-missed"
                  role="status"
                  data-testid="design-partner-zero-refs-banner"
                >
                  {(designPartner.analystEvidence.honesty as { banner?: string }).banner ??
                    "Zero customer references — Wave market presence not met"}
                </p>
              ) : null}
              <p
                className="rounded-control border border-line bg-elevated/50 px-3 py-2 text-xs text-muted"
                role="note"
              >
                {designPartner.analystEvidence.honesty.disclaimer} Public
                references:{" "}
                {designPartner.analystEvidence.honesty.publicReferenceCount}.
                Wave:{" "}
                {(designPartner.analystEvidence.honesty as { waveMarketPresenceGate?: string }).waveMarketPresenceGate ??
                  "Fail"}
                ; MQ:{" "}
                {(designPartner.analystEvidence.honesty as { mqMarketPresenceGate?: string }).mqMarketPresenceGate ??
                  "Fail"}
                ; peer diligence:{" "}
                {designPartner.analystEvidence.honesty.peerDiligenceGate ??
                  "Fail"}
                ; reference pack:{" "}
                {designPartner.analystEvidence.honesty.referencePackStatus ??
                  "Empty"}
                . Market presence eligible:{" "}
                {designPartner.analystEvidence.honesty.marketPresenceEligible
                  ? "yes"
                  : "no"}
                .
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3 lg:col-span-2">
              <div className={sectionHeaderClass}>
                <h4 className="text-sm font-semibold text-ink">
                  Session learning (ICP first sessions)
                </h4>
                <Badge
                  aria-label={`Design-partner session learning count: ${designPartner.sessionLearning.sessionCount} of ${designPartner.sessionLearning.sessionsRequired}`}
                  role="status"
                >
                  {designPartner.sessionLearning.sessionCount}/
                  {designPartner.sessionLearning.sessionsRequired} sessions
                </Badge>
              </div>
              <p className="text-sm text-muted" role="status">
                {designPartner.sessionLearning.message}
              </p>
              {designPartner.sessionLearning.sessions.length === 0 ? (
                <div
                  className="flex flex-col gap-2 rounded-control border border-line bg-elevated/40 px-3 py-2"
                  data-testid="session-learning-empty-state"
                  role="status"
                >
                  <p className="text-sm text-muted">
                    No session notes yet. Need 5 sessions before the Wave{" "}
                    <em>learning</em> gate. Internal notes do not create public
                    references — market presence stays Fail at refs = 0.
                  </p>
                  <p className="text-xs font-medium text-ink">Next action</p>
                  <ol className="list-inside list-decimal text-xs text-muted">
                    <li>
                      Recruit one ICP participant (security leader/engineer or
                      MSSP/vCISO) — not a demo tenant
                    </li>
                    <li>
                      Run the measured proof loop on authorized scope (checklist
                      above)
                    </li>
                    <li>
                      Fill the observer scorecard; log an internal partner code
                      note below (never a public customer name claim)
                    </li>
                    <li>
                      For public refs, complete production deploy + written NDA
                      reference rights — see docs/DESIGN_PARTNER/REFERENCE_FACTORY.md
                    </li>
                  </ol>
                  <p className="font-mono text-[11px] text-subtle">
                    {designPartner.sessionLearning.sourceDoc} ·
                    docs/DESIGN_PARTNER/REFERENCE_FACTORY.md
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {designPartner.sessionLearning.sessions.map((session) => (
                    <li
                      className="rounded-control border border-line bg-elevated/40 px-3 py-2 text-sm text-muted"
                      key={session.sessionNoteId}
                    >
                      <span className="font-medium text-ink">
                        {session.partnerCode}
                      </span>
                      {session.roleBand ? ` · ${session.roleBand}` : null}
                      {session.outcome ? ` · ${session.outcome}` : null}
                      <span className="mt-1 block text-xs">
                        {session.note}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <DesignPartnerSessionNoteForm
                isBusy={isBusy}
                onSubmitted={async () => {
                  if (workspace.auth) {
                    await refreshWorkspace(workspace.auth);
                  }
                }}
                withBusy={withBusy}
                setErrorMessage={setErrorMessage}
              />
              <p className="text-xs text-muted" role="note">
                Source: {designPartner.sessionLearning.sourceDoc}. Wave market
                presence ready:{" "}
                {designPartner.sessionLearning.waveMarketPresenceReady
                  ? "yes"
                  : "no"}
                . Path to first public reference:{" "}
                <span className="font-mono">
                  docs/DESIGN_PARTNER/REFERENCE_FACTORY.md
                </span>
                .
              </p>
            </article>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className={sectionHeaderClass}>
            <h3 className="text-base font-semibold text-ink">
              Top Attack Paths
            </h3>
            <Badge
              tone="danger"
              aria-label={`Latest snapshot attack path count: ${latestSnapshotAttackPaths.length}`}
              role="status"
            >
              {latestSnapshotAttackPaths.length}
            </Badge>
          </div>
          {latestSnapshotAttackPaths.length === 0 ? (
            <p className="text-sm text-muted">No attack paths available yet.</p>
          ) : (
            latestSnapshotAttackPaths.map((path) => (
              <article
                className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
                key={path.attackPath.pathId}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-ink">{path.attackPath.name}</strong>
                  <StatusPill
                    status={path.risk.band}
                    aria-label={`Attack path ${path.attackPath.name} risk band: ${path.risk.band}`}
                  />
                </div>
                <p className="text-sm text-muted">
                  {buildAttackPathRiskSummary(path.attackPath, path.risk.band)}
                </p>
                <AttackPathDepth attackPath={path.attackPath} />
                <AttackPathGraph attackPath={path.attackPath} />
                <p className={kickerClass}>
                  {renderEvidenceCountLabel(path.attackPath.evidenceIds)}
                </p>
                {path.attackPath.evidenceIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {path.attackPath.evidenceIds.map((evidenceId) => (
                      <span className={chipClass} key={evidenceId}>
                        {evidenceId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    No evidence links are attached to this path yet.
                  </p>
                )}
              </article>
            ))
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className={sectionHeaderClass}>
            <h3 className="text-base font-semibold text-ink">
              Remediation Priorities
            </h3>
            <Badge
              tone="success"
              aria-label={`Latest snapshot remediation count: ${latestSnapshotRemediations.length}`}
              role="status"
            >
              {latestSnapshotRemediations.length}
            </Badge>
          </div>
          {latestSnapshotRemediations.length === 0 ? (
            <p className="text-sm text-muted">No remediations generated yet.</p>
          ) : (
            latestSnapshotRemediations.map((remediation) => (
              <article
                className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
                key={remediation.remediationId}
              >
                <strong className="text-ink">
                  {remediation.recommendedAction}
                </strong>
                <p className="text-sm text-muted">
                  Verification: {remediation.verificationMethod}
                </p>
                {remediation.latestVerification ? (
                  <p
                    className="text-sm text-muted"
                    role="status"
                    aria-label={`Last verification for ${remediation.recommendedAction}: ${remediation.latestVerification.outcome} (${
                      remediation.latestVerification.measuredRevalidation
                        ? "measured re-validation"
                        : "not measured"
                    })`}
                  >
                    Last verification: {remediation.latestVerification.outcome}{" "}
                    ·{" "}
                    {remediation.latestVerification.measuredRevalidation
                      ? "measured re-validation"
                      : "not measured"}
                    {remediation.relatedPathEvidenceBasis
                      ? ` · path evidence: ${remediation.relatedPathEvidenceBasis}`
                      : ""}
                  </p>
                ) : null}
                <p className={kickerClass}>
                  {renderEvidenceCountLabel(remediation.evidenceIds)}
                  {latestSnapshot
                    ? ` · ${latestSnapshotRemediationEvidenceCount} linked in the latest snapshot`
                    : ""}
                </p>
                {remediation.evidenceIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {remediation.evidenceIds.map((evidenceId) => (
                      <span className={chipClass} key={evidenceId}>
                        {evidenceId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    No evidence links are attached to this remediation yet.
                  </p>
                )}

                {remediation.ticketId ? (
                  <p className="text-sm text-muted">
                    Ticket: {remediation.ticketSystem ?? "external"} #
                    {remediation.ticketId}
                  </p>
                ) : ticketingDestinations.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`ticket-dest-${remediation.remediationId}`}
                      className="text-xs text-muted"
                    >
                      Destination:
                    </label>
                    <select
                      className={inputClass}
                      id={`ticket-dest-${remediation.remediationId}`}
                      value={
                        selectedTicketDest[remediation.remediationId] ||
                        ticketingDestinations[0]?.integrationId ||
                        ""
                      }
                      onChange={(e) =>
                        setSelectedTicketDest((prev) => ({
                          ...prev,
                          [remediation.remediationId]: e.target.value
                        }))
                      }
                      aria-label={`Select PSA/RMM destination for remediation ${remediation.recommendedAction}`}
                      disabled={isBusy}
                    >
                      {ticketingDestinations.map((dest) => (
                        <option
                          key={dest.integrationId}
                          value={dest.integrationId}
                        >
                          {dest.product} ({dest.vendor})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => {
                        const destId =
                          selectedTicketDest[remediation.remediationId] ||
                          ticketingDestinations[0]?.integrationId;
                        if (!destId) return;
                        startTransition(() => {
                          void withBusy(async () => {
                            try {
                              await browserPeriscanApiClient.createRemediationTicket(
                                remediation.remediationId,
                                { integrationId: destId }
                              );
                              setErrorMessage(null);
                              await refreshWorkspace(workspace.auth!);
                            } catch (err: unknown) {
                              const message =
                                err &&
                                typeof err === "object" &&
                                "message" in err
                                  ? String(
                                      (err as { message?: unknown }).message
                                    )
                                  : "Failed to create remediation ticket";
                              setErrorMessage(message);
                            }
                          });
                        });
                      }}
                    >
                      Create ticket
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Connect a PSA/RMM (Syncro, HaloPSA, Autotask, ConnectWise,
                    etc.) via /integrations to enable direct ticket creation.
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={
                        verifyingRemediationId === remediation.remediationId
                      }
                      onClick={() => {
                        startTransition(() => {
                          void verifyRemediationFix(
                            remediation.remediationId,
                            remediation.evidenceIds
                          );
                        });
                      }}
                    >
                      {verifyingRemediationId === remediation.remediationId
                        ? "Verifying fix..."
                        : "Verify fix"}
                    </Button>
                    <span className={kickerClass}>
                      No risk is marked fixed without a verification event.
                    </span>
                  </div>
                  {verificationViews[remediation.remediationId] ? (
                    <FixVerificationResult
                      view={verificationViews[remediation.remediationId]!}
                    />
                  ) : null}
                </div>
              </article>
            ))
          )}
        </Card>
      </div>

      {errorMessage ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{errorMessage}</p>
          <button
            className="text-xs text-muted underline"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            type="button"
          >
            Dismiss
          </button>
          <button
            className="text-xs text-muted underline"
            onClick={() => {
              setErrorMessage(null);
              if (typeof window !== "undefined") window.location.reload();
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Internal design-partner session note intake (P08-8 / zero-ref path).
 * Never creates public references — isPublicReference always false server-side.
 */
function DesignPartnerSessionNoteForm({
  isBusy,
  onSubmitted,
  withBusy,
  setErrorMessage
}: {
  isBusy: boolean;
  onSubmitted: () => Promise<void>;
  withBusy: (task: () => Promise<void>) => Promise<void>;
  setErrorMessage: (message: string | null) => void;
}) {
  const [partnerCode, setPartnerCode] = useState("");
  const [roleBand, setRoleBand] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<
    "not_started" | "in_progress" | "completed" | "convert" | "nurture" | "churn" | ""
  >("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-control border border-line bg-elevated/30 p-3"
      data-testid="design-partner-session-note-form"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => {
          void withBusy(async () => {
            setStatusMessage(null);
            const trimmedCode = partnerCode.trim();
            const trimmedNote = note.trim();
            if (!trimmedCode || !trimmedNote) {
              setErrorMessage(
                "Partner code and note are required for an internal session learning note."
              );
              return;
            }
            await browserPeriscanApiClient.appendDesignPartnerSessionNote({
              partnerCode: trimmedCode,
              note: trimmedNote,
              ...(roleBand.trim() ? { roleBand: roleBand.trim() } : {}),
              ...(outcome ? { outcome } : {})
            });
            setPartnerCode("");
            setRoleBand("");
            setNote("");
            setOutcome("");
            setStatusMessage(
              "Internal session note saved. This is not a public customer reference."
            );
            await onSubmitted();
          });
        });
      }}
    >
      <p className="text-xs font-medium text-ink">
        Log internal session note
      </p>
      <p className="text-[11px] text-muted">
        Use an anonymized partner code only. Notes never grant Wave market
        presence or public logos.
      </p>
      <label className={fieldClass}>
        Partner code (internal)
        <input
          className={inputClass}
          disabled={isBusy}
          maxLength={64}
          name="partnerCode"
          onChange={(e) => setPartnerCode(e.target.value)}
          placeholder="DP-01"
          required
          value={partnerCode}
        />
      </label>
      <label className={fieldClass}>
        Role band (optional)
        <input
          className={inputClass}
          disabled={isBusy}
          maxLength={128}
          name="roleBand"
          onChange={(e) => setRoleBand(e.target.value)}
          placeholder="security leader / engineer / MSSP"
          value={roleBand}
        />
      </label>
      <label className={fieldClass}>
        Note
        <textarea
          className={inputClass}
          disabled={isBusy}
          maxLength={4000}
          name="note"
          onChange={(e) => setNote(e.target.value)}
          placeholder="Pass/fail summary, friction, no customer secrets"
          required
          rows={3}
          value={note}
        />
      </label>
      <label className={fieldClass}>
        Outcome (optional)
        <select
          className={inputClass}
          disabled={isBusy}
          name="outcome"
          onChange={(e) =>
            setOutcome(
              e.target.value as
                | ""
                | "not_started"
                | "in_progress"
                | "completed"
                | "convert"
                | "nurture"
                | "churn"
            )
          }
          value={outcome}
        >
          <option value="">—</option>
          <option value="not_started">not_started</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
          <option value="convert">convert</option>
          <option value="nurture">nurture</option>
          <option value="churn">churn</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={isBusy} size="sm" type="submit" variant="secondary">
          Save internal note
        </Button>
        {statusMessage ? (
          <p className="text-xs text-muted" role="status">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function FixVerificationResult(props: { view: RemediationVerificationView }) {
  const { previousEvidenceIds, result } = props.view;
  const event = result.verificationEvent;
  const currentEvidenceIds = event.evidenceIds;
  const addedEvidenceIds = currentEvidenceIds.filter(
    (id) => !previousEvidenceIds.includes(id)
  );

  return (
    <article
      aria-label="Fix verification result"
      className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-ink">Verification event recorded</strong>
        <StatusPill
          status={event.outcome}
          aria-label={`Verification outcome: ${event.outcome}`}
        />
      </div>
      <p className="text-sm text-muted">
        State change: {event.previousState ?? "Unknown"} &rarr; {event.newState}
        . Verified at {event.verifiedAt}.
      </p>
      {result.attackPath ? (
        <p className="text-sm text-muted">
          Re-assessed path risk: {result.attackPath.risk.band} ·{" "}
          {result.attackPath.risk.score}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-subtle">
            Previous evidence ({previousEvidenceIds.length})
          </span>
          {previousEvidenceIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {previousEvidenceIds.map((evidenceId) => (
                <span
                  className="inline-flex items-center rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted"
                  key={`prev-${evidenceId}`}
                >
                  {evidenceId}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No prior evidence was attached.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-subtle">
            Current proof ({currentEvidenceIds.length})
          </span>
          {currentEvidenceIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {currentEvidenceIds.map((evidenceId) => (
                <span
                  className={
                    addedEvidenceIds.includes(evidenceId)
                      ? "inline-flex items-center rounded-pill bg-success/15 px-2 py-0.5 text-xs text-success"
                      : "inline-flex items-center rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted"
                  }
                  key={`cur-${evidenceId}`}
                >
                  {evidenceId}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No verification evidence was produced.
            </p>
          )}
        </div>
      </div>
      {addedEvidenceIds.length > 0 ? (
        <p className="text-xs uppercase tracking-wide text-subtle">
          {addedEvidenceIds.length} new evidence artifact
          {addedEvidenceIds.length === 1 ? "" : "s"} captured during
          verification.
        </p>
      ) : null}
    </article>
  );
}
