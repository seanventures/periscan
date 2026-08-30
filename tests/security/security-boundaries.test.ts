import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  executeModuleById,
  ModuleExecutionContextSchema
} from "../../packages/modules/src/index.js";
import { RunnerTaskEnvelopeSchema } from "../../packages/shared/src/runner.js";

const SESSION_COOKIE_NAME = "periscan_session";
const RAW_FIXTURE_SECRET = "ghp_periscanfixturetoken1234567890";
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

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

// A runner-side Ed25519 result-signing keypair. Result submission requires a
// registered signing key, so tests that submit a result register with one and
// sign the submitted localAuditSha256.
function makeSigner() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    sign: (localAuditSha256: string) =>
      sign(null, Buffer.from(localAuditSha256, "utf8"), privateKey).toString(
        "base64"
      )
  };
}

function getSessionCookie(response: {
  cookies: Array<{
    name: string;
    value: string;
  }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );

  if (!cookie) {
    throw new Error(
      "Expected API response to include a Periscan session cookie."
    );
  }

  return cookie.value;
}

function authCookies(cookie: string) {
  return {
    [SESSION_COOKIE_NAME]: cookie
  };
}

function safeRequestedAction(overrides: Record<string, boolean> = {}) {
  return {
    credentialTheft: false,
    destructive: false,
    persistence: false,
    realDataExfiltration: false,
    requiresInternalRunner: false,
    requiresTimeWindow: false,
    uncontrolledExploitChaining: false,
    ...overrides
  };
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function createApiHarness() {
  const queuedJobs: unknown[] = [];
  const prisma = createPrismaClient();
  const app = await buildApp({
    devMode: true,
    services: createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob(payload) {
          queuedJobs.push(payload);
        }
      },
      modelGatewayTurnQueue: {
        async enqueueTurn(payload) {
          queuedJobs.push(payload);
        }
      },
      prisma
    })
  });

  return {
    app,
    prisma,
    queuedJobs
  };
}

async function signupOwner(
  app: Awaited<ReturnType<typeof buildApp>>,
  emailPrefix: string
) {
  const response = await app.inject({
    method: "POST",
    payload: {
      email: uniqueEmail(emailPrefix),
      name: "Security Boundary Owner",
      password: "periscan-security-boundary-password",
      tenantName: "Security Boundary Tenant"
    },
    url: "/api/v1/auth/signup"
  });

  expect(response.statusCode).toBe(201);

  return getSessionCookie(response);
}

async function createDomainScope(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  cookie: string;
  value: string;
}) {
  const response = await input.app.inject({
    cookies: authCookies(input.cookie),
    method: "POST",
    payload: {
      scopeType: "Domain",
      value: input.value
    },
    url: "/api/v1/scopes"
  });

  expect(response.statusCode).toBe(201);

  return response.json().scopeId as string;
}

async function createScope(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  cookie: string;
  scopeType: string;
  value: string;
}) {
  const response = await input.app.inject({
    cookies: authCookies(input.cookie),
    method: "POST",
    payload: {
      scopeType: input.scopeType,
      value: input.value
    },
    url: "/api/v1/scopes"
  });

  expect(response.statusCode).toBe(201);

  return response.json().scopeId as string;
}

async function verifyScope(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  cookie: string;
  scopeId: string;
}) {
  const response = await input.app.inject({
    cookies: authCookies(input.cookie),
    method: "POST",
    payload: {
      devModeManual: true
    },
    url: `/api/v1/scopes/${input.scopeId}/verify`
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().verificationStatus).toBe("Verified");
}

async function createAllowedExternalPolicy(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  cookie: string;
  hostname: string;
  scopeId: string;
}) {
  const response = await input.app.inject({
    cookies: authCookies(input.cookie),
    method: "POST",
    payload: {
      executionEnvironment: "ExternalPoA",
      missionType: "ExposureValidation",
      requestedAction: safeRequestedAction(),
      safetyLevel: "ActiveNonInvasive",
      target: {
        hostname: input.hostname,
        templateProfile: "safe-baseline"
      }
    },
    url: `/api/v1/scopes/${input.scopeId}/policy-decisions/preview`
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().outcome).toBe("Allowed");

  return response.json().policyDecisionId as string;
}

async function createExposureMission(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  cookie: string;
  policyDecisionId: string;
  safetyLevel?: "ActiveNonInvasive" | "Disallowed";
  scopeId: string;
}) {
  const response = await input.app.inject({
    cookies: authCookies(input.cookie),
    method: "POST",
    payload: {
      missionType: "ExposureValidation",
      policyDecisionId: input.policyDecisionId,
      safetyLevel: input.safetyLevel ?? "ActiveNonInvasive",
      scopeId: input.scopeId
    },
    url: "/api/v1/missions"
  });

  expect(response.statusCode).toBe(201);

  return response.json().missionId as string;
}

