"use client";

import { useState } from "react";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { TeeAssuranceDesk } from "./tee-assurance-desk";

const ENDPOINT_TONES: Record<string, StateTone> = {
  Approved: "fixed",
  PendingReview: "approval",
  Revoked: "missed"
};

export function AgentTrustConsole() {
  const endpoints = useApiResource(() => api.listAgentProtocolEndpoints(), []);
  const exchange = useApiResource(() => api.listAgentExchangeObjects(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const tckRuns = useApiResource(() => api.listA2ATckRuns(), []);
  const didProfiles = useApiResource(() => api.listAgentDidTrustProfiles(), []);
  const agentCredentials = useApiResource(
    () => api.listAgentVerifiableCredentials(),
    []
  );
  const veraisonSessions = useApiResource(
    () => api.listVeraisonAttestationSessions(),
    []
  );
  const attestations = useApiResource(
    () => api.listConfidentialAttestations(),
    []
  );
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<"MCP" | "A2A">("MCP");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [audience, setAudience] = useState("periscan-agent-gateway");
  const [publicKeyPem, setPublicKeyPem] = useState("");
  const [requireAgentDidCredential, setRequireAgentDidCredential] =
    useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contractJson, setContractJson] = useState("");
  const [nvidiaBundle, setNvidiaBundle] = useState("");
  const [nvidiaChallengeId, setNvidiaChallengeId] = useState("");
  const [nvidiaIssuer, setNvidiaIssuer] = useState("NVAT-LOCAL-VERIFIER");
  const [nvidiaModel, setNvidiaModel] = useState("H100");
  const [nvidiaNonce, setNvidiaNonce] = useState("");
  const [nvidiaWorkload, setNvidiaWorkload] = useState("");
  const [trustScopeId, setTrustScopeId] = useState("");
  const [tckEndpointId, setTckEndpointId] = useState("");
  const [tckLevel, setTckLevel] = useState<"all" | "must" | "should" | "may">(
    "must"
  );
  const [tckTransports, setTckTransports] = useState<
    Array<"grpc" | "jsonrpc" | "http_json">
  >(["jsonrpc", "http_json"]);
  const [tckReason, setTckReason] = useState(
    "Customer-authorized interoperability qualification before production use."
  );
  const [tckAcknowledged, setTckAcknowledged] = useState(false);
  const [veraisonUrl, setVeraisonUrl] = useState("");
  const [veraisonProvider, setVeraisonProvider] = useState<
    "ArmPSA" | "ArmCCA" | "AMDSEVSNP" | "TPM"
  >("ArmCCA");
  const [veraisonWorkload, setVeraisonWorkload] = useState("");
  const [veraisonReason, setVeraisonReason] = useState(
    "Customer-authorized confidential workload attestation verification."
  );
  const [veraisonSessionId, setVeraisonSessionId] = useState("");
  const [veraisonNonce, setVeraisonNonce] = useState("");
  const [veraisonAcceptedTypes, setVeraisonAcceptedTypes] = useState<string[]>(
    []
  );
  const [veraisonMediaType, setVeraisonMediaType] = useState("");
  const [veraisonEvidence, setVeraisonEvidence] = useState("");
  const [veraisonExpectedClaims, setVeraisonExpectedClaims] = useState("{}");
  const [didEndpointId, setDidEndpointId] = useState("");
  const [didSubject, setDidSubject] = useState("");
  const [didIssuer, setDidIssuer] = useState("");
  const [didCredentialTypes, setDidCredentialTypes] = useState(
    "AgentDelegationCredential"
  );
  const [didReason, setDidReason] = useState(
    "Customer-approved cross-organization agent identity delegation."
  );
  const [didProfileId, setDidProfileId] = useState("");
  const [credentialJwt, setCredentialJwt] = useState("");
  const [contractResult, setContractResult] = useState<{
    compatible: boolean;
    checks: Array<{
      checkId: string;
      message: string;
      status: "Pass" | "Fail";
    }>;
  } | null>(null);

  async function runAction(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      await endpoints.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The trust action failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function register() {
    if (!name.trim() || !endpointUrl.trim() || !audience.trim()) return;
    await runAction("register", async () => {
      await api.registerAgentProtocolEndpoint({
        endpointUrl: endpointUrl.trim(),
        name: name.trim(),
        protocol,
        publicKeyPem: publicKeyPem.trim() || null,
        trustPolicy: {
          allowedAudience: audience.trim(),
          maxCredentialTtlSeconds: 300,
          requireAgentDidCredential,
          requireSignedArtifacts: true,
          requireSpiffeIdentity: true
        }
      });
      setName("");
      setEndpointUrl("");
      setPublicKeyPem("");
      setMessage(
        "Endpoint registered in Pending review; no outbound call was made."
      );
    });
  }

  async function validateContract() {
    setBusy("contract");
    setError(null);
    setContractResult(null);
    try {
      const parsed = JSON.parse(contractJson) as Parameters<
        typeof api.validateExtensionCompatibility
      >[0];
      setContractResult(await api.validateExtensionCompatibility(parsed));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The extension contract is invalid."
      );
    } finally {
      setBusy(null);
    }
  }

  async function generateNvidiaNonce() {
    if (!nvidiaWorkload.trim()) return;
    setBusy("nvidia-challenge");
    setError(null);
    setMessage(null);
    try {
      const challenge = await api.createConfidentialAttestationChallenge({
        provider: "NvidiaConfidentialGPU",
        workloadId: nvidiaWorkload.trim()
      });
      setNvidiaChallengeId(challenge.challengeId);
      setNvidiaNonce(challenge.nonce);
      setMessage(
        `One-use NVIDIA challenge created; it expires at ${new Date(challenge.expiresAt).toLocaleTimeString()}.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The NVIDIA challenge could not be created."
      );
    } finally {
      setBusy(null);
    }
  }

  async function verifyNvidiaBundle() {
    if (
      !nvidiaBundle.trim() ||
      !nvidiaChallengeId ||
      !nvidiaIssuer.trim() ||
      !nvidiaNonce.trim() ||
      !nvidiaWorkload.trim()
    )
      return;
    setBusy("nvidia-attestation");
    setError(null);
    setMessage(null);
    try {
      const result = await api.verifyConfidentialAttestation({
        challengeId: nvidiaChallengeId,
        expectedGpuModels: nvidiaModel.trim() ? [nvidiaModel.trim()] : [],
        expectedIssuer: nvidiaIssuer.trim(),
        expectedNonce: nvidiaNonce.trim(),
        maxTokenAgeSeconds: 600,
        provider: "NvidiaConfidentialGPU",
        requireDebugDisabled: true,
        requireSecureBoot: true,
        signedStatement: nvidiaBundle.trim(),
        workloadId: nvidiaWorkload.trim()
      });
      await attestations.refetch();
      setNvidiaBundle("");
      setNvidiaChallengeId("");
      setNvidiaNonce("");
      setMessage(
        result.outcome === "Verified"
          ? `Verified ${result.deviceCount} NVIDIA GPU attestation token${result.deviceCount === 1 ? "" : "s"}.`
          : `NVIDIA attestation recorded as ${result.outcome}; review the policy findings.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The NVIDIA attestation could not be verified."
      );
    } finally {
      setBusy(null);
    }
  }

  function toggleTckTransport(transport: "grpc" | "jsonrpc" | "http_json") {
    setTckTransports((current) =>
      current.includes(transport)
        ? current.filter((item) => item !== transport)
        : [...current, transport]
    );
  }

  async function runOfficialTck() {
    if (
      !tckEndpointId ||
      !trustScopeId ||
      tckTransports.length === 0 ||
      !tckReason.trim() ||
      !tckAcknowledged
    )
      return;
    setBusy("a2a-tck");
    setError(null);
    setMessage(null);
    try {
      const run = await api.runA2ATck(tckEndpointId, {
        acknowledgeTestTraffic: true,
        authorizationReason: tckReason.trim(),
        level: tckLevel,
        scopeId: trustScopeId,
        transports: tckTransports
      });
      await tckRuns.refetch();
      setTckAcknowledged(false);
      setMessage(
        run.status === "Completed"
          ? run.compatible
            ? `Official A2A TCK completed: all exercised MUST requirements passed (${run.mustCompatibility?.toFixed(1) ?? "—"}%).`
            : `Official A2A TCK completed with proof gaps; review failed or untested MUST requirements.`
          : `A2A TCK run recorded as ${run.status}; review the run evidence.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The official A2A TCK could not be run."
      );
    } finally {
      setBusy(null);
    }
  }

  async function createVeraisonSession() {
    if (
      !trustScopeId ||
      !veraisonUrl.trim() ||
      !veraisonWorkload.trim() ||
      !veraisonReason.trim()
    )
      return;
    setBusy("veraison-session");
    setError(null);
    setMessage(null);
    try {
      const session = await api.createVeraisonAttestationSession({
        authorizationReason: veraisonReason.trim(),
        provider: veraisonProvider,
        scopeId: trustScopeId,
        verifierUrl: veraisonUrl.trim(),
        workloadId: veraisonWorkload.trim()
      });
      setVeraisonSessionId(session.veraisonSessionId);
      setVeraisonNonce(session.nonce ?? "");
      setVeraisonAcceptedTypes(session.acceptedMediaTypes);
      setVeraisonMediaType(session.acceptedMediaTypes[0] ?? "");
      await veraisonSessions.refetch();
      setMessage(
        `Veraison challenge created. Collect ${session.provider} evidence with this nonce before ${new Date(session.expiresAt).toLocaleTimeString()}.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Veraison session could not be created."
      );
    } finally {
      setBusy(null);
    }
  }

  async function verifyWithVeraison() {
    if (!veraisonSessionId || !veraisonMediaType || !veraisonEvidence.trim())
      return;
    setBusy("veraison-verify");
    setError(null);
    setMessage(null);
    try {
      const parsedClaims = JSON.parse(veraisonExpectedClaims || "{}") as Record<
        string,
        string | number | boolean
      >;
      if (
        !parsedClaims ||
        Array.isArray(parsedClaims) ||
        typeof parsedClaims !== "object"
      ) {
        throw new Error("Expected claims must be a JSON object.");
      }
      const result = await api.verifyVeraisonAttestation({
        evidenceBase64: veraisonEvidence.replace(/\s+/gu, ""),
        evidenceMediaType: veraisonMediaType,
        expectedClaims: parsedClaims,
        veraisonSessionId
      });
      await Promise.all([attestations.refetch(), veraisonSessions.refetch()]);
      setVeraisonEvidence("");
      setVeraisonNonce("");
      setMessage(
        result.attestation.outcome === "Verified"
          ? "Veraison verified the nonce-bound evidence and every expected claim matched."
          : "Veraison verification was recorded as rejected; review the normalized findings."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Veraison could not verify the evidence."
      );
    } finally {
      setBusy(null);
    }
  }

  async function establishDidTrust() {
    const allowedCredentialTypes = didCredentialTypes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (
      !didEndpointId ||
      !trustScopeId ||
      !didSubject.trim() ||
      !didIssuer.trim() ||
      allowedCredentialTypes.length === 0 ||
      !didReason.trim()
    )
      return;
    const endpoint = (endpoints.data ?? []).find(
      (item) => item.agentProtocolEndpointId === didEndpointId
    );
    if (!endpoint) return;
    setBusy("did-profile");
    setError(null);
    setMessage(null);
    try {
      const profile = await api.createAgentDidTrustProfile({
        agentProtocolEndpointId: didEndpointId,
        allowedCredentialTypes,
        authorizationReason: didReason.trim(),
        expectedAudience: endpoint.trustPolicy.allowedAudience,
        issuerDid: didIssuer.trim(),
        scopeId: trustScopeId,
        subjectDid: didSubject.trim()
      });
      setDidProfileId(profile.agentDidTrustProfileId);
      await didProfiles.refetch();
      setMessage(
        "AgentDID trust established from live did:web documents. Only normalized identifiers and document hashes were retained."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AgentDID trust could not be established."
      );
    } finally {
      setBusy(null);
    }
  }

  async function verifyCredential() {
    if (!didProfileId || !credentialJwt.trim()) return;
    setBusy("did-credential");
    setError(null);
    setMessage(null);
    try {
      const credential = await api.verifyAgentVerifiableCredential({
        credentialJwt: credentialJwt.trim(),
        profileId: didProfileId
      });
      setCredentialJwt("");
      await agentCredentials.refetch();
      setMessage(
        credential.status === "Verified"
          ? "Credential verified and bound to the reviewed endpoint, SPIFFE workload, audience, validity window, and capability subset."
          : "Credential was rejected and normalized findings were added to the trust ledger."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The agent credential could not be verified."
      );
    } finally {
      setBusy(null);
    }
  }

  async function refreshDidProfile(profileId: string) {
    await runAction(`did-refresh-${profileId}`, async () => {
      await api.refreshAgentDidTrustProfile(profileId, {
        reason: "Operator-requested DID document and key rotation check."
      });
      await Promise.all([didProfiles.refetch(), agentCredentials.refetch()]);
      setMessage(
        "DID documents refreshed. Any detected key change revoked previously verified credentials."
      );
    });
  }

  async function revokeDidProfile(profileId: string) {
    await runAction(`did-revoke-${profileId}`, async () => {
      await api.revokeAgentDidTrustProfile(profileId, {
        reason: "Tenant operator revoked cross-organization agent delegation."
      });
      await Promise.all([didProfiles.refetch(), agentCredentials.refetch()]);
      if (didProfileId === profileId) setDidProfileId("");
      setMessage("AgentDID trust and every active credential were revoked.");
    });
  }

  const verifiedScopes = (scopes.data ?? []).filter(
    (scope) => scope.verificationStatus === "Verified"
  );
  const didReadyEndpoints = (endpoints.data ?? []).filter(
    (endpoint) =>
      endpoint.protocol === "A2A" &&
      endpoint.status === "Approved" &&
      endpoint.a2aConformance?.structurallyConformant &&
      endpoint.allowedCapabilityNames.length > 0
  );
  const selectedDidProfile = (didProfiles.data ?? []).find(
    (profile) => profile.agentDidTrustProfileId === didProfileId
  );

  return (
    <Panel>
      <PanelHeader title="Agent trust & interoperability" />
      <div className="border-b border-line px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["1", "Review endpoint", "No connection before tenant approval"],
            ["2", "Discover", "Schemas are hashed, never auto-imported"],
            ["3", "Import allowlist", "Only named capabilities can be used"],
            ["4", "Verify exchange", "SPIFFE, signature, nonce, TTL, evidence"]
          ].map(([number, title, copy]) => (
            <div key={number} className="flex gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/10 font-mono text-[10px] text-brand">
                {number}
              </span>
              <div>
                <p className="text-[12px] font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-[10.5px] leading-4 text-subtle">
                  {copy}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div
          className="mt-3 rounded-control border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
          data-testid="execution-integrity-honesty-panel"
        >
          <p className="font-semibold text-ink">
            Execution integrity honesty (matrix #47)
          </p>
          <p className="mt-1">
            Periscan is a{" "}
            <strong className="text-ink">verifier</strong>: evidence-chain
            hashes, flight-recorder seals, and agent signed receipts are product
            paths. Customer-supplied TEE/H100 attestation can be qualified via
            Veraison — Periscan does{" "}
            <strong className="text-ink">not</strong> host workloads inside a
            TEE/enclave.
          </p>
          <p className="mt-1 font-mono text-[11px] text-subtle">
            GET /api/v1/execution-integrity/honesty · POST
            /api/v1/agent-trust/receipts/verify
          </p>
        </div>
        <div
          className="mt-3 rounded-control border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
          data-testid="partner-capability-honesty-panel"
        >
          <p className="font-semibold text-ink">
            Partner residual honesty (matrix #2 / #26 / #28 / #38 / #51)
          </p>
          <p className="mt-1">
            A2A artifact exchange and AgentDID trust profiles are real product
            paths with tenant review, typed artifacts, and receipt binding.
            Leading joint-customer interchange and federation remain residual.
            Dark web, OT/ICS packs, and crowdsourced HITL stay{" "}
            <strong className="text-ink">ExternallyGated</strong> — never invent
            partners.
          </p>
          <p className="mt-1 font-mono text-[11px] text-subtle">
            GET /api/v1/partner-capabilities/honesty
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas px-4 py-3">
        <div className="min-w-[15rem] flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            Authorization context
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            Active validation and remote attestation are bound to one verified
            customer scope and an audited policy decision.
          </p>
        </div>
        <select
          aria-label="Verified authorization scope"
          value={trustScopeId}
          onChange={(event) => setTrustScopeId(event.target.value)}
          className="min-w-[17rem] rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
        >
          <option value="">Select verified scope…</option>
          {verifiedScopes.map((scope) => (
            <option key={scope.scopeId} value={scope.scopeId}>
              {scope.scopeType} · {scope.value}
            </option>
          ))}
        </select>
        <StateBadge tone={trustScopeId ? "fixed" : "approval"} dot={false}>
          {trustScopeId ? "Scope bound" : "Scope required"}
        </StateBadge>
      </div>

      <section className="border-b border-line">
        <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-[16rem] flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-brand">
              Identity chain of custody
            </p>
            <h3 className="mt-1 text-sm font-medium text-ink">
              Cross-organization AgentDID delegation
            </h3>
            <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted">
              Resolve a tenant-approved did:web issuer and agent subject, then
              verify short-lived W3C VC 2.0 JOSE credentials before accepting
              signed agent receipts. Trust is scoped to one reviewed A2A
              endpoint; DID control alone never makes an issuer trusted.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StateBadge tone="neutral" dot={false}>
              DID Core 1.0
            </StateBadge>
            <StateBadge tone="neutral" dot={false}>
              VC 2.0 · vc+jwt
            </StateBadge>
            <StateBadge tone="approval" dot={false}>
              did:web only
            </StateBadge>
          </div>
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink">
                  1 · Establish issuer trust
                </p>
                <p className="mt-1 text-[10.5px] leading-4 text-subtle">
                  Requires a verified scope plus an approved, structurally
                  conformant A2A endpoint with reviewed capabilities.
                </p>
              </div>
              <StateBadge
                tone={didReadyEndpoints.length > 0 ? "fixed" : "approval"}
                dot={false}
              >
                {didReadyEndpoints.length > 0
                  ? `${didReadyEndpoints.length} ready`
                  : "Endpoint required"}
              </StateBadge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                aria-label="A2A endpoint for AgentDID trust"
                value={didEndpointId}
                onChange={(event) => setDidEndpointId(event.target.value)}
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink sm:col-span-2"
              >
                <option value="">Select qualified A2A endpoint…</option>
                {didReadyEndpoints.map((endpoint) => (
                  <option
                    key={endpoint.agentProtocolEndpointId}
                    value={endpoint.agentProtocolEndpointId}
                  >
                    {endpoint.name} · {endpoint.allowedCapabilityNames.length}{" "}
                    capabilities
                  </option>
                ))}
              </select>
              <input
                aria-label="Agent subject DID"
                value={didSubject}
                onChange={(event) => setDidSubject(event.target.value)}
                placeholder="did:web:agent.partner.example"
                className="rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[10.5px] text-ink placeholder:text-subtle"
              />
              <input
                aria-label="Credential issuer DID"
                value={didIssuer}
                onChange={(event) => setDidIssuer(event.target.value)}
                placeholder="did:web:issuer.partner.example"
                className="rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[10.5px] text-ink placeholder:text-subtle"
              />
              <input
                aria-label="Allowed credential types"
                value={didCredentialTypes}
                onChange={(event) => setDidCredentialTypes(event.target.value)}
                placeholder="AgentDelegationCredential"
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-[10.5px] text-ink placeholder:text-subtle sm:col-span-2"
              />
              <input
                aria-label="AgentDID authorization reason"
                value={didReason}
                onChange={(event) => setDidReason(event.target.value)}
                placeholder="Customer authorization reason"
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-[10.5px] text-ink placeholder:text-subtle sm:col-span-2"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-md text-[10px] leading-4 text-subtle">
                Live HTTPS resolution is SSRF-bounded. Periscan keeps document
                hashes and resolution URLs—not raw DID documents.
              </p>
              <button
                type="button"
                onClick={establishDidTrust}
                disabled={
                  busy !== null ||
                  !trustScopeId ||
                  !didEndpointId ||
                  !didSubject.trim() ||
                  !didIssuer.trim() ||
                  !didCredentialTypes.trim() ||
                  !didReason.trim()
                }
                className={buttonClassName({ variant: "primary" })}
              >
                {busy === "did-profile" ? "Resolving DIDs…" : "Establish trust"}
              </button>
            </div>

            {didProfiles.loading ? (
              <LoadingSkeleton rows={2} className="p-0 pt-3" />
            ) : (didProfiles.data ?? []).length === 0 ? (
              <p className="mt-3 border-t border-line pt-3 text-[10.5px] text-subtle">
                No cross-organization identity profile has been approved.
              </p>
            ) : (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-subtle">
                  Trust profiles
                </p>
                <div className="mt-2 divide-y divide-line border-y border-line">
                  {(didProfiles.data ?? []).map((profile) => (
                    <div
                      key={profile.agentDidTrustProfileId}
                      className={cn(
                        "py-2.5",
                        didProfileId === profile.agentDidTrustProfileId &&
                          "bg-brand/[0.035]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setDidProfileId(profile.agentDidTrustProfileId)
                        }
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-[10px] text-ink">
                            {profile.subjectDid}
                          </span>
                          <StateBadge
                            className="ml-auto"
                            tone={
                              profile.status === "Active" ? "fixed" : "missed"
                            }
                            dot={false}
                          >
                            {profile.status}
                          </StateBadge>
                        </div>
                        <p className="mt-1 truncate font-mono text-[9px] text-subtle">
                          issuer {profile.issuerDid} · keyset{" "}
                          {profile.issuerDidDocumentHash.slice(0, 12)}
                        </p>
                      </button>
                      {profile.status === "Active" ? (
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              refreshDidProfile(profile.agentDidTrustProfileId)
                            }
                            disabled={busy !== null}
                            className={buttonClassName({
                              size: "sm",
                              variant: "secondary"
                            })}
                          >
                            {busy ===
                            `did-refresh-${profile.agentDidTrustProfileId}`
                              ? "Checking…"
                              : "Check key rotation"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              revokeDidProfile(profile.agentDidTrustProfileId)
                            }
                            disabled={busy !== null}
                            className={buttonClassName({
                              size: "sm",
                              variant: "ghost"
                            })}
                          >
                            Revoke
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink">
                  2 · Verify delegated identity
                </p>
                <p className="mt-1 text-[10.5px] leading-4 text-subtle">
                  Paste the compact vc+jwt once. Raw credentials are discarded
                  after verification; the ledger keeps normalized claims,
                  findings, and cryptographic hashes.
                </p>
              </div>
              <StateBadge
                tone={
                  selectedDidProfile?.status === "Active" ? "fixed" : "approval"
                }
                dot={false}
              >
                {selectedDidProfile?.status === "Active"
                  ? "Profile selected"
                  : "Select profile"}
              </StateBadge>
            </div>
            {selectedDidProfile?.status === "Active" ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-y border-line py-2 text-[9.5px]">
                  <span className="text-subtle">Audience</span>
                  <span className="truncate text-right font-mono text-ink">
                    {selectedDidProfile.expectedAudience}
                  </span>
                  <span className="text-subtle">Endpoint origin</span>
                  <span className="truncate text-right font-mono text-ink">
                    {selectedDidProfile.expectedEndpointOrigin}
                  </span>
                  <span className="text-subtle">Credential type</span>
                  <span className="truncate text-right text-ink">
                    {selectedDidProfile.allowedCredentialTypes.join(", ")}
                  </span>
                </div>
                <textarea
                  aria-label="Agent verifiable credential JWT"
                  value={credentialJwt}
                  onChange={(event) => setCredentialJwt(event.target.value)}
                  rows={5}
                  placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDp3ZWI6Li4uIiwidHlwIjoidmMrand0In0.…"
                  className="mt-3 w-full resize-y rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[9.5px] text-ink placeholder:text-subtle"
                />
                {busy === "did-credential" ? (
                  <div
                    aria-live="polite"
                    className="mt-2 grid gap-1.5 border-y border-brand/20 py-2.5"
                  >
                    {[
                      ["Parse JOSE envelope", "Complete"],
                      ["Resolve issuer DID", "Live"],
                      ["Verify assertion key", "Waiting"],
                      ["Bind delegation", "Waiting"]
                    ].map(([label, state], index) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 text-[10.5px]"
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            index === 0
                              ? "bg-fixed"
                              : index === 1
                                ? "animate-pulse bg-brand"
                                : "bg-line"
                          )}
                        />
                        <span className="text-ink">{label}</span>
                        <span className="ml-auto font-mono text-[9px] text-subtle">
                          {state}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="max-w-md text-[10px] leading-4 text-subtle">
                    Fails closed for unsupported credentialStatus methods,
                    private JWK material, key mismatch, excess capability, or
                    receipt TTL outside the credential window.
                  </p>
                  <button
                    type="button"
                    onClick={verifyCredential}
                    disabled={busy !== null || !credentialJwt.trim()}
                    className={buttonClassName({ variant: "primary" })}
                  >
                    {busy === "did-credential"
                      ? "Verifying chain…"
                      : "Verify credential"}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 border-y border-line py-5 text-center text-[10.5px] text-subtle">
                Select an active profile to inspect its exact trust boundary and
                verify a credential.
              </p>
            )}

            <div className="mt-3 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-subtle">
                  Credential trust ledger
                </p>
                <span className="font-mono text-[9px] text-subtle">
                  {
                    (agentCredentials.data ?? []).filter(
                      (item) =>
                        !didProfileId ||
                        item.agentDidTrustProfileId === didProfileId
                    ).length
                  }{" "}
                  result(s)
                </span>
              </div>
              {(agentCredentials.data ?? []).filter(
                (item) =>
                  !didProfileId || item.agentDidTrustProfileId === didProfileId
              ).length === 0 ? (
                <p className="mt-2 text-[10.5px] text-subtle">
                  No credential result exists for this trust profile.
                </p>
              ) : (
                <div className="mt-2 divide-y divide-line border-y border-line">
                  {(agentCredentials.data ?? [])
                    .filter(
                      (item) =>
                        !didProfileId ||
                        item.agentDidTrustProfileId === didProfileId
                    )
                    .slice(0, 6)
                    .map((credential) => (
                      <div
                        key={credential.agentVerifiableCredentialId}
                        className="py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[10.5px] text-ink">
                            {credential.workloadId ?? "Unbound workload"}
                          </span>
                          <StateBadge
                            className="ml-auto"
                            tone={
                              credential.status === "Verified"
                                ? "fixed"
                                : credential.status === "Expired"
                                  ? "inconclusive"
                                  : "missed"
                            }
                            dot={false}
                          >
                            {credential.status}
                          </StateBadge>
                        </div>
                        <p className="mt-1 font-mono text-[9px] text-subtle">
                          {credential.algorithm ?? "alg unavailable"} · claims{" "}
                          {credential.claimsHash.slice(0, 10)} · until{" "}
                          {credential.validUntil
                            ? new Date(
                                credential.validUntil
                              ).toLocaleTimeString()
                            : "unproven"}
                        </p>
                        {credential.allowedCapabilities.length > 0 ? (
                          <p className="mt-1 text-[9.5px] text-muted">
                            {credential.allowedCapabilities.join(", ")}
                          </p>
                        ) : null}
                        {credential.findings.length > 0 ? (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-[9.5px] text-missed">
                              {credential.findings.length} trust finding
                              {credential.findings.length === 1 ? "" : "s"}
                            </summary>
                            <ul className="mt-1 space-y-1 pl-3 text-[9.5px] leading-4 text-subtle">
                              {credential.findings.map((finding) => (
                                <li key={finding}>{finding}</li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="border-b border-line lg:border-b-0 lg:border-r">
          <div className="border-b border-line p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink">
                  Governed MCP / A2A endpoints
                </h3>
                <p className="mt-1 text-[12px] text-muted">
                  HTTPS targets are SSRF-checked. Discovery is outbound and
                  bounded; discovered tools or skills still require explicit
                  import review.
                </p>
              </div>
              <StateBadge tone="approval" dot={false}>
                Default deny
              </StateBadge>
            </div>
            <div className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr]">
              <select
                aria-label="Agent protocol"
                value={protocol}
                onChange={(event) =>
                  setProtocol(event.target.value as "MCP" | "A2A")
                }
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              >
                <option value="MCP">MCP</option>
                <option value="A2A">A2A</option>
              </select>
              <input
                aria-label="Endpoint name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Endpoint name"
                className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle"
              />
              <input
                aria-label="Endpoint URL"
                value={endpointUrl}
                onChange={(event) => setEndpointUrl(event.target.value)}
                placeholder={
                  protocol === "MCP"
                    ? "https://partner.example/mcp"
                    : "https://partner.example/.well-known/agent-card.json"
                }
                className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle"
              />
            </div>
            <details className="mt-2 rounded-control border border-line px-3 py-2">
              <summary className="cursor-pointer text-[11px] text-muted">
                Sender-bound receipt policy
              </summary>
              <div className="mt-3 grid gap-2">
                <input
                  aria-label="Allowed receipt audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="Allowed audience"
                  className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
                <textarea
                  aria-label="Endpoint public key PEM"
                  value={publicKeyPem}
                  onChange={(event) => setPublicKeyPem(event.target.value)}
                  rows={4}
                  placeholder="Optional public key PEM for signed receipts"
                  className="resize-y rounded-control border border-line bg-surface px-3 py-2 font-mono text-[11px] text-ink placeholder:text-subtle"
                />
                <label className="flex items-start gap-2 text-[10.5px] leading-4 text-muted">
                  <input
                    type="checkbox"
                    checked={requireAgentDidCredential}
                    onChange={(event) =>
                      setRequireAgentDidCredential(event.target.checked)
                    }
                    className="mt-0.5"
                  />
                  Require every signed receipt to reference a currently verified
                  AgentDID credential for the same endpoint and SPIFFE workload.
                </label>
                <p className="text-[10.5px] text-subtle">
                  Policy requires SPIFFE workload IDs, a five-minute maximum
                  credential TTL, signed artifacts, and one-time nonces.
                </p>
              </div>
            </details>
            <button
              type="button"
              onClick={register}
              disabled={
                busy !== null ||
                !name.trim() ||
                !endpointUrl.trim() ||
                !audience.trim()
              }
              className={cn(buttonClassName({ variant: "primary" }), "mt-3")}
            >
              {busy === "register" ? "Registering…" : "Register for review"}
            </button>
          </div>

          {endpoints.loading ? (
            <LoadingSkeleton rows={3} />
          ) : endpoints.error ? (
            <ErrorState message={endpoints.error} onRetry={endpoints.refetch} />
          ) : (endpoints.data ?? []).length === 0 ? (
            <div className="p-4">
              <NotConfigured
                title="No external agent endpoints"
                message="Periscan's inbound read-only MCP server remains available. Add an outbound endpoint only when a reviewed partner workflow needs it."
              />
            </div>
          ) : (
            <ul>
              {(endpoints.data ?? []).map((endpoint) => (
                <li
                  key={endpoint.agentProtocolEndpointId}
                  className="border-b border-line p-4 last:border-b-0"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">
                        {endpoint.name}
                      </p>
                      <p className="truncate font-mono text-[10.5px] text-subtle">
                        {endpoint.protocol} · {endpoint.endpointUrl}
                      </p>
                    </div>
                    <StateBadge
                      tone={ENDPOINT_TONES[endpoint.status] ?? "neutral"}
                    >
                      {endpoint.status}
                    </StateBadge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {endpoint.status === "PendingReview" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(endpoint.agentProtocolEndpointId, () =>
                            api.reviewAgentProtocolEndpoint(
                              endpoint.agentProtocolEndpointId,
                              {
                                allowedCapabilityNames: [],
                                reason:
                                  "Endpoint ownership and HTTPS transport reviewed in the Periscan trust console.",
                                status: "Approved"
                              }
                            )
                          )
                        }
                        className={buttonClassName({ variant: "secondary" })}
                      >
                        Approve endpoint
                      </button>
                    ) : null}
                    {endpoint.status === "Approved" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(
                            `discover:${endpoint.agentProtocolEndpointId}`,
                            () =>
                              api.discoverAgentProtocolEndpoint(
                                endpoint.agentProtocolEndpointId
                              )
                          )
                        }
                        className={buttonClassName({ variant: "secondary" })}
                      >
                        {busy === `discover:${endpoint.agentProtocolEndpointId}`
                          ? "Discovering…"
                          : "Discover capabilities"}
                      </button>
                    ) : null}
                    {endpoint.status === "Approved" &&
                    endpoint.discoveredCapabilities.length > 0 &&
                    endpoint.allowedCapabilityNames.length !==
                      endpoint.discoveredCapabilities.length ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(
                            `import:${endpoint.agentProtocolEndpointId}`,
                            () =>
                              api.reviewAgentProtocolEndpoint(
                                endpoint.agentProtocolEndpointId,
                                {
                                  allowedCapabilityNames:
                                    endpoint.discoveredCapabilities.map(
                                      (capability) => capability.name
                                    ),
                                  reason:
                                    "Discovered capability names and schema hashes reviewed in the Periscan trust console.",
                                  status: "Approved"
                                }
                              )
                          )
                        }
                        className={buttonClassName({ variant: "primary" })}
                      >
                        Import reviewed set
                      </button>
                    ) : null}
                    {endpoint.status === "Approved" &&
                    endpoint.protocol === "A2A" &&
                    endpoint.a2aConformance?.structurallyConformant ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          setTckEndpointId((current) =>
                            current === endpoint.agentProtocolEndpointId
                              ? ""
                              : endpoint.agentProtocolEndpointId
                          )
                        }
                        className={buttonClassName({ variant: "secondary" })}
                      >
                        {tckEndpointId === endpoint.agentProtocolEndpointId
                          ? "Close TCK setup"
                          : "Qualify with official TCK"}
                      </button>
                    ) : null}
                  </div>
                  {endpoint.protocol === "A2A" && endpoint.a2aConformance ? (
                    <div className="mt-3 rounded-control border border-line bg-canvas p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11.5px] font-medium text-ink">
                          Agent Card conformance
                        </p>
                        <StateBadge
                          className="ml-auto"
                          tone={
                            endpoint.a2aConformance.structurallyConformant
                              ? "fixed"
                              : "missed"
                          }
                          dot={false}
                        >
                          {endpoint.a2aConformance.structurallyConformant
                            ? "Structure passed"
                            : "Review failures"}
                        </StateBadge>
                      </div>
                      <p className="mt-1 font-mono text-[9.5px] text-subtle">
                        {endpoint.a2aConformance.specification} · card{" "}
                        {endpoint.a2aConformance.cardHash.slice(0, 10)} ·{" "}
                        {endpoint.a2aConformance.preferredInterface
                          ? `${endpoint.a2aConformance.preferredInterface.protocolBinding} ${endpoint.a2aConformance.preferredInterface.protocolVersion}`
                          : "no usable interface"}
                      </p>
                      <div className="mt-2 grid gap-1.5">
                        {endpoint.a2aConformance.checks
                          .filter((check) => check.status !== "Pass")
                          .map((check) => (
                            <div
                              key={check.checkId}
                              className="flex items-start gap-2 text-[10.5px]"
                            >
                              <span
                                className={cn(
                                  "mt-1 size-1.5 shrink-0 rounded-full",
                                  check.status === "Fail"
                                    ? "bg-missed"
                                    : "bg-approval"
                                )}
                              />
                              <span className="text-muted">
                                {check.message}
                              </span>
                            </div>
                          ))}
                      </div>
                      <p className="mt-2 text-[10px] text-subtle">
                        Structural discovery does not invoke agent operations or
                        claim partner qualification. Run a separately approved,
                        scope-bound interoperability test before trusting live
                        task behavior.
                      </p>
                    </div>
                  ) : endpoint.protocol === "A2A" && endpoint.discoveredAt ? (
                    <p className="mt-3 rounded-control border border-missed/30 bg-missed/5 p-2.5 text-[10.5px] text-missed">
                      Discovery returned no Agent Card conformance result.
                      Refresh discovery before importing capabilities.
                    </p>
                  ) : null}
                  {tckEndpointId === endpoint.agentProtocolEndpointId ? (
                    <div className="mt-3 overflow-hidden rounded-control border border-brand/30 bg-surface shadow-sm">
                      <div className="border-b border-brand/15 bg-brand/[0.045] px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div>
                            <p className="text-[11.5px] font-medium text-ink">
                              Official A2A TCK qualification
                            </p>
                            <p className="mt-0.5 text-[10px] text-subtle">
                              Active protocol traffic · pinned 1.0.0.alpha2 ·
                              normalized proof only
                            </p>
                          </div>
                          <StateBadge
                            className="ml-auto"
                            tone="approval"
                            dot={false}
                          >
                            Explicit approval
                          </StateBadge>
                        </div>
                      </div>
                      <div className="grid gap-3 p-3 sm:grid-cols-[8rem_1fr]">
                        <label className="grid gap-1 text-[10px] text-subtle">
                          Requirement level
                          <select
                            aria-label="A2A TCK requirement level"
                            value={tckLevel}
                            onChange={(event) =>
                              setTckLevel(
                                event.target.value as
                                  | "all"
                                  | "must"
                                  | "should"
                                  | "may"
                              )
                            }
                            className="rounded-control border border-line bg-surface px-2 py-1.5 text-[11px] text-ink"
                          >
                            <option value="must">MUST</option>
                            <option value="should">SHOULD</option>
                            <option value="may">MAY</option>
                            <option value="all">All levels</option>
                          </select>
                        </label>
                        <div>
                          <p className="text-[10px] text-subtle">Transports</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {[
                              ["jsonrpc", "JSON-RPC"],
                              ["http_json", "HTTP + JSON"],
                              ["grpc", "gRPC"]
                            ].map(([value, label]) => {
                              const transport = value as
                                | "grpc"
                                | "jsonrpc"
                                | "http_json";
                              const selected =
                                tckTransports.includes(transport);
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => toggleTckTransport(transport)}
                                  className={cn(
                                    "rounded-control border px-2 py-1 text-[10px] transition-colors",
                                    selected
                                      ? "border-brand/40 bg-brand/10 text-brand"
                                      : "border-line text-subtle hover:text-ink"
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="px-3 pb-3">
                        <input
                          aria-label="A2A TCK authorization reason"
                          value={tckReason}
                          onChange={(event) => setTckReason(event.target.value)}
                          placeholder="Why is this test traffic authorized?"
                          className="w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                        />
                        <label className="mt-2 flex items-start gap-2 text-[10.5px] leading-4 text-muted">
                          <input
                            type="checkbox"
                            checked={tckAcknowledged}
                            onChange={(event) =>
                              setTckAcknowledged(event.target.checked)
                            }
                            className="mt-0.5"
                          />
                          I confirm this endpoint is customer-authorized and may
                          receive bounded task, message, error, and lifecycle
                          test traffic.
                        </label>
                        {busy === "a2a-tck" ? (
                          <div
                            aria-live="polite"
                            className="mt-3 grid gap-1.5 rounded-control border border-brand/20 bg-canvas p-2.5"
                          >
                            {[
                              ["Scope + policy", "Complete", false],
                              ["Official TCK", "Running live", true],
                              ["Normalize report", "Waiting", false],
                              ["Seal proof hash", "Waiting", false]
                            ].map(([label, state, active]) => (
                              <div
                                key={label as string}
                                className="flex items-center gap-2 text-[10.5px]"
                              >
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    active
                                      ? "animate-pulse bg-brand"
                                      : state === "Complete"
                                        ? "bg-fixed"
                                        : "bg-line"
                                  )}
                                />
                                <span className="text-ink">{label}</span>
                                <span className="ml-auto font-mono text-[9.5px] text-subtle">
                                  {state}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] text-subtle">
                            MUST compatibility is never marked proven while a
                            MUST requirement is failed or not tested.
                          </p>
                          <button
                            type="button"
                            onClick={runOfficialTck}
                            disabled={
                              busy !== null ||
                              !trustScopeId ||
                              !tckAcknowledged ||
                              !tckReason.trim() ||
                              tckTransports.length === 0
                            }
                            className={buttonClassName({ variant: "primary" })}
                          >
                            {busy === "a2a-tck"
                              ? "TCK running…"
                              : "Run governed qualification"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {(() => {
                    const latest = (tckRuns.data ?? []).find(
                      (run) =>
                        run.agentProtocolEndpointId ===
                        endpoint.agentProtocolEndpointId
                    );
                    if (!latest) return null;
                    const proofGaps = latest.requirementResults.filter(
                      (requirement) =>
                        requirement.level === "MUST" &&
                        requirement.status !== "PASS"
                    );
                    return (
                      <div className="mt-3 rounded-control border border-line bg-canvas p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">
                              Latest official TCK proof
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-muted">
                              {latest.toolVersion} ·{" "}
                              {latest.transports.join(", ")} · report{" "}
                              {latest.reportHash?.slice(0, 10) ??
                                "not produced"}
                            </p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="font-mono text-lg leading-none text-ink">
                              {latest.mustCompatibility === null
                                ? "—"
                                : `${latest.mustCompatibility.toFixed(1)}%`}
                            </p>
                            <StateBadge
                              className="mt-1"
                              tone={
                                latest.compatible
                                  ? "fixed"
                                  : latest.status === "Failed" ||
                                      latest.status === "DeniedByPolicy"
                                    ? "missed"
                                    : "approval"
                              }
                              dot={false}
                            >
                              {latest.compatible
                                ? "MUST proven"
                                : latest.status}
                            </StateBadge>
                          </div>
                        </div>
                        {latest.failureReason ? (
                          <p className="mt-2 text-[10px] leading-4 text-missed">
                            {latest.failureReason}
                          </p>
                        ) : null}
                        {proofGaps.length > 0 ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] text-muted">
                              Review {proofGaps.length} MUST proof gap
                              {proofGaps.length === 1 ? "" : "s"}
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {proofGaps.slice(0, 12).map((requirement) => (
                                <div
                                  key={requirement.requirementId}
                                  className="flex gap-2 text-[10px]"
                                >
                                  <span className="font-mono text-missed">
                                    {requirement.requirementId}
                                  </span>
                                  <span className="text-subtle">
                                    {requirement.errors[0] ??
                                      requirement.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    );
                  })()}
                  {endpoint.discoveredCapabilities.length > 0 ? (
                    <div className="mt-3 grid gap-1.5">
                      {endpoint.discoveredCapabilities.map((capability) => {
                        const allowed =
                          endpoint.allowedCapabilityNames.includes(
                            capability.name
                          );
                        return (
                          <div
                            key={capability.name}
                            className="flex items-center gap-2 rounded-control bg-canvas px-2.5 py-1.5"
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                allowed ? "bg-fixed" : "bg-approval"
                              )}
                            />
                            <span className="text-[11.5px] text-ink">
                              {capability.name}
                            </span>
                            <span className="ml-auto font-mono text-[9.5px] text-subtle">
                              {capability.inputSchemaHash?.slice(0, 10) ??
                                "no schema"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col">
          <section className="border-b border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink">
                  Confidential deployment proof
                </h3>
                <p className="mt-1 text-[12px] text-muted">
                  Periscan qualifies customer-supplied TEE/H100 attestation
                  evidence — it does not run agents or inference inside an
                  enclave. Verifier results bind provider signatures,
                  measurements, challenge freshness, and deployment policy.
                  NVIDIA evidence also checks every GPU token, secure boot, and
                  debug state.
                </p>
              </div>
              <StateBadge
                tone={
                  (attestations.data ?? []).some(
                    (attestation) => attestation.outcome === "Verified"
                  )
                    ? "fixed"
                    : "inconclusive"
                }
                dot={false}
              >
                {(attestations.data ?? []).some(
                  (attestation) => attestation.outcome === "Verified"
                )
                  ? "Attested"
                  : "No proof"}
              </StateBadge>
            </div>
            <div className="mt-4 border-y border-line py-4">
              <TeeAssuranceDesk />
            </div>
            <details
              className="mt-3 overflow-hidden rounded-control border border-brand/25 bg-surface"
              open
            >
              <summary className="cursor-pointer list-none border-b border-brand/15 bg-brand/[0.045] p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-brand/35 bg-brand/10 font-mono text-[9px] text-brand">
                    V
                  </span>
                  <div>
                    <p className="text-[11.5px] font-medium text-ink">
                      Verify with Veraison
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-subtle">
                      Live challenge-response for PSA, CCA, SEV-SNP, and TPM
                      evidence. Periscan stores normalized results and hashes,
                      never the submitted evidence.
                    </p>
                  </div>
                  <StateBadge className="ml-auto" tone="neutral" dot={false}>
                    Remote verifier
                  </StateBadge>
                </div>
              </summary>
              <div className="p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    aria-label="Veraison service URL"
                    value={veraisonUrl}
                    onChange={(event) => {
                      setVeraisonUrl(event.target.value);
                      setVeraisonSessionId("");
                      setVeraisonNonce("");
                    }}
                    placeholder="https://verifier.example"
                    className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                  />
                  <select
                    aria-label="Veraison attestation scheme"
                    value={veraisonProvider}
                    onChange={(event) =>
                      setVeraisonProvider(
                        event.target.value as
                          | "ArmPSA"
                          | "ArmCCA"
                          | "AMDSEVSNP"
                          | "TPM"
                      )
                    }
                    className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                  >
                    <option value="ArmCCA">Arm CCA</option>
                    <option value="ArmPSA">Arm PSA</option>
                    <option value="AMDSEVSNP">AMD SEV-SNP</option>
                    <option value="TPM">TPM</option>
                  </select>
                  <input
                    aria-label="Veraison workload ID"
                    value={veraisonWorkload}
                    onChange={(event) => {
                      setVeraisonWorkload(event.target.value);
                      setVeraisonSessionId("");
                      setVeraisonNonce("");
                    }}
                    placeholder="Workload ID"
                    className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                  />
                  <input
                    aria-label="Veraison authorization reason"
                    value={veraisonReason}
                    onChange={(event) => setVeraisonReason(event.target.value)}
                    placeholder="Authorization reason"
                    className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-subtle">
                    Step 1 · Veraison returns a time-bounded 32-byte nonce and
                    its accepted evidence media types.
                  </p>
                  <button
                    type="button"
                    onClick={createVeraisonSession}
                    disabled={
                      busy !== null ||
                      !trustScopeId ||
                      !veraisonUrl.trim() ||
                      !veraisonWorkload.trim() ||
                      !veraisonReason.trim()
                    }
                    className={buttonClassName({ variant: "secondary" })}
                  >
                    {busy === "veraison-session"
                      ? "Requesting challenge…"
                      : "Create challenge"}
                  </button>
                </div>

                {veraisonSessionId ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-[10px] text-subtle">
                        Challenge nonce
                        <input
                          aria-label="Veraison challenge nonce"
                          value={veraisonNonce}
                          readOnly
                          className="rounded-control border border-line bg-canvas px-2.5 py-2 font-mono text-[9.5px] text-ink"
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] text-subtle">
                        Evidence media type
                        <select
                          aria-label="Veraison evidence media type"
                          value={veraisonMediaType}
                          onChange={(event) =>
                            setVeraisonMediaType(event.target.value)
                          }
                          className="rounded-control border border-line bg-surface px-2.5 py-2 text-[10px] text-ink"
                        >
                          {veraisonAcceptedTypes.map((mediaType) => (
                            <option key={mediaType} value={mediaType}>
                              {mediaType}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-subtle">
                      Step 2 · Give the nonce to the attester and collect one
                      evidence object in an accepted format. Paste its base64
                      representation below; do not paste a JSON wrapper.
                    </p>
                    <textarea
                      aria-label="Base64 Veraison evidence"
                      value={veraisonEvidence}
                      onChange={(event) =>
                        setVeraisonEvidence(event.target.value)
                      }
                      rows={4}
                      placeholder="Base64 evidence bytes"
                      className="mt-2 w-full resize-y rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[9.5px] text-ink placeholder:text-subtle"
                    />
                    <details className="mt-2 rounded-control border border-line px-2.5 py-2">
                      <summary className="cursor-pointer text-[10px] text-muted">
                        Optional expected claim checks
                      </summary>
                      <p className="mt-2 text-[10px] leading-4 text-subtle">
                        Use a flat JSON object whose keys are dotted claim
                        paths. Values may be strings, numbers, or booleans.
                      </p>
                      <textarea
                        aria-label="Expected Veraison claims JSON"
                        value={veraisonExpectedClaims}
                        onChange={(event) =>
                          setVeraisonExpectedClaims(event.target.value)
                        }
                        rows={3}
                        placeholder='{"submods.cpu.secure_boot":true}'
                        className="mt-2 w-full resize-y rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[9.5px] text-ink placeholder:text-subtle"
                      />
                    </details>

                    {busy === "veraison-verify" ? (
                      <div
                        aria-live="polite"
                        className="mt-3 grid gap-1.5 rounded-control border border-brand/20 bg-canvas p-2.5"
                      >
                        {[
                          ["Evidence binding", "Hashed"],
                          ["Remote appraisal", "Live"],
                          ["Expected claims", "Waiting"],
                          ["Result ledger", "Waiting"]
                        ].map(([label, state], index) => (
                          <div
                            key={label}
                            className="flex items-center gap-2 text-[10.5px]"
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                index === 0
                                  ? "bg-fixed"
                                  : index === 1
                                    ? "animate-pulse bg-brand"
                                    : "bg-line"
                              )}
                            />
                            <span className="text-ink">{label}</span>
                            <span className="ml-auto font-mono text-[9.5px] text-subtle">
                              {state}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-subtle">
                        Step 3 · Periscan submits the exact bytes, polls bounded
                        asynchronous sessions, checks the nonce and optional
                        claims, then deletes the remote session best-effort.
                      </p>
                      <button
                        type="button"
                        onClick={verifyWithVeraison}
                        disabled={
                          busy !== null ||
                          !veraisonEvidence.trim() ||
                          !veraisonMediaType
                        }
                        className={buttonClassName({ variant: "primary" })}
                      >
                        {busy === "veraison-verify"
                          ? "Appraising…"
                          : "Verify evidence"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {(veraisonSessions.data ?? []).length > 0 ? (
                  <div className="mt-3 border-t border-line pt-2.5">
                    <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-subtle">
                      Recent sessions
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {(veraisonSessions.data ?? [])
                        .slice(0, 3)
                        .map((session) => (
                          <div
                            key={session.veraisonSessionId}
                            className="flex items-center gap-2 text-[10px]"
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                session.state === "Complete"
                                  ? "bg-fixed"
                                  : session.state === "Failed"
                                    ? "bg-missed"
                                    : "animate-pulse bg-brand"
                              )}
                            />
                            <span className="truncate text-ink">
                              {session.workloadId}
                            </span>
                            <span className="font-mono text-[9px] text-subtle">
                              {session.provider}
                            </span>
                            <span className="ml-auto text-subtle">
                              {session.state}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
            <details className="mt-3 rounded-control border border-line bg-canvas p-3">
              <summary className="cursor-pointer text-[11.5px] font-medium text-ink">
                Verify an NVIDIA detached EAT bundle
              </summary>
              <p className="mt-2 text-[10.5px] leading-4 text-subtle">
                Generate a challenge before collecting evidence with NVAT. Paste
                the complete JSON bundle; Periscan verifies the configured ES384
                relying-party key, overall result, every GPU token, RIM checks,
                secure boot, debug state, freshness, issuer, and nonce.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  aria-label="NVIDIA workload ID"
                  value={nvidiaWorkload}
                  onChange={(event) => {
                    setNvidiaWorkload(event.target.value);
                    setNvidiaChallengeId("");
                    setNvidiaNonce("");
                  }}
                  placeholder="Workload ID"
                  className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                />
                <input
                  aria-label="NVIDIA expected issuer"
                  value={nvidiaIssuer}
                  onChange={(event) => setNvidiaIssuer(event.target.value)}
                  placeholder="Expected issuer"
                  className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                />
                <input
                  aria-label="NVIDIA allowed GPU model"
                  value={nvidiaModel}
                  onChange={(event) => setNvidiaModel(event.target.value)}
                  placeholder="Allowed model, e.g. H100"
                  className="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink placeholder:text-subtle"
                />
                <div className="flex gap-1.5">
                  <input
                    aria-label="NVIDIA attestation nonce"
                    value={nvidiaNonce}
                    readOnly
                    placeholder="Challenge nonce"
                    className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[10px] text-ink placeholder:text-subtle"
                  />
                  <button
                    type="button"
                    onClick={generateNvidiaNonce}
                    disabled={busy !== null || !nvidiaWorkload.trim()}
                    className={buttonClassName({ variant: "secondary" })}
                  >
                    {busy === "nvidia-challenge" ? "Creating…" : "Generate"}
                  </button>
                </div>
              </div>
              <textarea
                aria-label="NVIDIA detached EAT bundle JSON"
                value={nvidiaBundle}
                onChange={(event) => setNvidiaBundle(event.target.value)}
                rows={5}
                placeholder='[["JWT","…"],{"REMOTE_GPU_CLAIMS":[…]}]'
                className="mt-2 w-full resize-y rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[10px] text-ink placeholder:text-subtle"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-subtle">
                  No token is accepted when the server trust anchor is missing.
                  H100 or newer hardware and NVAT remain customer deployment
                  prerequisites — Periscan verifies detached evidence only.
                </p>
                <button
                  type="button"
                  onClick={verifyNvidiaBundle}
                  disabled={
                    busy !== null ||
                    !nvidiaBundle.trim() ||
                    !nvidiaChallengeId ||
                    !nvidiaIssuer.trim() ||
                    !nvidiaNonce.trim() ||
                    !nvidiaWorkload.trim()
                  }
                  className={buttonClassName({ variant: "primary" })}
                >
                  {busy === "nvidia-attestation"
                    ? "Verifying…"
                    : "Verify bundle"}
                </button>
              </div>
            </details>
            {attestations.loading ? (
              <LoadingSkeleton rows={2} className="p-0 pt-3" />
            ) : (attestations.data ?? []).length === 0 ? (
              <p className="mt-3 rounded-control border border-line bg-canvas p-2.5 text-[11px] text-subtle">
                No hardware attestation has been verified. Container and OCI
                signatures are software provenance—not TEE or confidential-GPU
                proof.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(attestations.data ?? []).slice(0, 3).map((attestation) => (
                  <li
                    key={attestation.confidentialAttestationId}
                    className="rounded-control border border-line p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-ink">
                        {attestation.workloadId}
                      </span>
                      <StateBadge
                        className="ml-auto"
                        tone={
                          attestation.outcome === "Verified"
                            ? "fixed"
                            : attestation.outcome === "Rejected"
                              ? "missed"
                              : "inconclusive"
                        }
                        dot={false}
                      >
                        {attestation.outcome}
                      </StateBadge>
                    </div>
                    <p className="mt-1 font-mono text-[9.5px] text-subtle">
                      {attestation.provider} · {attestation.verifierType} ·{" "}
                      {attestation.region ?? "region unknown"}
                    </p>
                    {attestation.verifierType === "Veraison" ? (
                      <p className="mt-1 font-mono text-[9px] text-subtle">
                        {attestation.evidenceMediaType ?? "media type unknown"}{" "}
                        · claims{" "}
                        {attestation.resultClaimsHash?.slice(0, 10) ??
                          "not returned"}
                      </p>
                    ) : null}
                    {attestation.provider === "NvidiaConfidentialGPU" ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px] text-subtle">
                        <span>{attestation.deviceCount} GPU</span>
                        <span>
                          · EAT {attestation.claimsVersion ?? "unknown"}
                        </span>
                        <span>
                          ·{" "}
                          {attestation.secureBoot
                            ? "secure boot"
                            : "boot unproven"}
                        </span>
                        <span>
                          ·{" "}
                          {attestation.debugDisabled
                            ? "debug disabled"
                            : "debug unproven"}
                        </span>
                        {attestation.hardwareModels.length > 0 ? (
                          <span>· {attestation.hardwareModels.join(", ")}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {attestation.findings.length > 0 ? (
                      <p className="mt-2 text-[10px] leading-4 text-danger">
                        {attestation.findings.join(" ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-b border-line p-4">
            <h3 className="text-sm font-medium text-ink">
              Signed OCI extension SDK
            </h3>
            <p className="mt-1 text-[12px] text-muted">
              Paste a version 1.0 execution contract to run signature, digest,
              capability, network, output, redaction, and resource checks.
              Passing compatibility never authorizes execution by itself.
            </p>
            <textarea
              aria-label="Extension execution contract JSON"
              value={contractJson}
              onChange={(event) => setContractJson(event.target.value)}
              rows={4}
              placeholder='{"contractVersion":"1.0", …}'
              className="mt-3 w-full resize-y rounded-control border border-line bg-surface px-3 py-2 font-mono text-[10.5px] text-ink placeholder:text-subtle"
            />
            <button
              type="button"
              onClick={validateContract}
              disabled={busy !== null || !contractJson.trim()}
              className={cn(buttonClassName({ variant: "secondary" }), "mt-2")}
            >
              {busy === "contract"
                ? "Validating…"
                : "Run compatibility harness"}
            </button>
            {contractResult ? (
              <div className="mt-3 space-y-1.5">
                {contractResult.checks.map((check) => (
                  <div
                    key={check.checkId}
                    className="flex items-start gap-2 text-[10.5px]"
                  >
                    <span
                      className={cn(
                        "mt-1 size-1.5 shrink-0 rounded-full",
                        check.status === "Pass" ? "bg-fixed" : "bg-missed"
                      )}
                    />
                    <span className="text-muted">{check.message}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-ink">
                A2A exchange ledger
              </h3>
              <span className="font-mono text-[10px] text-subtle">
                {(exchange.data ?? []).length} object
                {(exchange.data ?? []).length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Typed tasks, messages, and artifacts are idempotent, redacted, and
              state-machine controlled. Signed artifacts bind to verified
              receipts.
            </p>
          </section>
        </aside>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-t border-line px-4 py-2 text-[12px] text-missed"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="border-t border-line px-4 py-2 text-[12px] text-fixed">
          {message}
        </p>
      ) : null}
    </Panel>
  );
}
