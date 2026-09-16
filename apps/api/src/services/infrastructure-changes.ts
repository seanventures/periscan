import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { getConnectorByKey } from "@periscan/connectors";
import {
  InfrastructureChangeManifestSchema,
  InfrastructureChangeRequestSchema,
  type ConfirmInfrastructureChangeInput,
  type InfrastructureChangeRequest
} from "@periscan/shared";
import { z } from "zod";

import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "../integration-credentials.js";
import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  stringifyCanonicalJson,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type InfrastructureChangeServices = Pick<
  AppServices,
  | "approveInfrastructureChange"
  | "executeInfrastructureChange"
  | "listInfrastructureChanges"
  | "previewInfrastructureChange"
  | "refreshInfrastructureChange"
  | "rollbackInfrastructureChange"
>;

const GitHubFileSchema = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
  sha: z.string().min(1)
});
const GitHubRefSchema = z.object({
  object: z.object({ sha: z.string().min(1) })
});
const GitHubCommitSchema = z.object({
  content: z.object({ sha: z.string().min(1) })
});
const GitHubPullRequestSchema = z.object({
  head: z.object({ sha: z.string().min(1) }).optional(),
  html_url: z.url(),
  merge_commit_sha: z.string().min(1).nullable().optional(),
  merged: z.boolean().default(false),
  number: z.number().int().positive(),
  state: z.string().min(1)
});
const GitHubChecksSchema = z.object({
  check_runs: z.array(
    z.object({
      conclusion: z.string().nullable(),
      name: z.string().min(1),
      status: z.string().min(1)
    })
  ),
  total_count: z.number().int().nonnegative()
});
const ApplicationReceiptSchema = z.object({
  branchName: z.string().min(1),
  checks: z
    .object({
      conclusion: z.enum(["Pending", "Passing", "Failing"]),
      names: z.array(z.string()),
      refreshedAt: z.iso.datetime()
    })
    .optional(),
  commitSha: z.string().min(1),
  /** GitHub issue comment on the PR (always attempted after open). */
  issueCommentId: z.number().int().positive().optional(),
  openedAt: z.iso.datetime(),
  pullRequestNumber: z.number().int().positive(),
  pullRequestUrl: z.url(),
  /**
   * Optional GitHub multi-line review comment with a ```suggestion``` block.
   * Posted only when the exact diff is a contiguous, bounded line range.
   * Reviewers must still accept the suggestion or merge the branch commit —
   * Periscan never pushes to main or merges.
   */
  suggestionCommentId: z.number().int().positive().optional(),
  suggestionPosted: z.boolean().optional()
});

const GitHubIssueCommentSchema = z.object({
  id: z.number().int().positive(),
  html_url: z.string().optional()
});

const GitHubPullReviewCommentSchema = z.object({
  id: z.number().int().positive(),
  html_url: z.string().optional()
});

/** Max contiguous replacement lines eligible for an optional GitHub suggestion. */
export const IAC_SUGGESTION_MAX_LINES = 40;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertPublicGithubBaseUrl(value: unknown) {
  const baseUrl =
    typeof value === "string"
      ? value.replace(/\/+$/u, "")
      : "https://api.github.com";
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AppServiceError(
      "GitHub API base URL is invalid.",
      400,
      "iac_github_url_invalid"
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^10\.|^192\.168\.|^169\.254\.|^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
  ) {
    throw new AppServiceError(
      "GitHub API base URL must be a public HTTPS endpoint.",
      400,
      "iac_github_url_unsafe"
    );
  }
  return baseUrl;
}

