import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  IssuedRunnerControlChannelSchema,
  RunnerDeploymentModeSchema,
  RunnerIssuedCredentialSchema,
  RunnerRegistrationRequestSchema,
  RunnerScopeConstraintSchema,
  RunnerTaskEnvelopeSchema,
  RunnerTaskResultSchema,
  getPrimaryRunnerControlChannel,
  listDefaultRunnerTransportDecisions
} from "../../packages/shared/src/runner.js";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

async function pathExists(path: string) {
  try {
    await access(new URL(`../../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseBullets(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function parseNumberedList(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/u.test(line))
    .map((line) => line.replace(/^\d+\.\s/u, ""));
}

function sectionFrom(source: string, startHeader: string) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  return source.slice(start);
}

describe("PRD section 14 Periscan Runner coverage", () => {
  it("keeps PRD deployment modes represented by runner contracts and deployment artifacts", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const runnerSection = sectionBetween(
      prd,
      "## 14. Periscan Runner Spec",
      "## 15. UX Requirements"
    );
    const deploymentBullets = parseBullets(
      sectionBetween(runnerSection, "### 14.2 Deployment", "### 14.3 Security")
    );

    expect(deploymentBullets).toEqual([
      "Docker container",
      "Linux VM",
      "Kubernetes Helm chart later",
      "Windows service later"
    ]);

    expect(RunnerDeploymentModeSchema.options).toEqual(
      expect.arrayContaining([
        "Docker",
        "SystemdService",
        "Kubernetes",
        "WindowsService"
      ])
    );
    expect(await pathExists("apps/runner/Dockerfile")).toBe(true);
    expect(
      await pathExists("apps/runner/deploy/docker-compose.runner.yml")
    ).toBe(true);
    expect(
      await pathExists("apps/runner/deploy/k8s/runner-deployment.yaml")
    ).toBe(true);
    expect(
      await pathExists("apps/runner/deploy/systemd/periscan-runner.service")
    ).toBe(true);
    expect(
      await pathExists("apps/runner/deploy/systemd/runner.env.example")
    ).toBe(true);
    // P10-12: runner-agent ships deploy parity with Go runner
    expect(
      await pathExists("apps/runner-agent/deploy/docker-compose.runner-agent.yml")
    ).toBe(true);
    expect(
      await pathExists(
        "apps/runner-agent/deploy/k8s/runner-agent-deployment.yaml"
      )
    ).toBe(true);
    expect(
      await pathExists(
        "apps/runner-agent/deploy/systemd/periscan-runner-agent.service"
      )
    ).toBe(true);
    expect(
      await pathExists("apps/runner-agent/deploy/README.md")
    ).toBe(true);
  });

  it("maps every PRD security bullet to implemented runner controls", async () => {
    const [prd, runnerSpec, runnerSource, runnerTests, sharedRunnerSource] =
      await Promise.all([
        readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
        readRepoFile("docs/RUNNER_SPEC.md"),
        readRepoFile("apps/runner/main.go"),
        readRepoFile("apps/runner/main_test.go"),
        readRepoFile("packages/shared/src/runner.ts")
      ]);
    const runnerSection = sectionBetween(
      prd,
      "## 14. Periscan Runner Spec",
      "## 15. UX Requirements"
    );
    const securityBullets = parseBullets(
      sectionBetween(runnerSection, "### 14.3 Security", "### 14.4 Runner Flow")
    );

    expect(securityBullets).toEqual([
      "outbound-only",
      "mTLS",
      "signed tasks",
      "signed modules",
      "local scope enforcement",
      "resource limits",
      "timeouts",
      "local audit logs",
      "kill switch",
      "no inbound firewall rule"
    ]);

    expect(getPrimaryRunnerControlChannel()).toBe("LongPollHttps");
    expect(IssuedRunnerControlChannelSchema.options).not.toContain(
      "ReverseSsh"
    );
    expect(
      listDefaultRunnerTransportDecisions().find(
        (decision) => decision.channel === "ReverseSsh"
      )?.status
    ).toBe("Disallowed");
    expect(runnerSpec).toContain(
      "No inbound ports, no NAT traversal, no reverse tunnel"
    );
    expect(runnerSpec).toContain(
      "Transport authentication is **mTLS client certificate plus bearer token over TLS**"
    );
    expect(runnerSpec).toContain("PERISCAN_RUNNER_REQUIRE_MTLS=true");

    expect(RunnerRegistrationRequestSchema.shape).toHaveProperty("csrPem");
    expect(RunnerIssuedCredentialSchema.shape).toHaveProperty("transportAuth");
    expect(RunnerIssuedCredentialSchema.shape).toHaveProperty(
      "caCertificatePem"
    );
    expect(RunnerIssuedCredentialSchema.shape).toHaveProperty(
      "mtlsCertificateSha256"
    );
    expect(RunnerIssuedCredentialSchema.shape).toHaveProperty(
      "mtlsClientCertificatePem"
    );
    expect(
      RunnerIssuedCredentialSchema.parse({
        caCertificatePem:
          "-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----",
        certificateExpiresAt: "2026-06-01T00:00:00.000Z",
        controlChannel: "LongPollHttps",
        controlPlaneUrl: "https://runner.periscan.cloud",
        heartbeatIntervalSeconds: 30,
        mtlsCertificateSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        mtlsClientCertificatePem:
          "-----BEGIN CERTIFICATE-----\nclient\n-----END CERTIFICATE-----",
        mtlsClientPrivateKeyRequired: true,
        pollIntervalSeconds: 15,
        runnerAuthToken: "runner-token",
        runnerId: "22222222-2222-4222-8222-222222222222",
        taskSigningKeyId: "runner-signing-key-1",
        taskSigningPublicKeyPem:
          "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----",
        taskResultsUrl: "https://runner.periscan.cloud/tasks/result",
        tenantId: "11111111-1111-4111-8111-111111111111",
        transportAuth: "mtls-client-cert-and-bearer-over-tls"
      }).transportAuth
    ).toBe("mtls-client-cert-and-bearer-over-tls");

    expect(RunnerTaskEnvelopeSchema.shape).toHaveProperty("signature");
    expect(sharedRunnerSource).toContain("RunnerTaskSignatureSchema");
    expect(runnerTests).toContain("TestProcessTaskRejectsInvalidSignature");
    expect(runnerTests).toContain("TestProcessTaskRejectsExpiredTask");
    expect(runnerTests).toContain("TestProcessTaskRejectsReplayedNonce");
    expect(runnerTests).toContain("TestProcessTaskRejectsDisallowedModule");
    expect(runnerTests).toContain(
      "TestProcessTaskRejectsDisallowedSafetyLevel"
    );
    expect(runnerTests).toContain(
      "TestPollCycleSkipsExecutionWhenServerKillSwitchActive"
    );
    expect(runnerTests).toContain("TestRunnerExposesNoArbitraryShellModule");
    expect(runnerSource).toContain("allowlistedModules");
    expect(runnerSource).toContain("newNonceCache");
    expect(runnerSource).toContain("LocalAuditSHA256");
    expect(runnerSource).toContain("timeoutSeconds");
    expect(RunnerScopeConstraintSchema.shape).toHaveProperty("approvedCidrs");
    expect(RunnerScopeConstraintSchema.shape).toHaveProperty(
      "approvedHostnames"
    );
    expect(RunnerScopeConstraintSchema.shape).toHaveProperty(
      "approvedDnsSuffixes"
    );
    expect(RunnerScopeConstraintSchema.shape).toHaveProperty("approvedPorts");
    expect(RunnerScopeConstraintSchema.shape).toHaveProperty(
      "forbidInternetEgress"
    );
    expect(RunnerTaskResultSchema.shape).toHaveProperty("localAuditSha256");
    expect(RunnerTaskResultSchema.shape).toHaveProperty("evidenceManifest");
  });

  it("keeps the PRD runner flow mapped to API routes, signed polling, evidence upload, and audit behavior", async () => {
    const [
      prd,
      apiRoutes,
      runnerService,
      runnerTests,
      apiTests,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/services/runner.ts"),
      readRepoFile("apps/runner/main_test.go"),
      readRepoFile("apps/api/src/app.test.ts"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const runnerSection = sectionBetween(
      prd,
      "## 14. Periscan Runner Spec",
      "## 15. UX Requirements"
    );
    const flowSteps = parseNumberedList(
      sectionFrom(runnerSection, "### 14.4 Runner Flow")
    );

    expect(flowSteps).toEqual([
      "User creates runner in control plane.",
      "Periscan generates registration token.",
      "Runner registers.",
      "Runner receives certificate.",
      "Runner polls for signed tasks.",
      "Runner verifies task signature.",
      "Runner enforces local scope.",
      "Runner executes task.",
      "Runner uploads evidence.",
      "Runner writes audit log."
    ]);

    for (const operation of [
      "createRunnerRegistrationToken",
      "registerRunner",
      "pollRunnerTasks",
      "createRunnerReachabilityTask",
      "createRunnerCheckTask",
      "createRunnerMeasuredTask",
      "createRunnerDiscoverTask",
      "uploadRunnerTaskArtifact",
      "submitRunnerTaskResult"
    ]) {
      expect(apiRoutes).toContain(operation);
      expect(runnerService).toContain(operation);
    }

    expect(runnerService).toContain("issueRunnerCredentials");
    expect(runnerService).toContain("signRunnerTaskEnvelope");
    expect(runnerService).toContain("policy.decision");
    expect(runnerService).toContain("writeAuditEvent");
    expect(runnerService).toContain("runner.task");
    expect(runnerService).toContain("evidenceManifest");
    expect(apiTests).toContain("credentials.transportAuth");
    expect(apiTests).toContain("runnerAuthToken");
    expect(apiTests).toContain("taskSigningPublicKeyPem");
    expect(apiTests).toContain("certificateSha256");
    expect(apiTests).toContain("caCertificatePem");
    expect(apiTests).toContain("mtlsClientCertificatePem");
    expect(runnerTests).toContain(
      "TestUploadTaskEvidenceUpdatesResultManifest"
    );
    expect(runnerTests).toContain("TestRunnerLocalLabInternalChecksE2E");
    expect(acceptanceCriteria).toContain(
      "mTLS client certificate plus bearer-token transport auth"
    );
    expect(acceptanceCriteria).toContain("task-signing public key material");
  });
});
