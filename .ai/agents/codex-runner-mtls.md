# Codex Runner mTLS Certificate Alignment

Branch: `codex/runner-mtls-certificate-alignment`

Requirement IDs: `SRC-14-RUNNER`, `PRD-RUNNER-003`

Scope:

- Align runner implementation with the PRD section 14 mTLS/certificate requirement.
- Preserve outbound HTTPS signed-task polling.
- Do not add reverse SSH, inbound listeners, arbitrary tunnels, or shell execution.

Implemented direction:

- Runner registration and credential rotation require a CSR.
- The API issues tenant-scoped client certificates and tenant CA material.
- The runner private key is generated locally by the runner and is not sent to Periscan Cloud.
- The API stores the issued runner certificate SHA-256 fingerprint.
- Runner-authenticated API calls can require a TLS-terminator forwarded certificate fingerprint with `PERISCAN_RUNNER_REQUIRE_MTLS=true`.
- The Go runner can load mTLS CA/client certificate/client key files for outbound control-plane calls.

Validation notes:

- TypeScript/shared/API validation is expected to run in this branch.
- Go-specific validation requires a local Go toolchain; this environment currently reports `go: command not found`.