export function findUnsafeInfrastructureContent(content: string): string[] {
  const findings: string[] = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(content)) {
    findings.push("private_key_material");
  }
  if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u.test(content)) {
    findings.push("aws_access_key");
  }
  if (/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/u.test(content)) {
    findings.push("github_token");
  }
  for (const line of content.split(/\r?\n/u)) {
    const assignment = line.match(
      /\b(password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]\s*["']?([^"'\s,}]+)/iu
    );
    if (!assignment?.[2]) continue;
    const value = assignment[2];
    if (
      !/^(?:var\.|local\.|data\.|module\.|\$\{|null$|true$|false$)/u.test(value)
    ) {
      findings.push(`literal_${assignment[1]!.toLowerCase()}`);
    }
  }
  return [...new Set(findings)];
}

export function computeInfrastructureDiffSpan(input: {
  after: string;
  before: string;
}) {
  const beforeLines = input.before.split("\n");
  const afterLines = input.after.split("\n");
  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] ===
      afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return { afterLines, beforeLines, prefix, suffix };
}

export function buildInfrastructureUnifiedDiff(input: {
  after: string;
  before: string;
  filePath: string;
}) {
  const { afterLines, beforeLines, prefix, suffix } =
    computeInfrastructureDiffSpan(input);
  const contextStart = Math.max(0, prefix - 3);
  const beforeEnd = Math.min(
    beforeLines.length,
    beforeLines.length - suffix + 3
  );
  const afterEnd = Math.min(afterLines.length, afterLines.length - suffix + 3);
  const lines = [
    `--- a/${input.filePath}`,
    `+++ b/${input.filePath}`,
    `@@ -${contextStart + 1},${beforeEnd - contextStart} +${contextStart + 1},${afterEnd - contextStart} @@`
  ];
  for (let index = contextStart; index < prefix; index += 1) {
    lines.push(` ${beforeLines[index] ?? ""}`);
  }
  for (let index = prefix; index < beforeLines.length - suffix; index += 1) {
    lines.push(`-${beforeLines[index] ?? ""}`);
  }
  for (let index = prefix; index < afterLines.length - suffix; index += 1) {
    lines.push(`+${afterLines[index] ?? ""}`);
  }
  const suffixStart = Math.max(prefix, beforeLines.length - suffix);
  for (let index = suffixStart; index < beforeEnd; index += 1) {
    lines.push(` ${beforeLines[index] ?? ""}`);
  }
  return lines.join("\n");
}

/**
 * Real PR issue comment for an opened IaC change — not a static export-only hint.
 * States verification gates and that merge does not mark the risk Fixed.
 */
export function buildInfrastructurePullRequestIssueComment(input: {
  filePath: string;
  previewHash: string;
  remediationId: string;
  unifiedDiff: string;
}) {
  const diffExcerpt =
    input.unifiedDiff.length > 4_000
      ? `${input.unifiedDiff.slice(0, 4_000)}\n… (diff truncated in comment)`
      : input.unifiedDiff;
  return [
    "### Periscan infrastructure change (reviewed PR only)",
    "",
    `- Remediation: \`${input.remediationId}\``,
    `- File: \`${input.filePath}\``,
    `- Preview hash: \`${input.previewHash}\``,
    "",
    "This pull request was opened by Periscan after human preview + approval.",
    "Periscan **does not** merge to the default branch and **does not** mark the risk Fixed.",
    "After merge (by your reviewers), run a fresh Periscan fix verification.",
    "",
    "<details><summary>Exact unified diff</summary>",
    "",
    "```diff",
    diffExcerpt,
    "```",
    "",
    "</details>"
  ].join("\n");
}

/**
 * Optional GitHub "suggested change" review comment for a contiguous bounded edit.
 * Returns null when the diff is empty, non-contiguous enough for line anchors, or too large.
 * Side is always RIGHT on the Periscan branch head (post-commit content).
 */
