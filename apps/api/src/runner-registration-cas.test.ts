import { createHash, randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeServiceDeps } from "./runtime-services.js";

const VALID_RUNNER_CSR_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIICZDCCAUwCAQAwHzEdMBsGA1UEAwwUcGVyaXNjYW4tdGVzdC1ydW5uZXIwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC2Jf1bZlp+nlHFusx+r5ZM+Pms
fUGYwXn4j/8573nKomGvdTfnUUXQbnPOIfmLw2dvrYr09TPFyJEWtgbfJ9+kjjLm
HYL5Px4pOqkthWoqFYWam2tWaAMRT8Om7Ve3Z5M25BBRmQCB9BdR/5qabCHIkrtJ
10++ODcmdHasCSsFoztY0ZSifc7KK+PZ4At7hKTcI8+Lb0UAA/FQd0moxhk/Ojcw
XzFX3FcpkNZuOh2HJRwk1wkMfz4phIvRKfbn8P8dg9/ovlNDKwy6PAmWY8Ifttoq
016b/HN7xuIW91ieYGDFiJxl3gUneiS5zbV8Fk/69QYMix1vup9dOOT/2wYtAgMB
AAGgADANBgkqhkiG9w0BAQsFAAOCAQEArd5ye+Fs2176U4desA9KjzD9VbUD7DiI
RGGBsmiw/K0A2OBp6I01Vl6SMIM7H6Fb7AvrF1qyQ69aMchNTIKoEr0XAFtnw+jt
n5A6vXBmeduDQdIlC6zkZZZbd9mCxNT5i3bZ+sxxX618yiNsbHiLrDzmhP3ILNbV
/u5FHQuWH5ZJdONn21ICwQMIpSJQN64CXjmSlaHw9E4K/Yi0tsN/bFyViy6zaiw5
sl0crYhJZZjFo7YQ0ZD/s1XH6i/6qgG/zZp5xZbptk6uiVTFljEyyKC6HWzThCA8
8EqaJWzUefkhm9zTm1+ud0UlY7lHGZ3Km75+BaZYszM5lyEruketbQ==
-----END CERTIFICATE REQUEST-----`;

vi.mock("./runtime-services.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runtime-services.js")>();
  return {
    ...actual,
    getRunnerControlPlaneUrl: () => "https://runner.periscan.test",
    issueRunnerCredentials: vi.fn().mockResolvedValue({
      caCertificatePem: "-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----",
      certificateExpiresAt: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      mtlsCertificateSha256: "a".repeat(64),
      mtlsClientCertificatePem:
        "-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----",
      taskSigningKeyId: "runner-signing-key-test",
      taskSigningPublicKeyPem:
        "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----"
    })
  };
});

import { createRunnerServices } from "./services/runner.js";

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("registerRunner single-use token CAS", () => {
  const tenantId = randomUUID();
  const createdBy = randomUUID();
  const registrationTokenId = randomUUID();
  const plaintextToken = "prrt_registration_cas_token";
  const tokenHash = hashSecret(plaintextToken);
  const now = new Date();

  const registrationRequest = {
    arch: "amd64",
    capabilities: {
      supportsArtifactUpload: true,
      supportsHttpConnectProxy: true,
      supportsLocalReachability: true,
      supportsLongPoll: true,
      supportsWebSocket: false
    },
    csrPem: VALID_RUNNER_CSR_PEM,
    deploymentMode: "Docker" as const,
    hostname: "periscan-runner-cas",
    labels: ["lab"],
    networkProfile: {
      additionalEgressNotes: null,
      dnsResolutionRequired: true,
      explicitProxyUrl: null,
      gatewayHostnames: ["runner.periscan.cloud"],
      httpConnectProxySupported: true,
      outboundHttpsPorts: [443]
    },
    os: "linux",
    registrationToken: plaintextToken,
    runnerName: "cas-runner",
    version: "0.1.0"
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildServices(updateManyCount: number) {
    const updateMany = vi.fn().mockResolvedValue({ count: updateManyCount });
    const runnerCreate = vi.fn().mockImplementation(async ({ data }) => ({
      ...data,
      createdAt: now,
      killSwitchActivatedAt: null,
      killSwitchActivatedBy: null,
      killSwitchAcknowledgedAt: null,
      killSwitchActive: false,
      killSwitchReason: null,
      revocationAcknowledgedAt: null,
      revokedAt: null,
      updatedAt: now
    }));
    const auditCreate = vi.fn().mockResolvedValue({});

    const services = createRunnerServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      prisma: {
        $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
          fn({
            auditEvent: { create: auditCreate },
            runner: { create: runnerCreate },
            runnerRegistrationToken: { updateMany }
          })
        ),
        runnerRegistrationToken: {
          findUnique: vi.fn().mockResolvedValue({
            createdBy,
            expiresAt: new Date(Date.now() + 60_000),
            registrationTokenId,
            status: "Active",
            tenantId,
            tokenHash
          }),
          update: vi.fn()
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    return { auditCreate, runnerCreate, services, updateMany };
  }

  it("claims Active→Used with updateMany before creating the runner", async () => {
    const { runnerCreate, services, updateMany } = buildServices(1);

    const result = await services.registerRunner(registrationRequest);

    expect(updateMany).toHaveBeenCalledWith({
      data: {
        status: "Used",
        usedAt: expect.any(Date)
      },
      where: {
        expiresAt: { gt: expect.any(Date) },
        registrationTokenId,
        status: "Active"
      }
    });
    expect(runnerCreate).toHaveBeenCalledTimes(1);
    expect(result.runner.runnerId).toBeTruthy();
    expect(result.credentials.runnerAuthToken).toMatch(/^prra_/);
  });

  it("refuses enroll when the CAS claim misses (token already Used)", async () => {
    const { runnerCreate, services, updateMany } = buildServices(0);

    await expect(services.registerRunner(registrationRequest)).rejects.toMatchObject({
      code: "runner_registration_expired",
      statusCode: 401
    });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(runnerCreate).not.toHaveBeenCalled();
  });
});