describe("security boundary regression suite", () => {
  it("requires verified scope and prevents denied safety decisions from queueing jobs", async () => {
    const { app, prisma, queuedJobs } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "security-scope");
      const hostname = `scope-${randomUUID()}.example.com`;
      const scopeId = await createDomainScope({
        app,
        cookie,
        value: hostname
      });

      const snapshotDeniedResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          audience: "Security Team"
        },
        url: "/api/v1/snapshots"
      });

      expect(snapshotDeniedResponse.statusCode).toBe(400);
      expect(snapshotDeniedResponse.json().error).toMatch(/verified scope/i);

      await verifyScope({
        app,
        cookie,
        scopeId
      });

      const deniedPolicyResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: safeRequestedAction(),
          safetyLevel: "Disallowed",
          target: {
            hostname,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });

      expect(deniedPolicyResponse.statusCode).toBe(201);
      expect(deniedPolicyResponse.json().outcome).toBe("Denied");

      const missionId = await createExposureMission({
        app,
        cookie,
        policyDecisionId: deniedPolicyResponse.json().policyDecisionId,
        safetyLevel: "Disallowed",
        scopeId
      });
      const startResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname,
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${missionId}/start`
      });

      expect(startResponse.statusCode).toBe(200);
      expect(startResponse.json().jobsQueued).toBe(0);
      expect(startResponse.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("rechecks verified scope and rejects expired/rejected policy decisions at mission start (dual policy gate)", async () => {
    // P0 dual policy gate: startMission must not trust a stored Allowed outcome
    // alone. Scope may be revoked after the decision is minted; expiry and
    // admin rejection must fail closed before any job is queued.
    const { app, prisma, queuedJobs } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "security-dual-gate");
      const hostname = `dual-gate-${randomUUID()}.example.com`;
      const scopeId = await createDomainScope({
        app,
        cookie,
        value: hostname
      });
      await verifyScope({ app, cookie, scopeId });

      async function createMissionWithAllowedDecision() {
        const policyDecisionId = await createAllowedExternalPolicy({
          app,
          cookie,
          hostname,
          scopeId
        });
        const missionId = await createExposureMission({
          app,
          cookie,
          policyDecisionId,
          scopeId
        });
        return { missionId, policyDecisionId };
      }

      // 1) Scope verification revoked after Allowed decision → DeniedByPolicy, no queue
      const unverified = await createMissionWithAllowedDecision();
      await prisma.scope.update({
        data: {
          verificationStatus: "Pending",
          verifiedAt: null,
          verifiedBy: null
        },
        where: { scopeId }
      });
      const unverifiedStart = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname,
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${unverified.missionId}/start`
      });
      expect(unverifiedStart.statusCode).toBe(200);
      expect(unverifiedStart.json().jobsQueued).toBe(0);
      expect(unverifiedStart.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);

      // Restore verification for subsequent cases
      await prisma.scope.update({
        data: {
          verificationStatus: "Verified",
          verifiedAt: new Date(),
          verifiedBy: null
        },
        where: { scopeId }
      });

      // 2) Expired Allowed decision → DeniedByPolicy, no queue
      const expired = await createMissionWithAllowedDecision();
      await prisma.policyDecision.update({
        data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") },
        where: { policyDecisionId: expired.policyDecisionId }
      });
      const expiredStart = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname,
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${expired.missionId}/start`
      });
      expect(expiredStart.statusCode).toBe(200);
      expect(expiredStart.json().jobsQueued).toBe(0);
      expect(expiredStart.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);

      // 3) Admin-rejected decision → DeniedByPolicy, no queue
      const rejected = await createMissionWithAllowedDecision();
      const denyResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/approvals/${rejected.policyDecisionId}/deny`
      });
      expect(denyResponse.statusCode).toBe(200);
      expect(denyResponse.json().approvalState).toBe("Rejected");
      const rejectedStart = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname,
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${rejected.missionId}/start`
      });
      expect(rejectedStart.statusCode).toBe(200);
      expect(rejectedStart.json().jobsQueued).toBe(0);
      expect(rejectedStart.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("enforces external validation rate limits before queueing additional jobs", async () => {
    const previousEnv = {
      blockedTargets: process.env.PERISCAN_EXTERNAL_VALIDATION_BLOCKED_TARGETS,
      globalLimit: process.env.PERISCAN_EXTERNAL_VALIDATION_GLOBAL_LIMIT,
      killSwitch: process.env.PERISCAN_EXTERNAL_VALIDATION_KILL_SWITCH,
      tenantLimit: process.env.PERISCAN_EXTERNAL_VALIDATION_TENANT_LIMIT,
      windowMs: process.env.PERISCAN_EXTERNAL_VALIDATION_WINDOW_MS
    };
    process.env.PERISCAN_EXTERNAL_VALIDATION_BLOCKED_TARGETS = "";
    process.env.PERISCAN_EXTERNAL_VALIDATION_GLOBAL_LIMIT = "100";
    process.env.PERISCAN_EXTERNAL_VALIDATION_KILL_SWITCH = "false";
    process.env.PERISCAN_EXTERNAL_VALIDATION_TENANT_LIMIT = "1";
    process.env.PERISCAN_EXTERNAL_VALIDATION_WINDOW_MS = "60000";

    const { app, prisma, queuedJobs } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "security-rate");
      // Hostname must resolve to public DNS (post-resolve SSRF guard). Random
      // subdomains of example.com often ENOTFOUND and deny the first start.
      const hostname = "example.com";
      const scopeId = await createDomainScope({
        app,
        cookie,
        value: hostname
      });

      await verifyScope({
        app,
        cookie,
        scopeId
      });

      const firstPolicyDecisionId = await createAllowedExternalPolicy({
        app,
        cookie,
        hostname,
        scopeId
      });
      const firstMissionId = await createExposureMission({
        app,
        cookie,
        policyDecisionId: firstPolicyDecisionId,
        scopeId
      });
      const firstStartResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname,
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${firstMissionId}/start`
      });

      expect(firstStartResponse.statusCode).toBe(200);
      expect(firstStartResponse.json().jobsQueued).toBe(1);
      expect(firstStartResponse.json().mission.status).toBe("Queued");
      expect(queuedJobs).toHaveLength(1);

      const secondPolicyDecisionId = await createAllowedExternalPolicy({
        app,
        cookie,
        hostname,
        scopeId
      });
      const secondMissionId = await createExposureMission({
        app,
        cookie,
        policyDecisionId: secondPolicyDecisionId,
        scopeId
      });
      const secondStartResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname,
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${secondMissionId}/start`
      });

      expect(secondStartResponse.statusCode).toBe(200);
      expect(secondStartResponse.json().jobsQueued).toBe(0);
      expect(secondStartResponse.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(1);
    } finally {
      await app.close();
      await prisma.$disconnect();
      restoreEnvVar(
        "PERISCAN_EXTERNAL_VALIDATION_BLOCKED_TARGETS",
        previousEnv.blockedTargets
      );
      restoreEnvVar(
        "PERISCAN_EXTERNAL_VALIDATION_GLOBAL_LIMIT",
        previousEnv.globalLimit
      );
      restoreEnvVar(
        "PERISCAN_EXTERNAL_VALIDATION_KILL_SWITCH",
        previousEnv.killSwitch
      );
      restoreEnvVar(
        "PERISCAN_EXTERNAL_VALIDATION_TENANT_LIMIT",
        previousEnv.tenantLimit
      );
      restoreEnvVar(
        "PERISCAN_EXTERNAL_VALIDATION_WINDOW_MS",
        previousEnv.windowMs
      );
    }
  });

  it("requires tenant authorization before reading evidence artifacts", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const ownerCookie = await signupOwner(app, "security-evidence-owner");
      const ownerMeResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: "/api/v1/me"
      });

      expect(ownerMeResponse.statusCode).toBe(200);
      const tenantId = ownerMeResponse.json().tenant.tenantId as string;
      const scopeId = await createDomainScope({
        app,
        cookie: ownerCookie,
        value: `evidence-${randomUUID()}.example.com`
      });

      await verifyScope({
        app,
        cookie: ownerCookie,
        scopeId
      });

      const snapshotResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          audience: "Security Team",
          maxTopItems: 3
        },
        url: "/api/v1/snapshots"
      });

      expect(snapshotResponse.statusCode).toBe(201);
      expect(snapshotResponse.json().evidenceIds.length).toBeGreaterThan(0);

      const evidenceId = snapshotResponse.json().evidenceIds[0] as string;
      const ownerEvidenceResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}`
      });

      expect(ownerEvidenceResponse.statusCode).toBe(200);

      const ownerEvidenceDownloadResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}/download`
      });

      expect(ownerEvidenceDownloadResponse.statusCode).toBe(200);
      expect(ownerEvidenceDownloadResponse.json().artifact.evidenceId).toBe(
        evidenceId
      );

      const timestamp = new Date();
      const cloudRole = await prisma.asset.create({
        data: {
          assetType: "CloudResource",
          businessCriticality: "High",
          environment: "production",
          firstSeenAt: timestamp,
          identifiers: {
            arn: `arn:aws:iam::123456789012:role/evidence-boundary-${randomUUID()}`
          },
          internetExposed: false,
          lastSeenAt: timestamp,
          name: `Evidence boundary role ${randomUUID()}`,
          status: "Active",
          tags: ["security-boundary", "iam"],
          tenantId
        }
      });
      const productionData = await prisma.asset.create({
        data: {
          assetType: "CloudResource",
          businessCriticality: "Critical",
          environment: "production",
          firstSeenAt: timestamp,
          identifiers: {
            arn: `arn:aws:s3:::evidence-boundary-${randomUUID()}`
          },
          internetExposed: false,
          lastSeenAt: timestamp,
          name: `Evidence boundary data ${randomUUID()}`,
          status: "Active",
          tags: ["security-boundary", "data"],
          tenantId
        }
      });
      await prisma.signalEnvelope.createMany({
        data: [
          {
            confidence: 0.92,
            evidenceIds: [evidenceId],
            freshness: "Fresh",
            rawPayloadPointer: `/api/v1/evidence/${evidenceId}`,
            redactionStatus: "Redacted",
            relatedAssetIds: [],
            relatedControlIds: [],
            relatedEvidenceIds: [evidenceId],
            relatedIdentityIds: [],
            relatedPathIds: [],
            sensitivityLevel: "Moderate",
            signalCategory: "Repository",
            signalSubcategory: "SecretScanCandidate",
            sourceType: "fixture.security-boundary",
            sourceVendor: "Periscan",
            techniqueIds: [],
            tenantId,
            timestampIngested: timestamp,
            timestampObserved: timestamp
          },
          {
            confidence: 0.88,
            evidenceIds: [evidenceId],
            freshness: "Fresh",
            rawPayloadPointer: `/api/v1/evidence/${evidenceId}`,
            redactionStatus: "Redacted",
            relatedAssetIds: [cloudRole.assetId, productionData.assetId],
            relatedControlIds: [],
            relatedEvidenceIds: [evidenceId],
            relatedIdentityIds: [],
            relatedPathIds: [],
            sensitivityLevel: "Moderate",
            signalCategory: "Cloud",
            signalSubcategory: "PublicExposure",
            sourceType: "fixture.security-boundary",
            sourceVendor: "Periscan",
            techniqueIds: [],
            tenantId,
            timestampIngested: timestamp,
            timestampObserved: timestamp
          }
        ]
      });

      const attackPathsResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: "/api/v1/attack-paths"
      });

      expect(attackPathsResponse.statusCode).toBe(200);
      expect(attackPathsResponse.json().items.length).toBeGreaterThan(0);
      const pathId = attackPathsResponse.json().items[0].attackPath
        .pathId as string;
      const ownerAttackPathEvidenceResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/evidence`
      });

      expect(ownerAttackPathEvidenceResponse.statusCode).toBe(200);
      expect(
        ownerAttackPathEvidenceResponse.json().items.length
      ).toBeGreaterThan(0);

      const otherCookie = await signupOwner(app, "security-evidence-other");
      const otherEvidenceResponse = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}`
      });

      expect(otherEvidenceResponse.statusCode).toBe(404);

      const otherEvidenceDownloadResponse = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}/download`
      });

      expect(otherEvidenceDownloadResponse.statusCode).toBe(404);

      const otherAttackPathEvidenceResponse = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/evidence`
      });

      expect(otherAttackPathEvidenceResponse.statusCode).toBe(404);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("denies unsafe OSS module starts before queueing jobs", async () => {
    const { app, prisma, queuedJobs } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "security-oss-modules");
      const controlScopeId = await createScope({
        app,
        cookie,
        scopeType: "ControlSource",
        value: "mock-control-source"
      });

      await verifyScope({
        app,
        cookie,
        scopeId: controlScopeId
      });

      const atomicDecisionResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          adminApproval: true,
          executionEnvironment: "ControlPlane",
          explicitMissionApproval: true,
          missionType: "ControlValidation",
          requestedAction: safeRequestedAction(),
          safetyLevel: "BASLite",
          target: {
            controlSourceId: randomUUID(),
            dryRun: false,
            techniqueId: "T1595"
          }
        },
        url: `/api/v1/scopes/${controlScopeId}/policy-decisions/preview`
      });

      expect(atomicDecisionResponse.statusCode).toBe(201);
      expect(atomicDecisionResponse.json().outcome).toBe("Allowed");

      const atomicMissionResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ControlValidation",
          policyDecisionId: atomicDecisionResponse.json().policyDecisionId,
          safetyLevel: "BASLite",
          scopeId: controlScopeId
        },
        url: "/api/v1/missions"
      });
      const atomicStartResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["atomic.control_validation_safe"],
          target: {
            controlSourceId: randomUUID(),
            dryRun: false,
            techniqueId: "T1595"
          }
        },
        url: `/api/v1/missions/${atomicMissionResponse.json().missionId}/start`
      });

      expect(atomicStartResponse.statusCode).toBe(200);
      expect(atomicStartResponse.json().jobsQueued).toBe(0);
      expect(atomicStartResponse.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);

      const internalScopeId = await createScope({
        app,
        cookie,
        scopeType: "InternalNetwork",
        value: "10.30.0.0/24"
      });

      await verifyScope({
        app,
        cookie,
        scopeId: internalScopeId
      });

      const calderaDecisionResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          adminApproval: true,
          executionEnvironment: "InternalRunner",
          explicitMissionApproval: true,
          missionType: "ControlValidation",
          requestedAction: safeRequestedAction({
            requiresInternalRunner: true,
            requiresTimeWindow: true
          }),
          safetyLevel: "AdvancedAdversarial",
          target: {
            operationName: "blocked-plan"
          },
          timeWindowApproved: true
        },
        url: `/api/v1/scopes/${internalScopeId}/policy-decisions/preview`
      });

      expect(calderaDecisionResponse.statusCode).toBe(201);
      expect(calderaDecisionResponse.json().outcome).toBe("Denied");

      const calderaMissionResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ControlValidation",
          policyDecisionId: calderaDecisionResponse.json().policyDecisionId,
          safetyLevel: "AdvancedAdversarial",
          scopeId: internalScopeId
        },
        url: "/api/v1/missions"
      });
      const calderaStartResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["caldera.advanced_adversarial"],
          target: {}
        },
        url: `/api/v1/missions/${calderaMissionResponse.json().missionId}/start`
      });

      expect(calderaStartResponse.statusCode).toBe(200);
      expect(calderaStartResponse.json().jobsQueued).toBe(0);
      expect(calderaStartResponse.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("exposes readiness, deployment status, and tenant-scoped job visibility", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const readyResponse = await app.inject({
        method: "GET",
        url: "/api/v1/health/ready"
      });

      expect(readyResponse.statusCode).toBe(200);
      expect(readyResponse.json().status).toBe("ready");
      expect(
        readyResponse
          .json()
          .checks.find((check: { name: string }) => check.name === "database")
          ?.status
      ).toBe("ok");

      const cookie = await signupOwner(app, "deployment-status");

      const jobsResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/jobs?status=Failed"
      });

      expect(jobsResponse.statusCode).toBe(200);
      expect(Array.isArray(jobsResponse.json().items)).toBe(true);

      const deploymentResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/system/deployment-status"
      });

      expect(deploymentResponse.statusCode).toBe(200);
      expect(Array.isArray(deploymentResponse.json().items)).toBe(true);
      expect(deploymentResponse.json()).toHaveProperty("missingRequired");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("rate limits authenticated requests per tenant and exempts health probes", async () => {
    const previousMax = process.env.PERISCAN_RATE_LIMIT_MAX;
    process.env.PERISCAN_RATE_LIMIT_MAX = "3";

    const { app, prisma } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "rate-limit");

      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await app.inject({
          cookies: authCookies(cookie),
          method: "GET",
          url: "/api/v1/me"
        });

        statuses.push(response.statusCode);
      }

      expect(statuses).toContain(429);

      // Health probes are always exempt from rate limiting.
      const healthResponse = await app.inject({
        method: "GET",
        url: "/api/v1/health"
      });

      expect(healthResponse.statusCode).toBe(200);
    } finally {
      restoreEnvVar("PERISCAN_RATE_LIMIT_MAX", previousMax);
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("redacts raw secret material and rejects unsigned runner task envelopes", async () => {
    const output = await executeModuleById(
      "gitleaks.repo_secrets",
      ModuleExecutionContextSchema.parse({
        integrationIds: [],
        inputs: {},
        missionId: randomUUID(),
        policyDecisionId: null,
        runId: randomUUID(),
        runnerId: null,
        safetyLevel: "PassiveReadOnly",
        scopeId: randomUUID(),
        target: {
          fixtureMode: true,
          repositoryName: "periscan-fixtures/demo-app",
          repositoryPath: path.resolve(
            process.cwd(),
            "packages/modules/fixtures/gitleaks/repo-with-fake-secret"
          )
        },
        tenantId: randomUUID()
      })
    );

    expect(output.validationState).toBe("Validated");
    expect(output.evidence[0]?.redactionStatus).toBe("Redacted");
    expect(String(output.evidence[0]?.attributes.secretPreview)).toMatch(
      /^\[REDACTED(:[a-z]+)?\]$/
    );
    expect(JSON.stringify(output)).not.toContain(RAW_FIXTURE_SECRET);
    expect(output.summary).not.toContain(RAW_FIXTURE_SECRET);

    const now = new Date().toISOString();
    const unsignedRunnerTask = {
      artifactUpload: {
        artifactUploadUrl: "https://runner.periscan.test/tasks/artifacts",
        maxArtifactBytes: 10_000_000,
        resultCallbackUrl: "https://runner.periscan.test/tasks/result"
      },
      executionEnvironment: "InternalRunner",
      expiresAt: now,
      inputs: {},
      issuedAt: now,
      missionId: randomUUID(),
      moduleId: "runner.reachability_check",
      runId: randomUUID(),
      runnerId: randomUUID(),
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints: {
        approvedCidrs: [],
        approvedDnsSuffixes: ["corp.example.internal"],
        approvedHostnames: ["app-01.corp.example.internal"],
        approvedPorts: [443],
        forbidInternetEgress: true
      },
      scopeId: randomUUID(),
      target: {
        hostname: "app-01.corp.example.internal",
        port: 443
      },
      taskId: randomUUID(),
      tenantId: randomUUID()
    };

    expect(RunnerTaskEnvelopeSchema.safeParse(unsignedRunnerTask).success).toBe(
      false
    );
  });

  it("enforces the runner kill switch server-side: no task dispatch and no poll leasing while active", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "runner-killswitch-owner");

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["killswitch"],
          runnerName: "killswitch-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      const registerResponse = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "killswitch-runner",
          labels: ["killswitch"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          runnerName: "killswitch-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;

      const activate = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          active: true,
          reason: "Security boundary drill"
        },
        url: `/api/v1/runners/${runnerId}/kill-switch`
      });
      expect(activate.statusCode).toBe(200);
      expect(activate.json().runner.killSwitchActive).toBe(true);
      expect(activate.json().runner.status).toBe("KillSwitchActive");

      // Task dispatch must be refused while the kill switch is active.
      const blockedTask = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          ports: [443],
          scopeId: randomUUID(),
          targetHost: "app-01.corp.internal",
          timeoutSeconds: 5
        },
        url: `/api/v1/runners/${runnerId}/tasks/reachability`
      });
      expect(blockedTask.statusCode).toBe(409);

      // The runner poll must report the kill switch and lease no tasks.
      const poll = await app.inject({
        headers: {
          authorization: `Bearer ${runnerAuthToken}`
        },
        method: "POST",
        payload: {},
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(poll.statusCode).toBe(200);
      expect(poll.json().killSwitchActive).toBe(true);
      expect(poll.json().tasks).toHaveLength(0);

      // Deactivating restores normal operation.
      const deactivate = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          active: false
        },
        url: `/api/v1/runners/${runnerId}/kill-switch`
      });
      expect(deactivate.statusCode).toBe(200);
      expect(deactivate.json().runner.killSwitchActive).toBe(false);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("enforces model gateway boundaries: denial never queues, secrets never leak, tenants are isolated, and the kill switch halts activity", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const ownerCookie = await signupOwner(app, "security-gateway-owner");
      const otherCookie = await signupOwner(app, "security-gateway-other");

      const scopeId = await createDomainScope({
        app,
        cookie: ownerCookie,
        value: "gateway-boundary.example.com"
      });

      const rawApiKey = "sk-gateway-raw-secret-should-never-leak";
      const providerResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          apiKey: rawApiKey,
          authMethod: "bearer",
          deploymentType: "Cloud",
          endpointUrl: "https://api.openai.com/v1",
          providerName: "Owner OpenAI",
          providerType: "OpenAICompatible"
        },
        url: "/api/v1/model-gateway/providers"
      });
      expect(providerResponse.statusCode).toBe(201);
      const providerId = providerResponse.json().modelProviderId as string;
      // The raw API key must never be returned on create or read.
      expect(JSON.stringify(providerResponse.json())).not.toContain(rawApiKey);
      const providerRead = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: `/api/v1/model-gateway/providers/${providerId}`
      });
      expect(JSON.stringify(providerRead.json())).not.toContain(rawApiKey);

      // A read-only policy profile: validation tools exceed its safety ceiling.
      const policyResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          allowedModes: ["PlanOnly", "ReadOnlyEvidence", "SafeValidation"],
          description: "Read-only ceiling",
          maxSafetyLevel: "PassiveReadOnly",
          name: "Read-only ceiling"
        },
        url: "/api/v1/model-gateway/policies"
      });
      expect(policyResponse.statusCode).toBe(201);
      const policyId = policyResponse.json().modelPolicyProfileId as string;

      const sessionResponse = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          mode: "SafeValidation",
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: "Boundary probe",
          scopeIds: [scopeId]
        },
        url: "/api/v1/model-gateway/sessions"
      });
      expect(sessionResponse.statusCode).toBe(201);
      const sessionId = sessionResponse.json().modelSessionId as string;
      const ownerTenantId = (
        await prisma.modelSession.findUniqueOrThrow({
          where: { modelSessionId: sessionId }
        })
      ).tenantId;

      await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        url: `/api/v1/model-gateway/sessions/${sessionId}/start`
      });

      // A validation tool exceeds the policy ceiling: it must be Denied and
      // never produce a mission/queued action.
      const deniedRequest = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          input: {},
          requestReason: "Attempt validation under a read-only ceiling",
          toolName: "request_exposure_validation"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(deniedRequest.statusCode).toBe(201);
      expect(deniedRequest.json().status).toBe("Denied");

      // Executing a denied request must be rejected, and nothing is queued.
      const executeDenied = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        url: `/api/v1/model-gateway/tool-requests/${deniedRequest.json().toolRequestId}/execute`
      });
      expect(executeDenied.statusCode).toBe(409);
      const missionCount = await prisma.validationMission.count({
        where: { tenantId: ownerTenantId }
      });
      expect(missionCount).toBe(0);

      // Cross-tenant isolation: another tenant cannot read this session.
      const crossTenant = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/model-gateway/sessions/${sessionId}`
      });
      expect(crossTenant.statusCode).toBe(404);

      // Kill switch halts activity: the session is terminated and refuses new
      // tool requests.
      const kill = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: { reason: "Boundary drill" },
        url: "/api/v1/model-gateway/kill-switch"
      });
      expect(kill.statusCode).toBe(200);

      const afterKill = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          input: { limit: 5 },
          requestReason: "Post-kill attempt",
          toolName: "list_assets_in_scope"
        },
        url: `/api/v1/model-gateway/sessions/${sessionId}/tool-requests`
      });
      expect(afterKill.statusCode).toBe(409);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("issues mTLS runner credentials with bearer-token defense in depth", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "runner-transport-auth");
      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["transport"],
          runnerName: "transport-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      const registerResponse = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "transport-runner",
          labels: ["transport"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          runnerName: "transport-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });

      expect(registerResponse.statusCode).toBe(201);
      expect(registerResponse.json().credentials.transportAuth).toBe(
        "mtls-client-cert-and-bearer-over-tls"
      );
      expect(registerResponse.json().credentials.taskSigningKeyId).toMatch(
        /^runner-task-/
      );
      expect(
        registerResponse.json().credentials.mtlsClientCertificatePem
      ).toContain("BEGIN CERTIFICATE");
      expect(registerResponse.json().credentials.caCertificatePem).toContain(
        "BEGIN CERTIFICATE"
      );
      expect(registerResponse.json().credentials.mtlsCertificateSha256).toMatch(
        /^[a-f0-9]{64}$/u
      );

      const runnerId = registerResponse.json().runner.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;
      const previousRequireMtls = process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
      process.env.PERISCAN_RUNNER_REQUIRE_MTLS = "true";

      try {
        const heartbeatPayload = {
          activeTaskId: null,
          certificateExpiresAt:
            registerResponse.json().runner.certificateExpiresAt,
          lastTaskCompletedAt: null,
          observedAt: new Date().toISOString(),
          queueDepth: 0,
          runnerId,
          status: "Active",
          tenantId: registerResponse.json().runner.tenantId,
          version: "0.1.1"
        };

        const missingCertificateResponse = await app.inject({
          headers: {
            authorization: `Bearer ${runnerAuthToken}`
          },
          method: "POST",
          payload: heartbeatPayload,
          url: `/api/v1/runners/${runnerId}/heartbeat`
        });
        expect(missingCertificateResponse.statusCode).toBe(401);
        expect(missingCertificateResponse.json().code).toBe(
          "runner_mtls_required"
        );

        const wrongCertificateResponse = await app.inject({
          headers: {
            authorization: `Bearer ${runnerAuthToken}`,
            "x-periscan-runner-client-cert-sha256":
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
          },
          method: "POST",
          payload: heartbeatPayload,
          url: `/api/v1/runners/${runnerId}/heartbeat`
        });
        expect(wrongCertificateResponse.statusCode).toBe(403);
        expect(wrongCertificateResponse.json().code).toBe(
          "runner_mtls_mismatch"
        );

        const matchingCertificateResponse = await app.inject({
          headers: {
            authorization: `Bearer ${runnerAuthToken}`,
            "x-periscan-runner-client-cert-sha256":
              registerResponse.json().credentials.mtlsCertificateSha256
          },
          method: "POST",
          payload: heartbeatPayload,
          url: `/api/v1/runners/${runnerId}/heartbeat`
        });
        expect(matchingCertificateResponse.statusCode).toBe(200);
      } finally {
        if (previousRequireMtls === undefined) {
          delete process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
        } else {
          process.env.PERISCAN_RUNNER_REQUIRE_MTLS = previousRequireMtls;
        }
      }
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("rejects runner task results with inline unverified evidence manifest items", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "runner-inline-evidence");
      const signer = makeSigner();
      const scopeId = await createScope({
        app,
        cookie,
        scopeType: "InternalNetwork",
        value: "10.40.0.0/24"
      });
      await verifyScope({
        app,
        cookie,
        scopeId
      });

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["inline-evidence"],
          runnerName: "inline-evidence-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      const registerResponse = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "inline-evidence-runner",
          labels: ["inline-evidence"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          resultSigningPublicKeyPem: signer.publicKeyPem,
          runnerName: "inline-evidence-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);

      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;
      const taskResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          ports: [443],
          scopeId,
          targetHost: "10.40.0.10",
          timeoutSeconds: 5
        },
        url: `/api/v1/runners/${runnerId}/tasks/reachability`
      });
      expect(taskResponse.statusCode).toBe(201);
      const taskId = taskResponse.json().task.taskId as string;
      const runId = taskResponse.json().run.runId as string;
      const tenantId = registerResponse.json().runner.tenantId as string;
      const completedAt = new Date().toISOString();

      const inlineResultResponse = await app.inject({
        headers: {
          authorization: `Bearer ${runnerAuthToken}`
        },
        method: "POST",
        payload: {
          completedAt,
          evidenceManifest: [
            {
              artifactType: "NormalizedEvidence",
              redactionStatus: "Redacted",
              sha256: "inline-unverified-sha",
              sizeBytes: 128
            }
          ],
          localAuditSha256: "inline-audit-sha",
          outcome: "reachable",
          resultSignature: signer.sign("inline-audit-sha"),
          runId,
          runnerId,
          startedAt: completedAt,
          status: "Completed",
          taskId,
          tenantId,
          validationState: "Reachable"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${taskId}/result`
      });

      expect(inlineResultResponse.statusCode).toBe(400);
      expect(inlineResultResponse.json().code).toBe(
        "runner_evidence_not_uploaded"
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("enforces unique runner task nonces per runner", async () => {
    const { app, prisma } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "runner-nonce-unique");
      const scopeId = await createScope({
        app,
        cookie,
        scopeType: "InternalNetwork",
        value: "10.41.0.0/24"
      });
      await verifyScope({
        app,
        cookie,
        scopeId
      });

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["nonce"],
          runnerName: "nonce-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      const registerResponse = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "nonce-runner",
          labels: ["nonce"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          runnerName: "nonce-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const firstTask = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          ports: [443],
          scopeId,
          targetHost: "10.41.0.10",
          timeoutSeconds: 5
        },
        url: `/api/v1/runners/${runnerId}/tasks/reachability`
      });
      expect(firstTask.statusCode).toBe(201);

      const duplicateNonce = firstTask.json().task.nonce as string;
      await expect(
        prisma.runnerTask.create({
          data: {
            envelope: firstTask.json().envelope,
            expiresAt: new Date(Date.now() + 60_000),
            inputs: {},
            issuedAt: new Date(),
            missionId: firstTask.json().mission.missionId,
            moduleId: "runner.reachability_check",
            nonce: duplicateNonce,
            runId: randomUUID(),
            runnerId,
            safetyLevel: "ActiveNonInvasive",
            scopeConstraints: firstTask.json().task.scopeConstraints,
            scopeId,
            status: "Queued",
            target: {},
            taskId: randomUUID(),
            tenantId: registerResponse.json().runner.tenantId
          }
        })
      ).rejects.toThrow();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("enqueues and executes real fix-verification module runs before recording verification events", async () => {
    const { app, prisma, queuedJobs } = await createApiHarness();

    try {
      const cookie = await signupOwner(app, "fix-verification-real-run");
      const meResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(meResponse.statusCode).toBe(200);
      const tenantId = meResponse.json().tenant.tenantId as string;

      const scopeId = await createDomainScope({
        app,
        cookie,
        value: `verify-${randomUUID()}.example.com`
      });
      await verifyScope({
        app,
        cookie,
        scopeId
      });

      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          owner: "Security engineering",
          recommendedAction: "Compare submitted remediation evidence.",
          relatedPathId: null,
          status: "VerificationPending",
          technicalSteps: ["Review remediation evidence"],
          tenantId,
          verificationMethod: "Run targeted fix verification modules.",
          verificationRequired: true
        }
      });

      const verifyResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediation.remediationId}/verify`
      });

      expect(verifyResponse.statusCode).toBe(200);
      expect(verifyResponse.json().mission.status).toBe("Completed");
      expect(verifyResponse.json().run.status).toBe("Completed");
      expect(verifyResponse.json().run.moduleId).toBe(
        "periscan.fix_verification.compare"
      );
      expect(
        verifyResponse.json().verificationEvent.verificationId
      ).toBeTruthy();
      expect(queuedJobs.length).toBeGreaterThan(0);

      const missionRuns = await prisma.validationRun.findMany({
        where: {
          missionId: verifyResponse.json().mission.missionId
        }
      });
      expect(missionRuns.length).toBeGreaterThan(0);
      expect(missionRuns.every((run) => run.status === "Completed")).toBe(true);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
