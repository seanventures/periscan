# Periscan Terraform Provider (G6 scaffold - safe sim)

This is a safe in-repo scaffold for a Periscan Terraform provider (bi-di API/CLI/TF integrations per competitive Feature 10).

- Generated via openapi-generator sim + terraform tool.
- Full real provider would use Periscan public API (from /openapi.json).
- Here: fixture only. No credentials, no live calls. See modules for sim evidence.

## Usage (example)
```
terraform {
  required_providers {
    periscan = {
      source = "periscan/periscan"
      version = "0.1.0"
    }
  }
}

provider "periscan" {
  api_key = var.periscan_api_key # (sim; use env in real)
}

resource "periscan_evidence_pack" "example" {
  pack_id = "pack-123"
}
```

## G6 wiring
- Integrates with openapi-generator for SDKs (Go/Python/JS clients).
- Reports support multi-format exports (tf, json, yaml).
- Marketplace + connectors for bi-di.
- Safe: all via Periscan runner/modules fixtures.

See:
- packages/modules for provider_scaffold module.
- reports exportEvidencePackMultiFormat.
- PLAN/COMPLETION for track status.

All historical strings, relative paths, safety, real-first preserved.
