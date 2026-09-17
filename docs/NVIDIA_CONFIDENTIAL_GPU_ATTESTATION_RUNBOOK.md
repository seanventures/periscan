# NVIDIA confidential-GPU attestation

Periscan verifies NVIDIA Attestation Suite output; it does not collect GPU
evidence inside the API process and does not claim that a deployment owns or
operates H100 hardware. Evidence collection remains on the authorized GPU host
using NVIDIA NVAT. The production boundary is therefore:

1. An authenticated Periscan operator creates a five-minute, one-use challenge
   for a named workload.
2. The challenge nonce is supplied to NVAT when the authorized host collects
   evidence.
3. NVAT or NRAS verifies the evidence against NVIDIA RIM and certificate
   services and returns a JSON-encoded detached EAT bundle.
4. The operator submits the complete bundle with the challenge. Periscan
   consumes the challenge exactly once, verifies the configured relying-party
   key, and evaluates every GPU token.
5. Periscan persists only normalized proof fields, findings, and a SHA-256 hash
   of the submitted bundle. It does not persist the raw bundle.

## Public contract implemented

The verifier recognizes NVIDIA claims versions 2.0 and 3.0 and requires:

- exactly one overall token and at least one `GPU-n` detached token;
- ES384 signatures under the configured NVAT relying-party public key;
- successful `x-nvidia-overall-att-result`;
- matching issuer and server-issued `eat_nonce` on the overall and device
  tokens;
- valid issue and expiry times within the tenant-selected freshness window;
- overall `submods` entries for every detached GPU;
- successful GPU architecture, report-signature, report-nonce, driver-RIM,
  vBIOS-RIM, and runtime-measurement checks;
- secure boot and disabled debug facilities when required by policy;
- an optional tenant allowlist for `hwmodel` such as `H100`.

The UI shows the claims version, GPU count and models, secure-boot state,
debug state, result, and exact policy failures. An absent trust anchor is
`NotConfigured`; a malformed, stale, mismatched, unsigned, replayed, or
policy-failing response is never shown as verified.

## Configure the relying-party key

For an NVAT local verifier, create the detached EAT with a P-384 signing key,
stable issuer, and `kid`. Inject only the corresponding public key into the API
environment. PEM newlines must be JSON escaped:

```text
PERISCAN_ATTESTATION_TRUST_ANCHORS_JSON={"NvidiaConfidentialGPU":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}
```

Rotate the key through the deployment secret/configuration manager and restart
the API. The public key is not an NVIDIA API key. `NVIDIA_API_KEY` belongs only
on an authorized collector that calls NRAS; do not put it in Periscan's EAT
bundle or trust-anchor setting.

## Operator validation

1. Open **Agent trust & interoperability** and expand **Verify an NVIDIA
   detached EAT bundle**.
2. Enter the stable workload ID and the expected issuer. Use an allowlisted
   hardware-model fragment such as `H100`.
3. Select **Generate**. Copy the displayed challenge nonce into the authorized
   NVAT collection command or SDK call before collecting evidence.
4. Paste the complete JSON-encoded detached EAT bundle and select **Verify
   bundle**.
5. Confirm the result lists every expected GPU, claims version 2.0 or 3.0,
   secure boot, disabled debug, and the expected model.
6. Submit the same bundle and challenge again. The API must reject it with
   `attestation_challenge_invalid`; a challenge is deliberately one use.

The repository acceptance test performs this path with an ES384 test signer,
then proves replay rejection. Production qualification still requires a real
supported H100-or-newer host, a supported driver/NVAT release, the selected
local or NRAS verifier, and deployment evidence.

## Primary references

- NVIDIA GPU claims guide:
  <https://docs.nvidia.com/attestation/advanced-documentation/latest/claims-guide/gpu_claims.html>
- NVIDIA detached EAT structure:
  <https://docs.nvidia.com/attestation/advanced-documentation/latest/claims-guide/introduction.html>
- NVIDIA H100 attestation example:
  <https://docs.nvidia.com/attestation/quick-start-guide/latest/attestation-examples/hopper_single_gpu.html>
- NVIDIA evidence collection:
  <https://docs.nvidia.com/attestation/quick-start-guide/latest/attestation-examples/collecting_evidence.html>
- NVAT detached EAT signing options:
  <https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/api/function_nvat_8h_1a4e6f2a2bde639cfd688a04836bffd91b.html>
