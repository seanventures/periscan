# OSS proof-engine runbook

## Purpose

Periscan wraps open-source tools as governed evidence producers. The tools do
not become the product experience: policy, verified scope, normalized evidence,
certainty, audit, and fix verification remain Periscan responsibilities.

The current qualified OSS proof wave adds three live modules and two
interoperability adapters:

| Module                        | Runtime               | Product use                                                          | Safety boundary                                                                                                                                                                               |
| ----------------------------- | --------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web.zap_baseline`            | OWASP ZAP 2.17.0      | Passive web baseline for verified web scope                          | Spider and passive rules only; active attacks are not invoked                                                                                                                                 |
| `syft.sbom_generate`          | Syft 1.46.0           | CycloneDX repository inventory                                       | Read-only staged source, no network, normalized component preview and SBOM digest only                                                                                                        |
| `sigstore.cosign_verify_blob` | Cosign 3.0.6          | Offline artifact verification with an explicitly trusted public key  | Verification only; no signing key enters Periscan and no transparency-log lookup occurs                                                                                                       |
| A2A TCK adapter               | A2A TCK 1.0.0.alpha2  | Active protocol conformance for an approved, verified-scope endpoint | Explicit test-traffic acknowledgment; denied policy decisions never invoke the harness; raw reports are reduced to normalized results and a SHA-256                                           |
| AgentDID / VC adapter         | DID Core 1.0 / VC 2.0 | Cross-organization agent identity and delegated A2A capabilities     | Tenant-approved did:web issuer/subject pair; JOSE assertion key, audience, endpoint, SPIFFE workload, TTL, and capability subset are bound; raw documents and credentials are never persisted |
| Veraison adapter              | Challenge-response v1 | Remote appraisal for PSA, CCA, SEV-SNP, and TPM evidence             | HTTPS in production; nonce, origin, media type, evidence hash, expected claims, and tenant are bound; evidence bytes are never persisted                                                      |

The source projects and operating contracts are documented by
[OWASP ZAP baseline scan](https://www.zaproxy.org/docs/docker/baseline-scan/),
[Anchore Syft](https://github.com/anchore/syft), and
[Sigstore Cosign verify-blob](https://github.com/sigstore/cosign/blob/main/doc/cosign_verify-blob.md).
The agent-trust adapters follow the official
[A2A TCK](https://github.com/a2aproject/a2a-tck) and
[Veraison challenge-response](https://github.com/veraison/docs/tree/main/api/challenge-response)
contracts. The cross-organization identity profile follows the stable
[DID Core 1.0](https://www.w3.org/TR/did-core/),
[Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/),
[Securing Verifiable Credentials using JOSE and COSE](https://www.w3.org/TR/vc-jose-cose/),
and [did:web](https://w3c-ccg.github.io/did-method-web/) specifications.

## Runtime isolation

Docker execution uses a read-only root filesystem, all Linux capabilities are
dropped, privilege escalation is disabled, process/CPU/memory ceilings are
applied, and tools run as non-root users. Syft and Cosign run with networking
disabled. ZAP receives bridge networking only because its authorized target is
the validation subject.

Evidence is copied through the Docker API into short-lived named volumes. This
avoids host bind-mount assumptions and works when the Docker daemon is remote or
host paths are not shared by Colima/Docker Desktop. Input volumes become
read-only for Syft and Cosign. ZAP receives a dedicated output volume, and the
report is copied out after the container exits. Volumes and local staging files
are removed in `finally` paths.

For production, configure immutable image references through the existing
runtime overrides, for example:

```bash
export PERISCAN_SYFT_IMAGE='anchore/syft@sha256:<approved-digest>'
export PERISCAN_COSIGN_IMAGE='ghcr.io/sigstore/cosign/cosign@sha256:<approved-digest>'
export PERISCAN_ZAPROXY_IMAGE='ghcr.io/zaproxy/zaproxy@sha256:<approved-digest>'
```

Keep the approved digest in release configuration and update it only through
the dependency/security review. Cosign is pinned to the patched 3.0.6 line; the
current offline customer-key profile uses a legacy JSON bundle with
`private-infrastructure` verification semantics rather than claiming public
transparency-log inclusion.

## Operator flow

1. Open **Operate → Tool Governance** and confirm the required engine is
   installed, enabled, and reports an implemented live module.
2. Start from a verified Repository or web scope. The module does not create or
   widen scope.
3. For Syft, provide `repositoryPath` and an optional display name. Generated
   evidence includes CycloneDX version, component count/preview, runtime
   version, and SBOM SHA-256. Raw SBOM contents are not retained in primary UX.
4. For Cosign, provide `artifactPath`, `bundlePath`, and `publicKeyPath` from an
   approved customer trust profile. A mismatch returns
   `artifact_signature_rejected` and a repository signal; it never becomes a
   tool outage or a clean result.
5. For ZAP, provide the verified `url`, a spider budget of 0–2 minutes, and a
   total duration of 1–5 minutes. The module reports normalized passive alerts,
   not raw scanner output.
6. Review the resulting evidence and certainty in the mission/snapshot flow.
   A fixture remains Inconclusive and an unavailable runtime remains
   `tool_unavailable`.

## Qualification

With Docker running:

```bash
pnpm tools:check
pnpm tools:qualify:proof
```

The proof command must complete all of these checks:

- Syft inventories the real Periscan repository and returns a non-empty
  CycloneDX result.
- Cosign generates an ephemeral local qualification key, verifies the signed
  repository artifact with networking disabled, then rejects a different
  artifact and emits one rejection signal. Restrictive input-file permissions
  are included in the test.
- ZAP scans an ephemeral local HTTP application and returns normalized passive
  alerts without active rules.
- Temporary keys, bundles, archives, Docker containers, and Docker volumes are
  removed after the run.

Then run focused and release validation:

```bash
pnpm --filter @periscan/modules typecheck
pnpm --filter @periscan/modules test -- --run
pnpm verify
```

## A2A TCK setup and operator flow

Install the pinned checkout and provide a reviewed `uv` runtime with Python
3.11 or newer. A project-local qualification setup is:

```bash
pnpm tools:pull -- --tool=a2a-tck
python3 -m venv .periscan/uv-runtime
.periscan/uv-runtime/bin/pip install uv==0.11.29
export PERISCAN_A2A_TCK_UV_BINARY="$PWD/.periscan/uv-runtime/bin/uv"
export PERISCAN_A2A_TCK_CHECKOUT="$PWD/.periscan/oss/a2a-tck"
pnpm tools:qualify:agent-trust
```

The executor refuses a checkout that is not exactly tagged
`1.0.0.alpha2`. Each run copies the checkout to a short-lived directory so
concurrent reports cannot collide. The official `compatibility.json` is parsed;
HTML, JUnit, the Agent Card copy, and raw failure output are not persisted.
Bearer-looking or authorization material in errors is redacted. A run is
compatible only when its MUST score is 100% **and** every reported MUST
requirement is `PASS`; an upstream `NOT TESTED` result remains a proof gap.

In Periscan:

1. Create and verify a Domain, Subdomain, or AI Application Endpoint scope.
2. Open **Workflows → Agent trust**, register the A2A Agent Card URL, approve
   the endpoint, and choose **Discover capabilities**.
3. Confirm the Agent Card structural result passes. This check does not send
   task traffic and is not TCK proof.
4. Choose the verified scope in **Authorization context**, then choose
   **Qualify with official TCK** on the endpoint.
5. Select MUST/SHOULD/MAY/all and only the transports the target is authorized
   to receive. Record the reason, acknowledge active test traffic, and run.
6. Review the latest official proof. A denied or failed run has no
   compatibility percentage; failed and untested MUST requirements stay
   visible by requirement ID.

The pinned alpha TCK does not currently provide a Periscan-safe tenant secret
injection contract. Use a customer-authorized non-production conformance
endpoint or an independently controlled network authentication layer; never
put credentials in the endpoint URL or authorization reason.

## AgentDID and VC 2.0 operator flow

This is a relying-party profile, not a DID issuer or wallet. Production supports
`did:web` over HTTPS. Loopback HTTP and percent-encoded local ports exist only
for development qualification. Periscan accepts compact JOSE credentials with
`typ=vc+jwt` and an allowlisted `ES256`, `ES384`, or `EdDSA` assertion key.

1. Complete A2A endpoint approval, structural Agent Card discovery, and the
   explicit capability import review. The endpoint must retain at least one
   allowed capability.
2. Choose a verified Domain, Subdomain, or AI Application Endpoint in
   **Authorization context**.
3. Under **Cross-organization AgentDID delegation**, choose the qualified
   endpoint. Enter the exact subject `did:web`, exact trusted issuer `did:web`,
   allowed credential type, and customer authorization reason.
4. Choose **Establish trust**. Periscan records the scope and policy decision,
   resolves both DID documents through the SSRF boundary, checks the DID Core
   context and exact document IDs, and persists only hashes, URLs, timestamps,
   and normalized identifiers.
5. Select the profile and paste one short-lived `vc+jwt`. The credential must
   use the VC 2.0 context, include `VerifiableCredential` plus an allowed type,
   match issuer, subject, audience, reviewed A2A endpoint origin, and SPIFFE
   workload, and delegate a non-empty subset of the imported capabilities.
   `validFrom`/`validUntil` must match JWT `nbf`/`exp` and remain inside the
   endpoint credential TTL.
6. Choose **Verify credential**. The `kid` must be an absolute issuer DID URL
   authorized by the document's `assertionMethod`; private JWK fields, unknown
   keys, invalid signatures, excess capability, and unsupported
   `credentialStatus` methods fail closed. Periscan discards the compact
   credential and retains normalized claims, findings, hashes, and validity.
7. When endpoint policy requires AgentDID, include the verified credential ID
   in each signed receipt. The receipt is accepted only for the same endpoint,
   audience, SPIFFE workload, and a validity interval contained by the
   credential.
8. Use **Check key rotation** before a sensitive exchange. If either DID
   document hash changes, every Verified credential on the profile becomes
   Revoked and must be re-issued. **Revoke** ends the profile and revokes all
   remaining active credentials.

Qualification:

```bash
export DATABASE_URL='postgresql://periscan:periscan@127.0.0.1:5434/periscan'
pnpm exec vitest run --dir tests/acceptance -t 'binds W3C VC delegation' --hideSkippedTests --testTimeout=60000
```

The local lab serves real Agent Card and DID JSON over loopback, signs an ES256
VC, verifies receipt binding, rejects an excess-capability credential, rotates
the DID key, and proves automatic credential revocation. This validates the
relying-party implementation. It does not manufacture evidence that an
external partner's issuer, DNS/TLS operation, wallet, or agent implementation
is production-qualified.

## Veraison setup and operator flow

Operate Veraison as a separately hardened verification service. Its own Docker
deployment is a development topology, not a production hardening claim. Before
using Periscan, provision the verifier with the correct trust anchors,
endorsements, and evidence scheme. Place authentication and mTLS at the service
or network layer; Periscan does not persist verifier credentials.

1. In **Workflows → Agent trust**, choose a verified authorization scope.
2. Under **Verify with Veraison**, enter the verifier base URL, evidence scheme,
   workload ID, and authorization reason. Production URLs must be HTTPS;
   loopback HTTP is accepted only in development.
3. Choose **Create challenge**. Periscan calls
   `POST /challenge-response/v1/newSession?nonceSize=32`, validates the
   same-origin session `Location`, expiry, state, 8–64 byte nonce, and accepted
   media types, then stores only the nonce hash.
4. Give the displayed nonce to the real workload attester. Collect exactly one
   evidence object in one of the returned media types and base64-encode its raw
   bytes.
5. Paste those base64 bytes, select the matching media type, and optionally add
   a flat JSON object of dotted expected-claim paths, for example
   `{"deployment.secure_boot":true}`.
6. Choose **Verify evidence**. Periscan binds the session to the evidence hash,
   submits the bytes, handles synchronous `200` or bounded asynchronous `202`
   polling, re-checks the nonce, checks expected claims, persists only result
   hashes and normalized findings, and attempts remote session deletion.

If polling times out, retry the **same** evidence; different evidence is denied.
An `is_valid=false`, failed session, claim mismatch, expired nonce, cross-origin
Location, unsupported media type, or missing result never becomes Verified.

Qualification for A2A and Veraison:

```bash
export DATABASE_URL='postgresql://periscan:periscan@localhost:5434/periscan'
pnpm exec vitest run --dir tests/acceptance -t 'governs an official A2A TCK proof and a Veraison' --hideSkippedTests --testTimeout=60000
pnpm tools:qualify:agent-trust
```

The acceptance flow exercises policy, tenant persistence, the TCK proof record,
Veraison `201` session creation, `202` asynchronous polling, claim matching,
evidence hashing, normalized attestation persistence, audit events, and remote
cleanup. The qualification command invokes the actual pinned TCK against a
controlled incomplete SUT and requires a real hashed compatibility report; the
SUT is intentionally not expected to pass.

## Next OSS-backed increments

| Candidate                                 | Safe product mapping                                                                                                                 | What remains before promotion                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| A2A external implementation qualification | Run the pinned TCK against at least one customer-authorized Java, Python, or Go implementation and retain the normalized report hash | Requires an external implementation owner and test authorization; Periscan cannot manufacture that evidence         |
| AgentDID partner interoperability         | Verify a credential from a real partner issuer and bind it to a partner A2A receipt                                                  | Requires partner DNS/TLS, issuer policy, wallet/credential lifecycle, and authorized production-like endpoint       |
| Hardware-backed Veraison qualification    | Verify real PSA, CCA, SEV-SNP, and TPM evidence against provisioned endorsements and trust anchors                                   | Requires actual customer/lab hardware and verifier provisioning; software fixtures cannot substitute for possession |

The adapters are current product capabilities. External implementation success
and real hardware proof remain environment-dependent qualification, not claims
that code or a mock service can manufacture.
