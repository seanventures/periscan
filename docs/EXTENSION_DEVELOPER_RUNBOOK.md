# Signed extension developer runbook

## Supported product boundary

Periscan provides a governed developer and review lifecycle for tenant-owned,
signed OCI extension contracts:

1. create a tenant-scoped project with repository, support owner, bounded
   purpose, and SPDX-format license identifier;
2. generate a deterministic scaffold whose files are individually hashed;
3. build the adapter and OCI image outside Periscan;
4. pin the image reference to its immutable SHA-256 digest;
5. keep the private signing key local and submit only the signed contract and
   public verification key;
6. pass deterministic compatibility checks;
7. record an administrator certification decision and reason;
8. select one certified version for the tenant review catalog;
9. roll back only to a previously certified superseded version; or
10. revoke a release and remove it from active catalog state.

Compatibility, certification, and catalog activation never authorize
execution. Every persisted release has **executionAuthorized: false**,
reinforced by the database constraint. A runnable extension still requires a
reviewed Periscan module binding, license/security approval, a verified
customer-authorized scope, a policy decision, runner eligibility, and a
supported parser/evidence path. Arbitrary Python or source upload is not
supported.

The digest-pinned image model follows the content-addressable design of the
[OCI Image Manifest specification](https://github.com/opencontainers/image-spec/blob/main/manifest.md).
Project license metadata uses identifiers from the
[SPDX License List](https://spdx.org/licenses/). Release inputs use
[Semantic Versioning 2.0.0](https://semver.org/).

## Create the project and scaffold

Open **Registries → Extension release pipeline**.

1. Enter the display name and unique lowercase package name.
2. Describe one bounded normalization or validation purpose.
3. Provide the reviewed source repository and support URL.
4. Enter the SPDX-format license identifier selected during legal review.
5. Choose **Create project**.
6. Choose **Generate SDK scaffold**.
7. Inspect every returned path and SHA-256 before placing the scaffold in the
   repository.

The scaffold contains:

- **extension.contract.json:** explicit capability, network, output, redaction,
  and resource declarations;
- **src/index.ts:** typed normalization entry point;
- **src/index.test.ts:** an anti-fabrication starter assertion;
- **scripts/sign-contract.mjs:** local-only canonical contract signer; and
- **README.md:** build, signing, repository, support, and license instructions.

The scaffold API returns JSON. It does not create a repository, push a branch,
upload code, build an image, or handle a private key.

## Build and sign

1. Implement the typed adapter and keep raw scanner output out of the returned
   product contract.
2. Run its local tests.
3. Build the image with provenance enabled.
4. Resolve the pushed immutable digest.
5. Put the same **sha256:...** value in **imageDigest** and after **@** in
   **imageReference**.
6. Export only the public SPKI verification key to **signerPublicKeyPem**.
7. Set **EXTENSION_SIGNING_KEY_PATH** to the local protected private key and run
   the generated signing script.
8. Paste the resulting signed JSON and semantic version into **Submit signed
   release**.

The compatibility harness checks:

- exact immutable image-reference and digest agreement;
- RSA/EC public-key signature over canonical JSON;
- explicit capability and network-allowlist agreement;
- bounded typed JSON output;
- declared redaction fields; and
- CPU, memory, timeout, and output limits within the default review envelope.

A failed release is durably retained as **CompatibilityFailed**. It cannot be
certified or activated. Correct the contract and submit a new semantic version;
immutable versions are never overwritten.

## Certify and activate

Only tenant administrators can certify, reject, activate, roll back, or revoke.

1. Review the compatibility findings, repository, support owner, license,
   signer identity, digest, permissions, allowlist, output schema, redaction,
   and resource envelope.
2. Enter a decision reason of at least ten characters.
3. Choose **Certify** or **Reject**.
4. For a certified release, choose **Activate catalog version**.

Activation supersedes the previous active version atomically. It makes the
release visible as the tenant's reviewed catalog selection; the UI continues to
show **Runtime blocked** and the API continues to return
**executionAuthorized: false**.

## Upgrade, rollback, and revoke

- **Upgrade:** submit and certify a new immutable version, then activate it. The
  previous version becomes **Superseded**.
- **Rollback:** choose **Roll back here** on a previously certified
  **Superseded** version. The current active version becomes superseded in the
  same transaction.
- **Revoke:** choose **Revoke**, type the exact version, and confirm. If the
  release is active, the project's active selection is cleared atomically.
- **Recovery:** a revoked or rejected version cannot become active. Submit a new
  version or select another certified version.

Every state-changing action emits a tenant audit event. The service never
deletes release history during these operations.

## API operations

| Operation         | Endpoint                                             |
| ----------------- | ---------------------------------------------------- |
| Read workspace    | GET /api/v1/extensions/workspace                     |
| Create project    | POST /api/v1/extensions/projects                     |
| Generate scaffold | GET /api/v1/extensions/projects/:projectId/scaffold  |
| Submit release    | POST /api/v1/extensions/projects/:projectId/releases |
| Certify/reject    | POST /api/v1/extensions/releases/:releaseId/review   |
| Activate          | POST /api/v1/extensions/releases/:releaseId/activate |
| Roll back         | POST /api/v1/extensions/projects/:projectId/rollback |
| Revoke            | POST /api/v1/extensions/releases/:releaseId/revoke   |

## Qualification

Run the focused real-PostgreSQL lifecycle:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm exec vitest run --dir tests/acceptance \
  -t "scaffolds, certifies, activates" \
  --reporter=verbose --hideSkippedTests --testTimeout=60000
```

The acceptance proof covers scaffold hashing, valid signature verification,
failed immutable-digest compatibility, prohibited certification bypass,
certification, activation, upgrade, rollback, active revocation, audit
completeness, tenant isolation, and the zero-runtime-authority invariant.

The rendered guide was also exercised against the local product: it created a
project, generated the scaffold, exposed all five paths and hashes, kept the
private-key boundary in the README, showed the four-stage release rail, and
preserved zero horizontal overflow at 390px. The browser console contained no
errors. The repository-wide accessibility journey separately covers the
registry and contextual help.

Before release, run the complete gate:

```bash
pnpm verify
```

The 2026-07-15 release gate passed with 76 web files / 253 tests, 25 API files /
331 tests, 23 shared files / 134 tests, 7 module files / 176 tests, the 53-route
production build, 94 Playwright journeys, 25 security tests, 133 acceptance
files / 172 tests, and all 134 migrations.
