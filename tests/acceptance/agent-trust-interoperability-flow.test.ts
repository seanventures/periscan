import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject
} from "node:crypto";
import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { signableAgentReceipt } from "../../apps/api/src/services/agent-trust.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import type { VerifyAgentSignedReceiptInput } from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function signEs384Jwt(claims: Record<string, unknown>, privateKey: KeyObject) {
  const header = Buffer.from(
    JSON.stringify({ alg: "ES384", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signable = `${header}.${payload}`;
  const signature = sign("sha384", Buffer.from(signable), {
    dsaEncoding: "ieee-p1363",
    key: privateKey
  }).toString("base64url");
  return `${signable}.${signature}`;
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return address.port;
}

describe("agent trust interoperability", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let protocolServer: Server | undefined;
  const originalAnchors = process.env.PERISCAN_ATTESTATION_TRUST_ANCHORS_JSON;

  afterEach(async () => {
    if (protocolServer) {
      await new Promise<void>((resolve, reject) =>
        protocolServer?.close((error) => (error ? reject(error) : resolve()))
      );
      protocolServer = undefined;
    }
    if (originalAnchors === undefined) {
      delete process.env.PERISCAN_ATTESTATION_TRUST_ANCHORS_JSON;
    } else {
      process.env.PERISCAN_ATTESTATION_TRUST_ANCHORS_JSON = originalAnchors;
    }
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "trust-owner",
        "trust-a2a",
        "trust-oss"
      ]);
      await prisma.$disconnect();
    }
  });

  it("persists public A2A 1.0 Agent Card conformance without probing live operations", async () => {
    let protocolPort = 0;
    protocolServer = createServer((request, response) => {
      if (
        request.method !== "GET" ||
        request.url !== "/.well-known/agent-card.json"
      ) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          capabilities: { pushNotifications: false, streaming: true },
          defaultInputModes: ["text/plain"],
          defaultOutputModes: ["application/json"],
          description: "Returns redacted validation proof summaries.",
          name: "Local conformance agent",
          skills: [
            {
              description: "Read a redacted proof summary.",
              id: "read-proof-summary",
              name: "Read proof summary",
              tags: ["security", "evidence"]
            }
          ],
          supportedInterfaces: [
            {
              protocolBinding: "HTTP+JSON",
              protocolVersion: "1.0",
              url: `http://127.0.0.1:${protocolPort}/a2a/v1`
            }
          ],
          version: "1.0.0"
        })
      );
    });
    protocolPort = await listen(protocolServer);

    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "trust-a2a",
        "A2A Conformance Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const registered = await app.inject({
        cookies,
        method: "POST",
        payload: {
          endpointUrl: `http://127.0.0.1:${protocolPort}/.well-known/agent-card.json`,
          name: "Reviewed A2A agent",
          protocol: "A2A",
          trustPolicy: {
            allowedAudience: "periscan-agent-gateway",
            maxCredentialTtlSeconds: 300,
            requireSignedArtifacts: true,
            requireSpiffeIdentity: true
          }
        },
        url: "/api/v1/agent-trust/endpoints"
      });
      expect(registered.statusCode).toBe(201);
      const endpointId = registered.json().agentProtocolEndpointId as string;

      const approved = await app.inject({
        cookies,
        method: "POST",
        payload: {
          allowedCapabilityNames: [],
          reason: "Endpoint ownership and local test transport were reviewed.",
          status: "Approved"
        },
        url: `/api/v1/agent-trust/endpoints/${endpointId}/review`
      });
      expect(approved.statusCode).toBe(200);

      const discovery = await app.inject({
        cookies,
        method: "POST",
        url: `/api/v1/agent-trust/endpoints/${endpointId}/discover`
      });
      expect(discovery.statusCode).toBe(200);
      expect(discovery.json()).toMatchObject({
        a2aConformance: {
          agentName: "Local conformance agent",
          agentVersion: "1.0.0",
          coreOperationsProbe: "NotRun",
          preferredInterface: {
            protocolBinding: "HTTP+JSON",
            protocolVersion: "1.0"
          },
          specification: "A2A 1.0 Agent Card",
          structurallyConformant: true
        },
        capabilities: [{ name: "read-proof-summary" }],
        importedAutomatically: false,
        protocol: "A2A"
      });

      const listed = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/agent-trust/endpoints"
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().items).toContainEqual(
        expect.objectContaining({
          a2aConformance: expect.objectContaining({
            coreOperationsProbe: "NotRun",
            structurallyConformant: true
          }),
          agentProtocolEndpointId: endpointId
        })
      );
    } finally {
      await app.close();
    }
  });

  it("governs an official A2A TCK proof and a Veraison challenge-response result end to end", async () => {
    const nonce = Buffer.alloc(32, 7).toString("base64");
    const expiry = new Date(Date.now() + 5 * 60_000).toISOString();
    let protocolPort = 0;
    let evidenceBytes = 0;
    let remoteSessionDeleted = false;
    protocolServer = createServer((request, response) => {
      if (
        request.method === "GET" &&
        request.url === "/.well-known/agent-card.json"
      ) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            capabilities: { pushNotifications: false, streaming: false },
            defaultInputModes: ["text/plain"],
            defaultOutputModes: ["application/json"],
            description: "A customer-authorized conformance target.",
            name: "Governed A2A target",
            skills: [
              {
                description: "Return a bounded test response.",
                id: "bounded-test",
                name: "Bounded test",
                tags: ["conformance"]
              }
            ],
            supportedInterfaces: [
              {
                protocolBinding: "JSONRPC",
                protocolVersion: "1.0",
                url: `http://127.0.0.1:${protocolPort}/a2a`
              }
            ],
            version: "1.0.0"
          })
        );
        return;
      }
      if (
        request.method === "POST" &&
        request.url === "/challenge-response/v1/newSession?nonceSize=32"
      ) {
        response.writeHead(201, {
          "content-type":
            "application/vnd.veraison.challenge-response-session+json",
          location: `http://127.0.0.1:${protocolPort}/challenge-response/v1/session/test-session`
        });
        response.end(
          JSON.stringify({
            accept: ["application/psa-attestation-token"],
            expiry,
            nonce,
            state: "waiting"
          })
        );
        return;
      }
      if (
        request.method === "POST" &&
        request.url === "/challenge-response/v1/session/test-session"
      ) {
        request.on("data", (chunk) => {
          evidenceBytes += Buffer.byteLength(chunk);
        });
        request.on("end", () => {
          response.writeHead(202, {
            "content-type":
              "application/vnd.veraison.challenge-response-session+json"
          });
          response.end(
            JSON.stringify({
              accept: ["application/psa-attestation-token"],
              expiry,
              nonce,
              state: "processing"
            })
          );
        });
        return;
      }
      if (
        request.method === "GET" &&
        request.url === "/challenge-response/v1/session/test-session"
      ) {
        response.writeHead(200, {
          "content-type":
            "application/vnd.veraison.challenge-response-session+json"
        });
        response.end(
          JSON.stringify({
            accept: ["application/psa-attestation-token"],
            expiry,
            nonce,
            result: {
              claims: {
                deployment: { debug_disabled: true, secure_boot: true }
              },
              is_valid: true
            },
            state: "complete"
          })
        );
        return;
      }
      if (
        request.method === "DELETE" &&
        request.url === "/challenge-response/v1/session/test-session"
      ) {
        remoteSessionDeleted = true;
        response.writeHead(204).end();
        return;
      }
      response.writeHead(404).end();
    });
    protocolPort = await listen(protocolServer);

    const a2aTckExecutor = vi.fn(async () => ({
      compatible: true,
      mayCompatibility: 100,
      mustCompatibility: 100,
      overallCompatibility: 100,
      reportHash: "a".repeat(64),
      requirementResults: [
        {
          errors: [],
          level: "MUST" as const,
          requirementId: "CORE-SEND-001",
          status: "PASS" as const,
          transports: { jsonrpc: "PASS" as const }
        }
      ],
      shouldCompatibility: 100,
      specVersion: "1.0.0",
      toolVersion: "1.0.0.alpha2",
      transportResults: [
        {
          failed: 0,
          passed: 1,
          skipped: 0,
          total: 1,
          transport: "jsonrpc" as const
        }
      ]
    }));
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        a2aTckExecutor,
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "trust-oss",
        "Agent OSS Trust Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const scopeResponse = await app.inject({
        cookies,
        method: "POST",
        payload: { scopeType: "Domain", value: "127.0.0.1" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      const verifiedScope = await app.inject({
        cookies,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifiedScope.statusCode).toBe(200);

      const registered = await app.inject({
        cookies,
        method: "POST",
        payload: {
          endpointUrl: `http://127.0.0.1:${protocolPort}/.well-known/agent-card.json`,
          name: "TCK governed target",
          protocol: "A2A",
          trustPolicy: {
            allowedAudience: "periscan-agent-gateway",
            maxCredentialTtlSeconds: 300,
            requireSignedArtifacts: true,
            requireSpiffeIdentity: true
          }
        },
        url: "/api/v1/agent-trust/endpoints"
      });
      expect(registered.statusCode).toBe(201);
      const endpointId = registered.json().agentProtocolEndpointId as string;
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: {
              allowedCapabilityNames: [],
              reason: "Customer ownership and local test transport reviewed.",
              status: "Approved"
            },
            url: `/api/v1/agent-trust/endpoints/${endpointId}/review`
          })
        ).statusCode
      ).toBe(200);
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            url: `/api/v1/agent-trust/endpoints/${endpointId}/discover`
          })
        ).statusCode
      ).toBe(200);

      const tckRun = await app.inject({
        cookies,
        method: "POST",
        payload: {
          acknowledgeTestTraffic: true,
          authorizationReason:
            "Customer-authorized protocol qualification before production use.",
          level: "must",
          scopeId,
          transports: ["jsonrpc"]
        },
        url: `/api/v1/agent-trust/endpoints/${endpointId}/tck-runs`
      });
      expect(tckRun.statusCode).toBe(201);
      expect(tckRun.json()).toMatchObject({
        compatible: true,
        mustCompatibility: 100,
        reportHash: "a".repeat(64),
        status: "Completed",
        toolVersion: "1.0.0.alpha2"
      });
      expect(a2aTckExecutor).toHaveBeenCalledWith({
        level: "must",
        sutHost: `http://127.0.0.1:${protocolPort}`,
        transports: ["jsonrpc"]
      });

      const createdSession = await app.inject({
        cookies,
        method: "POST",
        payload: {
          authorizationReason:
            "Customer-authorized confidential workload verification.",
          provider: "ArmPSA",
          scopeId,
          verifierUrl: `http://127.0.0.1:${protocolPort}`,
          workloadId: "payments-confidential-worker"
        },
        url: "/api/v1/agent-trust/attestations/veraison/sessions"
      });
      expect(createdSession.statusCode).toBe(201);
      expect(createdSession.json()).toMatchObject({
        acceptedMediaTypes: ["application/psa-attestation-token"],
        nonce,
        provider: "ArmPSA",
        state: "Waiting"
      });
      const veraisonSessionId = createdSession.json()
        .veraisonSessionId as string;
      const evidence = Buffer.from("customer-authorized-psa-evidence");
      const verified = await app.inject({
        cookies,
        method: "POST",
        payload: {
          evidenceBase64: evidence.toString("base64"),
          evidenceMediaType: "application/psa-attestation-token",
          expectedClaims: {
            "deployment.debug_disabled": true,
            "deployment.secure_boot": true
          },
          veraisonSessionId
        },
        url: "/api/v1/agent-trust/attestations/veraison/verify"
      });
      expect(verified.statusCode).toBe(201);
      expect(verified.json()).toMatchObject({
        attestation: {
          outcome: "Verified",
          provider: "ArmPSA",
          signatureVerified: true,
          verifierType: "Veraison",
          workloadId: "payments-confidential-worker"
        },
        session: { nonce: null, state: "Complete" }
      });
      expect(evidenceBytes).toBe(evidence.length);
      expect(remoteSessionDeleted).toBe(true);
      const attestationId = verified.json().attestation
        .confidentialAttestationId as string;

      const assurance = await app.inject({
        cookies,
        method: "POST",
        payload: {
          authorizationReason:
            "Qualify the approved confidential workload for release.",
          escalationReference: "RUNBOOK-TEE-001",
          evidenceMediaType: "application/psa-attestation-token",
          expectedMeasurement: null,
          expectedRegion: null,
          maxAttestationAgeMinutes: 10,
          policyReference: "CC-POLICY-004",
          provider: "ArmPSA",
          qualificationValidityMinutes: 60,
          requireDebugDisabled: false,
          requireSecureBoot: false,
          scopeId,
          supportOwner: "Confidential Compute SRE",
          verifierType: "Veraison",
          workloadId: "payments-confidential-worker"
        },
        url: "/api/v1/agent-trust/tee-assurance"
      });
      expect(assurance.statusCode).toBe(201);
      expect(assurance.json()).toMatchObject({
        latestDecision: null,
        policyReference: "CC-POLICY-004",
        status: "AwaitingEvidence"
      });
      const assuranceId = assurance.json().teeAssuranceRequirementId as string;
      const qualified = await app.inject({
        cookies,
        method: "POST",
        payload: {
          attestationId,
          decisionReason:
            "Release review accepted the exact fresh verifier receipt.",
          decisionReference: "TEE-REVIEW-001"
        },
        url: `/api/v1/agent-trust/tee-assurance/${assuranceId}/evaluate`
      });
      expect(qualified.statusCode).toBe(201);
      expect(qualified.json()).toMatchObject({
        latestDecision: {
          attestationId,
          decisionReference: "TEE-REVIEW-001",
          decisionType: "Qualified",
          findings: [],
          qualifiedUntil: expect.any(String)
        },
        status: "Qualified"
      });
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: {
              attestationId,
              decisionReason:
                "Attempt to reuse an already decided verifier receipt.",
              decisionReference: "TEE-REVIEW-REPLAY"
            },
            url: `/api/v1/agent-trust/tee-assurance/${assuranceId}/evaluate`
          })
        ).statusCode
      ).toBe(409);
      const revoked = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decisionReason:
            "Release was withdrawn after the workload deployment changed.",
          decisionReference: "TEE-INCIDENT-001"
        },
        url: `/api/v1/agent-trust/tee-assurance/${assuranceId}/revoke`
      });
      expect(revoked.statusCode).toBe(201);
      expect(revoked.json()).toMatchObject({
        latestDecision: {
          attestationId,
          decisionReference: "TEE-INCIDENT-001",
          decisionType: "Revoked",
          qualifiedUntil: null
        },
        status: "Revoked"
      });
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: {
              decisionReason: "A second revocation must not rewrite history.",
              decisionReference: "TEE-INCIDENT-REPLAY"
            },
            url: `/api/v1/agent-trust/tee-assurance/${assuranceId}/revoke`
          })
        ).statusCode
      ).toBe(409);

      const strictAssurance = await app.inject({
        cookies,
        method: "POST",
        payload: {
          authorizationReason:
            "Require a normalized secure boot claim before qualification.",
          escalationReference: "RUNBOOK-TEE-001",
          evidenceMediaType: "application/psa-attestation-token",
          maxAttestationAgeMinutes: 10,
          policyReference: "CC-POLICY-SECURE-BOOT",
          provider: "ArmPSA",
          qualificationValidityMinutes: 60,
          requireDebugDisabled: false,
          requireSecureBoot: true,
          scopeId,
          supportOwner: "Confidential Compute SRE",
          verifierType: "Veraison",
          workloadId: "payments-confidential-worker"
        },
        url: "/api/v1/agent-trust/tee-assurance"
      });
      expect(strictAssurance.statusCode).toBe(201);
      const rejected = await app.inject({
        cookies,
        method: "POST",
        payload: {
          attestationId,
          decisionReason:
            "Evaluate the receipt against the stricter secure boot policy.",
          decisionReference: "TEE-REVIEW-STRICT-001"
        },
        url: `/api/v1/agent-trust/tee-assurance/${strictAssurance.json().teeAssuranceRequirementId}/evaluate`
      });
      expect(rejected.statusCode).toBe(201);
      expect(rejected.json()).toMatchObject({
        latestDecision: {
          decisionType: "Rejected",
          findings: ["Secure boot is required but was not proven."],
          qualifiedUntil: null
        },
        status: "Rejected"
      });

      const qualificationDecision =
        await prisma.teeAssuranceDecision.findFirstOrThrow({
          where: {
            decisionType: "Qualified",
            teeAssuranceRequirementId: assuranceId
          }
        });
      await expect(
        prisma.teeAssuranceDecision.update({
          data: { decisionReference: "MUTATED" },
          where: {
            teeAssuranceDecisionId: qualificationDecision.teeAssuranceDecisionId
          }
        })
      ).rejects.toThrow(/immutable/u);

      const assuranceWorkspace = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/agent-trust/tee-assurance"
      });
      expect(assuranceWorkspace.statusCode).toBe(200);
      expect(assuranceWorkspace.json()).toMatchObject({
        qualificationRulesVersion: "1.0"
      });
      expect(assuranceWorkspace.json().assurances).toHaveLength(2);
      expect(assuranceWorkspace.json().attestations).toContainEqual(
        expect.objectContaining({ confidentialAttestationId: attestationId })
      );

      const sessionRow = await prisma.veraisonAttestationSession.findUnique({
        where: { veraisonSessionId }
      });
      expect(sessionRow).toMatchObject({
        evidenceHash: createHash("sha256").update(evidence).digest("hex"),
        state: "Complete",
        tenantId
      });
      expect(await prisma.policyDecision.count({ where: { tenantId } })).toBe(
        4
      );
      expect(
        await prisma.auditEvent.count({
          where: {
            action: {
              in: [
                "policy_decision",
                "module_executed",
                "verification_run",
                "tee_assurance_requirement_created",
                "tee_assurance_evaluated",
                "tee_assurance_revoked"
              ]
            },
            tenantId
          }
        })
      ).toBeGreaterThanOrEqual(9);
    } finally {
      await app.close();
    }
  });

  it("reviews outbound MCP imports, rejects receipt replay, tracks A2A state, and verifies TEE and NVIDIA EAT claims", async () => {
    protocolServer = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        const message = JSON.parse(body) as { id: string };
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            id: message.id,
            jsonrpc: "2.0",
            result: {
              tools: [
                {
                  description: "Read a redacted validation summary.",
                  inputSchema: {
                    additionalProperties: false,
                    properties: { findingId: { type: "string" } },
                    required: ["findingId"],
                    type: "object"
                  },
                  name: "read_validation_summary"
                }
              ]
            }
          })
        );
      });
    });
    const protocolPort = await listen(protocolServer);

    const receiptKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const attestationKeys = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const nvidiaAttestationKeys = generateKeyPairSync("ec", {
      namedCurve: "secp384r1"
    });
    process.env.PERISCAN_ATTESTATION_TRUST_ANCHORS_JSON = JSON.stringify({
      AWSNitro: attestationKeys.publicKey.export({
        format: "pem",
        type: "spki"
      }),
      NvidiaConfidentialGPU: nvidiaAttestationKeys.publicKey.export({
        format: "pem",
        type: "spki"
      })
    });

    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "trust-owner",
        "Agent Trust Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const register = await app.inject({
        cookies,
        method: "POST",
        payload: {
          endpointUrl: `http://127.0.0.1:${protocolPort}/mcp`,
          name: "Reviewed local MCP",
          protocol: "MCP",
          publicKeyPem: receiptKeys.publicKey.export({
            format: "pem",
            type: "spki"
          }),
          trustPolicy: {
            allowedAudience: "periscan-agent-gateway",
            maxCredentialTtlSeconds: 300,
            requireSignedArtifacts: true,
            requireSpiffeIdentity: true
          }
        },
        url: "/api/v1/agent-trust/endpoints"
      });
      expect(register.statusCode).toBe(201);
      expect(register.json()).toMatchObject({
        allowedCapabilityNames: [],
        protocol: "MCP",
        status: "PendingReview"
      });
      const endpointId = register.json().agentProtocolEndpointId as string;

      const deniedDiscovery = await app.inject({
        cookies,
        method: "POST",
        url: `/api/v1/agent-trust/endpoints/${endpointId}/discover`
      });
      expect(deniedDiscovery.statusCode).toBe(409);

      const approve = await app.inject({
        cookies,
        method: "POST",
        payload: {
          allowedCapabilityNames: [],
          reason: "Endpoint ownership and transport were reviewed.",
          status: "Approved"
        },
        url: `/api/v1/agent-trust/endpoints/${endpointId}/review`
      });
      expect(approve.statusCode).toBe(200);

      const discovery = await app.inject({
        cookies,
        method: "POST",
        url: `/api/v1/agent-trust/endpoints/${endpointId}/discover`
      });
      expect(discovery.statusCode).toBe(200);
      expect(discovery.json()).toMatchObject({
        importedAutomatically: false,
        capabilities: [{ name: "read_validation_summary" }]
      });

      const importReview = await app.inject({
        cookies,
        method: "POST",
        payload: {
          allowedCapabilityNames: ["read_validation_summary"],
          reason:
            "Schema reviewed; only the read-only summary tool is allowed.",
          status: "Approved"
        },
        url: `/api/v1/agent-trust/endpoints/${endpointId}/review`
      });
      expect(importReview.statusCode).toBe(200);
      expect(importReview.json().allowedCapabilityNames).toEqual([
        "read_validation_summary"
      ]);

      const payloadRedacted = {
        artifactRef: "evidence-pack:pending",
        claim: "Redacted proof artifact"
      };
      const issuedAt = new Date();
      const unsignedReceipt: Omit<VerifyAgentSignedReceiptInput, "signature"> =
        {
          agentProtocolEndpointId: endpointId,
          audience: "periscan-agent-gateway",
          evidenceIds: [],
          expiresAt: new Date(issuedAt.getTime() + 120_000).toISOString(),
          issuedAt: issuedAt.toISOString(),
          nonce: "receipt_nonce_123456789",
          payloadDigest: digest(payloadRedacted),
          receiptKind: "Artifact",
          senderWorkloadId: "spiffe://partner.example/agents/validator"
        };
      const receiptInput: VerifyAgentSignedReceiptInput = {
        ...unsignedReceipt,
        signature: "placeholder-placeholder-placeholder-placeholder"
      };
      receiptInput.signature = sign(
        "sha256",
        signableAgentReceipt(receiptInput),
        receiptKeys.privateKey
      ).toString("base64url");

      const receipt = await app.inject({
        cookies,
        method: "POST",
        payload: receiptInput,
        url: "/api/v1/agent-trust/receipts/verify"
      });
      expect(receipt.statusCode).toBe(201);
      expect(receipt.json().verificationStatus).toBe("Verified");

      const replay = await app.inject({
        cookies,
        method: "POST",
        payload: receiptInput,
        url: "/api/v1/agent-trust/receipts/verify"
      });
      expect(replay.statusCode).toBe(409);
      expect(replay.json().code).toBe("agent_receipt_nonce_replayed");

      const exchange = await app.inject({
        cookies,
        method: "POST",
        payload: {
          agentProtocolEndpointId: endpointId,
          evidenceIds: [],
          idempotencyKey: "artifact:validation-summary:001",
          kind: "Artifact",
          payloadRedacted,
          signedReceiptId: receipt.json().agentSignedReceiptId
        },
        url: "/api/v1/agent-trust/exchange"
      });
      expect(exchange.statusCode).toBe(201);
      expect(exchange.json()).toMatchObject({
        kind: "Artifact",
        state: "Submitted"
      });

      const working = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason: "Artifact entered policy review.",
          state: "Working"
        },
        url: `/api/v1/agent-trust/exchange/${exchange.json().agentExchangeObjectId}/state`
      });
      expect(working.statusCode).toBe(200);
      expect(working.json().state).toBe("Working");

      const lifecycleStream = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/agent-trust/exchange/${exchange.json().agentExchangeObjectId}/events`
      });
      expect(lifecycleStream.statusCode).toBe(200);
      expect(lifecycleStream.headers["content-type"]).toContain(
        "text/event-stream"
      );
      expect(lifecycleStream.body).toContain("event: state");
      expect(lifecycleStream.body).toContain('"state":"Working"');

      const nowSeconds = Math.floor(Date.now() / 1_000);
      const measurement = "b".repeat(64);
      const nonce = "attestation_nonce_123456";
      const header = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" })
      ).toString("base64url");
      const claims = Buffer.from(
        JSON.stringify({
          aud: "periscan-confidential-inference",
          exp: nowSeconds + 300,
          hardwareProtected: true,
          iat: nowSeconds,
          measurement,
          noLog: true,
          nonce,
          region: "us-east-1",
          workloadId: "inference-prod-01"
        })
      ).toString("base64url");
      const statementPayload = `${header}.${claims}`;
      const signedStatement = `${statementPayload}.${sign(
        "RSA-SHA256",
        Buffer.from(statementPayload),
        attestationKeys.privateKey
      ).toString("base64url")}`;

      const attestation = await app.inject({
        cookies,
        method: "POST",
        payload: {
          expectedAudience: "periscan-confidential-inference",
          expectedMeasurement: measurement,
          expectedNonce: nonce,
          expectedRegion: "us-east-1",
          noLogRequired: true,
          provider: "AWSNitro",
          signedStatement,
          workloadId: "inference-prod-01"
        },
        url: "/api/v1/agent-trust/attestations/verify"
      });
      expect(attestation.statusCode).toBe(201);
      expect(attestation.json()).toMatchObject({
        ordinarySignatureIsHardwareAttestation: false,
        outcome: "Verified",
        signatureVerified: true,
        trustAnchorConfigured: true
      });

      const nvidiaChallenge = await app.inject({
        cookies,
        method: "POST",
        payload: {
          provider: "NvidiaConfidentialGPU",
          workloadId: "confidential-inference-h100"
        },
        url: "/api/v1/agent-trust/attestations/challenges"
      });
      expect(nvidiaChallenge.statusCode).toBe(201);
      const nvidiaNonce = nvidiaChallenge.json().nonce as string;

      const nvidiaDeviceToken = signEs384Jwt(
        {
          dbgstat: "disabled",
          eat_nonce: nvidiaNonce,
          exp: nowSeconds + 300,
          hwmodel: "NVIDIA H100 80GB HBM3",
          iat: nowSeconds,
          iss: "NVAT-LOCAL-VERIFIER",
          measres: "success",
          secboot: true,
          "x-nvidia-gpu-arch-check": true,
          "x-nvidia-gpu-attestation-report-nonce-match": true,
          "x-nvidia-gpu-attestation-report-signature-verified": true,
          "x-nvidia-gpu-driver-rim-signature-verified": true,
          "x-nvidia-gpu-vbios-rim-signature-verified": true
        },
        nvidiaAttestationKeys.privateKey
      );
      const nvidiaOverallToken = signEs384Jwt(
        {
          eat_nonce: nvidiaNonce,
          exp: nowSeconds + 300,
          iat: nowSeconds,
          iss: "NVAT-LOCAL-VERIFIER",
          submods: {
            "GPU-0": ["DIGEST", ["SHA-256", "c".repeat(64)]]
          },
          "x-nvidia-overall-att-result": true,
          "x-nvidia-ver": "3.0"
        },
        nvidiaAttestationKeys.privateKey
      );
      const nvidiaBundle = JSON.stringify([
        [
          "JWT",
          signEs384Jwt(
            { exp: nowSeconds + 300 },
            nvidiaAttestationKeys.privateKey
          )
        ],
        {
          LOCAL_GPU_CLAIMS: [
            ["JWT", nvidiaOverallToken],
            { "GPU-0": ["JWT", nvidiaDeviceToken] }
          ]
        }
      ]);

      const nvidiaVerificationPayload = {
        challengeId: nvidiaChallenge.json().challengeId,
        expectedGpuModels: ["H100"],
        expectedIssuer: "NVAT-LOCAL-VERIFIER",
        expectedNonce: nvidiaNonce,
        maxTokenAgeSeconds: 600,
        provider: "NvidiaConfidentialGPU",
        requireDebugDisabled: true,
        requireSecureBoot: true,
        signedStatement: nvidiaBundle,
        workloadId: "confidential-inference-h100"
      };
      const nvidiaAttestation = await app.inject({
        cookies,
        method: "POST",
        payload: nvidiaVerificationPayload,
        url: "/api/v1/agent-trust/attestations/verify"
      });
      expect(nvidiaAttestation.statusCode).toBe(201);
      expect(nvidiaAttestation.json()).toMatchObject({
        claimsVersion: "3.0",
        debugDisabled: true,
        deviceCount: 1,
        findings: [],
        hardwareModels: ["NVIDIA H100 80GB HBM3"],
        ordinarySignatureIsHardwareAttestation: false,
        outcome: "Verified",
        provider: "NvidiaConfidentialGPU",
        secureBoot: true,
        signatureVerified: true,
        trustAnchorConfigured: true
      });
      const replayedNvidiaAttestation = await app.inject({
        cookies,
        method: "POST",
        payload: nvidiaVerificationPayload,
        url: "/api/v1/agent-trust/attestations/verify"
      });
      expect(replayedNvidiaAttestation.statusCode).toBe(409);
      expect(replayedNvidiaAttestation.json().code).toBe(
        "attestation_challenge_invalid"
      );
    } finally {
      await app.close();
    }
  });
});
