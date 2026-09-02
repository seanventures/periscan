import { describe, expect, it } from "vitest";

import { listCommunityRunnerLaneEntries } from "./community-edition.js";
import {
  RUNNER_DEPLOYMENT_MODE_PRODUCT_STATUS,
  RUNNER_DISCOVER_MODULE_IDS,
  RUNNER_MEASURED_MODULE_IDS,
  RUNNER_OSS_ENGINE_MODULE_IDS,
  isRunnerDispatchableModuleId,
  isRunnerOssEngineModuleId,
  RunnerCredentialRotationRequestSchema,
  RunnerCredentialRotationResponseSchema,
  RunnerCheckTaskRequestSchema,
  RunnerHeartbeatSchema,
  RunnerInternalCheckModuleSchema,
  RunnerIssuedCredentialSchema,
  RunnerMeasuredTaskRequestSchema,
  RunnerRegistrationRequestSchema,
  RunnerTaskArtifactUploadRequestSchema,
  RunnerTaskArtifactUploadResponseSchema,
  RunnerTaskEnvelopeSchema,
  RunnerTaskResultSchema,
  getPrimaryRunnerControlChannel,
  isRunnerDeploymentModeAvailable,
  isRunnerMeasuredModuleId,
  listDefaultRunnerTransportDecisions,
  runnerDeploymentModeLabel
} from "./runner.js";

const now = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const runnerId = "22222222-2222-4222-8222-222222222222";
const missionId = "33333333-3333-4333-8333-333333333333";
const runId = "44444444-4444-4444-8444-444444444444";
const scopeId = "55555555-5555-4555-8555-555555555555";
const taskId = "66666666-6666-4666-8666-666666666666";
const certificateHash =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const caCertificatePem =
  "-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----";
const clientCertificatePem =
  "-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----";

