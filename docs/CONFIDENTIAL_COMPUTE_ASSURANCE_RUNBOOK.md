# Confidential compute assurance runbook

**Owner:** Confidential Compute SRE
**Product surface:** Autonomous → Agent Workflows → Agent trust → Hardware trust qualification
**API prefix:** `/api/v1/agent-trust/tee-assurance`
**Qualification rules:** `1.0`

## Purpose and boundary

This runbook operates Periscan's relying-party qualification layer for Arm PSA,
Arm CCA, AMD SEV-SNP, and TPM evidence appraised by a customer-configured
Veraison service. It answers whether one fresh normalized verifier receipt
satisfies one immutable tenant workload requirement.

Periscan does not provision the TEE, attester, endorsements, trust anchors, or
Veraison service. An ordinary OCI signature, a demo value, a controlled test
server, or a requirement without evidence is not hardware proof. The seeded
demo therefore remains `AwaitingEvidence` and creates no attestation.

## Durable proof model

Each assurance requirement binds:

- tenant, verified scope, workload ID, provider, and `Veraison` verifier type;
- the policy decision that authorized creation;
- maximum attestation age and maximum qualification validity;
- optional exact measurement, region, evidence media type, secure-boot, and
  debug-disabled requirements;
- policy reference, support owner, escalation reference, and authorization
  reason.

Requirements cannot be edited. Create a new requirement when policy changes.
Each decision is an append-only receipt containing the exact attestation ID,
raw/result claim hashes, checked time, operator reason/reference, findings, and
bounded qualification expiry. Database triggers reject updates. Forced RLS and
a tenant-consistency trigger prevent cross-tenant decision binding.

## State contract

| State              | Meaning                                                                   | Operator action                                                              |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `AwaitingEvidence` | Requirement exists, but no decision has been sealed.                      | Collect fresh matching evidence.                                             |
| `Qualified`        | Every deterministic requirement passed and the receipt remains current.   | Monitor expiry and deployment changes.                                       |
| `Rejected`         | At least one exact requirement failed.                                    | Review findings; correct infrastructure and collect new evidence.            |
| `Revoked`          | An administrator explicitly withdrew the latest qualification.            | Investigate the referenced change/incident and collect new evidence.         |
| `Expired`          | The latest qualified receipt passed its bounded `qualifiedUntil` instant. | Treat as unqualified and collect new evidence; never extend the old receipt. |

Rejected, revoked, and expired states are not degraded forms of approval. They
are unqualified.

## Normal qualification procedure

1. In **Hardware trust qualification**, choose **New requirement**.
2. Select the exact verified scope and enter the workload ID, Veraison evidence
   profile, support owner, escalation reference, policy reference, evidence-age
   limit, validity limit, and authorization reason.
3. Add optional claim requirements only when the configured Veraison appraisal
   result normalizes those claims. Requiring an unavailable claim fails closed.
4. Choose **Seal requirement**. Confirm the workspace shows
   `Awaiting evidence`.
5. In **Verify with Veraison**, use the same workload, provider, and scope.
   Create a challenge and give the returned nonce to the authorized attester.
6. Submit exactly one accepted evidence object. Periscan sends the bytes to the
   configured verifier, bounds polling, checks nonce and expected claims,
   persists normalized hashes/findings, and does not retain raw evidence.
7. Return to **Hardware trust qualification** and choose the exact receipt.
8. Enter a decision reason and change/review/incident reference. Choose **Seal
   decision**.
9. Confirm the status, receipt hash, findings, and `qualifiedUntil` value. A
   `Qualified` result is valid only until that instant.

The evaluator checks tenant, verified scope, workload, provider, verifier type,
completed session, policy binding, trust-anchor state, signature, freshness,
expiry, and every configured optional claim. Operators cannot override a failed
check into `Qualified`.

## Revocation

Revoke immediately when the workload image/configuration changes, a trust
anchor or endorsement is withdrawn, the attester is compromised, scope is no
longer authorized, or the release decision is withdrawn.

1. Select the qualified requirement.
2. Enter the incident/change reason and reference.
3. Choose **Revoke qualification**.
4. Confirm the latest append-only receipt is `Revoked` and has no
   `qualifiedUntil` value.
5. Collect fresh evidence after remediation. The old receipt cannot be reused.

## Failure and recovery

| Symptom                                    | Likely boundary                                    | Recovery                                                                                       |
| ------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No matching receipt                        | No real evidence for exact workload/provider       | Run a new Veraison challenge with the same verified scope.                                     |
| Verifier unreachable or invalid response   | Veraison networking/configuration                  | Escalate to the named owner; verify allowlisting, TLS, service health, and response profile.   |
| `is_valid=false`                           | Trust anchor, endorsement, reference value, or TEE | Inspect verifier-side appraisal details; correct provisioning; collect new evidence.           |
| Scope/workload/provider mismatch           | Wrong requirement or collection target             | Do not edit either receipt. Select the correct requirement or create a new challenge.          |
| Missing secure-boot/debug/measurement fact | Claim was not normalized or did not pass           | Correct the attester/appraisal policy or remove the requirement only by creating a new policy. |
| Evidence too old or expired                | Freshness boundary                                 | Create a new challenge; never extend or replay the old receipt.                                |
| Duplicate receipt rejected                 | Receipt already has a sealed decision              | Collect fresh evidence.                                                                        |
| Revocation rejected                        | Latest receipt is not `Qualified`                  | Review the current terminal state; no second revocation is necessary.                          |

## Monitoring and evidence review

Monitor at minimum:

- count and age of `AwaitingEvidence`, `Rejected`, `Expired`, and `Revoked`
  requirements by support owner;
- time from challenge creation to terminal Veraison result;
- verifier HTTP/content-type/nonce/session-state failures;
- qualifications expiring inside the release/change window;
- repeated rejection by provider, policy reference, or expected claim;
- `tee_assurance.requirement_created`, `tee_assurance.evaluated`, and
  `tee_assurance.revoked` audit events.

This repository proves the lifecycle, deterministic evaluator, failure states,
database invariants, and controlled Veraison protocol behavior. It does not yet
claim customer hardware availability, independent multi-customer usability,
production support performance, or an externally audited SLO. Record those as
external qualification evidence before awarding 5.0 maturity.

## Safe demo validation

1. Run `DATABASE_URL=... pnpm seed:demo`.
2. Sign in with the printed demo credentials and open `/workflows`.
3. In **Hardware trust qualification**, confirm
   `demo-confidential-validation-worker`, AMD SEV-SNP, the demo support owner,
   and `Awaiting evidence`.
4. Confirm the chain shows **Hardware evidence · Required**, no receipt picker,
   and a disabled **Seal decision** button.
5. Open product help and follow the six TEE assurance instructions. They must
   explain collection and escalation without instructing the operator to use
   fixture evidence.
6. Do not create an attestation in the demo. Rerun the seed after any controlled
   local protocol exercise; it deletes assurance decisions, verifier sessions,
   attestations, and challenges before restoring the honest baseline.
