import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("open-source workstream docs", () => {
  it("keeps the customer-agent workstream aligned with the resolved runner transport", async () => {
    const [
      index,
      customerAgent,
      validationEngines,
      internalRunner,
      deployRequirements,
      runnerDeployReadme,
      runnerSystemdEnv,
      acceptanceCriteria,
      userStories,
      sharedDomain
    ] = await Promise.all([
      readRepoFile("docs/agent-tasks/open-source-tools/00-index.md"),
      readRepoFile("docs/agent-tasks/open-source-tools/17-customer-agent.md"),
      readRepoFile("docs/OPEN_SOURCE_VALIDATION_ENGINES.md"),
      readRepoFile("docs/agent-tasks/13-internal-runner.md"),
      readRepoFile(".ai/deploy-requirements.md"),
      readRepoFile("apps/runner/deploy/README.md"),
      readRepoFile("apps/runner/deploy/systemd/runner.env.example"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("packages/shared/src/domain.ts")
    ]);

    expect(index).toContain("17");
    expect(index).toContain("Customer Agent");
    expect(index).not.toContain("CurrentMvp");
    expect(customerAgent).toContain("## Resolved decisions");
    expect(customerAgent).toContain(
      "Reverse SSH, arbitrary shell,\n  and arbitrary tunnels are disallowed"
    );
    expect(validationEngines).toContain(
      "The runner supports signed,\n  scope-enforced reachability, DNS, TLS certificate, HTTP health"
    );
    expect(validationEngines).toContain(
      "TCP reachability, DNS resolution, TLS certificate inspection, and HTTP health"
    );
    expect(validationEngines).not.toContain(
      "currently performs only TCP reachability checks"
    );
    expect(internalRunner).toContain("runner.http_health_check` implemented");

    for (const content of [
      index,
      customerAgent,
      validationEngines,
      internalRunner
    ]) {
      expect(content).not.toContain("Decision needed");
      expect(content).not.toContain("blocker of record");
      expect(content).not.toContain("agent remains reachability-only");
    }

    for (const content of [acceptanceCriteria, internalRunner, userStories]) {
      expect(content).not.toMatch(/mock mTLS|fake mTLS/u);
      expect(content).not.toMatch(/issues fresh certificate material/u);
      expect(content).not.toMatch(/rotate my issued certificate material/u);
    }

    for (const content of [
      deployRequirements,
      runnerDeployReadme,
      runnerSystemdEnv
    ]) {
      expect(content).toContain("bearer");
      expect(content).toContain("mTLS");
      expect(content).toMatch(
        /PERISCAN_RUNNER_MTLS_(CA_FILE|CLIENT_CERT_FILE|CLIENT_KEY_FILE)/u
      );
    }

    expect(acceptanceCriteria).toContain(
      "mTLS client certificate plus bearer-token transport auth"
    );
    expect(acceptanceCriteria).toContain("task-signing public key material");
    expect(internalRunner).toContain("fresh client-certificate material");
    expect(internalRunner).toContain("task-signing key material");
    expect(deployRequirements).not.toContain("agent's reverse tunnel");
    expect(validationEngines).not.toContain("agent's reverse tunnel");
    expect(sharedDomain).toContain(
      "future\n// restricted signed logical channel"
    );
    expect(sharedDomain).not.toContain("scoped reverse tunnel");
  });

  it("keeps the historical self-contained runner PRD from reviving reverse-tunnel transport", async () => {
    const selfContainedRunnerPrd = await readRepoFile(
      "docs/PRD_SELF_CONTAINED_RUNNER.md"
    );

    expect(selfContainedRunnerPrd).toContain(
      "Historical / superseded safety proposal"
    );
    expect(selfContainedRunnerPrd).toContain(
      "Future restricted logical channel"
    );
    expect(selfContainedRunnerPrd).not.toContain("agent's reverse tunnel");
    expect(selfContainedRunnerPrd).not.toContain("Reverse tunnel:");
    expect(selfContainedRunnerPrd).not.toMatch(/reverse tunnel \+/u);
  });
});