export function buildInfrastructureFileSuggestion(input: {
  after: string;
  before: string;
  filePath: string;
  previewHash: string;
  remediationId: string;
}): {
  body: string;
  line: number;
  path: string;
  side: "RIGHT";
  startLine: number;
  startSide: "RIGHT";
} | null {
  const { afterLines, beforeLines, prefix, suffix } =
    computeInfrastructureDiffSpan(input);
  const afterChanged = afterLines.length - prefix - suffix;
  const beforeChanged = beforeLines.length - prefix - suffix;
  if (afterChanged <= 0 && beforeChanged <= 0) {
    return null;
  }
  if (afterChanged > IAC_SUGGESTION_MAX_LINES) {
    return null;
  }
  // GitHub suggestions require at least one line on the RIGHT (new) side.
  if (afterChanged === 0) {
    return null;
  }
  const startLine = prefix + 1;
  const line = prefix + afterChanged;
  const suggested = afterLines.slice(prefix, prefix + afterChanged).join("\n");
  const body = [
    "Periscan exact file suggestion for remediation",
    `\`${input.remediationId}\` (preview \`${input.previewHash}\`).`,
    "Accept in the GitHub UI only after review. Merge ≠ Fixed; revalidate in Periscan.",
    "",
    "```suggestion",
    suggested,
    "```"
  ].join("\n");
  return {
    body,
    line,
    path: input.filePath,
    side: "RIGHT",
    startLine,
    startSide: "RIGHT"
  };
}

function serialize(record: {
  applicationReceipt: Prisma.JsonValue | null;
  appliedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  failureReason: string | null;
  iacChangeRequestId: string;
  idempotencyKey: string;
  integrationId: string;
  manifest: Prisma.JsonValue;
  previewHash: string;
  remediationId: string;
  rollbackReceipt: Prisma.JsonValue | null;
  rolledBackAt: Date | null;
  state: string;
  tenantId: string;
  updatedAt: Date;
}): InfrastructureChangeRequest {
  return InfrastructureChangeRequestSchema.parse({
    ...record,
    appliedAt: record.appliedAt?.toISOString() ?? null,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    rolledBackAt: record.rolledBackAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString()
  });
}

