"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  TeeAssuranceProvider,
  TeeAssuranceRequirement
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const STATUS_TONE: Record<TeeAssuranceRequirement["status"], StateTone> = {
  AwaitingEvidence: "approval",
  Expired: "inconclusive",
  Qualified: "fixed",
  Rejected: "missed",
  Revoked: "missed"
};

const PROVIDER_LABEL: Record<TeeAssuranceProvider, string> = {
  AMDSEVSNP: "AMD SEV-SNP",
  ArmCCA: "Arm CCA",
  ArmPSA: "Arm PSA",
  TPM: "TPM"
};

function displayStatus(status: TeeAssuranceRequirement["status"]) {
  if (status === "AwaitingEvidence") return "Awaiting evidence";
  return status;
}

function compactHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "Not required";
}

export function TeeAssuranceDesk() {
  const workspace = useApiResource(() => api.getTeeAssuranceWorkspace(), []);
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [scopeId, setScopeId] = useState("");
  const [workloadId, setWorkloadId] = useState("");
  const [provider, setProvider] = useState<TeeAssuranceProvider>("AMDSEVSNP");
  const [supportOwner, setSupportOwner] = useState("");
  const [escalationReference, setEscalationReference] = useState("");
  const [policyReference, setPolicyReference] = useState("");
  const [authorizationReason, setAuthorizationReason] = useState("");
  const [maxAge, setMaxAge] = useState(10);
  const [validity, setValidity] = useState(60);
  const [expectedMeasurement, setExpectedMeasurement] = useState("");
  const [expectedRegion, setExpectedRegion] = useState("");
  const [evidenceMediaType, setEvidenceMediaType] = useState("");
  const [requireSecureBoot, setRequireSecureBoot] = useState(false);
  const [requireDebugDisabled, setRequireDebugDisabled] = useState(false);
  const [attestationId, setAttestationId] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionReference, setDecisionReference] = useState("");
  const [busy, setBusy] = useState<"create" | "evaluate" | "revoke" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const assurances = workspace.data?.assurances ?? [];
  const scopes = workspace.data?.scopes ?? [];
  const selected =
    assurances.find(
      (assurance) => assurance.teeAssuranceRequirementId === selectedId
    ) ?? assurances[0];

  useEffect(() => {
    if (!selectedId && assurances[0]) {
      setSelectedId(assurances[0].teeAssuranceRequirementId);
    }
  }, [assurances, selectedId]);

  useEffect(() => {
    if (!scopeId && scopes[0]) setScopeId(scopes[0].scopeId);
  }, [scopeId, scopes]);

  const matchingAttestations = useMemo(
    () =>
      (workspace.data?.attestations ?? []).filter(
        (attestation) =>
          selected &&
          attestation.provider === selected.provider &&
          attestation.verifierType === selected.verifierType &&
          attestation.workloadId === selected.workloadId
      ),
    [selected, workspace.data?.attestations]
  );

  useEffect(() => {
    if (
      attestationId &&
      !matchingAttestations.some(
        (attestation) => attestation.confidentialAttestationId === attestationId
      )
    ) {
      setAttestationId("");
    }
  }, [attestationId, matchingAttestations]);

  async function createRequirement() {
    if (!scopeId || !workloadId.trim()) return;
    setBusy("create");
    setError(null);
    setMessage(null);
    try {
      const created = await api.createTeeAssuranceRequirement({
        authorizationReason,
        escalationReference,
        evidenceMediaType: evidenceMediaType.trim() || null,
        expectedMeasurement: expectedMeasurement.trim() || null,
        expectedRegion: expectedRegion.trim() || null,
        maxAttestationAgeMinutes: maxAge,
        policyReference,
        provider,
        qualificationValidityMinutes: validity,
        requireDebugDisabled,
        requireSecureBoot,
        scopeId,
        supportOwner,
        verifierType: "Veraison",
        workloadId
      });
      await workspace.refetch();
      setSelectedId(created.teeAssuranceRequirementId);
      setShowCreate(false);
      setMessage(
        "Requirement sealed. Collect fresh nonce-bound hardware evidence before qualification."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The assurance requirement could not be created."
      );
    } finally {
      setBusy(null);
    }
  }

  async function evaluate() {
    if (!selected || !attestationId) return;
    setBusy("evaluate");
    setError(null);
    setMessage(null);
    try {
      const result = await api.evaluateTeeAssurance(
        selected.teeAssuranceRequirementId,
        { attestationId, decisionReason, decisionReference }
      );
      await workspace.refetch();
      setAttestationId("");
      setMessage(
        result.status === "Qualified"
          ? "Qualification sealed against the exact verifier receipt."
          : "The evidence was rejected. Review the sealed findings before collecting fresh evidence."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The assurance decision could not be sealed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!selected) return;
    setBusy("revoke");
    setError(null);
    setMessage(null);
    try {
      await api.revokeTeeAssurance(selected.teeAssuranceRequirementId, {
        decisionReason,
        decisionReference
      });
      await workspace.refetch();
      setMessage("Qualification revoked. Fresh evidence is required.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The qualification could not be revoked."
      );
    } finally {
      setBusy(null);
    }
  }

  if (workspace.loading) return <LoadingSkeleton rows={4} className="p-0" />;
  if (workspace.error && !workspace.data) {
    return (
      <ErrorState
        message={workspace.error}
        onRetry={() => void workspace.refetch()}
      />
    );
  }

  return (
    <section aria-label="TEE assurance desk" className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.16em] text-brand">
            Customer attestation evidence · rules 1.0
          </p>
          <h3 className="mt-1 text-sm font-medium text-ink">
            Hardware trust qualification
          </h3>
          <p className="mt-1 max-w-2xl text-[11px] leading-4 text-muted">
            Qualify customer-supplied TEE/H100 attestation evidence against a
            sealed workload requirement. Periscan does not run workloads inside
            an enclave and does not host TDX/SEV/H100 hardware — only verifier
            receipts. A software signature, demo token, or unbound verifier
            result can never become qualified hardware proof.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className={buttonClassName({ variant: "secondary" })}
        >
          {showCreate ? "Close requirement" : "New requirement"}
        </button>
      </div>

      {error ? <p className="mt-3 text-[11px] text-danger">{error}</p> : null}
      {message ? (
        <p aria-live="polite" className="mt-3 text-[11px] text-fixed">
          {message}
        </p>
      ) : null}

      {showCreate || assurances.length === 0 ? (
        <div className="mt-4 border-b border-line pb-4">
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Verified scope
              <select
                aria-label="TEE assurance verified scope"
                value={scopeId}
                onChange={(event) => setScopeId(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
              >
                <option value="">Choose verified scope</option>
                {scopes.map((scope) => (
                  <option key={scope.scopeId} value={scope.scopeId}>
                    {scope.value} · {scope.scopeType}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Workload ID
              <input
                aria-label="TEE assurance workload ID"
                value={workloadId}
                onChange={(event) => setWorkloadId(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="payments-confidential-worker"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Hardware evidence profile
              <select
                aria-label="TEE assurance provider"
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as TeeAssuranceProvider)
                }
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
              >
                {Object.entries(PROVIDER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} · Veraison
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Support owner
              <input
                aria-label="TEE assurance support owner"
                value={supportOwner}
                onChange={(event) => setSupportOwner(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="Confidential Compute SRE"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Escalation reference
              <input
                aria-label="TEE assurance escalation reference"
                value={escalationReference}
                onChange={(event) => setEscalationReference(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="RUNBOOK-TEE-001"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Policy reference
              <input
                aria-label="TEE assurance policy reference"
                value={policyReference}
                onChange={(event) => setPolicyReference(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="CC-POLICY-004"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Maximum evidence age · minutes
              <input
                aria-label="TEE assurance maximum evidence age"
                type="number"
                min={1}
                max={1440}
                value={maxAge}
                onChange={(event) => setMaxAge(Number(event.target.value))}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
              Qualification validity · minutes
              <input
                aria-label="TEE assurance qualification validity"
                type="number"
                min={5}
                max={10080}
                value={validity}
                onChange={(event) => setValidity(Number(event.target.value))}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-[10px] text-subtle sm:col-span-2 lg:col-span-1">
              Authorization reason
              <input
                aria-label="TEE assurance authorization reason"
                value={authorizationReason}
                onChange={(event) => setAuthorizationReason(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="Qualify the approved confidential workload."
              />
            </label>
          </div>
          <details className="mt-2 border-t border-line pt-2">
            <summary className="cursor-pointer text-[10px] text-muted">
              Exact optional claim requirements
            </summary>
            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-3">
              <input
                aria-label="TEE assurance expected measurement"
                value={expectedMeasurement}
                onChange={(event) => setExpectedMeasurement(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[10px] text-ink"
                placeholder="Expected SHA-256 measurement"
              />
              <input
                aria-label="TEE assurance expected region"
                value={expectedRegion}
                onChange={(event) => setExpectedRegion(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[10px] text-ink"
                placeholder="Expected region"
              />
              <input
                aria-label="TEE assurance evidence media type"
                value={evidenceMediaType}
                onChange={(event) => setEvidenceMediaType(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[10px] text-ink"
                placeholder="Evidence media type"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-muted">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireSecureBoot}
                  onChange={(event) =>
                    setRequireSecureBoot(event.target.checked)
                  }
                />
                Require secure boot claim
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireDebugDisabled}
                  onChange={(event) =>
                    setRequireDebugDisabled(event.target.checked)
                  }
                />
                Require debug-disabled claim
              </label>
            </div>
          </details>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void createRequirement()}
              disabled={
                busy !== null ||
                !scopeId ||
                !workloadId.trim() ||
                !supportOwner.trim() ||
                !escalationReference.trim() ||
                !policyReference.trim() ||
                authorizationReason.trim().length < 10
              }
              className={buttonClassName({ variant: "primary" })}
            >
              {busy === "create" ? "Sealing…" : "Seal requirement"}
            </button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="mt-4 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="TEE assurance requirement"
              value={selected.teeAssuranceRequirementId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
            >
              {assurances.map((assurance) => (
                <option
                  key={assurance.teeAssuranceRequirementId}
                  value={assurance.teeAssuranceRequirementId}
                >
                  {assurance.workloadId} · {PROVIDER_LABEL[assurance.provider]}
                </option>
              ))}
            </select>
            <StateBadge tone={STATUS_TONE[selected.status]} dot={false}>
              {displayStatus(selected.status)}
            </StateBadge>
          </div>

          <ol className="mt-4 grid min-w-0 grid-cols-1 gap-0 sm:grid-cols-4">
            {[
              ["1", "Requirement", "Sealed", true],
              [
                "2",
                "Hardware evidence",
                matchingAttestations.length > 0 ? "Received" : "Required",
                matchingAttestations.length > 0
              ],
              [
                "3",
                "Decision",
                selected.latestDecision?.decisionType ?? "Waiting",
                Boolean(selected.latestDecision)
              ],
              [
                "4",
                "Freshness",
                selected.status === "Qualified"
                  ? "Current"
                  : selected.status === "Expired"
                    ? "Expired"
                    : "Unproven",
                selected.status === "Qualified"
              ]
            ].map(([number, label, state, complete], index) => (
              <li
                key={String(label)}
                className="relative flex min-w-0 items-center gap-2 border-b border-line py-2 sm:border-b-0 sm:border-r sm:px-3 sm:first:pl-0 sm:last:border-r-0"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[9px]",
                    complete
                      ? "border-fixed/40 bg-fixed/10 text-fixed"
                      : index === 1 && matchingAttestations.length === 0
                        ? "animate-pulse border-brand/40 bg-brand/10 text-brand"
                        : "border-line text-subtle"
                  )}
                >
                  {String(number)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] text-ink">
                    {String(label)}
                  </span>
                  <span className="block truncate font-mono text-[9px] text-subtle">
                    {String(state)}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <dl className="mt-4 grid min-w-0 gap-x-5 gap-y-2 border-y border-line py-3 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-subtle">Verified scope</dt>
              <dd className="mt-0.5 truncate text-ink">
                {scopes.find((scope) => scope.scopeId === selected.scopeId)
                  ?.value ?? selected.scopeId}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-subtle">Evidence boundary</dt>
              <dd className="mt-0.5 text-ink">
                ≤ {selected.maxAttestationAgeMinutes} min · Veraison
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-subtle">Measurement</dt>
              <dd className="mt-0.5 truncate font-mono text-[9px] text-ink">
                {compactHash(selected.expectedMeasurement)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-subtle">Owner / escalation</dt>
              <dd className="mt-0.5 truncate text-ink">
                {selected.supportOwner} · {selected.escalationReference}
              </dd>
            </div>
          </dl>

          {selected.latestDecision ? (
            <div className="mt-3 min-w-0 border-l-2 border-brand/30 pl-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="font-medium text-ink">Latest receipt</span>
                <span className="font-mono text-[9px] text-subtle">
                  {selected.latestDecision.decisionReference}
                </span>
                <span className="ml-auto text-subtle">
                  {new Date(selected.latestDecision.decidedAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 break-words text-[10px] leading-4 text-muted">
                {selected.latestDecision.decisionReason}
              </p>
              <p className="mt-1 break-all font-mono text-[9px] text-subtle">
                evidence {selected.latestDecision.attestationRawClaimsHash}
              </p>
              {selected.latestDecision.qualifiedUntil ? (
                <p className="mt-1 text-[10px] text-subtle">
                  Qualified only until{" "}
                  {new Date(
                    selected.latestDecision.qualifiedUntil
                  ).toLocaleString()}
                </p>
              ) : null}
              {selected.latestDecision.findings.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[10px] text-danger">
                  {selected.latestDecision.findings.map((finding) => (
                    <li key={finding}>· {finding}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 min-w-0">
            {matchingAttestations.length === 0 ? (
              <p className="border-l-2 border-approval/40 pl-3 text-[10.5px] leading-4 text-muted">
                No matching hardware result exists. Use the Veraison collector
                below with workload <strong>{selected.workloadId}</strong>,
                provider {PROVIDER_LABEL[selected.provider]}, and the same
                verified scope. Qualification remains unavailable until that
                real verifier result is persisted.
              </p>
            ) : (
              <label className="grid min-w-0 gap-1 text-[10px] text-subtle">
                Fresh verifier receipt
                <select
                  aria-label="TEE assurance verifier receipt"
                  value={attestationId}
                  onChange={(event) => setAttestationId(event.target.value)}
                  className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                >
                  <option value="">Choose exact receipt</option>
                  {matchingAttestations.map((attestation) => (
                    <option
                      key={attestation.confidentialAttestationId}
                      value={attestation.confidentialAttestationId}
                    >
                      {attestation.outcome} ·{" "}
                      {new Date(attestation.checkedAt).toLocaleString()} ·{" "}
                      {compactHash(attestation.rawClaimsHash)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
              <input
                aria-label="TEE assurance decision reason"
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="Why this exact evidence supports the decision"
              />
              <input
                aria-label="TEE assurance decision reference"
                value={decisionReference}
                onChange={(event) => setDecisionReference(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink"
                placeholder="Change, review, or incident reference"
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {selected.status === "Qualified" ||
              selected.status === "Expired" ? (
                <button
                  type="button"
                  onClick={() => void revoke()}
                  disabled={
                    busy !== null ||
                    decisionReason.trim().length < 10 ||
                    decisionReference.trim().length < 3
                  }
                  className={buttonClassName({ variant: "danger" })}
                >
                  {busy === "revoke" ? "Revoking…" : "Revoke qualification"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void evaluate()}
                disabled={
                  busy !== null ||
                  !attestationId ||
                  decisionReason.trim().length < 10 ||
                  decisionReference.trim().length < 3
                }
                className={buttonClassName({ variant: "primary" })}
              >
                {busy === "evaluate" ? "Checking chain…" : "Seal decision"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-subtle">
          No requirement exists. Create one against a verified customer scope;
          Periscan will not manufacture hardware evidence for the demo.
        </p>
      )}

      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-[10px] font-medium text-muted">
          How to qualify a workload
        </summary>
        <ol className="mt-2 grid list-decimal gap-2 pl-5 text-[10px] leading-4 text-subtle sm:grid-cols-2">
          <li>
            Seal the exact workload, verified scope, provider, owner, and
            freshness policy.
          </li>
          <li>
            Create a Veraison challenge below and give its nonce to the
            authorized attester.
          </li>
          <li>
            Submit one accepted evidence object; Periscan stores hashes and
            normalized results, not raw evidence.
          </li>
          <li>
            Select the matching receipt here, record a reason/reference, and
            seal the deterministic decision.
          </li>
          <li>
            Treat Expired, Rejected, and Revoked as unqualified; collect fresh
            evidence rather than editing history.
          </li>
          <li>
            Escalate verifier, trust-anchor, endorsement, or hardware failures
            to the named support owner.
          </li>
        </ol>
      </details>
    </section>
  );
}
