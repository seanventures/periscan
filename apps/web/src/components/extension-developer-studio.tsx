"use client";

import { useEffect, useMemo, useState } from "react";

import type { ExtensionRelease, ExtensionScaffold } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ConfirmDialog,
  LoadingSkeleton,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const STATUS_TONE: Record<string, StateTone> = {
  CatalogActive: "fixed",
  Certified: "validated",
  Compatible: "validated",
  CompatibilityFailed: "missed",
  Rejected: "missed",
  Revoked: "missed",
  Superseded: "inconclusive"
};

const inputClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand";

function shortDigest(digest: string) {
  return digest.slice(0, 10) + "…" + digest.slice(-8);
}

function ReleaseRail({ release }: { release: ExtensionRelease | null }) {
  const stages = ["Scaffold", "Compatible", "Certified", "Catalog active"];
  const completeThrough = !release
    ? 0
    : release.status === "CatalogActive"
      ? 3
      : ["Certified", "Superseded"].includes(release.status)
        ? 2
        : release.compatible
          ? 1
          : 0;

  return (
    <ol aria-label="Extension release stages" className="grid grid-cols-4">
      {stages.map((stage, index) => (
        <li className="relative pr-2" key={stage}>
          <div
            className={cn(
              "absolute left-2 top-[7px] h-px w-full",
              index < completeThrough ? "bg-brand" : "bg-line",
              index === stages.length - 1 && "hidden"
            )}
          />
          <span
            className={cn(
              "relative block size-3.5 rounded-full border-2 bg-canvas",
              index <= completeThrough ? "border-brand" : "border-line"
            )}
          />
          <span className="mt-2 block text-[10px] leading-4 text-subtle">
            {stage}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ExtensionDeveloperStudio() {
  const workspace = useApiResource(
    () => api.getExtensionDeveloperWorkspace(),
    []
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [description, setDescription] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [licenseSpdx, setLicenseSpdx] = useState("Apache-2.0");
  const [version, setVersion] = useState("1.0.0");
  const [contractJson, setContractJson] = useState("");
  const [reason, setReason] = useState(
    "Reviewed for tenant catalog compatibility and bounded permissions."
  );
  const [scaffold, setScaffold] = useState<ExtensionScaffold | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ExtensionRelease | null>(
    null
  );

  const projects = workspace.data?.projects ?? [];
  const releases = workspace.data?.releases ?? [];
  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].extensionProjectId);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => project.extensionProjectId === selectedProjectId
      ) ?? null,
    [projects, selectedProjectId]
  );
  const projectReleases = useMemo(
    () =>
      releases.filter(
        (release) => release.extensionProjectId === selectedProjectId
      ),
    [releases, selectedProjectId]
  );
  const activeRelease =
    projectReleases.find((release) => release.status === "CatalogActive") ??
    projectReleases[0] ??
    null;
  const previewFile = scaffold?.files.find(
    (file) => file.path === (selectedFile || scaffold.files[0]?.path)
  );

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      await workspace.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The extension action did not complete."
      );
    } finally {
      setBusy(null);
    }
  }

  async function createProject() {
    await run("create-project", async () => {
      const project = await api.createExtensionProject({
        description: description.trim(),
        displayName: displayName.trim(),
        licenseSpdx: licenseSpdx.trim(),
        packageName: packageName.trim(),
        repositoryUrl: repositoryUrl.trim(),
        supportUrl: supportUrl.trim()
      });
      setSelectedProjectId(project.extensionProjectId);
      setDisplayName("");
      setPackageName("");
      setDescription("");
      setRepositoryUrl("");
      setSupportUrl("");
      setMessage("Extension project created; no code or image was executed.");
    });
  }

  async function loadScaffold() {
    if (!selectedProject) return;
    await run("scaffold", async () => {
      const generated = await api.getExtensionScaffold(
        selectedProject.extensionProjectId
      );
      setScaffold(generated);
      setSelectedFile(generated.files[0]?.path ?? "");
      setMessage(
        "Scaffold generated with hashed files and local-only signing."
      );
    });
  }

  async function submitRelease() {
    if (!selectedProject) return;
    await run("submit-release", async () => {
      const contract = JSON.parse(contractJson) as Parameters<
        typeof api.submitExtensionRelease
      >[1]["contract"];
      const release = await api.submitExtensionRelease(
        selectedProject.extensionProjectId,
        { contract, version: version.trim() }
      );
      setContractJson("");
      setMessage(
        release.compatible
          ? "Immutable release passed compatibility and is waiting for review."
          : "Release was retained as a failed compatibility record; execution remains blocked."
      );
    });
  }

  async function review(
    release: ExtensionRelease,
    decision: "Certify" | "Reject"
  ) {
    await run("review-" + release.extensionReleaseId, async () => {
      await api.reviewExtensionRelease(release.extensionReleaseId, {
        decision,
        reason: reason.trim()
      });
      setMessage(
        decision === "Certify"
          ? "Release certified for the tenant review catalog; runtime execution is still blocked."
          : "Release rejected and retained in the immutable history."
      );
    });
  }

  async function activate(release: ExtensionRelease) {
    await run("activate-" + release.extensionReleaseId, async () => {
      await api.activateExtensionRelease(release.extensionReleaseId, {
        reason: reason.trim()
      });
      setMessage(
        "Catalog version activated. Module binding and runner authorization remain separate gates."
      );
    });
  }

  async function rollback(release: ExtensionRelease) {
    if (!selectedProject) return;
    await run("rollback-" + release.extensionReleaseId, async () => {
      await api.rollbackExtensionProject(selectedProject.extensionProjectId, {
        reason: reason.trim(),
        targetReleaseId: release.extensionReleaseId
      });
      setMessage(
        "Catalog selection rolled back to the certified prior release."
      );
    });
  }

  async function revoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    await run("revoke-" + target.extensionReleaseId, async () => {
      await api.revokeExtensionRelease(target.extensionReleaseId, {
        reason: reason.trim()
      });
      setRevokeTarget(null);
      setMessage("Release revoked and removed from active catalog state.");
    });
  }

  if (workspace.loading && !workspace.data) {
    return <LoadingSkeleton rows={5} />;
  }

  return (
    <section
      aria-labelledby="extension-developer-heading"
      className="border-y border-line bg-canvas py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-2">
            Developer program · signed OCI
          </p>
          <h2
            className="mt-1 font-display text-lg font-semibold text-ink"
            id="extension-developer-heading"
          >
            Extension release pipeline
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Scaffold a typed adapter, submit an immutable signed contract, and
            govern its tenant catalog lifecycle. Catalog activation never
            authorizes runner execution.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-x-5 gap-y-1 text-right">
          <div>
            <p className="font-mono text-lg text-ink">
              {workspace.data?.summary.projects ?? 0}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-subtle">
              Projects
            </p>
          </div>
          <div>
            <p className="font-mono text-lg text-ink">
              {workspace.data?.summary.certifiedReleases ?? 0}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-subtle">
              Certified
            </p>
          </div>
          <div>
            <p className="font-mono text-lg text-missed">0</p>
            <p className="text-[9px] uppercase tracking-wide text-subtle">
              Runtime grants
            </p>
          </div>
        </div>
      </div>

      {workspace.error ? (
        <p className="mt-4 text-sm text-missed" role="alert">
          {workspace.error}{" "}
          <button
            className="font-semibold underline"
            onClick={() => void workspace.refetch()}
            type="button"
          >
            Retry
          </button>
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-missed" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-fixed" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)]">
        <div className="min-w-0 border-r-0 border-line xl:border-r xl:pr-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Projects</h3>
            <span className="font-mono text-[10px] text-subtle">
              {projects.length} tenant-scoped
            </span>
          </div>
          {projects.length > 0 ? (
            <div className="mt-3 space-y-1">
              {projects.map((project) => (
                <button
                  className={cn(
                    "w-full border-l-2 px-3 py-2 text-left transition-colors",
                    project.extensionProjectId === selectedProjectId
                      ? "border-brand bg-brand/5"
                      : "border-transparent hover:border-line hover:bg-surface"
                  )}
                  key={project.extensionProjectId}
                  onClick={() => {
                    setSelectedProjectId(project.extensionProjectId);
                    setScaffold(null);
                  }}
                  type="button"
                >
                  <span className="block text-sm font-medium text-ink">
                    {project.displayName}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-subtle">
                    {project.packageName} · {project.licenseSpdx}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-muted">
              No extension projects exist. Create one to generate a safe local
              scaffold; Periscan does not accept arbitrary source uploads.
            </p>
          )}

          <details
            className="mt-4 border-t border-line pt-4"
            open={projects.length === 0}
          >
            <summary className="cursor-pointer text-xs font-semibold text-brand">
              Create extension project
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="text-[10px] text-subtle">
                Display name
                <input
                  aria-label="Extension display name"
                  className={cn(inputClass, "mt-1")}
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </label>
              <label className="text-[10px] text-subtle">
                Package name
                <input
                  aria-label="Extension package name"
                  className={cn(inputClass, "mt-1 font-mono")}
                  onChange={(event) => setPackageName(event.target.value)}
                  placeholder="safe-source-adapter"
                  value={packageName}
                />
              </label>
              <label className="text-[10px] text-subtle sm:col-span-2 xl:col-span-1 2xl:col-span-2">
                Purpose
                <textarea
                  aria-label="Extension purpose"
                  className={cn(inputClass, "mt-1 resize-y")}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  value={description}
                />
              </label>
              <label className="text-[10px] text-subtle">
                Repository URL
                <input
                  aria-label="Extension repository URL"
                  className={cn(inputClass, "mt-1")}
                  onChange={(event) => setRepositoryUrl(event.target.value)}
                  type="url"
                  value={repositoryUrl}
                />
              </label>
              <label className="text-[10px] text-subtle">
                Support URL
                <input
                  aria-label="Extension support URL"
                  className={cn(inputClass, "mt-1")}
                  onChange={(event) => setSupportUrl(event.target.value)}
                  type="url"
                  value={supportUrl}
                />
              </label>
              <label className="text-[10px] text-subtle">
                SPDX license
                <input
                  aria-label="Extension SPDX license"
                  className={cn(inputClass, "mt-1 font-mono")}
                  onChange={(event) => setLicenseSpdx(event.target.value)}
                  value={licenseSpdx}
                />
              </label>
            </div>
            <button
              className={cn(
                buttonClassName({ size: "sm", variant: "secondary" }),
                "mt-3"
              )}
              disabled={
                busy !== null ||
                !displayName.trim() ||
                !packageName.trim() ||
                description.trim().length < 10 ||
                !repositoryUrl.trim() ||
                !supportUrl.trim()
              }
              onClick={() => void createProject()}
              type="button"
            >
              {busy === "create-project" ? "Creating…" : "Create project"}
            </button>
          </details>
        </div>

        <div className="min-w-0">
          {selectedProject ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {selectedProject.displayName}
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                    {selectedProject.description}
                  </p>
                </div>
                <button
                  className={buttonClassName({
                    size: "sm",
                    variant: "secondary"
                  })}
                  disabled={busy !== null}
                  onClick={() => void loadScaffold()}
                  type="button"
                >
                  {busy === "scaffold"
                    ? "Generating…"
                    : "Generate SDK scaffold"}
                </button>
              </div>

              <div className="mt-5">
                <ReleaseRail release={activeRelease} />
              </div>

              {scaffold ? (
                <div className="mt-5 grid gap-3 border-y border-line py-4 md:grid-cols-[13rem_minmax(0,1fr)]">
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      Hashed scaffold
                    </p>
                    <div className="mt-2 space-y-1">
                      {scaffold.files.map((file) => (
                        <button
                          className={cn(
                            "block w-full truncate px-2 py-1 text-left font-mono text-[10px]",
                            (selectedFile || scaffold.files[0]?.path) ===
                              file.path
                              ? "bg-brand/10 text-brand"
                              : "text-subtle hover:text-ink"
                          )}
                          key={file.path}
                          onClick={() => setSelectedFile(file.path)}
                          type="button"
                        >
                          {file.path}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-subtle">
                      {previewFile?.purpose}
                    </p>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-control bg-surface p-3 font-mono text-[10px] leading-4 text-muted">
                      {previewFile?.content}
                    </pre>
                    <p className="mt-1 break-all font-mono text-[9px] text-subtle">
                      sha256 {previewFile?.contentSha256}
                    </p>
                  </div>
                </div>
              ) : null}

              <details className="mt-5 border-b border-line pb-5">
                <summary className="cursor-pointer text-xs font-semibold text-brand">
                  Submit signed release
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)]">
                  <label className="text-[10px] text-subtle">
                    Version
                    <input
                      aria-label="Extension release version"
                      className={cn(inputClass, "mt-1 font-mono")}
                      onChange={(event) => setVersion(event.target.value)}
                      value={version}
                    />
                  </label>
                  <label className="text-[10px] text-subtle">
                    Signed contract JSON
                    <textarea
                      aria-label="Signed extension contract JSON"
                      className={cn(
                        inputClass,
                        "mt-1 resize-y font-mono text-[10px]"
                      )}
                      onChange={(event) => setContractJson(event.target.value)}
                      rows={5}
                      value={contractJson}
                    />
                  </label>
                </div>
                <button
                  className={cn(
                    buttonClassName({ size: "sm", variant: "primary" }),
                    "mt-3"
                  )}
                  disabled={
                    busy !== null || !contractJson.trim() || !version.trim()
                  }
                  onClick={() => void submitRelease()}
                  type="button"
                >
                  {busy === "submit-release"
                    ? "Checking signature…"
                    : "Submit immutable release"}
                </button>
              </details>

              <label className="mt-5 block text-[10px] text-subtle">
                Governance reason
                <input
                  aria-label="Extension governance reason"
                  className={cn(inputClass, "mt-1")}
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                />
              </label>

              <div className="mt-4 divide-y divide-line border-t border-line">
                {projectReleases.length === 0 ? (
                  <p className="py-5 text-xs text-muted">
                    No releases submitted. Generate the scaffold, sign the OCI
                    contract locally, then submit the immutable version.
                  </p>
                ) : (
                  projectReleases.map((release) => (
                    <article
                      className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
                      key={release.extensionReleaseId}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-mono text-xs font-semibold text-ink">
                            v{release.version}
                          </h4>
                          <StateBadge
                            dot={false}
                            tone={STATUS_TONE[release.status] ?? "inconclusive"}
                          >
                            {release.status}
                          </StateBadge>
                          <StateBadge dot={false} tone="inconclusive">
                            Runtime blocked
                          </StateBadge>
                        </div>
                        <p className="mt-2 font-mono text-[9.5px] text-subtle">
                          contract {shortDigest(release.contractDigest)} · image{" "}
                          {shortDigest(
                            release.imageDigest.replace("sha256:", "")
                          )}
                        </p>
                        <p className="mt-1 text-[10px] text-muted">
                          {release.capabilities.join(" · ") ||
                            "No capabilities"}{" "}
                          · {release.networkAllowlist.length} network host
                          {release.networkAllowlist.length === 1 ? "" : "s"}
                        </p>
                        {release.status === "CompatibilityFailed" ? (
                          <p className="mt-2 text-[10px] leading-4 text-missed">
                            {release.compatibilityReport.checks
                              .filter((check) => check.status === "Fail")
                              .map((check) => check.message)
                              .join(" ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-start gap-2 md:justify-end">
                        {release.status === "Compatible" ? (
                          <>
                            <button
                              className={buttonClassName({
                                size: "sm",
                                variant: "primary"
                              })}
                              disabled={
                                busy !== null || reason.trim().length < 10
                              }
                              onClick={() => void review(release, "Certify")}
                              type="button"
                            >
                              Certify
                            </button>
                            <button
                              className={buttonClassName({
                                size: "sm",
                                variant: "secondary"
                              })}
                              disabled={
                                busy !== null || reason.trim().length < 10
                              }
                              onClick={() => void review(release, "Reject")}
                              type="button"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {release.status === "Certified" ? (
                          <button
                            className={buttonClassName({
                              size: "sm",
                              variant: "primary"
                            })}
                            disabled={
                              busy !== null || reason.trim().length < 10
                            }
                            onClick={() => void activate(release)}
                            type="button"
                          >
                            Activate catalog version
                          </button>
                        ) : null}
                        {release.status === "Superseded" ? (
                          <button
                            className={buttonClassName({
                              size: "sm",
                              variant: "secondary"
                            })}
                            disabled={
                              busy !== null || reason.trim().length < 10
                            }
                            onClick={() => void rollback(release)}
                            type="button"
                          >
                            Roll back here
                          </button>
                        ) : null}
                        {release.status !== "Revoked" ? (
                          <button
                            className={buttonClassName({
                              size: "sm",
                              variant: "ghost"
                            })}
                            disabled={
                              busy !== null || reason.trim().length < 10
                            }
                            onClick={() => setRevokeTarget(release)}
                            type="button"
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-ink">
                Create a project to begin
              </p>
              <p className="mt-1 text-xs text-muted">
                The release rail will appear after tenant-scoped project
                registration.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        busy={busy?.startsWith("revoke-") ?? false}
        confirmLabel="Revoke release"
        confirmPhrase={revokeTarget ? revokeTarget.version : undefined}
        description="Revocation is durable. If this is the active catalog version, it will be removed immediately; runtime execution remains prohibited either way."
        destructive
        error={error}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void revoke()}
        open={revokeTarget !== null}
        title="Revoke immutable extension release"
      />
    </section>
  );
}
