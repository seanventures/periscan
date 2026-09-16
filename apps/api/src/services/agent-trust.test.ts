import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import { exportJWK, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  didWebToResolutionUrl,
  evaluateA2AAgentCard,
  verifyAgentCredentialJwt,
  verifyNvidiaDetachedEatBundle
} from "./agent-trust.js";

const checkedAt = new Date("2026-07-15T20:00:00.000Z");

describe("A2A Agent Card conformance", () => {
  it("accepts the public 1.0 card structure without claiming live operations", () => {
    const report = evaluateA2AAgentCard(
      {
        capabilities: { pushNotifications: false, streaming: true },
        defaultInputModes: ["text/plain"],
        defaultOutputModes: ["application/json"],
        description: "Returns redacted validation summaries.",
        name: "Validation summary agent",
        security: [{ oidc: ["openid"] }],
        securitySchemes: {
          oidc: {
            openIdConnectSecurityScheme: {
              openIdConnectUrl:
                "https://identity.example/.well-known/openid-configuration"
            }
          }
        },
        skills: [
          {
            description: "Read a redacted summary.",
            id: "read-summary",
            name: "Read summary",
            tags: ["security", "evidence"]
          }
        ],
        supportedInterfaces: [
          {
            protocolBinding: "HTTP+JSON",
            protocolVersion: "1.0",
            url: "https://agent.example/a2a/v1"
          }
        ],
        version: "1.2.0"
      },
      false,
      checkedAt
    );

    expect(report).toMatchObject({
      agentName: "Validation summary agent",
      agentVersion: "1.2.0",
      checkedAt: checkedAt.toISOString(),
      coreOperationsProbe: "NotRun",
      preferredInterface: {
        protocolBinding: "HTTP+JSON",
        protocolVersion: "1.0"
      },
      signatureStatus: "NotPresent",
      specification: "A2A 1.0 Agent Card",
      structurallyConformant: true
    });
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        checkId: "core-operation-probe",
        status: "Warning"
      })
    );
  });

  it("surfaces missing mandatory card fields and unsafe interfaces", () => {
    const report = evaluateA2AAgentCard(
      {
        capabilities: {},
        defaultInputModes: [],
        defaultOutputModes: ["text/plain"],
        description: "Incomplete card",
        name: "",
        skills: [{ id: "missing-contract" }],
        supportedInterfaces: [
          {
            protocolBinding: "HTTP+JSON",
            protocolVersion: "1.0",
            url: "http://public.example/a2a"
          }
        ]
      },
      false,
      checkedAt
    );

    expect(report.structurallyConformant).toBe(false);
    expect(report.preferredInterface).toBeNull();
    expect(report.checks.filter((check) => check.status === "Fail")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: "card-identity" }),
        expect.objectContaining({ checkId: "supported-interfaces" }),
        expect.objectContaining({ checkId: "default-content-modes" }),
        expect.objectContaining({ checkId: "skill-contracts" })
      ])
    );
  });
});

describe("W3C AgentDID credential verification", () => {
  const issuerDid = "did:web:localhost:issuer";
  const subjectDid = "did:web:localhost:agent";
  const kid = `${issuerDid}#delegation-key`;
  const keys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const now = new Date("2026-07-15T20:00:00.000Z");
  const validFrom = new Date(now.getTime() - 30_000);
  const validUntil = new Date(validFrom.getTime() + 300_000);

  async function credential(overrides: Record<string, unknown> = {}) {
    return new SignJWT({
      vc: {
        "@context": ["https://www.w3.org/ns/credentials/v2"],
        credentialSubject: {
          allowedCapabilities: ["read-proof-summary"],
          endpointOrigin: "https://agent.partner.example",
          id: subjectDid,
          workloadId: "spiffe://partner.example/agents/proof-reader"
        },
        id: "urn:uuid:11111111-1111-4111-8111-111111111111",
        issuer: issuerDid,
        type: ["VerifiableCredential", "AgentDelegationCredential"],
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        ...overrides
      }
    })
      .setProtectedHeader({ alg: "ES256", kid, typ: "vc+jwt" })
      .setIssuer(issuerDid)
      .setSubject(subjectDid)
      .setAudience("periscan-agent-gateway")
      .setJti("urn:uuid:11111111-1111-4111-8111-111111111111")
      .setNotBefore(Math.floor(validFrom.getTime() / 1_000))
      .setExpirationTime(Math.floor(validUntil.getTime() / 1_000))
      .sign(keys.privateKey);
  }

  async function issuerDocument() {
    return {
      "@context": ["https://www.w3.org/ns/did/v1"],
      assertionMethod: [kid],
      id: issuerDid,
      verificationMethod: [
        {
          controller: issuerDid,
          id: kid,
          publicKeyJwk: await exportJWK(keys.publicKey),
          type: "JsonWebKey"
        }
      ]
    };
  }

  const profile = {
    allowedCapabilityNames: ["read-proof-summary"],
    allowedCredentialTypes: ["AgentDelegationCredential"],
    expectedAudience: "periscan-agent-gateway",
    expectedEndpointOrigin: "https://agent.partner.example",
    issuerDid,
    maxCredentialTtlSeconds: 300,
    subjectDid
  };

  it("maps did:web paths and development ports without permitting arbitrary URLs", () => {
    expect(didWebToResolutionUrl(issuerDid, true)).toBe(
      "http://localhost/issuer/did.json"
    );
    expect(
      didWebToResolutionUrl("did:web:127.0.0.1%3A4317:tenant:issuer", true)
    ).toBe("http://127.0.0.1:4317/tenant/issuer/did.json");
  });

  it("verifies issuer assertion control and the normalized delegation boundary", async () => {
    const result = await verifyAgentCredentialJwt(await credential(), profile, {
      devMode: true,
      fetchImpl: async () =>
        new Response(JSON.stringify(await issuerDocument()), {
          headers: { "content-type": "application/did+json" },
          status: 200
        }),
      now
    });

    expect(result).toMatchObject({
      algorithm: "ES256",
      allowedCapabilities: ["read-proof-summary"],
      findings: [],
      issuerDid,
      status: "Verified",
      subjectDid,
      verificationMethodId: kid,
      workloadId: "spiffe://partner.example/agents/proof-reader"
    });
  });

  it("fails closed when a credential declares an unsupported status method", async () => {
    const result = await verifyAgentCredentialJwt(
      await credential({
        credentialStatus: {
          id: "https://issuer.example/status/1#7",
          type: "BitstringStatusListEntry"
        }
      }),
      profile,
      {
        devMode: true,
        fetchImpl: async () =>
          new Response(JSON.stringify(await issuerDocument()), {
            headers: { "content-type": "application/json" },
            status: 200
          }),
        now
      }
    );

    expect(result.status).toBe("Rejected");
    expect(result.findings).toContain(
      "Credential status methods are not yet supported; verification fails closed."
    );
  });
});