export function createInfrastructureChangeServices(
  deps: RuntimeServiceDeps
): InfrastructureChangeServices {
  const { fetchImpl, prisma } = deps;

  async function ownedChange(tenantId: string, iacChangeRequestId: string) {
    const change = await prisma.infrastructureChangeRequest.findFirst({
      where: { iacChangeRequestId, tenantId }
    });
    if (!change) {
      throw new AppServiceError(
        "Infrastructure change request not found.",
        404,
        "iac_change_not_found"
      );
    }
    return change;
  }

  function confirmHash(
    change: { previewHash: string },
    input: ConfirmInfrastructureChangeInput
  ) {
    if (change.previewHash !== input.previewHash) {
      throw new AppServiceError(
        "The approved hash does not match the exact infrastructure preview.",
        409,
        "iac_change_preview_hash_mismatch"
      );
    }
  }

  async function githubContext(tenantId: string, integrationId: string) {
    const integration = await prisma.integration.findFirst({
      where: { integrationId, tenantId }
    });
    if (!integration) {
      throw new AppServiceError(
        "GitHub integration not found.",
        404,
        "iac_github_integration_not_found"
      );
    }
    const configRecord =
      integration.config && typeof integration.config === "object"
        ? (integration.config as Record<string, unknown>)
        : {};
    if (
      configRecord.connectorKey !== "github" ||
      integration.authType !== "pat"
    ) {
      throw new AppServiceError(
        "Select a real GitHub PAT integration for infrastructure pull requests.",
        400,
        "iac_github_integration_required"
      );
    }
    if (configRecord.mockMode === true) {
      throw new AppServiceError(
        "Demo and fixture integrations cannot create repository changes.",
        400,
        "iac_mock_write_denied"
      );
    }
    const connector = getConnectorByKey("github");
    if (!connector) throw new Error("GitHub connector is not registered.");
    const config = decryptIntegrationConfig(
      integration.config,
      integrationSecretFieldKeys(connector, integration.authType)
    );
    const token = config.accessToken;
    if (typeof token !== "string" || !token) {
      throw new AppServiceError(
        "GitHub integration credential is unavailable.",
        400,
        "iac_github_credential_missing"
      );
    }
    return {
      baseUrl: assertPublicGithubBaseUrl(config.apiBaseUrl),
      config,
      token
    };
  }

  async function githubRequest(
    github: { baseUrl: string; token: string },
    pathName: string,
    init: { body?: unknown; method?: string } = {}
  ): Promise<unknown> {
    const response = await fetchImpl(`${github.baseUrl}${pathName}`, {
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${github.token}`,
        ...(init.body === undefined
          ? {}
          : { "content-type": "application/json" }),
        "x-github-api-version": "2022-11-28"
      },
      method: init.method ?? "GET"
    });
    if (!response.ok) {
      throw new AppServiceError(
        `GitHub repository operation failed with HTTP ${response.status}.`,
        response.status === 401 || response.status === 403 ? 403 : 502,
        "iac_github_operation_failed"
      );
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function readFile(
    github: { baseUrl: string; token: string },
    repository: { name: string; owner: string },
    filePath: string,
    branch: string
  ) {
    const path = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/contents/${filePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(branch)}`;
    const file = GitHubFileSchema.parse(await githubRequest(github, path));
    return {
      content: Buffer.from(file.content.replace(/\s/gu, ""), "base64").toString(
        "utf8"
      ),
      sha: file.sha
    };
  }

  function assertRepositoryAuthorized(
    config: Record<string, unknown>,
    repository: { name: string; owner: string }
  ) {
    const fullName = `${repository.owner}/${repository.name}`;
    if (
      Array.isArray(config.repositoryFullNames) &&
      config.repositoryFullNames.length > 0 &&
      !config.repositoryFullNames.includes(fullName)
    ) {
      throw new AppServiceError(
        "Repository is not in this integration's authorized repository list.",
        403,
        "iac_repository_not_authorized"
      );
    }
    if (
      typeof config.organization === "string" &&
      config.organization.toLowerCase() !== repository.owner.toLowerCase()
    ) {
      throw new AppServiceError(
        "Repository owner does not match the integration's authorized organization.",
        403,
        "iac_repository_not_authorized"
      );
    }
  }

  async function recordFailure(
    tenantId: string,
    iacChangeRequestId: string,
    reason: string
  ) {
    // Only fail rows still in Approved. Concurrent execute losers must not
    // overwrite a winner's PullRequestOpened/Checks*/Merged state with Failed
    // after a real GitHub PR was opened.
    await prisma.infrastructureChangeRequest.updateMany({
      data: { failureReason: reason.slice(0, 500), state: "Failed" },
      where: { iacChangeRequestId, state: "Approved", tenantId }
    });
  }

  return {
    async listInfrastructureChanges(context, remediationId) {
      const remediation = await prisma.remediationTask.findFirst({
        select: { remediationId: true },
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }
      const rows = await prisma.infrastructureChangeRequest.findMany({
        orderBy: { createdAt: "desc" },
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      return rows.map(serialize);
    },

    async previewInfrastructureChange(context, remediationId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "preview infrastructure pull requests"
      );
      const remediation = await prisma.remediationTask.findFirst({
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }
      if (["Fixed", "ClosedWithoutEvidence"].includes(remediation.status)) {
        throw new AppServiceError(
          "Create a new remediation before proposing a change to a settled risk.",
          409,
          "iac_change_settled_risk"
        );
      }
      const unsafeContent = findUnsafeInfrastructureContent(
        input.proposedContent
      );
      if (unsafeContent.length > 0) {
        throw new AppServiceError(
          `Proposed content appears to contain secret material (${unsafeContent.join(", ")}). Use secret references instead.`,
          400,
          "iac_change_secret_detected"
        );
      }
      const github = await githubContext(
        context.tenant.tenantId,
        input.integrationId
      );
      assertRepositoryAuthorized(github.config, input.repository);
      const before = await readFile(
        github,
        input.repository,
        input.filePath,
        input.baseBranch
      );
      if (input.expectedBeforeSha && input.expectedBeforeSha !== before.sha) {
        throw new AppServiceError(
          "The repository file changed before preview. Refresh and review the current version.",
          409,
          "iac_change_stale_source"
        );
      }
      if (before.content === input.proposedContent) {
        throw new AppServiceError(
          "The proposed infrastructure content does not change the source file.",
          400,
          "iac_change_empty_diff"
        );
      }
      const branchName =
        input.branchName ??
        `periscan/remediation-${remediationId.slice(0, 8)}-${sha256(input.idempotencyKey).slice(0, 8)}`;
      const manifest = InfrastructureChangeManifestSchema.parse({
        actionType: "InfrastructureAsCodePullRequest",
        afterContent: input.proposedContent,
        afterContentHash: sha256(input.proposedContent),
        baseBranch: input.baseBranch,
        beforeContent: before.content,
        beforeContentHash: sha256(before.content),
        beforeSha: before.sha,
        blastRadius:
          "One reviewed repository file on a new Periscan branch. Periscan opens a pull request and never merges it automatically.",
        branchName,
        expectedWriteOperations: [
          `Create branch ${branchName} from ${input.baseBranch}`,
          `Commit ${input.filePath}`,
          "Open one pull request"
        ],
        filePath: input.filePath,
        pullRequestBody: input.pullRequestBody,
        pullRequestTitle: input.pullRequestTitle,
        repository: input.repository,
        rollback: {
          availableUntilMerged: true,
          operation: "Close the pull request and delete its unmerged branch."
        },
        unifiedDiff: buildInfrastructureUnifiedDiff({
          after: input.proposedContent,
          before: before.content,
          filePath: input.filePath
        }),
        verification: {
          ciChecksRequired: true,
          freshPeriscanRevalidationRequired: true,
          mergeDoesNotEqualFixed: true
        }
      });
      const previewHash = sha256(
        stringifyCanonicalJson({
          idempotencyKey: input.idempotencyKey,
          manifest,
          remediationId
        })
      );
      const existing = await prisma.infrastructureChangeRequest.findUnique({
        where: {
          tenantId_idempotencyKey: {
            idempotencyKey: input.idempotencyKey,
            tenantId: context.tenant.tenantId
          }
        }
      });
      if (existing) {
        if (existing.previewHash !== previewHash) {
          throw new AppServiceError(
            "This idempotency key is already bound to a different infrastructure preview.",
            409,
            "iac_change_idempotency_conflict"
          );
        }
        return serialize(existing);
      }
      const created = await prisma.$transaction(async (transaction) => {
        const row = await transaction.infrastructureChangeRequest.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            integrationId: input.integrationId,
            manifest,
            previewHash,
            remediationId,
            state: "AwaitingApproval",
            tenantId: context.tenant.tenantId
          }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.previewed",
          actorType: "User",
          entityId: row.iacChangeRequestId,
          entityType: "RemediationAction",
          metadata: {
            actionType: "InfrastructureAsCodePullRequest",
            previewHash,
            remediationId
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return row;
      });
      return serialize(created);
    },

    async approveInfrastructureChange(context, iacChangeRequestId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve infrastructure pull requests"
      );
      const change = await ownedChange(
        context.tenant.tenantId,
        iacChangeRequestId
      );
      confirmHash(change, input);
      if (
        [
          "Approved",
          "PullRequestOpened",
          "ChecksPassing",
          "ChecksFailed",
          "MergedAwaitingVerification"
        ].includes(change.state)
      ) {
        return serialize(change);
      }
      if (change.state !== "AwaitingApproval") {
        throw new AppServiceError(
          `Infrastructure change cannot be approved from ${change.state}.`,
          409,
          "iac_change_invalid_state"
        );
      }
      const updated = await prisma.$transaction(async (transaction) => {
        const row = await transaction.infrastructureChangeRequest.update({
          data: {
            approvedAt: new Date(),
            approvedBy: context.user.userId,
            state: "Approved"
          },
          where: { iacChangeRequestId }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.approved",
          actorType: "User",
          entityId: iacChangeRequestId,
          entityType: "RemediationAction",
          metadata: {
            actionType: "InfrastructureAsCodePullRequest",
            previewHash: change.previewHash
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return row;
      });
      return serialize(updated);
    },

    async executeInfrastructureChange(context, iacChangeRequestId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "open infrastructure pull requests"
      );
      const change = await ownedChange(
        context.tenant.tenantId,
        iacChangeRequestId
      );
      confirmHash(change, input);
      if (
        [
          "PullRequestOpened",
          "ChecksPassing",
          "ChecksFailed",
          "MergedAwaitingVerification"
        ].includes(change.state)
      ) {
        return serialize(change);
      }
      if (change.state !== "Approved") {
        throw new AppServiceError(
          `Infrastructure change cannot execute from ${change.state}.`,
          409,
          "iac_change_approval_required"
        );
      }
      const manifest = InfrastructureChangeManifestSchema.parse(
        change.manifest
      );
      const github = await githubContext(
        context.tenant.tenantId,
        change.integrationId
      );
      assertRepositoryAuthorized(github.config, manifest.repository);
      const repositoryPath = `/repos/${encodeURIComponent(manifest.repository.owner)}/${encodeURIComponent(manifest.repository.name)}`;
      let branchCreated = false;
      try {
        const current = await readFile(
          github,
          manifest.repository,
          manifest.filePath,
          manifest.baseBranch
        );
        if (
          current.sha !== manifest.beforeSha ||
          sha256(current.content) !== manifest.beforeContentHash
        ) {
          throw new AppServiceError(
            "The base-branch file changed after approval. Create a fresh preview.",
            409,
            "iac_change_stale_approved_source"
          );
        }
        const baseRef = GitHubRefSchema.parse(
          await githubRequest(
            github,
            `${repositoryPath}/git/ref/heads/${manifest.baseBranch
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`
          )
        );
        await githubRequest(github, `${repositoryPath}/git/refs`, {
          body: {
            ref: `refs/heads/${manifest.branchName}`,
            sha: baseRef.object.sha
          },
          method: "POST"
        });
        branchCreated = true;
        const commit = GitHubCommitSchema.parse(
          await githubRequest(
            github,
            `${repositoryPath}/contents/${manifest.filePath
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`,
            {
              body: {
                branch: manifest.branchName,
                content: Buffer.from(manifest.afterContent, "utf8").toString(
                  "base64"
                ),
                message: manifest.pullRequestTitle,
                sha: manifest.beforeSha
              },
              method: "PUT"
            }
          )
        );
        const pullRequest = GitHubPullRequestSchema.parse(
          await githubRequest(github, `${repositoryPath}/pulls`, {
            body: {
              base: manifest.baseBranch,
              body: `${manifest.pullRequestBody}\n\nPeriscan preview: ${change.previewHash}\nFresh validation is required after merge; this PR does not mark the risk fixed.`,
              head: manifest.branchName,
              title: manifest.pullRequestTitle
            },
            method: "POST"
          })
        );

        // Real PR issue comment (not a static export-only IaC hint).
        const issueComment = GitHubIssueCommentSchema.parse(
          await githubRequest(
            github,
            `${repositoryPath}/issues/${pullRequest.number}/comments`,
            {
              body: {
                body: buildInfrastructurePullRequestIssueComment({
                  filePath: manifest.filePath,
                  previewHash: change.previewHash,
                  remediationId: change.remediationId,
                  unifiedDiff: manifest.unifiedDiff
                })
              },
              method: "POST"
            }
          )
        );

        // Optional GitHub file suggestion review comment when the exact diff is
        // a contiguous, bounded replacement. Never merges or pushes to main.
        let suggestionCommentId: number | undefined;
        let suggestionPosted = false;
        const suggestion = buildInfrastructureFileSuggestion({
          after: manifest.afterContent,
          before: manifest.beforeContent,
          filePath: manifest.filePath,
          previewHash: change.previewHash,
          remediationId: change.remediationId
        });
        const headCommitSha = pullRequest.head?.sha ?? commit.content.sha;
        if (suggestion) {
          const reviewComment = GitHubPullReviewCommentSchema.parse(
            await githubRequest(
              github,
              `${repositoryPath}/pulls/${pullRequest.number}/comments`,
              {
                body: {
                  body: suggestion.body,
                  commit_id: headCommitSha,
                  line: suggestion.line,
                  path: suggestion.path,
                  side: suggestion.side,
                  start_line: suggestion.startLine,
                  start_side: suggestion.startSide
                },
                method: "POST"
              }
            )
          );
          suggestionCommentId = reviewComment.id;
          suggestionPosted = true;
        }

        const appliedAt = new Date();
        const receipt = ApplicationReceiptSchema.parse({
          branchName: manifest.branchName,
          commitSha: commit.content.sha,
          issueCommentId: issueComment.id,
          openedAt: appliedAt.toISOString(),
          pullRequestNumber: pullRequest.number,
          pullRequestUrl: pullRequest.html_url,
          suggestionCommentId,
          suggestionPosted
        });
        const updated = await prisma.$transaction(async (transaction) => {
          await transaction.remediationTask.update({
            data: { status: "InProgress" },
            where: { remediationId: change.remediationId }
          });
          const row = await transaction.infrastructureChangeRequest.update({
            data: {
              appliedAt,
              applicationReceipt: receipt,
              failureReason: null,
              state: "PullRequestOpened"
            },
            where: { iacChangeRequestId }
          });
          await writeAuditEvent(transaction, {
            action: "remediation_action.applied",
            actorType: "User",
            entityId: iacChangeRequestId,
            entityType: "RemediationAction",
            metadata: {
              actionType: "InfrastructureAsCodePullRequest",
              commitSha: receipt.commitSha,
              issueCommentId: receipt.issueCommentId,
              pullRequestNumber: receipt.pullRequestNumber,
              pullRequestUrl: receipt.pullRequestUrl,
              suggestionCommentId: receipt.suggestionCommentId ?? null,
              suggestionPosted: receipt.suggestionPosted ?? false
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
          return row;
        });
        return serialize(updated);
      } catch (error) {
        if (branchCreated) {
          await githubRequest(
            github,
            `${repositoryPath}/git/refs/heads/${manifest.branchName
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`,
            { method: "DELETE" }
          ).catch(() => undefined);
        }
        const reason =
          error instanceof Error ? error.message : "GitHub change failed.";
        await recordFailure(
          context.tenant.tenantId,
          iacChangeRequestId,
          reason
        );
        throw error;
      }
    },

    async refreshInfrastructureChange(context, iacChangeRequestId) {
      const change = await ownedChange(
        context.tenant.tenantId,
        iacChangeRequestId
      );
      if (
        !["PullRequestOpened", "ChecksPassing", "ChecksFailed"].includes(
          change.state
        )
      ) {
        return serialize(change);
      }
      const manifest = InfrastructureChangeManifestSchema.parse(
        change.manifest
      );
      const receipt = ApplicationReceiptSchema.parse(change.applicationReceipt);
      const github = await githubContext(
        context.tenant.tenantId,
        change.integrationId
      );
      const repositoryPath = `/repos/${encodeURIComponent(manifest.repository.owner)}/${encodeURIComponent(manifest.repository.name)}`;
      const pullRequest = GitHubPullRequestSchema.parse(
        await githubRequest(
          github,
          `${repositoryPath}/pulls/${receipt.pullRequestNumber}`
        )
      );
      const checks = GitHubChecksSchema.parse(
        await githubRequest(
          github,
          `${repositoryPath}/commits/${encodeURIComponent(receipt.commitSha)}/check-runs`
        )
      );
      const failing = checks.check_runs.some(
        (check) =>
          check.status === "completed" &&
          !["success", "neutral", "skipped"].includes(check.conclusion ?? "")
      );
      const passing =
        checks.total_count > 0 &&
        checks.check_runs.every(
          (check) =>
            check.status === "completed" &&
            ["success", "neutral", "skipped"].includes(check.conclusion ?? "")
        );
      const conclusion = failing ? "Failing" : passing ? "Passing" : "Pending";
      const state = pullRequest.merged
        ? "MergedAwaitingVerification"
        : failing
          ? "ChecksFailed"
          : passing
            ? "ChecksPassing"
            : "PullRequestOpened";
      const nextReceipt = ApplicationReceiptSchema.parse({
        ...receipt,
        checks: {
          conclusion,
          names: checks.check_runs.map((check) => check.name),
          refreshedAt: new Date().toISOString()
        }
      });
      const updated = await prisma.$transaction(async (transaction) => {
        if (pullRequest.merged) {
          await transaction.remediationTask.update({
            data: {
              nextVerificationAt: new Date(),
              status: "VerificationPending"
            },
            where: { remediationId: change.remediationId }
          });
        }
        return transaction.infrastructureChangeRequest.update({
          data: { applicationReceipt: nextReceipt, state },
          where: { iacChangeRequestId }
        });
      });
      return serialize(updated);
    },

    async rollbackInfrastructureChange(context, iacChangeRequestId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "roll back infrastructure pull requests"
      );
      const change = await ownedChange(
        context.tenant.tenantId,
        iacChangeRequestId
      );
      confirmHash(change, input);
      if (change.state === "RolledBack") return serialize(change);
      if (
        !["PullRequestOpened", "ChecksPassing", "ChecksFailed"].includes(
          change.state
        )
      ) {
        throw new AppServiceError(
          "Only an unmerged Periscan pull request can be rolled back automatically.",
          409,
          "iac_change_rollback_unavailable"
        );
      }
      const manifest = InfrastructureChangeManifestSchema.parse(
        change.manifest
      );
      const receipt = ApplicationReceiptSchema.parse(change.applicationReceipt);
      const github = await githubContext(
        context.tenant.tenantId,
        change.integrationId
      );
      const repositoryPath = `/repos/${encodeURIComponent(manifest.repository.owner)}/${encodeURIComponent(manifest.repository.name)}`;
      const pullRequest = GitHubPullRequestSchema.parse(
        await githubRequest(
          github,
          `${repositoryPath}/pulls/${receipt.pullRequestNumber}`
        )
      );
      if (pullRequest.merged) {
        throw new AppServiceError(
          "The pull request is already merged; automatic branch rollback is no longer safe.",
          409,
          "iac_change_already_merged"
        );
      }
      await githubRequest(
        github,
        `${repositoryPath}/pulls/${receipt.pullRequestNumber}`,
        { body: { state: "closed" }, method: "PATCH" }
      );
      await githubRequest(
        github,
        `${repositoryPath}/git/refs/heads/${manifest.branchName
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        { method: "DELETE" }
      );
      const rolledBackAt = new Date();
      const rollbackReceipt = {
        branchDeleted: true,
        pullRequestClosed: true,
        pullRequestNumber: receipt.pullRequestNumber,
        rolledBackAt: rolledBackAt.toISOString()
      };
      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.remediationTask.update({
          data: { status: "InProgress" },
          where: { remediationId: change.remediationId }
        });
        const row = await transaction.infrastructureChangeRequest.update({
          data: {
            rollbackReceipt,
            rolledBackAt,
            state: "RolledBack"
          },
          where: { iacChangeRequestId }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.rolled_back",
          actorType: "User",
          entityId: iacChangeRequestId,
          entityType: "RemediationAction",
          metadata: {
            actionType: "InfrastructureAsCodePullRequest",
            ...rollbackReceipt
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return row;
      });
      return serialize(updated);
    }
  };
}
