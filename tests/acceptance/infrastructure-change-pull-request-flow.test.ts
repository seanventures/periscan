import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";
const BEFORE_CONTENT = `terraform {
  required_version = ">= 1.9"
}

resource "aws_s3_bucket" "evidence" {
  force_destroy = true
}
`;
const AFTER_CONTENT = BEFORE_CONTENT.replace(
  "force_destroy = true",
  "force_destroy = false"
);

describe("infrastructure change pull request proof loop", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["iac-change"]);
      await prisma.$disconnect();
    }
  });

  it("previews an exact diff, requires its hash, opens but never merges a PR, rolls back, and gates merged work on revalidation", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    let nextPullRequest = 40;
    const pullRequests = new Map<
      number,
      { branch: string; closed: boolean; mergedOnRefresh: boolean }
    >();
    const requests: Array<{ body: unknown; method: string; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      );
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ body, method, path: `${url.pathname}${url.search}` });
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" },
          status
        });

      if (method === "GET" && url.pathname.includes("/contents/")) {
        return json({
          content: Buffer.from(BEFORE_CONTENT, "utf8").toString("base64"),
          encoding: "base64",
          sha: "base-file-sha"
        });
      }
      if (method === "GET" && url.pathname.includes("/git/ref/heads/")) {
        return json({ object: { sha: "base-branch-sha" } });
      }
      if (method === "POST" && url.pathname.endsWith("/git/refs")) {
        return json({ ref: body.ref }, 201);
      }
      if (method === "PUT" && url.pathname.includes("/contents/")) {
        return json({ content: { sha: `commit-${nextPullRequest + 1}` } });
      }
      if (method === "POST" && url.pathname.endsWith("/pulls")) {
        nextPullRequest += 1;
        pullRequests.set(nextPullRequest, {
          branch: body.head,
          closed: false,
          mergedOnRefresh: nextPullRequest === 42
        });
        return json(
          {
            head: { sha: `commit-${nextPullRequest}` },
            html_url: `https://github.test/periscan/secure-infra/pull/${nextPullRequest}`,
            merged: false,
            number: nextPullRequest,
            state: "open"
          },
          201
        );
      }
      // Real PR issue comment (Slice B / row 70).
      const issueCommentMatch = url.pathname.match(
        /\/issues\/(\d+)\/comments$/u
      );
      if (method === "POST" && issueCommentMatch) {
        const number = Number(issueCommentMatch[1]);
        expect(typeof body?.body).toBe("string");
        expect(body.body).toMatch(/does not.*Fixed|Fresh validation/i);
        expect(body.body).toContain("```diff");
        return json(
          {
            html_url: `https://github.test/periscan/secure-infra/pull/${number}#issuecomment-9001`,
            id: 9000 + number
          },
          201
        );
      }
      // Optional GitHub multi-line file suggestion review comment.
      const reviewCommentMatch = url.pathname.match(
        /\/pulls\/(\d+)\/comments$/u
      );
      if (method === "POST" && reviewCommentMatch) {
        const number = Number(reviewCommentMatch[1]);
        expect(body).toMatchObject({
          path: "infra/main.tf",
          side: "RIGHT",
          start_side: "RIGHT"
        });
        expect(typeof body.commit_id).toBe("string");
        expect(body.body).toContain("```suggestion");
        expect(body.body).toContain("force_destroy = false");
        return json(
          {
            html_url: `https://github.test/periscan/secure-infra/pull/${number}#discussion_r8001`,
            id: 8000 + number
          },
          201
        );
      }
      const pullMatch = url.pathname.match(/\/pulls\/(\d+)$/u);
      if (method === "GET" && pullMatch) {
        const number = Number(pullMatch[1]);
        const pull = pullRequests.get(number)!;
        return json({
          head: { sha: `commit-${number}` },
          html_url: `https://github.test/periscan/secure-infra/pull/${number}`,
          merge_commit_sha: pull.mergedOnRefresh ? `merge-${number}` : null,
          merged: pull.mergedOnRefresh,
          number,
          state: pull.closed ? "closed" : "open"
        });
      }
      if (method === "PATCH" && pullMatch) {
        const number = Number(pullMatch[1]);
        const pull = pullRequests.get(number)!;
        pull.closed = true;
        return json({
          html_url: `https://github.test/periscan/secure-infra/pull/${number}`,
          merged: false,
          number,
          state: "closed"
        });
      }
      if (method === "GET" && url.pathname.endsWith("/check-runs")) {
        return json({
          check_runs: [
            {
              conclusion: "success",
              name: "terraform-plan",
              status: "completed"
            },
            {
              conclusion: "success",
              name: "policy-as-code",
              status: "completed"
            }
          ],
          total_count: 2
        });
      }
      if (method === "DELETE" && url.pathname.includes("/git/refs/heads/")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected GitHub request: ${method} ${url.pathname}`);
    };

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        fetchImpl,
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "iac-change",
        "Infrastructure Change Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = { [SESSION_COOKIE_NAME]: cookie };
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });
      const integrationResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          authType: "pat",
          config: {
            accessToken: "github-test-token-not-a-fixture",
            apiBaseUrl: "https://api.github.test",
            organization: "periscan",
            repositoryFullNames: ["periscan/secure-infra"]
          },
          connectorKey: "github",
          mockMode: false
        },
        url: "/api/v1/integrations"
      });
      expect(integrationResponse.statusCode).toBe(201);
      const integrationId = integrationResponse.json().integrationId as string;
      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          recommendedAction: "Disable destructive bucket teardown in IaC.",
          status: "Open",
          technicalSteps: ["Review the exact Terraform diff."],
          tenantId,
          verificationMethod: "Run a fresh cloud posture validation."
        }
      });

      const secretPreview = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          baseBranch: "main",
          filePath: "infra/main.tf",
          idempotencyKey: `secret-${randomUUID()}`,
          integrationId,
          proposedContent: 'password = "literal-password"',
          pullRequestBody: "Unsafe proposal must be denied.",
          pullRequestTitle: "Unsafe proposal",
          repository: { name: "secure-infra", owner: "periscan" }
        },
        url: `/api/v1/remediations/${remediation.remediationId}/infrastructure-changes`
      });
      expect(secretPreview.statusCode).toBe(400);
      expect(secretPreview.json().code).toBe("iac_change_secret_detected");
      expect(requests).toHaveLength(0);

      async function createChange(idempotencyKey: string) {
        const preview = await app.inject({
          cookies: auth,
          method: "POST",
          payload: {
            baseBranch: "main",
            filePath: "infra/main.tf",
            idempotencyKey,
            integrationId,
            proposedContent: AFTER_CONTENT,
            pullRequestBody: "Make destructive teardown impossible by default.",
            pullRequestTitle: "Harden evidence bucket lifecycle",
            repository: { name: "secure-infra", owner: "periscan" }
          },
          url: `/api/v1/remediations/${remediation.remediationId}/infrastructure-changes`
        });
        expect(preview.statusCode).toBe(201);
        expect(preview.json()).toMatchObject({
          manifest: {
            actionType: "InfrastructureAsCodePullRequest",
            rollback: { availableUntilMerged: true },
            verification: {
              ciChecksRequired: true,
              freshPeriscanRevalidationRequired: true,
              mergeDoesNotEqualFixed: true
            }
          },
          state: "AwaitingApproval"
        });
        expect(preview.json().manifest.unifiedDiff).toContain(
          "-  force_destroy = true"
        );
        expect(preview.json().manifest.unifiedDiff).toContain(
          "+  force_destroy = false"
        );
        return preview.json() as {
          iacChangeRequestId: string;
          previewHash: string;
        };
      }

      async function approveAndExecute(change: {
        iacChangeRequestId: string;
        previewHash: string;
      }) {
        const beforeApproval = await app.inject({
          cookies: auth,
          method: "POST",
          payload: { previewHash: change.previewHash },
          url: `/api/v1/infrastructure-changes/${change.iacChangeRequestId}/execute`
        });
        expect(beforeApproval.statusCode).toBe(409);
        const wrongHash = await app.inject({
          cookies: auth,
          method: "POST",
          payload: { previewHash: "b".repeat(64) },
          url: `/api/v1/infrastructure-changes/${change.iacChangeRequestId}/approve`
        });
        expect(wrongHash.statusCode).toBe(409);
        const approved = await app.inject({
          cookies: auth,
          method: "POST",
          payload: { previewHash: change.previewHash },
          url: `/api/v1/infrastructure-changes/${change.iacChangeRequestId}/approve`
        });
        expect(approved.json().state).toBe("Approved");
        const executed = await app.inject({
          cookies: auth,
          method: "POST",
          payload: { previewHash: change.previewHash },
          url: `/api/v1/infrastructure-changes/${change.iacChangeRequestId}/execute`
        });
        expect(executed.statusCode).toBe(200);
        expect(executed.json()).toMatchObject({
          applicationReceipt: {
            issueCommentId: expect.any(Number),
            pullRequestNumber: nextPullRequest,
            suggestionPosted: true,
            suggestionCommentId: expect.any(Number)
          },
          state: "PullRequestOpened"
        });
      }

      const rollbackChange = await createChange(`rollback-${randomUUID()}`);
      await approveAndExecute(rollbackChange);
      const passing = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/infrastructure-changes/${rollbackChange.iacChangeRequestId}/refresh`
      });
      expect(passing.json()).toMatchObject({
        applicationReceipt: { checks: { conclusion: "Passing" } },
        state: "ChecksPassing"
      });
      const rollback = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { previewHash: rollbackChange.previewHash },
        url: `/api/v1/infrastructure-changes/${rollbackChange.iacChangeRequestId}/rollback`
      });
      expect(rollback.json()).toMatchObject({
        rollbackReceipt: { branchDeleted: true, pullRequestClosed: true },
        state: "RolledBack"
      });

      const mergedChange = await createChange(`merged-${randomUUID()}`);
      await approveAndExecute(mergedChange);
      const merged = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/infrastructure-changes/${mergedChange.iacChangeRequestId}/refresh`
      });
      expect(merged.json().state).toBe("MergedAwaitingVerification");
      expect(
        await prisma.remediationTask.findUniqueOrThrow({
          where: { remediationId: remediation.remediationId }
        })
      ).toMatchObject({ status: "VerificationPending" });

      expect(
        requests.some(
          (request) =>
            request.method === "PUT" &&
            (request.body as { content: string }).content ===
              Buffer.from(AFTER_CONTENT, "utf8").toString("base64")
        )
      ).toBe(true);
      // Slice B: real PR issue comments + optional file suggestion comments.
      const issueComments = requests.filter(
        (request) =>
          request.method === "POST" &&
          /\/issues\/\d+\/comments$/u.test(request.path)
      );
      const suggestionComments = requests.filter(
        (request) =>
          request.method === "POST" &&
          /\/pulls\/\d+\/comments$/u.test(request.path)
      );
      expect(issueComments.length).toBeGreaterThanOrEqual(2);
      expect(suggestionComments.length).toBeGreaterThanOrEqual(2);
      expect(
        issueComments.every((request) =>
          String((request.body as { body?: string }).body ?? "").includes(
            "```diff"
          )
        )
      ).toBe(true);
      expect(
        suggestionComments.every((request) =>
          String((request.body as { body?: string }).body ?? "").includes(
            "```suggestion"
          )
        )
      ).toBe(true);
      // Never silent push/merge to main without human approval.
      expect(
        requests.some((request) =>
          ["merge", "merges"].some((part) => request.path.includes(part))
        )
      ).toBe(false);
      expect(
        requests.some(
          (request) =>
            request.method === "POST" &&
            request.path.includes("/git/refs") &&
            String((request.body as { ref?: string })?.ref ?? "").includes(
              "refs/heads/main"
            )
        )
      ).toBe(false);
      expect(
        await prisma.auditEvent.count({
          where: {
            action: {
              in: [
                "remediation_action_previewed",
                "remediation_action_approved",
                "remediation_action_applied",
                "remediation_action_rolled_back"
              ]
            },
            tenantId
          }
        })
      ).toBe(7);
    } finally {
      await app.close();
    }
  });
});