function signEs384Jwt(claims: Record<string, unknown>, privateKey: KeyObject) {
  const header = Buffer.from(
    JSON.stringify({ alg: "ES384", kid: "periscan-test", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signable = `${header}.${payload}`;
  const signature = sign("sha384", Buffer.from(signable), {
    dsaEncoding: "ieee-p1363",
    key: privateKey
  }).toString("base64url");
  return `${signable}.${signature}`;
}

describe("NVIDIA detached EAT conformance", () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
  const publicKeyPem = keys.publicKey.export({
    format: "pem",
    type: "spki"
  }) as string;
  const now = new Date("2026-07-15T20:00:00.000Z");
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const nonce = "931d8dd0add203ac3d8b4fbde75e115278";
  const issuer = "NVAT-LOCAL-VERIFIER";

  function bundle(overrides: Record<string, unknown> = {}) {
    const device = signEs384Jwt(
      {
        dbgstat: "disabled",
        eat_nonce: nonce,
        exp: nowSeconds + 600,
        hwmodel: "NVIDIA H100 80GB HBM3",
        iat: nowSeconds,
        iss: issuer,
        measres: "success",
        secboot: true,
        "x-nvidia-gpu-arch-check": true,
        "x-nvidia-gpu-attestation-report-nonce-match": true,
        "x-nvidia-gpu-attestation-report-signature-verified": true,
        "x-nvidia-gpu-driver-rim-signature-verified": true,
        "x-nvidia-gpu-vbios-rim-signature-verified": true,
        ...overrides
      },
      keys.privateKey
    );
    const overall = signEs384Jwt(
      {
        eat_nonce: nonce,
        exp: nowSeconds + 600,
        iat: nowSeconds,
        iss: issuer,
        submods: {
          "GPU-0": ["DIGEST", ["SHA-256", "a".repeat(64)]]
        },
        "x-nvidia-overall-att-result": true,
        "x-nvidia-ver": "3.0"
      },
      keys.privateKey
    );
    return JSON.stringify([
      ["JWT", signEs384Jwt({ exp: nowSeconds + 600 }, keys.privateKey)],
      {
        REMOTE_GPU_CLAIMS: [["JWT", overall], { "GPU-0": ["JWT", device] }]
      }
    ]);
  }

  const input = {
    challengeId: "11111111-1111-4111-8111-111111111111",
    expectedGpuModels: ["H100"],
    expectedIssuer: issuer,
    expectedNonce: nonce,
    maxTokenAgeSeconds: 600,
    provider: "NvidiaConfidentialGPU" as const,
    requireDebugDisabled: true,
    requireSecureBoot: true,
    signedStatement: bundle(),
    workloadId: "confidential-inference-prod"
  };

  it("verifies signed overall and per-GPU claims against tenant policy", () => {
    const result = verifyNvidiaDetachedEatBundle(input, publicKeyPem, now);

    expect(result).toMatchObject({
      claimsVersion: "3.0",
      debugDisabled: true,
      deviceCount: 1,
      findings: [],
      hardwareModels: ["NVIDIA H100 80GB HBM3"],
      secureBoot: true,
      signatureVerified: true
    });
  });

  it("rejects a signed token when device policy claims fail", () => {
    const result = verifyNvidiaDetachedEatBundle(
      {
        ...input,
        signedStatement: bundle({ dbgstat: "enabled", secboot: false })
      },
      publicKeyPem,
      now
    );

    expect(result.signatureVerified).toBe(true);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        "GPU-0 secure boot is not enabled.",
        "GPU-0 debug facilities are not disabled."
      ])
    );
  });
});