describe("runner transport contracts", () => {
  it("parses registration, issued credentials, and heartbeat payloads", () => {
    expect(
      RunnerRegistrationRequestSchema.parse({
        arch: "amd64",
        capabilities: {
          supportsArtifactUpload: true,
          supportsHttpConnectProxy: true,
          supportsLocalReachability: true,
          supportsLongPoll: true,
          supportsWebSocket: false
        },
        csrPem: "-----BEGIN CERTIFICATE REQUEST-----demo",
        deploymentMode: "Docker",
        hostname: "periscan-runner-1",
        labels: ["dmz", "prod"],
        networkProfile: {
          additionalEgressNotes: null,
          dnsResolutionRequired: true,
          explicitProxyUrl: null,
          gatewayHostnames: ["runner.periscan.cloud"],
          httpConnectProxySupported: true,
          outboundHttpsPorts: [443]
        },
        os: "linux",
        registrationToken: "runner-registration-token",
        runnerName: "primary-prod-runner",
        version: "0.1.0"
      }).deploymentMode
    ).toBe("Docker");

    expect(
      RunnerIssuedCredentialSchema.parse({
        caCertificatePem,
        certificateExpiresAt: now,
        controlChannel: "LongPollHttps",
        controlPlaneUrl: "https://runner.periscan.cloud",
        heartbeatIntervalSeconds: 30,
        mtlsCertificateSha256: certificateHash,
        mtlsClientCertificatePem: clientCertificatePem,
        mtlsClientPrivateKeyRequired: true,
        pollIntervalSeconds: 15,
        runnerId,
        taskSigningKeyId: "runner-signing-key-1",
        taskSigningPublicKeyPem:
          "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----",
        taskResultsUrl: "https://runner.periscan.cloud/api/v1/runners/results",
        tenantId,
        transportAuth: "mtls-client-cert-and-bearer-over-tls"
      }).controlChannel
    ).toBe("LongPollHttps");

    expect(
      RunnerCredentialRotationRequestSchema.parse({
        csrPem: "-----BEGIN CERTIFICATE REQUEST-----demo",
        observedAt: now,
        runnerId,
        tenantId,
        version: "0.1.1"
      }).runnerId
    ).toBe(runnerId);

    expect(
      RunnerCredentialRotationResponseSchema.parse({
        credentials: {
          caCertificatePem,
          certificateExpiresAt: now,
          controlChannel: "LongPollHttps",
          controlPlaneUrl: "https://runner.periscan.cloud",
          heartbeatIntervalSeconds: 30,
          mtlsCertificateSha256: certificateHash,
          mtlsClientCertificatePem: clientCertificatePem,
          mtlsClientPrivateKeyRequired: true,
          pollIntervalSeconds: 15,
          runnerId,
          taskSigningKeyId: "runner-signing-key-1",
          taskSigningPublicKeyPem:
            "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----",
          taskResultsUrl:
            "https://runner.periscan.cloud/api/v1/runners/results",
          tenantId,
          transportAuth: "mtls-client-cert-and-bearer-over-tls"
        },
        runner: {
          arch: "amd64",
          certificateExpiresAt: now,
          certificateSha256: certificateHash,
          createdAt: now,
          createdBy: null,
          deploymentMode: "Docker",
          hostname: "periscan-runner-1",
          labels: ["dmz"],
          lastSeenAt: now,
          name: "primary-prod-runner",
          networkProfile: {
            dnsResolutionRequired: true,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          revokedAt: null,
          runnerId,
          status: "Active",
          tenantId,
          transportMode: "LongPollHttps",
          updatedAt: now,
          version: "0.1.1"
        }
      }).runner.version
    ).toBe("0.1.1");

    expect(
      RunnerHeartbeatSchema.parse({
        activeTaskId: null,
        certificateExpiresAt: now,
        lastTaskCompletedAt: null,
        observedAt: now,
        queueDepth: 0,
        runnerId,
        status: "Active",
        tenantId,
        version: "0.1.0"
      }).status
    ).toBe("Active");
  });

  it("parses signed runner tasks and results", () => {
    expect(
      RunnerTaskEnvelopeSchema.parse({
        artifactUpload: {
          artifactUploadUrl:
            "https://runner.periscan.cloud/api/v1/runners/tasks/artifacts",
          maxArtifactBytes: 10_000_000,
          resultCallbackUrl:
            "https://runner.periscan.cloud/api/v1/runners/tasks/result"
        },
        executionEnvironment: "InternalRunner",
        expiresAt: now,
        inputs: {
          timeoutSeconds: 10
        },
        issuedAt: now,
        missionId,
        moduleId: "runner.reachability_check",
        runId,
        runnerId,
        safetyLevel: "ActiveNonInvasive",
        scopeConstraints: {
          approvedCidrs: ["10.0.0.0/24"],
          approvedDnsSuffixes: ["corp.example.internal"],
          approvedHostnames: ["app-01.corp.example.internal"],
          approvedPorts: [443, 8443],
          forbidInternetEgress: true
        },
        scopeId,
        signature: {
          algorithm: "EdDSA",
          digestSha256: "abc123",
          keyId: "runner-signing-key-1",
          nonce: "nonce-123",
          signature: "signed-payload"
        },
        target: {
          hostname: "app-01.corp.example.internal"
        },
        taskId,
        tenantId
      }).moduleId
    ).toBe("runner.reachability_check");

    const taskResultPayload = {
      completedAt: now,
      errorSummary: null,
      evidenceManifest: [
        {
          artifactType: "NormalizedEvidence",
          evidenceId: "77777777-7777-4777-8777-777777777777",
          redactionStatus: "Redacted",
          sha256: "deadbeef",
          sizeBytes: 1024
        }
      ],
      localAuditSha256: "feedface",
      outcome: "reachable",
      runId,
      runnerId,
      startedAt: now,
      status: "Completed",
      taskId,
      tenantId,
      validationState: "Reachable"
    };
    expect(RunnerTaskResultSchema.parse(taskResultPayload).status).toBe(
      "Completed"
    );
    expect(
      RunnerTaskResultSchema.safeParse({
        ...taskResultPayload,
        errorSummary: "runner module failed",
        status: "Failed",
        validationState: "Inconclusive"
      }).success
    ).toBe(true);
    expect(
      RunnerTaskResultSchema.safeParse({
        ...taskResultPayload,
        status: "Running"
      }).success
    ).toBe(false);

    expect(
      RunnerTaskArtifactUploadRequestSchema.parse({
        artifactType: "NormalizedEvidence",
        contentBase64: "eyJvayI6dHJ1ZX0=",
        contentType: "application/json",
        sha256: "runner-raw-sha",
        sizeBytes: 11
      }).contentType
    ).toBe("application/json");

    expect(
      RunnerTaskArtifactUploadResponseSchema.parse({
        artifact: {
          artifactType: "NormalizedEvidence",
          createdAt: now,
          evidenceId: "77777777-7777-4777-8777-777777777777",
          redactionStatus: "Redacted",
          relatedEntityId: runId,
          relatedEntityType: "ValidationRun",
          sensitivityLevel: "Low",
          sha256: "runner-redacted-sha",
          storageUri: "memory://tenant/ValidationRun/run/runner-evidence.json",
          tenantId,
          updatedAt: now
        }
      }).artifact.evidenceId
    ).toBe("77777777-7777-4777-8777-777777777777");
  });

  it("defaults to long-poll HTTPS and rejects reverse SSH as the primary transport", () => {
    const decisions = listDefaultRunnerTransportDecisions();

    expect(getPrimaryRunnerControlChannel()).toBe("LongPollHttps");
    expect(
      decisions.find((item) => item.channel === "ReverseSsh")?.status
    ).toBe("Disallowed");
  });
});

describe("RunnerCheckTaskRequest", () => {
  it("exposes exactly the implemented Go runner internal checks", () => {
    const modules = RunnerInternalCheckModuleSchema.options;

    expect(modules).toEqual([
      "runner.dns_resolution_check",
      "runner.tls_certificate_check",
      "runner.http_health_check"
    ]);
    expect(new Set(modules).size).toBe(modules.length);
  });

  it("allows DNS checks without a port and requires a port for HTTP/TLS checks", () => {
    expect(
      RunnerCheckTaskRequestSchema.parse({
        module: "runner.dns_resolution_check",
        scopeId,
        targetHost: "internal.corp.local"
      }).module
    ).toBe("runner.dns_resolution_check");

    expect(
      RunnerCheckTaskRequestSchema.safeParse({
        module: "runner.tls_certificate_check",
        scopeId,
        targetHost: "internal.corp.local"
      }).success
    ).toBe(false);

    expect(
      RunnerCheckTaskRequestSchema.parse({
        module: "runner.http_health_check",
        port: 8080,
        scopeId,
        targetHost: "internal.corp.local"
      }).port
    ).toBe(8080);
  });
});

describe("RunnerMeasuredTaskRequest", () => {
  it("accepts an allowlisted measured module with a host:port target", () => {
    const parsed = RunnerMeasuredTaskRequestSchema.parse({
      moduleId: "periscan.tls_protocol_audit",
      port: 443,
      scopeId,
      targetHost: "internal.corp.local"
    });

    expect(parsed.moduleId).toBe("periscan.tls_protocol_audit");
    // Defaults mirror the internal-check request contract.
    expect(parsed.rateLimitPerMinute).toBe(30);
    expect(parsed.timeoutSeconds).toBe(5);
  });

  it("accepts the DNS resolution check without a port", () => {
    const parsed = RunnerMeasuredTaskRequestSchema.parse({
      moduleId: "periscan.dns_resolution_check",
      scopeId,
      targetHost: "internal.corp.local"
    });

    expect(parsed.moduleId).toBe("periscan.dns_resolution_check");
  });

  it("requires platform and a constrained marker for endpoint emission", () => {
    const parsed = RunnerMeasuredTaskRequestSchema.parse({
      markerId: "periscan-endpoint-1234",
      moduleId: "periscan.endpoint_benign_marker_emit",
      platform: "Linux",
      scopeId,
      targetHost: "runner-01.corp.local"
    });

    expect(parsed.port).toBeUndefined();
    expect(parsed.platform).toBe("Linux");
    expect(
      RunnerMeasuredTaskRequestSchema.safeParse({
        markerId: "contains spaces",
        moduleId: "periscan.endpoint_benign_marker_emit",
        platform: "Linux",
        scopeId,
        targetHost: "runner-01.corp.local"
      }).success
    ).toBe(false);
  });

  it("accepts an optional remediationId (verify-in-network intent)", () => {
    const remediationId = "99999999-9999-4999-8999-999999999999";
    const parsed = RunnerMeasuredTaskRequestSchema.parse({
      moduleId: "periscan.tls_protocol_audit",
      port: 443,
      remediationId,
      scopeId,
      targetHost: "internal.corp.local"
    });

    expect(parsed.remediationId).toBe(remediationId);
  });

  it("requires a port for TLS/HTTP measured checks", () => {
    expect(
      RunnerMeasuredTaskRequestSchema.safeParse({
        moduleId: "periscan.http_cors_audit",
        scopeId,
        targetHost: "internal.corp.local"
      }).success
    ).toBe(false);
  });

  it("rejects a non-allowlisted or arbitrary module id (authorization boundary)", () => {
    // A control-plane-only / public-domain module is not runner-safe-listed.
    expect(
      RunnerMeasuredTaskRequestSchema.safeParse({
        moduleId: "periscan.well_known_security_txt",
        port: 443,
        scopeId,
        targetHost: "internal.corp.local"
      }).success
    ).toBe(false);
    // An offensive module can never be dispatched via this request.
    expect(
      RunnerMeasuredTaskRequestSchema.safeParse({
        moduleId: "exploit.metasploit_check",
        port: 443,
        scopeId,
        targetHost: "internal.corp.local"
      }).success
    ).toBe(false);
    expect(isRunnerMeasuredModuleId("exploit.metasploit_check")).toBe(false);
    expect(RUNNER_MEASURED_MODULE_IDS).toContain("periscan.tls_protocol_audit");
  });
});

describe("runner OSS engine allowlist (PERISCAN-498)", () => {
  const offensiveNeverDispatch = [
    "atomic.control_validation_safe",
    "caldera.advanced_adversarial",
    "exploit.metasploit_check",
    "exploitation.killchain.engine",
    "identity.cred_spray",
    "identity.kerberos_userenum",
    "web.sqli_probe"
  ] as const;

  it("lists only safe scanners and never offensive IDs", () => {
    expect(RUNNER_OSS_ENGINE_MODULE_IDS).toContain("gitleaks.repo_secrets");
    expect(RUNNER_OSS_ENGINE_MODULE_IDS).toContain("syft.sbom_generate");
    expect(RUNNER_OSS_ENGINE_MODULE_IDS).toContain(
      "grype.repo_vulnerability_scan"
    );
    expect(isRunnerDispatchableModuleId("recon.host_discovery")).toBe(true);
    expect(isRunnerDispatchableModuleId("syft.sbom_generate")).toBe(true);
    for (const moduleId of offensiveNeverDispatch) {
      expect(isRunnerOssEngineModuleId(moduleId)).toBe(false);
      expect(isRunnerDispatchableModuleId(moduleId)).toBe(false);
    }
  });

  it("treats every Community runner-lane module as dispatchable", () => {
    const runnerLaneIds = listCommunityRunnerLaneEntries().map(
      (entry) => entry.moduleId
    );
    expect(runnerLaneIds.length).toBeGreaterThan(0);
    expect(runnerLaneIds).toEqual(
      expect.arrayContaining([
        "syft.sbom_generate",
        "recon.host_discovery",
        "recon.service_inventory",
        "recon.subdomain_enum",
        "recon.http_probe",
        "recon.dns_probe"
      ])
    );
    for (const moduleId of runnerLaneIds) {
      expect(isRunnerDispatchableModuleId(moduleId)).toBe(true);
    }
    expect(RUNNER_OSS_ENGINE_MODULE_IDS).toContain("syft.sbom_generate");
    expect(RUNNER_OSS_ENGINE_MODULE_IDS).toContain("web.zap_baseline");
    for (const moduleId of [
      "recon.host_discovery",
      "recon.service_inventory",
      "recon.subdomain_enum",
      "recon.http_probe",
      "recon.dns_probe"
    ]) {
      expect(RUNNER_DISCOVER_MODULE_IDS).toContain(moduleId);
    }
    expect(
      (RUNNER_MEASURED_MODULE_IDS as readonly string[]).includes(
        "periscan.dns_resolution_check"
      )
    ).toBe(true);
    expect(isRunnerOssEngineModuleId("periscan.dns_resolution_check")).toBe(
      false
    );
  });
});

describe("Runner deployment mode product honesty (P10-3)", () => {
  it("marks WindowsService as Planned and available modes as Available", () => {
    expect(RUNNER_DEPLOYMENT_MODE_PRODUCT_STATUS.WindowsService).toBe(
      "Planned"
    );
    expect(isRunnerDeploymentModeAvailable("WindowsService")).toBe(false);
    expect(isRunnerDeploymentModeAvailable("Docker")).toBe(true);
    expect(runnerDeploymentModeLabel("WindowsService")).toBe(
      "Windows (Planned)"
    );
    expect(runnerDeploymentModeLabel("Kubernetes")).toBe("Kubernetes");
  });
});
